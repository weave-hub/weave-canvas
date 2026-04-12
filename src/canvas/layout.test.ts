import { computeLayout } from './layout'
import { NODE_WIDTH, NODE_GAP_Y, LANE_GAP_X, PADDING_TOP, PADDING_LEFT } from './constants'
import { measureNodeHeight } from './measure-node-height'
import type { CanvasNode } from '@/types'

let idCounter = 0
function makeNode(overrides: Partial<CanvasNode> = {}): CanvasNode {
  return {
    id: `node-${idCounter++}`,
    sessionId: 'session-1',
    agentId: '',
    type: 'text',
    timestamp: Date.now(),
    content: 'test content',
    ...overrides,
  }
}

beforeEach(() => {
  idCounter = 0
})

describe('computeLayout()', () => {
  it('returns empty result for empty nodes', () => {
    const result = computeLayout([])
    expect(result).toEqual({ positions: [], edges: [], totalWidth: 0, totalHeight: 0 })
  })

  it('positions a single node correctly', () => {
    const node = makeNode()
    const result = computeLayout([node])
    expect(result.positions).toHaveLength(1)

    const pos = result.positions[0]
    expect(pos.nodeId).toBe(node.id)
    expect(pos.x).toBe(PADDING_LEFT)
    expect(pos.y).toBe(PADDING_TOP)
    expect(pos.width).toBe(NODE_WIDTH)
    expect(pos.height).toBe(measureNodeHeight(node))
    expect(pos.laneIndex).toBe(0)
  })

  it('stacks nodes vertically in the same lane', () => {
    const nodes = [makeNode({ agentId: 'main', timestamp: 1 }), makeNode({ agentId: 'main', timestamp: 2 })]
    const result = computeLayout(nodes)
    const [first, second] = result.positions

    expect(first.y).toBe(PADDING_TOP)
    expect(second.y).toBe(first.y + first.height + NODE_GAP_Y)
    expect(first.x).toBe(second.x)
  })

  it('creates separate lanes for different agents', () => {
    const nodes = [makeNode({ agentId: 'main', timestamp: 1 }), makeNode({ agentId: 'sub-1', timestamp: 2 })]
    const result = computeLayout(nodes)
    const [mainPos, subPos] = result.positions

    expect(mainPos.laneIndex).toBe(0)
    expect(subPos.laneIndex).toBe(1)
    expect(mainPos.x).toBe(PADDING_LEFT)
    expect(subPos.x).toBe(PADDING_LEFT + LANE_GAP_X)
  })

  it('generates sequence edges for consecutive nodes in the same lane', () => {
    const nodes = [
      makeNode({ agentId: 'main', timestamp: 1 }),
      makeNode({ agentId: 'main', timestamp: 2 }),
      makeNode({ agentId: 'main', timestamp: 3 }),
    ]
    const result = computeLayout(nodes)
    const seqEdges = result.edges.filter((e) => e.type === 'sequence')

    expect(seqEdges).toHaveLength(2)
    expect(seqEdges[0]).toEqual({ fromId: nodes[0].id, toId: nodes[1].id, type: 'sequence' })
    expect(seqEdges[1]).toEqual({ fromId: nodes[1].id, toId: nodes[2].id, type: 'sequence' })
  })

  it('generates tool-match edges for matching toolId', () => {
    const nodes = [
      makeNode({ agentId: 'main', timestamp: 1, type: 'tool-use', toolId: 'tool-1', toolName: 'Read' }),
      makeNode({ agentId: 'main', timestamp: 2, type: 'tool-result', toolId: 'tool-1' }),
    ]
    const result = computeLayout(nodes)
    const matchEdges = result.edges.filter((e) => e.type === 'tool-match')

    expect(matchEdges).toHaveLength(1)
    expect(matchEdges[0].fromId).toBe(nodes[0].id)
    expect(matchEdges[0].toId).toBe(nodes[1].id)
  })

  it('generates branch edges for Agent tool-use to subagent first node', () => {
    const nodes = [
      makeNode({ agentId: 'main', timestamp: 1, type: 'tool-use', toolName: 'Agent', toolId: 'a1' }),
      makeNode({ agentId: 'sub-1', timestamp: 2, type: 'thinking' }),
    ]
    const result = computeLayout(nodes)
    const branchEdges = result.edges.filter((e) => e.type === 'branch')

    expect(branchEdges).toHaveLength(1)
    expect(branchEdges[0].fromId).toBe(nodes[0].id)
    expect(branchEdges[0].toId).toBe(nodes[1].id)
  })

  it('does not generate branch edges for non-Agent tool-use', () => {
    const nodes = [
      makeNode({ agentId: 'main', timestamp: 1, type: 'tool-use', toolName: 'Read', toolId: 't1' }),
      makeNode({ agentId: 'sub-1', timestamp: 2, type: 'text' }),
    ]
    const result = computeLayout(nodes)
    const branchEdges = result.edges.filter((e) => e.type === 'branch')
    expect(branchEdges).toHaveLength(0)
  })

  it('calculates totalWidth based on lane count', () => {
    const nodes = [
      makeNode({ agentId: 'main', timestamp: 1 }),
      makeNode({ agentId: 'sub-1', timestamp: 2 }),
      makeNode({ agentId: 'sub-2', timestamp: 3 }),
    ]
    const result = computeLayout(nodes)
    expect(result.totalWidth).toBe(PADDING_LEFT + 3 * LANE_GAP_X)
  })

  it('calculates totalHeight as max lane bottom', () => {
    const nodes = [makeNode({ agentId: 'main', timestamp: 1 })]
    const result = computeLayout(nodes)
    const expectedHeight = PADDING_TOP + measureNodeHeight(nodes[0]) + NODE_GAP_Y
    expect(result.totalHeight).toBe(expectedHeight)
  })
})
