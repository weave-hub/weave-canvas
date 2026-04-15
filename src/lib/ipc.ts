import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { SessionEvent, SessionInfoDto, SessionDetailDto, ProjectInfoDto } from '@/types'

export const commands = {
  listActiveSessions: (): Promise<SessionEvent[]> => invoke('list_active_sessions'),

  listSessions: (projectPath: string): Promise<SessionInfoDto[]> => invoke('list_sessions', { projectPath }),

  getSessionDetail: (sessionId: string): Promise<SessionDetailDto | null> =>
    invoke('get_session_detail', { sessionId }),

  listProjects: (): Promise<ProjectInfoDto[]> => invoke('list_projects'),
}

export const events = {
  onSessionEvent: (handler: (event: SessionEvent) => void) =>
    listen<SessionEvent>('session-event', ({ payload }) => handler(payload)),
}
