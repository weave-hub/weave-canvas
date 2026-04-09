import { useState } from 'react'
import { Toolbar } from './components/toolbar'
import { SidePanel } from './components/side-panel'
import { CanvasArea } from './components/canvas-area'
import { StatusBar } from './components/status-bar'

function App() {
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground">
      <Toolbar onTogglePanel={() => setPanelOpen((prev) => !prev)} />
      <main className="relative flex-1 overflow-hidden">
        <CanvasArea activeSessionId={null} events={[]} />
        <SidePanel open={panelOpen} onOpenChange={setPanelOpen} />
      </main>
      <StatusBar />
    </div>
  )
}

export default App
