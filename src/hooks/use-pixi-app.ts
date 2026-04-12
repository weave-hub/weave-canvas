// src/hooks/use-pixi-app.ts
// PixiJS Application 라이프사이클을 관리하는 커스텀 훅
// init 완료 시 setState로 리렌더를 트리거하여 nodes effect의 레이스 컨디션 해결

import { type RefObject, useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { createSharedResources, type SharedResources } from '@/canvas/shared-resources'

export type UsePixiAppResult = {
  app: Application | null
  world: Container | null
  edgeGraphics: Graphics | null
  resources: SharedResources | null
  error: Error | null
}

const initialResult: UsePixiAppResult = {
  app: null,
  world: null,
  edgeGraphics: null,
  resources: null,
  error: null,
}

function resolveBgColor(container: HTMLElement): number {
  const el = container.closest('.bg-background') ?? document.body
  const computed = getComputedStyle(el).backgroundColor
  const canvas = new OffscreenCanvas(1, 1)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = computed
    // OffscreenCanvas fillStyle은 항상 CSS 색상 문자열 반환
    // 2d context에서 hex 변환을 위해 1px 채우고 픽셀 데이터 읽기
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return (r << 16) | (g << 8) | b
  }
  return 0x111122
}

export function usePixiApp(
  containerRef: RefObject<HTMLDivElement | null>,
  onFpsUpdateRef: RefObject<((fps: number) => void) | undefined>,
): UsePixiAppResult {
  const [result, setResult] = useState<UsePixiAppResult>(initialResult)
  const resourcesRef = useRef<SharedResources | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let cancelled = false

    const bgHex = resolveBgColor(container)

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

        const world = new Container()
        world.label = 'world'
        world.isRenderGroup = true
        app.stage.addChild(world)

        const edgeGraphics = new Graphics()
        edgeGraphics.label = 'edges'
        world.addChild(edgeGraphics)

        const resources = createSharedResources()
        resourcesRef.current = resources

        // FPS 모니터링 (~1초 간격 throttle)
        let lastFpsReport = 0
        app.ticker.add((ticker) => {
          const now = performance.now()
          if (now - lastFpsReport >= 1000) {
            lastFpsReport = now
            onFpsUpdateRef.current?.(Math.round(ticker.FPS))
          }
        })

        setResult({ app, world, edgeGraphics, resources, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({
            app: null,
            world: null,
            edgeGraphics: null,
            resources: null,
            error: err instanceof Error ? err : new Error(String(err)),
          })
        }
      })

    return () => {
      cancelled = true
      resourcesRef.current?.destroy()
      resourcesRef.current = null
      app.destroy(true, { children: true })
      // StrictMode 재마운트 시 잔여 캔버스 제거
      while (container.firstChild) {
        container.removeChild(container.firstChild)
      }
      setResult(initialResult)
    }
  }, [containerRef, onFpsUpdateRef])

  return result
}
