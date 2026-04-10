// src/canvas/constants.ts
// layout.ts와 node-renderer.ts에서 공유하는 캔버스 상수

export const NODE_WIDTH = 220
export const NODE_MIN_HEIGHT = 70
export const NODE_PADDING = 12
export const NODE_HEADER_HEIGHT = 28
export const NODE_LINE_HEIGHT = 18
export const NODE_MAX_PREVIEW_LINES = 4
export const NODE_GAP_Y = 24
export const LANE_GAP_X = 280
export const PADDING_TOP = 40
export const PADDING_LEFT = 40
export const ICON_SIZE = 16
export const CHARS_PER_LINE = Math.floor((NODE_WIDTH - 2 * NODE_PADDING) / 7)
