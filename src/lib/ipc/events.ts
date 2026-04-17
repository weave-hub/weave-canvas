// src/lib/ipc/events.ts
import type { UnlistenFn } from '@tauri-apps/api/event'
import { listenIpc } from './registry'
import type { IpcSessionEvent } from './types'

export const ipcEvents = {
  onSessionEvent: (handler: (event: IpcSessionEvent) => void): Promise<UnlistenFn> =>
    listenIpc('session-event', handler),
}
