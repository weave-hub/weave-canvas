// src/canvas/viewport.ts
import { Container } from 'pixi.js'

const MIN_SCALE = 0.1
const MAX_SCALE = 3
const ZOOM_FACTOR = 0.1
const DRAG_THRESHOLD = 3

export type ViewportState = {
  autoScroll: boolean
}

export function setupViewport(stage: Container, canvas: HTMLCanvasElement, state: ViewportState): () => void {
  let isPointerDown = false
  let isDragging = false
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0

  const onPointerDown = (e: PointerEvent) => {
    startX = e.clientX
    startY = e.clientY
    lastX = e.clientX
    lastY = e.clientY
    isPointerDown = true
    isDragging = false
    canvas.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!isPointerDown) return

    if (!isDragging) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
      isDragging = true
    }

    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    stage.x += dx
    stage.y += dy
    lastX = e.clientX
    lastY = e.clientY
    state.autoScroll = false
  }

  const onPointerUp = (e: PointerEvent) => {
    if (isPointerDown) {
      canvas.releasePointerCapture(e.pointerId)
    }
    isPointerDown = false
    isDragging = false
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const direction = e.deltaY > 0 ? -1 : 1
    const factor = 1 + ZOOM_FACTOR * direction
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, stage.scale.x * factor))

    // 마우스 위치 기준 줌
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const worldX = (mouseX - stage.x) / stage.scale.x
    const worldY = (mouseY - stage.y) / stage.scale.y

    stage.scale.set(newScale)
    stage.x = mouseX - worldX * newScale
    stage.y = mouseY - worldY * newScale

    state.autoScroll = false
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
  }
}

export function scrollToBottom(stage: Container, canvasHeight: number, contentHeight: number): void {
  const targetY = -(contentHeight * stage.scale.y - canvasHeight + 40)
  if (targetY < 0) {
    stage.y = targetY
  }
}
