export interface Session {
  id: string
  path: string
  name: string
}

export interface FileChangeEvent {
  session_id: string
  paths: string[]
  kind: string
}
