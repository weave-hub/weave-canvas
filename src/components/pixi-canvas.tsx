import { useEffect, useRef } from 'react'
import { Application } from 'pixi.js'
import { Viewport } from '../canvas/viewport'
import { SceneManager } from '../canvas/scene-manager'
import type { FileChangeEvent } from '../types'

interface PixiCanvasProps {
  events: FileChangeEvent[]
}

export function PixiCanvas({ events }: PixiCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const sceneRef = useRef<SceneManager | null>(null)
  const processedCount = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let cancelled = false

    app
      .init({
        background: 0x111122,
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

        const viewport = new Viewport()
        viewport.bindToCanvas(app.canvas as HTMLCanvasElement)
        app.stage.addChild(viewport)

        viewportRef.current = viewport
        sceneRef.current = new SceneManager(viewport)
      })

    return () => {
      cancelled = true
      if (viewportRef.current) {
        viewportRef.current.unbindFromCanvas()
        viewportRef.current = null
      }
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
        sceneRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const newEvents = events.slice(processedCount.current)
    processedCount.current = events.length

    for (const event of newEvents) {
      for (let i = 0; i < event.paths.length; i++) {
        const filePath = event.paths[i]
        const fileName = filePath.split(/[/\\]/).pop() ?? filePath
        const kindShort = event.kind.split('(')[0]
        const id = `${event.session_id}-${Date.now()}-${i}`

        scene.addNode({
          id,
          label: `${kindShort}: ${fileName}`,
          x: 100 + Math.random() * 500,
          y: 100 + Math.random() * 300,
        })
      }
    }
  }, [events])

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />
}
