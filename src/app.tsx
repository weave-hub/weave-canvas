import { useCallback, useMemo, useState } from 'react'
import { IconActivityHeartbeat } from '@tabler/icons-react'
import { Toolbar } from './components/toolbar'
import { SidePanel } from './components/side-panel'
import { CanvasArea } from './components/canvas-area'
import { StatusBar } from './components/status-bar'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './components/ui/empty'
import { useSessionEvents } from './hooks/use-session-events'
import type { CanvasNode } from './types'

function App() {
  const [panelOpen, setPanelOpen] = useState(true)
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const { sessions, nodes } = useSessionEvents()

  // Derive effective session: fall back to first active/idle if current is invalid
  const effectiveSessionId = useMemo(() => {
    const current = selectedSessionId ? sessions.get(selectedSessionId) : null
    if (current && current.status !== 'ended') return selectedSessionId

    const allSessions = Array.from(sessions.values())
    const next = allSessions.find((s) => s.status === 'active') ?? allSessions.find((s) => s.status === 'idle') ?? null
    return next?.sessionId ?? null
  }, [sessions, selectedSessionId])

  // Derive: clear selected node if it belongs to a different session
  const effectiveSelectedNode = selectedNode && selectedNode.sessionId === effectiveSessionId ? selectedNode : null

  const filteredNodes = useMemo(
    () => (effectiveSessionId ? nodes.filter((n) => n.sessionId === effectiveSessionId) : []),
    [nodes, effectiveSessionId],
  )

  const nodeCountBySession = useMemo(() => {
    const map = new Map<string, number>()
    for (const node of nodes) {
      map.set(node.sessionId, (map.get(node.sessionId) ?? 0) + 1)
    }
    return map
  }, [nodes])

  const handleNodeClick = useCallback((node: CanvasNode) => {
    setSelectedNode(node)
    setPanelOpen(true)
  }, [])

  const activeCount = useMemo(
    () => Array.from(sessions.values()).filter((s) => s.status !== 'ended').length,
    [sessions],
  )

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground">
      <Toolbar
        onTogglePanel={() => setPanelOpen((prev) => !prev)}
        sessions={sessions}
        selectedSessionId={effectiveSessionId}
        onSelectSession={setSelectedSessionId}
        nodeCountBySession={nodeCountBySession}
      />
      <main className="relative flex-1 overflow-hidden">
        {effectiveSessionId ? (
          <CanvasArea
            key={effectiveSessionId}
            nodes={filteredNodes}
            onNodeClick={handleNodeClick}
            onFpsUpdate={setFps}
            selectedNodeId={effectiveSelectedNode?.id}
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
        <SidePanel open={panelOpen} onOpenChange={setPanelOpen} selectedNode={effectiveSelectedNode} />
      </main>
      <StatusBar activeSessionCount={activeCount} nodeCount={filteredNodes.length} fps={fps} />
    </div>
  )
}

export default App
