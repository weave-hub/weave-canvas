// src/lib/ipc/registry.ts
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { IpcProjectInfo, IpcSessionDetail, IpcSessionEvent, IpcSessionInfo } from './types'

// Tauri 커맨드 시그니처의 단일 출처.
// 각 엔트리: { args: ...; result: ... }. 인자 없는 커맨드는 args: void.
// 키는 반드시 Rust #[tauri::command] 함수명(snake_case)과 일치해야 함.
// 한계: Rust 쪽에 신규 커맨드가 추가돼도 이 레지스트리가 자동으로 알지 못한다
//       (tauri-specta 미도입 결정의 trade-off). Rust↔TS 동기화는 수동.
export type IpcRegistry = {
  list_active_sessions: { args: void; result: IpcSessionEvent[] }
  list_sessions: { args: { projectPath: string }; result: IpcSessionInfo[] }
  get_session_detail: { args: { sessionId: string }; result: IpcSessionDetail | null }
  list_projects: { args: void; result: IpcProjectInfo[] }
}

// Tauri 이벤트 채널의 단일 출처. 키는 Rust 쪽 emit 채널명과 일치해야 함.
export type IpcEventRegistry = {
  'session-event': IpcSessionEvent
}

// 타입 안전 invoke.
// args 타입이 void 인 경우 rest parameter가 빈 튜플로 축소되어
// invokeIpc('list_projects') 처럼 두 번째 인자 없이 호출 가능.
// `as never`: conditional rest tuple이라 TS가 args[0] 을 invoke 의
// InvokeArgs | undefined 파라미터로 narrow 하지 못함. 레지스트리 K 제약으로
// shape 은 이미 확정되어 있으므로 안전하며, 이 cast 는 본 함수 1곳에만 격리됨.
export function invokeIpc<K extends keyof IpcRegistry>(
  command: K,
  ...args: IpcRegistry[K]['args'] extends void ? [] : [IpcRegistry[K]['args']]
): Promise<IpcRegistry[K]['result']> {
  return invoke<IpcRegistry[K]['result']>(command, args[0] as never)
}

// 타입 안전 listen. Tauri의 Promise<UnlistenFn>을 그대로 노출.
export function listenIpc<K extends keyof IpcEventRegistry>(
  channel: K,
  handler: (payload: IpcEventRegistry[K]) => void,
): Promise<UnlistenFn> {
  return listen<IpcEventRegistry[K]>(channel, ({ payload }) => handler(payload))
}
