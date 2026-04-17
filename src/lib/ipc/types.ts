// src/lib/ipc/types.ts
// Tauri IPC 경계를 넘는 모든 DTO. Rust struct와 1:1 대응 (serde camelCase).
// UI 전용 필드는 여기에 추가하지 말 것 — src/types.ts 로.

export type IpcSessionStatus = 'active' | 'idle' | 'ended'

export type IpcSessionEvent =
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

export type IpcSessionInfo = {
  sessionId: string
  projectPath: string
  status: IpcSessionStatus
  lastModified: number
  agentCount: number
}

export type IpcSessionDetail = {
  sessionId: string
  projectPath: string
  events: IpcSessionEvent[]
}

export type IpcProjectInfo = {
  projectPath: string
  encodedName: string
  sessionCount: number
}
