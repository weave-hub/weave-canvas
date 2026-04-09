import { useState } from 'react'
import { PixiCanvas } from './components/pixi-canvas'
import { useSessions } from './hooks/use-sessions'
import { useWatcherEvents } from './hooks/use-watcher-events'

function App() {
  const { sessions, addSession, removeSession } = useSessions()
  const { events, clearSession } = useWatcherEvents()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const activeSessionId = selectedSessionId ?? sessions[0]?.id ?? null

  const handleAddSession = async () => {
    const path = window.prompt('Watch directory path:')
    if (path) {
      try {
        const session = await addSession(path)
        setSelectedSessionId(session.id)
      } catch (e) {
        console.error('Failed to add session:', e)
      }
    }
  }

  const handleRemoveSession = async (id: string) => {
    await removeSession(id)
    clearSession(id)
    if (activeSessionId === id) {
      setSelectedSessionId(sessions.find((s) => s.id !== id)?.id ?? null)
    }
  }

  const activeEvents = activeSessionId ? (events.get(activeSessionId) ?? []) : []

  return (
    <div className="flex flex-col w-screen h-screen bg-surface text-text">
      <div className="flex items-center gap-3 px-4 py-2 bg-surface-raised border-b border-border text-sm shrink-0">
        <span className="font-bold text-base">Weave</span>
        <button
          onClick={handleAddSession}
          className="px-3 py-1 bg-primary text-white border-none rounded cursor-pointer text-[13px] hover:bg-primary-hover"
        >
          + Add Session
        </button>
        <span className="opacity-60 ml-auto">{sessions.length} sessions</span>
      </div>
      {sessions.length > 0 && (
        <div className="flex gap-0.5 px-4 bg-surface-raised border-b border-border shrink-0">
          {sessions.map((s) => {
            const dirName = s.path.split(/[/\\]/).slice(-2, -1)[0] ?? s.path
            return (
              <button
                key={s.id}
                className={`flex items-center gap-2 px-3 py-1.5 bg-transparent border-none border-b-2 cursor-pointer text-[13px] ${
                  s.id === activeSessionId ? 'text-text border-b-primary' : 'text-text-muted border-b-transparent'
                } hover:text-text`}
                onClick={() => setSelectedSessionId(s.id)}
              >
                <span>{dirName}</span>
                <span
                  className="opacity-40 text-sm hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveSession(s.id)
                  }}
                >
                  ×
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {activeSessionId ? (
          <PixiCanvas key={activeSessionId} events={activeEvents} />
        ) : (
          <div className="flex items-center justify-center h-full opacity-40 text-base">
            <p>Add a session to start monitoring</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
