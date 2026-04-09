import { Container } from 'pixi.js'
import { CanvasNode, type CanvasNodeData } from './canvas-node'

export class SceneManager {
  private nodes = new Map<string, CanvasNode>()
  private root: Container

  constructor(root: Container) {
    this.root = root
  }

  addNode(data: CanvasNodeData): CanvasNode {
    const existing = this.nodes.get(data.id)
    if (existing) {
      existing.updateLabel(data.label)
      existing.position.set(data.x, data.y)
      return existing
    }

    const node = new CanvasNode(data)
    this.nodes.set(data.id, node)
    this.root.addChild(node)
    return node
  }

  getNode(id: string): CanvasNode | undefined {
    return this.nodes.get(id)
  }

  removeNode(id: string): boolean {
    const node = this.nodes.get(id)
    if (!node) return false
    this.root.removeChild(node)
    node.destroy()
    this.nodes.delete(id)
    return true
  }

  clear(): void {
    for (const node of this.nodes.values()) {
      this.root.removeChild(node)
      node.destroy()
    }
    this.nodes.clear()
  }

  get nodeCount(): number {
    return this.nodes.size
  }
}
