// src/components/pixi-canvas.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Application, useApplication, useTick } from '@pixi/react'
import { Container, Graphics } from 'pixi.js'
import type { Ticker } from 'pixi.js'
import type { RefObject } from 'react'
import type { CanvasNode } from '@/types'
import { computeLayout } from '@/canvas/layout'
import { createNodeGraphics, updateNodeSelection } from '@/canvas/node-renderer'
import { drawEdges } from '@/canvas/edge-renderer'
import { setupViewport, scrollToBottom } from '@/canvas/viewport'
import type { ViewportState } from '@/canvas/viewport'
import { createSharedResources } from '@/canvas/shared-resources'
import type { SharedResources } from '@/canvas/shared-resources'

type CachedNode = { container: Container; height: number; content: string }

interface PixiCanvasProps {
  nodes: CanvasNode[]
  onNodeClick?: (node: CanvasNode) => void
  selectedNodeId?: string
  fpsRef: RefObject<HTMLSpanElement | null>
}

function resolveBgColor(container: HTMLElement): number {
  const el = container.closest('.bg-background') ?? document.body
  const computed = getComputedStyle(el).backgroundColor
  const offscreen = new OffscreenCanvas(1, 1)
  const ctx = offscreen.getContext('2d')
  if (ctx) {
    ctx.fillStyle = computed
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return (r << 16) | (g << 8) | b
  }
  return 0x111122
}

// PixiSceneManager: <Application> 자식 컴포넌트로서 useApplication() 사용
// 모든 PixiJS 렌더링 로직을 담당하며 JSX를 반환하지 않음
function PixiSceneManager({ nodes, onNodeClick, selectedNodeId, fpsRef }: PixiCanvasProps): null {
  const { app } = useApplication()
  const [world, setWorld] = useState<Container | null>(null)
  const [edgeGraphics, setEdgeGraphics] = useState<Graphics | null>(null)
  const [resources, setResources] = useState<SharedResources | null>(null)

  const nodeContainersRef = useRef<Map<string, CachedNode>>(new Map())
  const viewportStateRef = useRef<ViewportState>({ autoScroll: true })
  const prevSelectedRef = useRef<string | null>(null)
  const prevNodesRef = useRef<CanvasNode[]>([])
  const lastFpsReportRef = useRef(0)

  // 콜백 ref 패턴 — stale closure 방지
  const selectedNodeIdRef = useRef(selectedNodeId)
  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  const onNodeClickRef = useRef(onNodeClick)
  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  const nodesRef = useRef(nodes)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // 배경색: app.renderer에 직접 설정 (타이밍 문제 없이 초기화 이후 적용)
  useEffect(() => {
    const canvasEl = app.canvas as HTMLCanvasElement
    const container = canvasEl.parentElement
    if (container) {
      app.renderer.background.color = resolveBgColor(container)
    }
  }, [app])

  // world, edgeGraphics, SharedResources 초기화
  useEffect(() => {
    const w = new Container()
    w.isRenderGroup = true
    app.stage.addChild(w)

    const eg = new Graphics()
    w.addChild(eg)

    const res = createSharedResources()

    setWorld(w)
    setEdgeGraphics(eg)
    setResources(res)

    return () => {
      res.destroy()
      w.destroy({ children: true })
    }
  }, [app])

  // FPS 보고 — R3F 패턴: useCallback memoize + ref mutation (setState 없음)
  useTick(
    useCallback((ticker: Ticker) => {
      const now = performance.now()
      if (now - lastFpsReportRef.current >= 1000) {
        lastFpsReportRef.current = now
        if (fpsRef.current) {
          fpsRef.current.textContent = `${Math.round(ticker.FPS)} FPS`
        }
      }
    }, []),
  )

  // 뷰포트 설정 — world 준비 완료 시
  useEffect(() => {
    if (!world) return
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
    if (viewportStateRef.current.autoScroll) {
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

  return null
}

// PixiCanvas: <Application>을 마운트하는 외부 컴포넌트
// useApplication()은 자식인 PixiSceneManager에서만 호출 가능
export function PixiCanvas({ nodes, onNodeClick, selectedNodeId, fpsRef }: PixiCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      <Application resizeTo={containerRef} antialias autoDensity resolution={window.devicePixelRatio || 1}>
        <PixiSceneManager nodes={nodes} onNodeClick={onNodeClick} selectedNodeId={selectedNodeId} fpsRef={fpsRef} />
      </Application>
    </div>
  )
}
