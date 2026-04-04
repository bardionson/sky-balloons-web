import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Use vi.hoisted so all values referenced in vi.mock factories are available after hoisting
const { mockUseOwnerAddress, mockUseActiveAccount, TEST_ARTIST } = vi.hoisted(() => ({
  mockUseOwnerAddress: vi.fn(),
  mockUseActiveAccount: vi.fn(),
  // ARTIST_ADDRESS is a module-level const in project-config — env mutation after import has no effect.
  // Mock the whole module so AccessControl sees a known value.
  TEST_ARTIST: '0xartist00000000000000000000000000000000000',
}))

vi.mock('@/lib/project-config', () => ({
  ARTIST_ADDRESS: TEST_ARTIST,
}))

// Mock useOwnerAddress — we test AccessControl's logic, not the hook internals
vi.mock('@/lib/hooks/useOwnerAddress', () => ({
  useOwnerAddress: mockUseOwnerAddress,
}))

// Mock useActiveAccount to control which wallet is connected
vi.mock('thirdweb/react', () => ({
  useActiveAccount: mockUseActiveAccount,
}))

import AccessControl from '../AccessControl'

const OWNER = '0xowner000000000000000000000000000000000000'
const OTHER = '0xother000000000000000000000000000000000000'

describe('AccessControl — owner role', () => {
  beforeEach(() => {
    mockUseOwnerAddress.mockReset()
    mockUseActiveAccount.mockReset()
  })

  it('shows lookup indicator while isBlocked is true', () => {
    mockUseOwnerAddress.mockReturnValue({ ownerAddress: undefined, isBlocked: true })
    mockUseActiveAccount.mockReturnValue({ address: OTHER })
    render(<AccessControl requiredRole="owner"><div>secret</div></AccessControl>)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByText(/deed_lookup_in_progress/i)).toBeInTheDocument()
  })

  it('shows access denied when connected wallet is not the deed holder', () => {
    mockUseOwnerAddress.mockReturnValue({ ownerAddress: OWNER, isBlocked: false })
    mockUseActiveAccount.mockReturnValue({ address: OTHER })
    render(<AccessControl requiredRole="owner"><div>secret</div></AccessControl>)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByText(/access_denied/i)).toBeInTheDocument()
  })

  it('renders children when connected wallet is the deed holder', () => {
    mockUseOwnerAddress.mockReturnValue({ ownerAddress: OWNER, isBlocked: false })
    mockUseActiveAccount.mockReturnValue({ address: OWNER })
    render(<AccessControl requiredRole="owner"><div>secret</div></AccessControl>)
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('renders children when connected wallet matches deed holder case-insensitively', () => {
    mockUseOwnerAddress.mockReturnValue({ ownerAddress: OWNER, isBlocked: false })
    mockUseActiveAccount.mockReturnValue({ address: OWNER.toUpperCase() })
    render(<AccessControl requiredRole="owner"><div>secret</div></AccessControl>)
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})

describe('AccessControl — artist role', () => {
  beforeEach(() => {
    mockUseOwnerAddress.mockReset()
    mockUseActiveAccount.mockReset()
    // hook is always called (Rules of Hooks) — return a neutral non-blocking value
    mockUseOwnerAddress.mockReturnValue({ ownerAddress: undefined, isBlocked: false })
  })

  it('shows access denied when connected wallet does not match ARTIST_ADDRESS', () => {
    // NODE_ENV is 'test' (not 'development') so isDev bypass does NOT apply.
    mockUseActiveAccount.mockReturnValue({ address: OTHER })
    render(<AccessControl requiredRole="artist"><div>artist content</div></AccessControl>)
    expect(screen.queryByText('artist content')).not.toBeInTheDocument()
    expect(screen.getByText(/access_denied/i)).toBeInTheDocument()
  })

  it('renders children when connected wallet matches ARTIST_ADDRESS', () => {
    mockUseActiveAccount.mockReturnValue({ address: TEST_ARTIST })
    render(<AccessControl requiredRole="artist"><div>artist content</div></AccessControl>)
    expect(screen.getByText('artist content')).toBeInTheDocument()
  })
})
