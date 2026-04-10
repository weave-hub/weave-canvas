// src/canvas/measure-node-height.ts
import type { CanvasNode } from '@/types'
import {
  NODE_MIN_HEIGHT,
  NODE_PADDING,
  NODE_HEADER_HEIGHT,
  NODE_LINE_HEIGHT,
  NODE_MAX_PREVIEW_LINES,
  CHARS_PER_LINE,
} from './constants'

function countWrappedLines(text: string): number {
  if (!text) return 0

  const lines = text.split('\n')
  let total = 0

  for (const line of lines) {
    if (line.length === 0) {
      total += 1
    } else {
      total += Math.ceil(line.length / CHARS_PER_LINE)
    }
    if (total >= NODE_MAX_PREVIEW_LINES) return NODE_MAX_PREVIEW_LINES
  }

  return Math.min(total, NODE_MAX_PREVIEW_LINES)
}

export function measureNodeHeight(node: CanvasNode): number {
  const previewLines = countWrappedLines(node.content)
  const contentHeight = previewLines > 0 ? previewLines * NODE_LINE_HEIGHT : 0

  // header + separator gap + content + bottom padding
  const calculated = NODE_PADDING + NODE_HEADER_HEIGHT + 4 + contentHeight + NODE_PADDING

  return Math.max(NODE_MIN_HEIGHT, calculated)
}
