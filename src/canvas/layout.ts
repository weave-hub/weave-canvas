// src/canvas/layout.ts
import type { CanvasNode } from '@/types'
import { NODE_WIDTH, NODE_GAP_Y, LANE_GAP_X, PADDING_TOP, PADDING_LEFT } from './constants'
import { measureNodeHeight } from './measure-node-height'

export type NodePosition = {
  nodeId: string
  x: number
  y: number
  width: number
  height: number
  laneIndex: number
}

export type EdgeDef = {
  fromId: string
  toId: string
  type: 'sequence' | 'branch' | 'tool-match'
}

export type LayoutResult = {
  positions: NodePosition[]
  edges: EdgeDef[]
  totalWidth: number
  totalHeight: number
}

export function computeLayout(nodes: CanvasNode[]): LayoutResult {
  if (nodes.length === 0) {
    return { positions: [], edges: [], totalWidth: 0, totalHeight: 0 }
  }

  // 에이전트별 레인 할당
  const laneOrder: string[] = []
  for (const node of nodes) {
    if (!laneOrder.includes(node.agentId)) {
      laneOrder.push(node.agentId)
    }
  }

  // 레인별 노드 그룹핑 (timestamp 순)
  const laneNodes = new Map<string, CanvasNode[]>()
  for (const agentId of laneOrder) {
    laneNodes.set(agentId, [])
  }
  for (const node of nodes) {
    laneNodes.get(node.agentId)!.push(node)
  }
  for (const arr of laneNodes.values()) {
    arr.sort((a, b) => a.timestamp - b.timestamp)
  }

  // 좌표 계산
  const positions: NodePosition[] = []
  const laneYCounters = new Map<string, number>()

  for (let laneIdx = 0; laneIdx < laneOrder.length; laneIdx++) {
    const agentId = laneOrder[laneIdx]
    const laneX = PADDING_LEFT + laneIdx * LANE_GAP_X
    let y = PADDING_TOP

    for (const node of laneNodes.get(agentId)!) {
      const height = measureNodeHeight(node)
      positions.push({
        nodeId: node.id,
        x: laneX,
        y,
        width: NODE_WIDTH,
        height,
        laneIndex: laneIdx,
      })
      y += height + NODE_GAP_Y
    }

    laneYCounters.set(agentId, y)
  }

  // 엣지 생성
  const edges: EdgeDef[] = []

  // 같은 레인 내 순차 연결
  for (const agentId of laneOrder) {
    const laneNodeList = laneNodes.get(agentId)!
    for (let i = 0; i < laneNodeList.length - 1; i++) {
      edges.push({
        fromId: laneNodeList[i].id,
        toId: laneNodeList[i + 1].id,
        type: 'sequence',
      })
    }
  }

  // Agent tool_use 노드를 시간순으로 수집
  const agentToolUses = nodes
    .filter((n) => n.type === 'tool-use' && n.toolName === 'Agent')
    .sort((a, b) => a.timestamp - b.timestamp)

  // 서브에이전트 레인도 첫 노드 시간순으로 정렬
  const subagentLanes = laneOrder
    .filter((id) => id !== '' && id !== nodes[0]?.agentId)
    .map((id) => ({ agentId: id, firstTimestamp: laneNodes.get(id)?.[0]?.timestamp ?? 0 }))
    .sort((a, b) => a.firstTimestamp - b.firstTimestamp)

  // Agent 호출 순서와 서브에이전트 등장 순서를 1:1 매칭
  for (let i = 0; i < Math.min(agentToolUses.length, subagentLanes.length); i++) {
    const agentNode = agentToolUses[i]
    const subLane = subagentLanes[i]
    const firstNode = laneNodes.get(subLane.agentId)?.[0]
    if (firstNode) {
      edges.push({
        fromId: agentNode.id,
        toId: firstNode.id,
        type: 'branch',
      })
    }
  }

  // ToolUse <-> ToolResult 매칭 (같은 toolId)
  const toolUseById = new Map<string, string>()
  for (const node of nodes) {
    if (node.type === 'tool-use' && node.toolId) {
      toolUseById.set(node.toolId, node.id)
    }
  }
  for (const node of nodes) {
    if (node.type === 'tool-result' && node.toolId) {
      const useNodeId = toolUseById.get(node.toolId)
      if (useNodeId) {
        edges.push({
          fromId: useNodeId,
          toId: node.id,
          type: 'tool-match',
        })
      }
    }
  }

  const maxY = Math.max(...Array.from(laneYCounters.values()), 0)
  const totalWidth = PADDING_LEFT + laneOrder.length * LANE_GAP_X
  const totalHeight = maxY

  return { positions, edges, totalWidth, totalHeight }
}
