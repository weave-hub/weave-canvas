// src/components/pixi-canvas.tsx
import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import type { CanvasNode } from '@/types'
import { computeLayout } from '@/canvas/layout'
import { createNodeGraphics, updateNodeSelection } from '@/canvas/node-renderer'
import { drawEdges } from '@/canvas/edge-renderer'
import { setupViewport, scrollToBottom } from '@/canvas/viewport'
import type { ViewportState } from '@/canvas/viewport'

type CachedNode = { container: Container; height: number; content: string }

type PixiCanvasProps = {
  nodes: CanvasNode[]
  onNodeClick?: (node: CanvasNode) => void
  onFpsUpdate?: (fps: number) => void
  selectedNodeId?: string
}

export function PixiCanvas({ nodes, onNodeClick, onFpsUpdate, selectedNodeId }: PixiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const edgeGraphicsRef = useRef<Graphics | null>(null)
  const nodeContainersRef = useRef<Map<string, CachedNode>>(new Map())
  const viewportStateRef = useRef<ViewportState>({ autoScroll: true })
  const cleanupViewportRef = useRef<(() => void) | null>(null)
  const prevSelectedRef = useRef<string | null>(null)
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

  // PixiJS Application 초기화
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    const nodeContainers = nodeContainersRef.current
    let cancelled = false

    // CSS oklch() 등을 PixiJS가 인식하는 hex로 변환
    // 부모 컨테이너 또는 최상위 bg-background 요소에서 배경색을 읽음
    const bgHex = (() => {
      const el = container.closest('.bg-background') ?? document.body
      const computed = getComputedStyle(el).backgroundColor
      const ctx = document.createElement('canvas').getContext('2d')
      if (ctx) {
        ctx.fillStyle = computed
        const hex = ctx.fillStyle
        if (hex.startsWith('#')) {
          return parseInt(hex.slice(1, 7), 16)
        }
      }
      return 0x111122
    })()

    app
      .init({
        background: bgHex,
        resizeTo: container,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true)
          return
        }

        container.appendChild(app.canvas as HTMLCanvasElement)
        appRef.current = app

        const world = new Container()
        world.label = 'world'
        world.isRenderGroup = true
        app.stage.addChild(world)
        worldRef.current = world

        const edgeGraphics = new Graphics()
        edgeGraphics.label = 'edges'
        world.addChild(edgeGraphics)
        edgeGraphicsRef.current = edgeGraphics

        // 뷰포트 설정
        cleanupViewportRef.current = setupViewport(world, app.canvas as HTMLCanvasElement, viewportStateRef.current)

        // FPS 모니터링 (~1초 간격 throttle)
        let lastFpsReport = 0
        app.ticker.add((ticker) => {
          const now = performance.now()
          if (now - lastFpsReport >= 1000) {
            lastFpsReport = now
            onFpsUpdateRef.current?.(Math.round(ticker.FPS))
          }
        })
      })

    return () => {
      cancelled = true
      cleanupViewportRef.current?.()
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
      // StrictMode 재마운트 시 잔여 캔버스 제거
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
      worldRef.current = null
      edgeGraphicsRef.current = null
      nodeContainers.clear()
    }
  }, [])

  // 노드 변경 시 캔버스 업데이트 (diff 기반 incremental)
  useEffect(() => {
    const world = worldRef.current
    const edgeGraphics = edgeGraphicsRef.current
    const app = appRef.current
    if (!world || !edgeGraphics || !app) return

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
      const gfx = createNodeGraphics(node, pos, isSelected)
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
  }, [nodes])

  // 선택 변경 시 필터만 교체 (노드 재생성 없이)
  // nodes를 의존성에서 제외: 노드 생성/재생성 시 이미 isSelected 반영됨
  const nodesRef = useRef(nodes)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    const existing = nodeContainersRef.current
    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]))

    if (prevSelectedRef.current && prevSelectedRef.current !== selectedNodeId) {
      const prev = existing.get(prevSelectedRef.current)
      const prevNode = nodeMap.get(prevSelectedRef.current)
      if (prev && prevNode) updateNodeSelection(prev.container, false, prevNode.type)
    }
    if (selectedNodeId) {
      const sel = existing.get(selectedNodeId)
      const selNode = nodeMap.get(selectedNodeId)
      if (sel && selNode) updateNodeSelection(sel.container, true, selNode.type)
    }
    prevSelectedRef.current = selectedNodeId ?? null
  }, [selectedNodeId])

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />
}
