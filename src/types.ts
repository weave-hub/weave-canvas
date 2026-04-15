// src/types.ts

export type SessionEventType =
  | 'sessionDiscovered'
  | 'sessionEnded'
  | 'sessionIdle'
  | 'sessionActive'
  | 'agentDiscovered'
  | 'thinking'
  | 'text'
  | 'toolUse'
  | 'toolResult'

export type SessionEvent =
  | { type: 'sessionDiscovered'; sessionId: string; projectPath: string }
  | { type: 'sessionEnded'; sessionId: string }
  | { type: 'sessionIdle'; sessionId: string }
  | { type: 'sessionActive'; sessionId: string }
  | { type: 'agentDiscovered'; sessionId: string; agentId: string; agentType: string | null }
  | { type: 'thinking'; sessionId: string; agentId: string; timestamp: string; content: string }
  | { type: 'text'; sessionId: string; agentId: string; timestamp: string; content: string }
  | {
      type: 'toolUse'
      sessionId: string
      agentId: string
      timestamp: string
      toolId: string
      toolName: string
      input: unknown
    }
  | {
      type: 'toolResult'
      sessionId: string
      agentId: string
      timestamp: string
      toolId: string
      content: string
      durationMs: number | null
    }

export type CanvasNodeType = 'thinking' | 'text' | 'tool-use' | 'tool-result'

export type CanvasNode = {
  id: string
  sessionId: string
  agentId: string
  type: CanvasNodeType
  timestamp: number
  toolName?: string
  toolId?: string
  content: string
  durationMs?: number
}

export type SessionStatus = 'active' | 'idle' | 'ended'

export type SessionState = {
  sessionId: string
  projectPath: string
  agents: Map<string, AgentInfo>
  status: SessionStatus
}

export type AgentInfo = {
  agentId: string
  agentType?: string
}

// IPC Data Transfer Objects — Rust 백엔드 응답 타입.
// UI 상태 타입(SessionState 등)과 구분하기 위해 Dto 접미사를 붙인다.

export type SessionInfoDto = {
  sessionId: string
  projectPath: string
  status: SessionStatus
  lastModified: number
  agentCount: number
}

export type SessionDetailDto = {
  sessionId: string
  projectPath: string
  events: SessionEvent[]
}

export type ProjectInfoDto = {
  projectPath: string
  encodedName: string
  sessionCount: number
}
