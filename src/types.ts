// src/types.ts
// UI / 도메인 상태 타입. IPC DTO는 @/lib/ipc 에 위치.
import type { IpcSessionStatus } from '@/lib/ipc'

// IPC 와이어 값과 동일한 도메인 상태. 구조적 identity alias이므로
// IpcSessionStatus 가 확장되면 자동 반영되고 UI 코드는 무수정.
export type SessionStatus = IpcSessionStatus

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

export type AgentInfo = {
  agentId: string
  agentType?: string
}

export type SessionState = {
  sessionId: string
  projectPath: string
  agents: Map<string, AgentInfo>
  status: SessionStatus
}
