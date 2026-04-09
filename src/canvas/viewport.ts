import { Container, type FederatedPointerEvent } from 'pixi.js'

export class Viewport extends Container {
  private dragging = false
  private lastPointer = { x: 0, y: 0 }
  private _zoom = 1
  private wheelHandler: ((e: WheelEvent) => void) | null = null
  private boundCanvas: HTMLCanvasElement | null = null

  readonly minZoom = 0.1
  readonly maxZoom = 5

  constructor() {
    super()
    this.eventMode = 'static'
    this.hitArea = { contains: () => true }
  }

  /**
   * Call once after adding to stage. Binds wheel events to the canvas element.
   */
  bindToCanvas(canvas: HTMLCanvasElement): void {
    this.wheelHandler = (e: WheelEvent) => {
      e.preventDefault()
      this.handleZoom(e)
    }
    this.boundCanvas = canvas
    canvas.addEventListener('wheel', this.wheelHandler, { passive: false })

    this.on('pointerdown', this.onDragStart, this)
    this.on('pointermove', this.onDragMove, this)
    this.on('pointerup', this.onDragEnd, this)
    this.on('pointerupoutside', this.onDragEnd, this)
  }

  unbindFromCanvas(): void {
    if (this.boundCanvas && this.wheelHandler) {
      this.boundCanvas.removeEventListener('wheel', this.wheelHandler)
    }
    this.boundCanvas = null
    this.wheelHandler = null
    this.removeAllListeners()
  }

  get zoom(): number {
    return this._zoom
  }

  private handleZoom(e: WheelEvent): void {
    const direction = e.deltaY < 0 ? 1 : -1
    const factor = 1 + direction * 0.1
    const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this._zoom * factor))

    // Zoom toward cursor position
    const worldX = (e.offsetX - this.x) / this._zoom
    const worldY = (e.offsetY - this.y) / this._zoom

    this._zoom = newZoom
    this.scale.set(newZoom, newZoom)

    this.x = e.offsetX - worldX * newZoom
    this.y = e.offsetY - worldY * newZoom
  }

  private onDragStart(e: FederatedPointerEvent): void {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.dragging = true
      this.lastPointer = { x: e.globalX, y: e.globalY }
    }
  }

  private onDragMove(e: FederatedPointerEvent): void {
    if (!this.dragging) return
    const dx = e.globalX - this.lastPointer.x
    const dy = e.globalY - this.lastPointer.y
    this.x += dx
    this.y += dy
    this.lastPointer = { x: e.globalX, y: e.globalY }
  }

  private onDragEnd(): void {
    this.dragging = false
  }

  /**
   * Convert screen coordinates to world coordinates.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.x) / this._zoom,
      y: (screenY - this.y) / this._zoom,
    }
  }
}
