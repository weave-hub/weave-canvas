// src/components/status-bar.tsx
export function StatusBar() {
  return (
    <div
      role="status"
      className="flex items-center gap-2 px-3 py-1 border-t bg-card text-muted-foreground text-xs shrink-0"
    >
      <span>Ready</span>
    </div>
  )
}
