import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Session } from '../types'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])

  const refresh = useCallback(async () => {
    const result = await invoke<Session[]>('list_sessions')
    setSessions(result)
  }, [])

  const addSession = useCallback(
    async (path: string) => {
      const session = await invoke<Session>('add_session', { path })
      await refresh()
      return session
    },
    [refresh],
  )

  const removeSession = useCallback(
    async (id: string) => {
      await invoke<boolean>('remove_session', { id })
      await refresh()
    },
    [refresh],
  )

  return { sessions, refresh, addSession, removeSession }
}
