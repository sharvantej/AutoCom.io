import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../app/App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText(/Loading dashboard/i)).toBeInTheDocument()
  })
})
