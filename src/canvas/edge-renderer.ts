// src/canvas/edge-renderer.ts
import { Graphics } from 'pixi.js'
import type { NodePosition, EdgeDef } from './layout'

const EDGE_COLORS = {
  sequence: 0x555555,
  branch: 0xba8c4c,
  'tool-match': 0x4c8cba,
} as const

export function drawEdges(graphics: Graphics, edges: EdgeDef[], posMap: Map<string, NodePosition>): void {
  graphics.clear()

  for (const edge of edges) {
    const from = posMap.get(edge.fromId)
    const to = posMap.get(edge.toId)
    if (!from || !to) continue

    const color = EDGE_COLORS[edge.type]
    const fromX = from.x + from.width / 2
    const fromY = from.y + from.height
    const toX = to.x + to.width / 2
    const toY = to.y

    if (edge.type === 'sequence') {
      // 직선
      graphics.moveTo(fromX, fromY)
      graphics.lineTo(toX, toY)
      graphics.stroke({ color, width: 1.5, alpha: 0.6 })
    } else if (edge.type === 'branch') {
      // bezier 곡선
      const midY = (fromY + toY) / 2
      graphics.moveTo(fromX, fromY)
      graphics.bezierCurveTo(fromX, midY, toX, midY, toX, toY)
      graphics.stroke({ color, width: 2, alpha: 0.8 })
    } else if (edge.type === 'tool-match') {
      // 점선 효과 — 짧은 세그먼트로 시뮬레이션
      const segments = 8
      const dx = toX - fromX
      const dy = toY - fromY
      for (let i = 0; i < segments; i += 2) {
        const t0 = i / segments
        const t1 = (i + 1) / segments
        graphics.moveTo(fromX + dx * t0, fromY + dy * t0)
        graphics.lineTo(fromX + dx * t1, fromY + dy * t1)
      }
      graphics.stroke({ color, width: 1, alpha: 0.4 })
    }
  }
}
