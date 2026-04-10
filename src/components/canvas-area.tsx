import { PixiCanvas } from './pixi-canvas'
import type { CanvasNode } from '@/types'

type CanvasAreaProps = {
  nodes: CanvasNode[]
  onNodeClick?: (node: CanvasNode) => void
  onFpsUpdate?: (fps: number) => void
}

export function CanvasArea({ nodes, onNodeClick, onFpsUpdate }: CanvasAreaProps) {
  return <PixiCanvas nodes={nodes} onNodeClick={onNodeClick} onFpsUpdate={onFpsUpdate} />
}
