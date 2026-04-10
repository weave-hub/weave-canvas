// src/canvas/node-renderer.ts
import { Container, Graphics, GraphicsContext, Text, TextStyle, Rectangle } from 'pixi.js'
import { DropShadowFilter, GlowFilter } from 'pixi-filters'
import type { CanvasNode, CanvasNodeType } from '@/types'
import type { NodePosition } from './layout'
import {
  NODE_PADDING,
  NODE_HEADER_HEIGHT,
  NODE_MAX_PREVIEW_LINES,
  ICON_SIZE,
  NODE_WIDTH,
  CHARS_PER_LINE,
} from './constants'

// -- Colors --

const COLORS = {
  thinking: { bg: 0x3b3b5c, border: 0x7c7cba, text: 0xc8c8ff },
  text: { bg: 0x2d3b2d, border: 0x5c8a5c, text: 0xc8ffc8 },
  'tool-use': { bg: 0x3b3020, border: 0xba8c4c, text: 0xffd88c },
  'tool-result': { bg: 0x203038, border: 0x4c8cba, text: 0x8cd8ff },
} as const

// -- Lazy-initialized shared filter instances --
// DropShadowFilter/GlowFilter may reference GPU resources internally,
// so we defer creation until first use (after PixiJS renderer init).

let _shadowFilter: DropShadowFilter | null = null
function getShadowFilter(): DropShadowFilter {
  if (!_shadowFilter) {
    _shadowFilter = new DropShadowFilter({
      offset: { x: 3, y: 4 },
      blur: 6,
      alpha: 0.35,
      color: 0x000000,
    })
  }
  return _shadowFilter
}

let _glowFilters: Record<CanvasNodeType, GlowFilter> | null = null
function getGlowFilter(type: CanvasNodeType): GlowFilter {
  if (!_glowFilters) {
    _glowFilters = {
      thinking: new GlowFilter({ outerStrength: 0.8, color: 0x7c7cba, distance: 15, quality: 0.2 }),
      text: new GlowFilter({ outerStrength: 0.8, color: 0x5c8a5c, distance: 15, quality: 0.2 }),
      'tool-use': new GlowFilter({ outerStrength: 0.8, color: 0xba8c4c, distance: 15, quality: 0.2 }),
      'tool-result': new GlowFilter({ outerStrength: 0.8, color: 0x4c8cba, distance: 15, quality: 0.2 }),
    }
  }
  return _glowFilters[type]
}

// -- Shared icon GraphicsContext instances (16x16, drawn once) --

function createThinkingIconContext(): GraphicsContext {
  const ctx = new GraphicsContext()
  // Circle (brain symbol)
  ctx.circle(8, 8, 7)
  ctx.stroke({ color: 0xc8c8ff, width: 1.5 })
  // Inner wave lines
  ctx.moveTo(4, 7)
  ctx.bezierCurveTo(6, 5, 10, 9, 12, 7)
  ctx.stroke({ color: 0xc8c8ff, width: 1 })
  ctx.moveTo(4, 10)
  ctx.bezierCurveTo(6, 8, 10, 12, 12, 10)
  ctx.stroke({ color: 0xc8c8ff, width: 1 })
  return ctx
}

function createTextIconContext(): GraphicsContext {
  const ctx = new GraphicsContext()
  // Three horizontal lines (text symbol)
  ctx.moveTo(2, 4)
  ctx.lineTo(14, 4)
  ctx.stroke({ color: 0xc8ffc8, width: 1.5 })
  ctx.moveTo(2, 8)
  ctx.lineTo(14, 8)
  ctx.stroke({ color: 0xc8ffc8, width: 1.5 })
  ctx.moveTo(2, 12)
  ctx.lineTo(10, 12)
  ctx.stroke({ color: 0xc8ffc8, width: 1.5 })
  return ctx
}

function createToolUseIconContext(): GraphicsContext {
  const ctx = new GraphicsContext()
  // Wrench symbol
  ctx.moveTo(4, 12)
  ctx.lineTo(10, 6)
  ctx.stroke({ color: 0xffd88c, width: 2 })
  ctx.circle(11, 5, 3)
  ctx.stroke({ color: 0xffd88c, width: 1.5 })
  return ctx
}

function createToolResultIconContext(): GraphicsContext {
  const ctx = new GraphicsContext()
  // Checkmark symbol
  ctx.moveTo(3, 8)
  ctx.lineTo(6, 12)
  ctx.lineTo(13, 4)
  ctx.stroke({ color: 0x8cd8ff, width: 2 })
  return ctx
}

