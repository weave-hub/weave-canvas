// src/components/status-bar.tsx
import type { RefObject } from 'react'

type StatusBarProps = {
  activeSessionCount: number
  nodeCount: number
  fpsRef: RefObject<HTMLSpanElement | null>
}

export function StatusBar({ activeSessionCount, nodeCount, fpsRef }: StatusBarProps) {
  return (
    <div
      role="status"
      className="flex items-center gap-4 px-3 py-1 border-t bg-card text-muted-foreground text-xs shrink-0"
    >
      <span>
        {activeSessionCount > 0
          ? `${activeSessionCount} active session${activeSessionCount > 1 ? 's' : ''}`
          : 'No active sessions'}
      </span>
      <span>{nodeCount} nodes</span>
      <span ref={fpsRef} className="ml-auto">
        0 FPS
      </span>
    </div>
  )
}
