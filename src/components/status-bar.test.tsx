// src/components/status-bar.test.tsx
import { render, screen } from '@testing-library/react'
import { StatusBar } from './status-bar'

describe('StatusBar', () => {
  it('renders the status bar', () => {
    render(<StatusBar />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('displays ready text', () => {
    render(<StatusBar />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })
})
