import { PixiCanvas } from './pixi-canvas'
import type { CanvasNode } from '@/types'

type CanvasAreaProps = {
  nodes: CanvasNode[]
  onNodeClick?: (node: CanvasNode) => void
  onFpsUpdate?: (fps: number) => void
  selectedNodeId?: string
}

export function CanvasArea({ nodes, onNodeClick, onFpsUpdate, selectedNodeId }: CanvasAreaProps) {
  return (
    <PixiCanvas nodes={nodes} onNodeClick={onNodeClick} onFpsUpdate={onFpsUpdate} selectedNodeId={selectedNodeId} />
  )
}
