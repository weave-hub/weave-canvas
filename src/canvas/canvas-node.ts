import { Container, Graphics, Text, TextStyle } from 'pixi.js'

export interface CanvasNodeData {
  id: string
  label: string
  x: number
  y: number
  color?: number
}

const LABEL_STYLE = new TextStyle({
  fill: 0xe0e0e0,
  fontSize: 13,
  fontFamily: 'system-ui, sans-serif',
})

const NODE_WIDTH = 220
const NODE_HEIGHT = 50
const NODE_RADIUS = 8
const NODE_BG = 0x2a2a4a
const NODE_BORDER = 0x3b82f6

export class CanvasNode extends Container {
  readonly nodeId: string
  private bg: Graphics
  private labelText: Text

  constructor(data: CanvasNodeData) {
    super()
    this.nodeId = data.id
    this.position.set(data.x, data.y)
    this.eventMode = 'static'
    this.cursor = 'grab'

    this.bg = new Graphics()
    this.drawBackground(data.color ?? NODE_BORDER)
    this.addChild(this.bg)

    this.labelText = new Text({ text: data.label, style: LABEL_STYLE })
    // Use a fixed vertical offset to avoid triggering canvas text measurement at construction time
    this.labelText.position.set(12, Math.round((NODE_HEIGHT - 16) / 2))
    this.addChild(this.labelText)

    this.setupDrag()
  }

  private drawBackground(borderColor: number): void {
    this.bg
      .clear()
      .roundRect(0, 0, NODE_WIDTH, NODE_HEIGHT, NODE_RADIUS)
      .fill({ color: NODE_BG })
      .stroke({ color: borderColor, width: 1.5 })
  }

  private setupDrag(): void {
    let dragging = false
    let offset = { x: 0, y: 0 }

    this.on('pointerdown', (e) => {
      if (e.button !== 0 || e.altKey) return
      dragging = true
      this.cursor = 'grabbing'
      if (!this.parent) return
      const pos = e.getLocalPosition(this.parent)
      offset = { x: pos.x - this.x, y: pos.y - this.y }
      e.stopPropagation()
    })

    this.on('globalpointermove', (e) => {
      const parent = this.parent
      if (!dragging || !parent) return
      const pos = e.getLocalPosition(parent)
      this.x = pos.x - offset.x
      this.y = pos.y - offset.y
    })

    this.on('pointerup', () => {
      dragging = false
      this.cursor = 'grab'
    })

    this.on('pointerupoutside', () => {
      dragging = false
      this.cursor = 'grab'
    })
  }

  updateLabel(label: string): void {
    this.labelText.text = label
  }
}
