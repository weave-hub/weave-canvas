// src/components/toolbar.test.tsx
import { render, screen } from '@testing-library/react'
import { Toolbar } from './toolbar'

describe('Toolbar', () => {
  it('renders the app logo text', () => {
    render(<Toolbar onTogglePanel={() => {}} />)
    expect(screen.getByText('Weave')).toBeInTheDocument()
  })

  it('renders the panel toggle button', () => {
    render(<Toolbar onTogglePanel={() => {}} />)
    expect(screen.getByRole('button', { name: /panel/i })).toBeInTheDocument()
  })

  it('calls onTogglePanel when toggle button is clicked', async () => {
    const onToggle = vi.fn()
    const { user } = await import('@testing-library/user-event').then((m) => ({
      user: m.default.setup(),
    }))
    render(<Toolbar onTogglePanel={onToggle} />)
    await user.click(screen.getByRole('button', { name: /panel/i }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
