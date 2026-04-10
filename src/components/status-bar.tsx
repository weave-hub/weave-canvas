// src/components/status-bar.tsx

type StatusBarProps = {
  activeSessionCount: number
  nodeCount: number
  fps: number
}

export function StatusBar({ activeSessionCount, nodeCount, fps }: StatusBarProps) {
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
      <span className="ml-auto">{fps} FPS</span>
    </div>
  )
}
