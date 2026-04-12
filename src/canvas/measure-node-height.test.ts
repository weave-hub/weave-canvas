import { measureNodeHeight } from './measure-node-height'
import { NODE_MIN_HEIGHT, NODE_PADDING, NODE_HEADER_HEIGHT, NODE_LINE_HEIGHT } from './constants'
import type { CanvasNode } from '@/types'

function makeNode(content: string, type: CanvasNode['type'] = 'text'): CanvasNode {
  return {
    id: 'test-id',
    sessionId: 'session-1',
    agentId: '',
    type,
    timestamp: Date.now(),
    content,
  }
}

describe('measureNodeHeight()', () => {
  it('returns NODE_MIN_HEIGHT for empty content', () => {
    expect(measureNodeHeight(makeNode(''))).toBe(NODE_MIN_HEIGHT)
  })

  it('returns NODE_MIN_HEIGHT for very short content', () => {
    // 1 line: 12 + 28 + 4 + 18 + 12 = 74 > 70
    const expected = NODE_PADDING + NODE_HEADER_HEIGHT + 4 + NODE_LINE_HEIGHT + NODE_PADDING
    expect(measureNodeHeight(makeNode('hello'))).toBe(expected)
  })

  it('increases height with more content lines', () => {
    const oneLineHeight = measureNodeHeight(makeNode('hello'))
    const twoLineHeight = measureNodeHeight(makeNode('line1\nline2'))
    expect(twoLineHeight).toBe(oneLineHeight + NODE_LINE_HEIGHT)
  })

  it('caps at max preview lines', () => {
    const fourLines = measureNodeHeight(makeNode('a\nb\nc\nd'))
    const tenLines = measureNodeHeight(makeNode('a\nb\nc\nd\ne\nf\ng\nh\ni\nj'))
    expect(tenLines).toBe(fourLines)
  })

  it('produces consistent height across node types', () => {
    const content = 'some content'
    const thinkingHeight = measureNodeHeight(makeNode(content, 'thinking'))
    const textHeight = measureNodeHeight(makeNode(content, 'text'))
    const toolUseHeight = measureNodeHeight(makeNode(content, 'tool-use'))
    expect(thinkingHeight).toBe(textHeight)
    expect(textHeight).toBe(toolUseHeight)
  })
})
