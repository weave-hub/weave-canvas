// src/canvas/shared-resources.ts
// PixiJS Application과 동일한 라이프사이클로 관리되는 공유 GPU 리소스
// usePixiApp 훅에서 생성/파괴하여 모듈 레벨 싱글톤 누수를 방지

import { GraphicsContext } from 'pixi.js'
import { DropShadowFilter, GlowFilter } from 'pixi-filters'
import type { CanvasNodeType } from '@/types'

export type SharedResources = {
  readonly shadowFilter: DropShadowFilter
  glowFilter(type: CanvasNodeType): GlowFilter
  iconContext(type: CanvasNodeType): GraphicsContext
  destroy(): void
}

function createIconContext(type: CanvasNodeType): GraphicsContext {
  const ctx = new GraphicsContext()

  switch (type) {
    case 'thinking':
      ctx.circle(8, 8, 7)
      ctx.stroke({ color: 0xc8c8ff, width: 1.5 })
      ctx.moveTo(4, 7)
      ctx.bezierCurveTo(6, 5, 10, 9, 12, 7)
      ctx.stroke({ color: 0xc8c8ff, width: 1 })
      ctx.moveTo(4, 10)
      ctx.bezierCurveTo(6, 8, 10, 12, 12, 10)
      ctx.stroke({ color: 0xc8c8ff, width: 1 })
      break
    case 'text':
      ctx.moveTo(2, 4)
      ctx.lineTo(14, 4)
      ctx.stroke({ color: 0xc8ffc8, width: 1.5 })
      ctx.moveTo(2, 8)
      ctx.lineTo(14, 8)
      ctx.stroke({ color: 0xc8ffc8, width: 1.5 })
      ctx.moveTo(2, 12)
      ctx.lineTo(10, 12)
      ctx.stroke({ color: 0xc8ffc8, width: 1.5 })
      break
    case 'tool-use':
      ctx.moveTo(4, 12)
      ctx.lineTo(10, 6)
      ctx.stroke({ color: 0xffd88c, width: 2 })
      ctx.circle(11, 5, 3)
      ctx.stroke({ color: 0xffd88c, width: 1.5 })
      break
    case 'tool-result':
      ctx.moveTo(3, 8)
      ctx.lineTo(6, 12)
      ctx.lineTo(13, 4)
      ctx.stroke({ color: 0x8cd8ff, width: 2 })
      break
  }

  return ctx
}

const glowColors: Record<CanvasNodeType, number> = {
  thinking: 0x7c7cba,
  text: 0x5c8a5c,
  'tool-use': 0xba8c4c,
  'tool-result': 0x4c8cba,
}

export function createSharedResources(): SharedResources {
  let shadow: DropShadowFilter | null = null
  let glowFilters: Partial<Record<CanvasNodeType, GlowFilter>> = {}
  let iconContexts: Partial<Record<CanvasNodeType, GraphicsContext>> = {}

  return {
    get shadowFilter(): DropShadowFilter {
      if (!shadow) {
        shadow = new DropShadowFilter({
          offset: { x: 3, y: 4 },
          blur: 6,
          alpha: 0.35,
          color: 0x000000,
        })
      }
      return shadow
    },

    glowFilter(type: CanvasNodeType): GlowFilter {
      if (!glowFilters[type]) {
        glowFilters[type] = new GlowFilter({
          outerStrength: 0.8,
          color: glowColors[type],
          distance: 15,
          quality: 0.2,
        })
      }
      return glowFilters[type]
    },

    iconContext(type: CanvasNodeType): GraphicsContext {
      if (!iconContexts[type]) {
        iconContexts[type] = createIconContext(type)
      }
      return iconContexts[type]
    },

    destroy() {
      shadow?.destroy()
      shadow = null
      for (const filter of Object.values(glowFilters)) {
        filter?.destroy()
      }
      glowFilters = {}
      for (const ctx of Object.values(iconContexts)) {
        ctx?.destroy()
      }
      iconContexts = {}
    },
  }
}
