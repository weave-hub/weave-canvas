// src/canvas/node-renderer.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { CanvasNode } from '@/types'
import type { NodePosition } from './layout'

const COLORS = {
  thinking: { bg: 0x3b3b5c, border: 0x7c7cba, text: 0xc8c8ff },
  text: { bg: 0x2d3b2d, border: 0x5c8a5c, text: 0xc8ffc8 },
  'tool-use': { bg: 0x3b3020, border: 0xba8c4c, text: 0xffd88c },
  'tool-result': { bg: 0x203038, border: 0x4c8cba, text: 0x8cd8ff },
} as const

const LABEL_STYLE = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 12,
  wordWrap: true,
  wordWrapWidth: 180,
})

export function createNodeGraphics(node: CanvasNode, pos: NodePosition): Container {
  const container = new Container()
  container.x = pos.x
  container.y = pos.y
  container.label = node.id
  container.eventMode = 'static'
  container.cursor = 'pointer'

  const colors = COLORS[node.type]

  // 배경
  const bg = new Graphics()
  bg.roundRect(0, 0, pos.width, pos.height, 8)
  bg.fill({ color: colors.bg, alpha: 0.9 })
  bg.stroke({ color: colors.border, width: 1.5 })
  container.addChild(bg)

  // 타입 라벨
  const typeLabel = node.type === 'tool-use' ? (node.toolName ?? 'Tool') : node.type
  const durationSuffix = node.type === 'tool-result' && node.durationMs ? ` (${node.durationMs}ms)` : ''

  const label = new Text({
    text: `${typeLabel}${durationSuffix}`,
    style: { ...LABEL_STYLE, fontSize: 11, fill: colors.text },
  })
  label.x = 8
  label.y = 6
  container.addChild(label)

  // 내용 미리보기 (1줄)
  const preview = node.content.split('\n')[0].slice(0, 40)
  if (preview) {
    const previewText = new Text({
      text: preview,
      style: { ...LABEL_STYLE, fontSize: 10, fill: 0x999999 },
    })
    previewText.x = 8
    previewText.y = 28
    container.addChild(previewText)
  }

  return container
}
