// src/components/toolbar.tsx
import { IconLayoutSidebar } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ToolbarProps {
  onTogglePanel: () => void
}

export function Toolbar({ onTogglePanel }: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card text-card-foreground shrink-0">
      <span className="font-semibold text-sm select-none">Weave</span>
      <Separator orientation="vertical" className="h-4" />
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
