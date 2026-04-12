// src/canvas/node-renderer.ts
import { Container, Graphics, Text, TextStyle, Rectangle } from 'pixi.js'
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
import { truncateToMaxLines } from './text-utils'
import type { SharedResources } from './shared-resources'

// -- Colors --

const COLORS = {
  thinking: { bg: 0x3b3b5c, border: 0x7c7cba, text: 0xc8c8ff },
  text: { bg: 0x2d3b2d, border: 0x5c8a5c, text: 0xc8ffc8 },
  'tool-use': { bg: 0x3b3020, border: 0xba8c4c, text: 0xffd88c },
  'tool-result': { bg: 0x203038, border: 0x4c8cba, text: 0x8cd8ff },
} as const

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

// -- Main export --

export function createNodeGraphics(
  node: CanvasNode,
  pos: NodePosition,
  resources: SharedResources,
  isSelected = false,
): Container {
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
  bg.filters = isSelected ? [resources.shadowFilter, resources.glowFilter(node.type)] : [resources.shadowFilter]
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
  const icon = new Graphics(resources.iconContext(node.type))
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
  const preview = truncateToMaxLines(node.content, CHARS_PER_LINE, NODE_MAX_PREVIEW_LINES)
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

export function updateNodeSelection(
  container: Container,
  isSelected: boolean,
  nodeType: CanvasNodeType,
  resources: SharedResources,
): void {
  const bg = container.getChildByLabel('bg') as Graphics | null
  if (!bg) return
  bg.filters = isSelected ? [resources.shadowFilter, resources.glowFilter(nodeType)] : [resources.shadowFilter]
}
