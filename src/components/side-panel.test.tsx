// src/components/side-panel.test.tsx
import { render, screen } from '@testing-library/react'
import { SidePanel } from './side-panel'

describe('SidePanel', () => {
  it('renders card content when open', () => {
    render(<SidePanel open={true} onOpenChange={() => {}} />)
    expect(screen.getByText('Panel')).toBeInTheDocument()
  })

  it('hides card content when closed', () => {
    render(<SidePanel open={false} onOpenChange={() => {}} />)
    expect(screen.queryByText('Panel')).not.toBeInTheDocument()
  })

  it('renders toggle button when closed', () => {
    render(<SidePanel open={false} onOpenChange={() => {}} />)
    expect(screen.getByRole('button', { name: /open panel/i })).toBeInTheDocument()
  })
})
