// src/components/side-panel.tsx
import { IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

interface SidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SidePanel({ open, onOpenChange }: SidePanelProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleContent>
        <Card className="absolute left-3 top-3 bottom-3 w-64 z-10">
          <CardHeader>
            <CardTitle className="text-sm">Panel</CardTitle>
          </CardHeader>
          <CardContent>{/* placeholder — functional content added in future tasks */}</CardContent>
        </Card>
      </CollapsibleContent>
      {!open && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-2 top-2 z-10"
          onClick={() => onOpenChange(true)}
          aria-label="Open panel"
        >
          <IconChevronRight data-icon="inline-start" />
        </Button>
      )}
    </Collapsible>
  )
}
