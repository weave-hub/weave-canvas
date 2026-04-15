import { useCallback, useMemo, useState } from 'react'
import type { CanvasNode, SessionState } from '@/types'

type SessionSelectionResult = {
  sessionId: string | null
  selectedNode: CanvasNode | null
  selectSession: (id: string) => void
  selectNode: (node: CanvasNode) => void
}

export function useSessionSelection(sessions: Map<string, SessionState>): SessionSelectionResult {
  const [preferredSessionId, setPreferredSessionId] = useState<string | null>(null)
  const [preferredNode, setPreferredNode] = useState<CanvasNode | null>(null)

  const sessionId = useMemo(() => {
    const current = preferredSessionId ? sessions.get(preferredSessionId) : null
    if (current && current.status !== 'ended') return preferredSessionId

    const all = Array.from(sessions.values())
    return all.find((s) => s.status === 'active')?.sessionId ?? all.find((s) => s.status === 'idle')?.sessionId ?? null
  }, [sessions, preferredSessionId])

  const selectedNode = preferredNode?.sessionId === sessionId ? preferredNode : null

  const selectSession = useCallback((id: string) => setPreferredSessionId(id), [])
  const selectNode = useCallback((node: CanvasNode) => setPreferredNode(node), [])

  return { sessionId, selectedNode, selectSession, selectNode }
}
