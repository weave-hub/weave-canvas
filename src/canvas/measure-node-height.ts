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
import { countWrappedLines } from './text-utils'

export function measureNodeHeight(node: CanvasNode): number {
  const previewLines = countWrappedLines(node.content, CHARS_PER_LINE, NODE_MAX_PREVIEW_LINES)
  const contentHeight = previewLines > 0 ? previewLines * NODE_LINE_HEIGHT : 0

  // header + separator gap + content + bottom padding
  const calculated = NODE_PADDING + NODE_HEADER_HEIGHT + 4 + contentHeight + NODE_PADDING

  return Math.max(NODE_MIN_HEIGHT, calculated)
}
