import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the thirdweb client source so module-level getContract doesn't need a real client
vi.mock('@/components/WalletConnectSection', () => ({
  thirdwebClient: { clientId: 'test' },
}))

// Mock getContract — it's a pure factory; we don't need a real contract object in tests
vi.mock('thirdweb', () => ({
  getContract: vi.fn(() => ({ address: '0xDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEd' })),
}))

// ownerOf is a pure function that just builds a query descriptor — mock it as an identity
vi.mock('thirdweb/extensions/erc721', () => ({
  ownerOf: vi.fn((args: unknown) => args),
}))

// Control useReadContract to simulate different blockchain states
const mockUseReadContract = vi.fn()
vi.mock('thirdweb/react', () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
}))

// Import after mocks are in place
import { useOwnerAddress } from '../useOwnerAddress'

describe('useOwnerAddress', () => {
  beforeEach(() => {
    mockUseReadContract.mockReset()
  })

  it('returns isBlocked: true and no address while RPC call is pending', () => {
    mockUseReadContract.mockReturnValue({ data: undefined, isPending: true, isError: false })
    const { result } = renderHook(() => useOwnerAddress())
    expect(result.current.isBlocked).toBe(true)
    expect(result.current.ownerAddress).toBeUndefined()
  })

  it('returns isBlocked: true and no address when RPC call errors', () => {
    mockUseReadContract.mockReturnValue({ data: undefined, isPending: false, isError: true })
    const { result } = renderHook(() => useOwnerAddress())
    expect(result.current.isBlocked).toBe(true)
    expect(result.current.ownerAddress).toBeUndefined()
  })

  it('returns isBlocked: false and lowercased ownerAddress when resolved', () => {
    mockUseReadContract.mockReturnValue({
      data: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      isPending: false,
      isError: false,
    })
    const { result } = renderHook(() => useOwnerAddress())
    expect(result.current.isBlocked).toBe(false)
    expect(result.current.ownerAddress).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
  })

  it('returns isBlocked: false and undefined ownerAddress when resolved with no holder data', () => {
    mockUseReadContract.mockReturnValue({ data: undefined, isPending: false, isError: false })
    const { result } = renderHook(() => useOwnerAddress())
    expect(result.current.isBlocked).toBe(false)
    expect(result.current.ownerAddress).toBeUndefined()
  })
})
