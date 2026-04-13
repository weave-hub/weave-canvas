// src/hooks/use-session-events.ts
import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
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
    // pull 과 push 경로를 동일하게 처리하기 위한 공용 핸들러.
    // idempotent 해야 함 — 같은 SessionDiscovered 가 여러 번 와도 안전해야 한다.
    const applyEvent = (payload: SessionEvent): void => {
      switch (payload.type) {
        case 'sessionDiscovered': {
          setSessions((prev) => {
            const existing = prev.get(payload.session_id)
            const next = new Map(prev)
            next.set(payload.session_id, {
              sessionId: payload.session_id,
              projectPath: payload.project_path,
              // 이미 수집된 에이전트가 있으면 유지 (pull/push 순서 무관 idempotency)
              agents: existing?.agents ?? new Map(),
              status: existing?.status ?? 'active',
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
    }

    // 1) 초기 동기화 — pull.
    //    watcher가 마운트 전에 쏜 초기 이벤트는 놓쳤을 수 있지만,
    //    이 커맨드가 파일시스템을 새로 스캔해 현재 활성 세션을 돌려준다.
    invoke<SessionEvent[]>('list_active_sessions')
      .then((events) => {
        events.forEach(applyEvent)
      })
      .catch((err) => {
        console.error('Failed to sync active sessions on mount:', err)
      })

    // 2) 실시간 구독 — push. 이후 변경사항은 watcher 가 방출함.
    const unlisten = listen<SessionEvent>('session-event', ({ payload }) => {
      applyEvent(payload)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  return { sessions, nodes }
}
