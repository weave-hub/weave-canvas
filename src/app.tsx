import { useCallback, useMemo, useRef, useState } from 'react'
import { IconActivityHeartbeat } from '@tabler/icons-react'
import { Toolbar } from './components/toolbar'
import { SidePanel } from './components/side-panel'
import { PixiCanvas } from './components/pixi-canvas'
import { StatusBar } from './components/status-bar'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './components/ui/empty'
import { useSessionEvents } from './hooks/use-session-events'
import { useSessionSelection } from './hooks/use-session-selection'
import type { CanvasNode } from './types'

function App() {
  const [panelOpen, setPanelOpen] = useState(true)
  const fpsRef = useRef<HTMLSpanElement>(null)
  const { sessions, nodes } = useSessionEvents()
  const { sessionId, selectedNode, selectSession, selectNode } = useSessionSelection(sessions)

  const filteredNodes = useMemo(
    () => (sessionId ? nodes.filter((n) => n.sessionId === sessionId) : []),
    [nodes, sessionId],
  )

  const nodeCountBySession = useMemo(() => {
    const map = new Map<string, number>()
    for (const node of nodes) {
      map.set(node.sessionId, (map.get(node.sessionId) ?? 0) + 1)
    }
    return map
  }, [nodes])

  const handleNodeClick = useCallback(
    (node: CanvasNode) => {
      selectNode(node)
      setPanelOpen(true)
    },
    [selectNode],
  )

  const activeCount = useMemo(
    () => Array.from(sessions.values()).filter((s) => s.status !== 'ended').length,
    [sessions],
  )

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground">
      <Toolbar
        onTogglePanel={() => setPanelOpen((prev) => !prev)}
        sessions={sessions}
        selectedSessionId={sessionId}
        onSelectSession={selectSession}
        nodeCountBySession={nodeCountBySession}
      />
      <main className="relative flex-1 overflow-hidden">
        {sessionId ? (
          <PixiCanvas
            key={sessionId}
            nodes={filteredNodes}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNode?.id}
            fpsRef={fpsRef}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Empty>
              <EmptyMedia>
                <IconActivityHeartbeat className="size-10 text-muted-foreground" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No active sessions</EmptyTitle>
                <EmptyDescription>Start a Claude Code session in your terminal to begin visualizing.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
        <SidePanel open={panelOpen} onOpenChange={setPanelOpen} selectedNode={selectedNode} />
      </main>
      <StatusBar activeSessionCount={activeCount} nodeCount={filteredNodes.length} fpsRef={fpsRef} />
    </div>
  )
}

export default App
