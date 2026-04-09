import { IconPlus } from '@tabler/icons-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import type { FileChangeEvent } from '@/types'
import { PixiCanvas } from './pixi-canvas'

interface CanvasAreaProps {
  activeSessionId: string | null
  events: FileChangeEvent[]
}

export function CanvasArea({ activeSessionId, events }: CanvasAreaProps) {
  if (!activeSessionId) {
    return (
      <div className="flex items-center justify-center size-full">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconPlus />
            </EmptyMedia>
            <EmptyTitle>No active session</EmptyTitle>
            <EmptyDescription>Add a session to start monitoring</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return <PixiCanvas key={activeSessionId} events={events} />
}
