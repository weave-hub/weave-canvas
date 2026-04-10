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
  | { type: 'sessionDiscovered'; session_id: string; project_path: string }
  | { type: 'sessionEnded'; session_id: string }
  | { type: 'sessionIdle'; session_id: string }
  | { type: 'sessionActive'; session_id: string }
  | { type: 'agentDiscovered'; session_id: string; agent_id: string; agent_type: string | null }
  | { type: 'thinking'; session_id: string; agent_id: string; timestamp: string; content: string }
  | { type: 'text'; session_id: string; agent_id: string; timestamp: string; content: string }
  | {
      type: 'toolUse'
      session_id: string
      agent_id: string
      timestamp: string
      tool_id: string
      tool_name: string
      input: unknown
    }
  | {
      type: 'toolResult'
      session_id: string
      agent_id: string
      timestamp: string
      tool_id: string
      content: string
      duration_ms: number | null
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
