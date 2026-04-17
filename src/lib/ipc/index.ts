// src/lib/ipc/index.ts
export { ipcCommands } from './commands'
export { ipcEvents } from './events'
export { invokeIpc, listenIpc } from './registry'
export type { IpcEventRegistry, IpcRegistry } from './registry'
export type { IpcProjectInfo, IpcSessionDetail, IpcSessionEvent, IpcSessionInfo, IpcSessionStatus } from './types'
