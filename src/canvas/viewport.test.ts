import { describe, it, expect } from 'vitest'
import { Viewport } from './viewport'

describe('Viewport', () => {
  it('initializes at origin with scale 1', () => {
    const vp = new Viewport()
    expect(vp.position.x).toBe(0)
    expect(vp.position.y).toBe(0)
    expect(vp.scale.x).toBe(1)
    expect(vp.scale.y).toBe(1)
  })

  it('converts screen to world coordinates at origin', () => {
    const vp = new Viewport()
    const world = vp.screenToWorld(100, 200)
    expect(world.x).toBe(100)
    expect(world.y).toBe(200)
  })

  it('converts screen to world coordinates when panned', () => {
    const vp = new Viewport()
    vp.x = 50
    vp.y = 100
    const world = vp.screenToWorld(150, 200)
    expect(world.x).toBe(100)
    expect(world.y).toBe(100)
  })
})
