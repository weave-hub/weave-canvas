// src/components/toolbar.tsx
import { useState } from 'react'
import { IconChevronDown, IconLayoutSidebar } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SessionState, SessionStatus } from '@/types'

type ToolbarProps = {
  onTogglePanel: () => void
  sessions: Map<string, SessionState>
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
  nodeCountBySession: Map<string, number>
}

function projectName(projectPath: string): string {
  return projectPath.split('/').filter(Boolean).pop() ?? projectPath
}

function statusColor(status: SessionStatus): string {
  return `var(--status-${status})`
}

function overallStatus(sessions: Map<string, SessionState>): SessionStatus {
  const values = Array.from(sessions.values())
  if (values.some((s) => s.status === 'active')) return 'active'
  if (values.some((s) => s.status === 'idle')) return 'idle'
  return 'ended'
}

export function Toolbar({
  onTogglePanel,
  sessions,
  selectedSessionId,
  onSelectSession,
  nodeCountBySession,
}: ToolbarProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const nonEndedCount = Array.from(sessions.values()).filter((s) => s.status !== 'ended').length
  const sessionEntries = Array.from(sessions.entries())

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card text-card-foreground shrink-0">
      <span className="font-semibold text-sm select-none">Weave</span>
      <Separator orientation="vertical" className="h-4" />

      {sessionEntries.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: statusColor(overallStatus(sessions)) }}
                />
                {nonEndedCount} {nonEndedCount === 1 ? 'Session' : 'Sessions'}
                <IconChevronDown data-icon="inline-end" />
              </Button>
            }
          />
          <PopoverContent align="start" className="w-72 p-0">
            <div className="max-h-64 overflow-y-auto">
              {sessionEntries.map(([id, session]) => (
                <button
                  key={id}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors',
                    id === selectedSessionId && 'bg-accent',
                  )}
                  onClick={() => {
                    onSelectSession(id)
                    setPopoverOpen(false)
                  }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: statusColor(session.status) }}
                  />
                  <span className="flex-1 truncate text-left font-medium">{projectName(session.projectPath)}</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {session.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">{nodeCountBySession.get(id) ?? 0}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <div className="flex-1" />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="sm" onClick={onTogglePanel} aria-label="Toggle panel">
                <IconLayoutSidebar data-icon="inline-start" />
              </Button>
            }
          />
          <TooltipContent>Toggle panel</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
