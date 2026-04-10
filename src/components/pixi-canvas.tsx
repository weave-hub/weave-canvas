// src/components/pixi-canvas.tsx
import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import type { CanvasNode } from '@/types'
import { computeLayout } from '@/canvas/layout'
import { createNodeGraphics } from '@/canvas/node-renderer'
import { drawEdges } from '@/canvas/edge-renderer'
import { setupViewport, scrollToBottom } from '@/canvas/viewport'
import type { ViewportState } from '@/canvas/viewport'

type PixiCanvasProps = {
  nodes: CanvasNode[]
  onNodeClick?: (node: CanvasNode) => void
  onFpsUpdate?: (fps: number) => void
}

export function PixiCanvas({ nodes, onNodeClick, onFpsUpdate }: PixiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const edgeGraphicsRef = useRef<Graphics | null>(null)
  const nodeContainersRef = useRef<Map<string, Container>>(new Map())
  const viewportStateRef = useRef<ViewportState>({ autoScroll: true })
  const cleanupViewportRef = useRef<(() => void) | null>(null)
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
    // Canvas 2D fillStyle은 어떤 CSS color든 #rrggbb로 정규화
    const bgHex = (() => {
      const computed = getComputedStyle(document.body).backgroundColor
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
    for (const [id, container] of existing) {
      if (!currentIds.has(id)) {
        world.removeChild(container)
        container.destroy({ children: true })
        existing.delete(id)
      }
    }

    // 새 노드만 생성, 기존 노드는 위치 업데이트
    for (const pos of layout.positions) {
      const node = nodeMap.get(pos.nodeId)
      if (!node) continue

      const cached = existing.get(pos.nodeId)
      if (cached) {
        cached.x = pos.x
        cached.y = pos.y
      } else {
        const gfx = createNodeGraphics(node, pos)
        gfx.on('pointertap', () => {
          onNodeClickRef.current?.(node)
        })
        world.addChild(gfx)
        existing.set(pos.nodeId, gfx)
      }
    }

    // 엣지 렌더링 (단일 Graphics — 전체 다시 그려도 저비용)
    drawEdges(edgeGraphics, layout.edges, posMap)

    // 자동 스크롤
    if (viewportStateRef.current.autoScroll) {
      const canvas = app.canvas as HTMLCanvasElement
      scrollToBottom(world, canvas.height / (window.devicePixelRatio || 1), layout.totalHeight)
    }
  }, [nodes])

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />
}
