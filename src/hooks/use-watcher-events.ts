import { useEffect, useState } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { FileChangeEvent } from '../types'

const MAX_EVENTS_PER_SESSION = 500

export function useWatcherEvents() {
  const [events, setEvents] = useState<Map<string, FileChangeEvent[]>>(new Map())

  useEffect(() => {
    let unlisten: UnlistenFn | undefined

    listen<FileChangeEvent>('file-changed', (e) => {
      setEvents((prev) => {
        const next = new Map(prev)
        const sessionEvents = next.get(e.payload.session_id) ?? []
        const updated = [...sessionEvents, e.payload]
        next.set(
          e.payload.session_id,
          updated.length > MAX_EVENTS_PER_SESSION ? updated.slice(-MAX_EVENTS_PER_SESSION) : updated,
        )
        return next
      })
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [])

  const clearSession = (sessionId: string) => {
    setEvents((prev) => {
      const next = new Map(prev)
      next.delete(sessionId)
      return next
    })
  }

  return { events, clearSession }
}
