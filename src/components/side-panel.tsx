// src/components/side-panel.tsx
import { IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import type { CanvasNode } from '@/types'

type SidePanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedNode: CanvasNode | null
}

export function SidePanel({ open, onOpenChange, selectedNode }: SidePanelProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleContent>
        <Card className="absolute left-3 top-3 bottom-3 w-72 z-10 overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm">{selectedNode ? formatNodeTitle(selectedNode) : 'No Selection'}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedNode ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {new Date(selectedNode.timestamp).toLocaleTimeString()}
                  {selectedNode.durationMs != null && ` · ${selectedNode.durationMs}ms`}
                </div>
                <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-muted/50 rounded p-2 max-h-96 overflow-auto">
                  {selectedNode.content}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Click a node on the canvas to view details.</p>
            )}
          </CardContent>
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

function formatNodeTitle(node: CanvasNode): string {
  switch (node.type) {
    case 'thinking':
      return 'Thinking'
    case 'text':
      return 'Text Response'
    case 'tool-use':
      return node.toolName ?? 'Tool Use'
    case 'tool-result':
      return 'Tool Result'
  }
}
