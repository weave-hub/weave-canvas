// src/components/pixi-canvas.tsx
import { useEffect, useRef } from 'react'
import type { Container } from 'pixi.js'
import type { CanvasNode } from '@/types'
import { computeLayout } from '@/canvas/layout'
import { createNodeGraphics, updateNodeSelection } from '@/canvas/node-renderer'
import { drawEdges } from '@/canvas/edge-renderer'
import { setupViewport, scrollToBottom } from '@/canvas/viewport'
import type { ViewportState } from '@/canvas/viewport'
import { usePixiApp } from '@/hooks/use-pixi-app'

type CachedNode = { container: Container; height: number; content: string }

interface PixiCanvasProps {
  nodes: CanvasNode[]
  onNodeClick?: (node: CanvasNode) => void
  onFpsUpdate?: (fps: number) => void
  selectedNodeId?: string
}

export function PixiCanvas({ nodes, onNodeClick, onFpsUpdate, selectedNodeId }: PixiCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeContainersRef = useRef<Map<string, CachedNode>>(new Map())
  const viewportStateRef = useRef<ViewportState>({ autoScroll: true })
  const prevSelectedRef = useRef<string | null>(null)
  const prevNodesRef = useRef<CanvasNode[]>([])

  // 콜백 ref 패턴 — stale closure 방지
  const selectedNodeIdRef = useRef(selectedNodeId)
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  const onNodeClickRef = useRef(onNodeClick)
  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  const onFpsUpdateRef = useRef(onFpsUpdate)
  useEffect(() => {
    onFpsUpdateRef.current = onFpsUpdate
  }, [onFpsUpdate])

  const nodesRef = useRef(nodes)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // PixiJS Application 라이프사이클
  const { app, world, edgeGraphics, resources, error } = usePixiApp(containerRef, onFpsUpdateRef)

  // 뷰포트 설정 — app/world 준비 완료 시
  useEffect(() => {
    if (!world || !app) return
    const canvas = app.canvas as HTMLCanvasElement
    const cleanup = setupViewport(world, canvas, viewportStateRef.current)
    return cleanup
  }, [world, app])

  // 노드 변경 시 캔버스 업데이트 (diff 기반 incremental)
  useEffect(() => {
    if (!world || !edgeGraphics || !resources) return
    if (nodes === prevNodesRef.current) return
    prevNodesRef.current = nodes

    if (nodes.length === 0) return

    // 레이아웃 계산
    const layout = computeLayout(nodes)

    const posMap = new Map(layout.positions.map((p) => [p.nodeId, p]))
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const existing = nodeContainersRef.current
    const currentIds = new Set(layout.positions.map((p) => p.nodeId))

    // 삭제된 노드 제거
    for (const [id, cached] of existing) {
      if (!currentIds.has(id)) {
        world.removeChild(cached.container)
        cached.container.destroy({ children: true })
        existing.delete(id)
      }
    }

    // 새 노드만 생성, 기존 노드는 위치 업데이트
    for (const pos of layout.positions) {
      const node = nodeMap.get(pos.nodeId)
      if (!node) continue

      const cached = existing.get(pos.nodeId)
      if (cached) {
        if (cached.height !== pos.height || cached.content !== node.content) {
          // 높이 또는 콘텐츠 변경 -> destroy 후 재생성
          world.removeChild(cached.container)
          cached.container.destroy({ children: true })
          existing.delete(pos.nodeId)
        } else {
          cached.container.x = pos.x
          cached.container.y = pos.y
          continue
        }
      }

      const isSelected = pos.nodeId === selectedNodeIdRef.current
      const gfx = createNodeGraphics(node, pos, resources, isSelected)
      gfx.on('pointertap', () => {
        onNodeClickRef.current?.(node)
      })
      world.addChild(gfx)
      existing.set(pos.nodeId, { container: gfx, height: pos.height, content: node.content })
    }

    // 엣지 렌더링 (단일 Graphics — 전체 다시 그려도 저비용)
    drawEdges(edgeGraphics, layout.edges, posMap)

    // 자동 스크롤
    if (viewportStateRef.current.autoScroll && app) {
      const canvas = app.canvas as HTMLCanvasElement
      scrollToBottom(world, canvas.height / (window.devicePixelRatio || 1), layout.totalHeight)
    }
  }, [nodes, world, edgeGraphics, resources, app])

  // 선택 변경 시 필터만 교체 (노드 재생성 없이)
  useEffect(() => {
    if (!resources) return
    const existing = nodeContainersRef.current
    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]))

    if (prevSelectedRef.current && prevSelectedRef.current !== selectedNodeId) {
      const prev = existing.get(prevSelectedRef.current)
      const prevNode = nodeMap.get(prevSelectedRef.current)
      if (prev && prevNode) updateNodeSelection(prev.container, false, prevNode.type, resources)
    }
    if (selectedNodeId) {
      const sel = existing.get(selectedNodeId)
      const selNode = nodeMap.get(selectedNodeId)
      if (sel && selNode) updateNodeSelection(sel.container, true, selNode.type, resources)
    }
    prevSelectedRef.current = selectedNodeId ?? null
  }, [selectedNodeId, resources])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Canvas initialization failed: {error.message}</p>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />
}
