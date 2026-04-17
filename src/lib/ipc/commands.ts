// src/lib/ipc/commands.ts
import { invokeIpc } from './registry'
import type { IpcProjectInfo, IpcSessionDetail, IpcSessionEvent, IpcSessionInfo } from './types'

export const ipcCommands = {
  listActiveSessions: (): Promise<IpcSessionEvent[]> => invokeIpc('list_active_sessions'),

  listSessions: (projectPath: string): Promise<IpcSessionInfo[]> => invokeIpc('list_sessions', { projectPath }),

  getSessionDetail: (sessionId: string): Promise<IpcSessionDetail | null> =>
    invokeIpc('get_session_detail', { sessionId }),

  listProjects: (): Promise<IpcProjectInfo[]> => invokeIpc('list_projects'),
}
