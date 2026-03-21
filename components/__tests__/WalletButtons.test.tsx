import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WalletButtons from '../WalletButtons'

const MINT_URL = 'https://example.com/mint/abc-123'

describe('WalletButtons', () => {
  it('renders all four wallet buttons', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    expect(screen.getByText(/MetaMask/i)).toBeInTheDocument()
    expect(screen.getByText(/Coinbase/i)).toBeInTheDocument()
    expect(screen.getByText(/Rabby/i)).toBeInTheDocument()
    expect(screen.getByText(/Rainbow/i)).toBeInTheDocument()
    expect(screen.getByText(/Other Wallet/i)).toBeInTheDocument()
  })

  it('MetaMask link uses metamask.app.link format', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    const link = screen.getByText(/MetaMask/i).closest('a')
    expect(link?.href).toContain('metamask.app.link/dapp/')
    expect(link?.href).toContain('example.com/mint/abc-123')
  })

  it('Coinbase link uses go.cb-wallet.com format', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    const link = screen.getByText(/Coinbase/i).closest('a')
    expect(link?.href).toContain('go.cb-wallet.com/dapp')
  })

  it('Rainbow link uses rnbwapp.com format', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    const link = screen.getByText(/Rainbow/i).closest('a')
    expect(link?.href).toContain('rnbwapp.com/dapp')
  })

  it('all wallet links open in the same tab (no target _blank)', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    const links = screen.getAllByRole('link')
    // Deep links must open in the same tab — _blank breaks mobile wallet deep links
    links.forEach(link => {
      expect(link).not.toHaveAttribute('target', '_blank')
    })
  })
})
