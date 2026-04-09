import { render, screen } from '@testing-library/react'
import { CanvasArea } from './canvas-area'

vi.mock('./pixi-canvas', () => ({
  PixiCanvas: ({ events }: { events: unknown[] }) => <div data-testid="pixi-canvas">events: {events.length}</div>,
}))

describe('CanvasArea', () => {
  it('renders Empty when no active session', () => {
    render(<CanvasArea activeSessionId={null} events={[]} />)
    expect(screen.getByText(/add a session/i)).toBeInTheDocument()
  })

  it('renders PixiCanvas when active session exists', () => {
    render(<CanvasArea activeSessionId="session-1" events={[]} />)
    expect(screen.getByTestId('pixi-canvas')).toBeInTheDocument()
  })
})
