import { describe, it, expect } from 'vitest'
import { SceneManager } from './scene-manager'
import { Container } from 'pixi.js'

describe('SceneManager', () => {
  it('adds a node and retrieves it by id', () => {
    const root = new Container()
    const scene = new SceneManager(root)

    scene.addNode({ id: 'n1', label: 'File created', x: 100, y: 200 })

    expect(scene.getNode('n1')).toBeDefined()
    expect(scene.getNode('n1')!.nodeId).toBe('n1')
    expect(root.children.length).toBe(1)
  })

  it('removes a node by id', () => {
    const root = new Container()
    const scene = new SceneManager(root)

    scene.addNode({ id: 'n1', label: 'Test', x: 0, y: 0 })
    scene.removeNode('n1')

    expect(scene.getNode('n1')).toBeUndefined()
    expect(root.children.length).toBe(0)
  })

  it('clears all nodes', () => {
    const root = new Container()
    const scene = new SceneManager(root)

    scene.addNode({ id: 'n1', label: 'A', x: 0, y: 0 })
    scene.addNode({ id: 'n2', label: 'B', x: 100, y: 0 })
    scene.clear()

    expect(scene.nodeCount).toBe(0)
    expect(root.children.length).toBe(0)
  })
})