const ICON_CONTEXTS: Record<CanvasNodeType, GraphicsContext> = {
  thinking: createThinkingIconContext(),
  text: createTextIconContext(),
  'tool-use': createToolUseIconContext(),
  'tool-result': createToolResultIconContext(),
}

// -- Text styles --

const LABEL_STYLE = new TextStyle({
  fontFamily: 'sans-serif',
  fontSize: 13,
  fontWeight: 'bold',
  wordWrap: true,
  wordWrapWidth: NODE_WIDTH - 2 * NODE_PADDING - ICON_SIZE - 8,
})

const PREVIEW_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 12,
  wordWrap: true,
  wordWrapWidth: NODE_WIDTH - 2 * NODE_PADDING,
  lineHeight: 18,
  fill: 0xbbbbbb,
})

// -- Helpers --

function truncatePreview(content: string): string {
  const lines = content.split('\n')
  const taken: string[] = []
  let lineCount = 0

  for (const line of lines) {
    if (lineCount >= NODE_MAX_PREVIEW_LINES) break
    taken.push(line)
    const wrapped = line.length === 0 ? 1 : Math.ceil(line.length / CHARS_PER_LINE)
    lineCount += wrapped
  }

  let result = taken.join('\n')
  if (lineCount > NODE_MAX_PREVIEW_LINES || taken.length < lines.length) {
    result = result.trimEnd() + '...'
  }
  return result
}

// -- Main export --

export function createNodeGraphics(node: CanvasNode, pos: NodePosition, isSelected = false): Container {
  const container = new Container()
  container.x = pos.x
  container.y = pos.y
  container.label = node.id
  container.eventMode = 'static'
  container.cursor = 'pointer'

  const colors = COLORS[node.type]

  // Background
  const bg = new Graphics()
  bg.label = 'bg'
  bg.roundRect(0, 0, pos.width, pos.height, 10)
  bg.fill({ color: colors.bg, alpha: 0.95 })
  bg.stroke({ color: colors.border, width: 2 })
  bg.filters = isSelected ? [getShadowFilter(), getGlowFilter(node.type)] : [getShadowFilter()]
  const filterPad = 16
  bg.filterArea = new Rectangle(-filterPad, -filterPad, pos.width + 2 * filterPad, pos.height + 2 * filterPad)
  container.addChild(bg)

  // Header separator line
  const headerY = NODE_PADDING + NODE_HEADER_HEIGHT
  const headerLine = new Graphics()
  headerLine.moveTo(NODE_PADDING, headerY)
  headerLine.lineTo(pos.width - NODE_PADDING, headerY)
  headerLine.stroke({ color: colors.border, width: 1, alpha: 0.3 })
  container.addChild(headerLine)

  // Type icon
  const icon = new Graphics(ICON_CONTEXTS[node.type])
  icon.x = NODE_PADDING
  icon.y = NODE_PADDING + (NODE_HEADER_HEIGHT - ICON_SIZE) / 2
  container.addChild(icon)

  // Type label
  const typeLabel = node.type === 'tool-use' ? (node.toolName ?? 'Tool') : node.type
  const label = new Text({
    text: typeLabel,
    style: { ...LABEL_STYLE, fill: colors.text },
  })
  label.x = NODE_PADDING + ICON_SIZE + 8
  label.y = NODE_PADDING + (NODE_HEADER_HEIGHT - 16) / 2
  container.addChild(label)

  // Duration badge (tool-result only)
  if (node.type === 'tool-result' && node.durationMs) {
    const badge = new Text({
      text: `${node.durationMs}ms`,
      style: { ...LABEL_STYLE, fontSize: 10, fontWeight: 'normal', fill: 0x999999 },
    })
    badge.x = label.x + label.width + 8
    badge.y = label.y + 2
    container.addChild(badge)
  }

  // Content preview
  const preview = truncatePreview(node.content)
  if (preview) {
    const previewText = new Text({
      text: preview,
      style: PREVIEW_STYLE,
    })
    previewText.x = NODE_PADDING
    previewText.y = headerY + 4
    container.addChild(previewText)
  }

  // Hover effects
  container.on('pointerover', () => {
    bg.tint = 0xcccccc
  })
  container.on('pointerout', () => {
    bg.tint = 0xffffff
  })

  return container
}

export function updateNodeSelection(container: Container, isSelected: boolean, nodeType: CanvasNodeType): void {
  const bg = container.getChildByLabel('bg') as Graphics | null
  if (!bg) return
  bg.filters = isSelected ? [getShadowFilter(), getGlowFilter(nodeType)] : [getShadowFilter()]
}
