// src/hooks/use-session-events.ts
import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { CanvasNode, SessionEvent, SessionState, AgentInfo } from '@/types'

function makeNodeId(): string {
  return `node-${crypto.randomUUID()}`
}

function eventToNodes(event: SessionEvent): CanvasNode[] {
  switch (event.type) {
    case 'thinking':
      return [
        {
          id: makeNodeId(),
          sessionId: event.session_id,
          agentId: event.agent_id,
          type: 'thinking',
          timestamp: new Date(event.timestamp).getTime(),
          content: event.content,
        },
      ]
    case 'text':
      return [
        {
          id: makeNodeId(),
          sessionId: event.session_id,
          agentId: event.agent_id,
          type: 'text',
          timestamp: new Date(event.timestamp).getTime(),
          content: event.content,
        },
      ]
    case 'toolUse':
      return [
        {
          id: makeNodeId(),
          sessionId: event.session_id,
          agentId: event.agent_id,
          type: 'tool-use',
          timestamp: new Date(event.timestamp).getTime(),
          toolName: event.tool_name,
          toolId: event.tool_id,
          content: JSON.stringify(event.input),
        },
      ]
    case 'toolResult':
      return [
        {
          id: makeNodeId(),
          sessionId: event.session_id,
          agentId: event.agent_id,
          type: 'tool-result',
          timestamp: new Date(event.timestamp).getTime(),
          toolId: event.tool_id,
          content: event.content,
          durationMs: event.duration_ms ?? undefined,
        },
      ]
    default:
      return []
  }
}

export function useSessionEvents() {
  const [sessions, setSessions] = useState<Map<string, SessionState>>(new Map())
  const [nodes, setNodes] = useState<CanvasNode[]>([])

  useEffect(() => {
    const unlisten = listen<SessionEvent>('session-event', ({ payload }) => {
      switch (payload.type) {
        case 'sessionDiscovered': {
          setSessions((prev) => {
            const next = new Map(prev)
            next.set(payload.session_id, {
              sessionId: payload.session_id,
              projectPath: payload.project_path,
              agents: new Map(),
              status: 'active',
            })
            return next
          })
          break
        }
        case 'sessionEnded': {
          setSessions((prev) => {
            const next = new Map(prev)
            const session = next.get(payload.session_id)
            if (session) {
              next.set(payload.session_id, { ...session, status: 'ended' })
            }
            return next
          })
          break
        }
        case 'sessionIdle': {
          setSessions((prev) => {
            const next = new Map(prev)
            const session = next.get(payload.session_id)
            if (session) {
              next.set(payload.session_id, { ...session, status: 'idle' })
            }
            return next
          })
          break
        }
        case 'sessionActive': {
          setSessions((prev) => {
            const next = new Map(prev)
            const session = next.get(payload.session_id)
            if (session) {
              next.set(payload.session_id, { ...session, status: 'active' })
            }
            return next
          })
          break
        }
        case 'agentDiscovered': {
          setSessions((prev) => {
            const next = new Map(prev)
            const session = next.get(payload.session_id)
            if (session) {
              const agents = new Map(session.agents)
              const agentInfo: AgentInfo = {
                agentId: payload.agent_id,
                agentType: payload.agent_type ?? undefined,
              }
              agents.set(payload.agent_id, agentInfo)
              next.set(payload.session_id, { ...session, agents })
            }
            return next
          })
          break
        }
        default: {
          const newNodes = eventToNodes(payload)
          if (newNodes.length > 0) {
            setNodes((prev) => [...prev, ...newNodes])
          }
        }
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  return { sessions, nodes }
}
