import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WalletView from '../WalletView'
import { getOwnedNFTs } from 'thirdweb/extensions/erc721'

// Mock WalletConnectSection (provides thirdwebClient)
vi.mock('../WalletConnectSection', () => ({
  thirdwebClient: {},
}))

// Mock thirdweb core
vi.mock('thirdweb', () => ({
  getContract: vi.fn(() => ({ address: '0xNFT' })),
}))

// Mock thirdweb chains
vi.mock('thirdweb/chains', () => ({
  ethereum: { id: 1 },
}))

// Mock thirdweb ERC721 extension
vi.mock('thirdweb/extensions/erc721', () => ({
  getOwnedNFTs: vi.fn(),
  transferFrom: vi.fn(() => ({ type: 'prepared-tx' })),
}))

// Controlled mocks for account + query state + send transaction
const mockUseActiveAccount = vi.fn()
const mockUseReadContract = vi.fn()
const mockMutate = vi.fn()
const mockRefetch = vi.fn()

vi.mock('thirdweb/react', () => ({
  ThirdwebProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConnectButton: () => <button>Connect Wallet</button>,
  useActiveAccount: () => mockUseActiveAccount(),
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
  useSendTransaction: () => ({ mutate: mockMutate }),
}))

// Mock IpfsImage
vi.mock('../IpfsImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const TWO_NFTS = [
  { id: 0n, metadata: { name: 'Balloon #0', image: 'ipfs://QmA' } },
  { id: 1n, metadata: { name: 'Balloon #1', image: 'ipfs://QmB' } },
]

const VALID_ADDRESS = '0x1234567890123456789012345678901234567890'

describe('WalletView', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    mockRefetch.mockReset()
  })

  // --- ConnectButton ---

  it('shows ConnectButton when no wallet is connected', () => {
    mockUseActiveAccount.mockReturnValue(undefined)
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false, refetch: mockRefetch })
    render(<WalletView />)
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('renders ConnectButton when wallet is connected', () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
    mockUseReadContract.mockReturnValue({ data: [], isLoading: false, refetch: mockRefetch })
    render(<WalletView />)
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('shows loading state while fetching NFTs', () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: true, refetch: mockRefetch })
    render(<WalletView />)
    expect(screen.getByText(/loading your collection/i)).toBeInTheDocument()
  })

  it('shows empty state when wallet has no NFTs', () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
    mockUseReadContract.mockReturnValue({ data: [], isLoading: false, refetch: mockRefetch })
    render(<WalletView />)
    expect(screen.getByText(/no balloons found/i)).toBeInTheDocument()
  })

  it('renders NFT cards when NFTs are present', () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
    mockUseReadContract.mockReturnValue({
      data: [{ id: 0n, metadata: { name: 'Balloons in the Sky #0 — Sunrise', image: 'ipfs://QmTest123' } }],
      isLoading: false,
      refetch: mockRefetch,
    })
    render(<WalletView />)
    expect(mockUseReadContract).toHaveBeenCalledWith(
      getOwnedNFTs,
      expect.objectContaining({ owner: '0xABC' })
    )
    expect(screen.getByText('Balloons in the Sky #0 — Sunrise')).toBeInTheDocument()
    expect(screen.getByText(/token #0/i)).toBeInTheDocument()
    expect(screen.getByAltText('Balloons in the Sky #0 — Sunrise')).toBeInTheDocument()
  })

  it('renders multiple NFT cards', () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
    mockUseReadContract.mockReturnValue({ data: TWO_NFTS, isLoading: false, refetch: mockRefetch })
    render(<WalletView />)
    expect(screen.getByText('Balloon #0')).toBeInTheDocument()
    expect(screen.getByText('Balloon #1')).toBeInTheDocument()
  })

  // --- NFT Transfer ---

  describe('NFT Transfer', () => {
    beforeEach(() => {
      mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
      mockUseReadContract.mockReturnValue({ data: TWO_NFTS, isLoading: false, refetch: mockRefetch })
    })

    it('shows Transfer button on each NFT card', () => {
      render(<WalletView />)
      expect(screen.getAllByRole('button', { name: /^transfer$/i })).toHaveLength(2)
    })

    it('clicking Transfer shows address input and Send/Cancel buttons', async () => {
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^send$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    })

    it('Cancel returns card to idle', async () => {
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(screen.queryByPlaceholderText('0x...')).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /^transfer$/i })).toHaveLength(2)
    })

    it('Send with empty address shows "Invalid address" without submitting', async () => {
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      await userEvent.click(screen.getByRole('button', { name: /^send$/i }))
      expect(screen.getByText(/invalid address/i)).toBeInTheDocument()
      expect(mockMutate).not.toHaveBeenCalled()
    })

    it('Send with invalid address shows "Invalid address" without submitting', async () => {
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      await userEvent.type(screen.getByPlaceholderText('0x...'), 'not-an-address')
      await userEvent.click(screen.getByRole('button', { name: /^send$/i }))
      expect(screen.getByText(/invalid address/i)).toBeInTheDocument()
      expect(mockMutate).not.toHaveBeenCalled()
    })

    it('Send with zero address shows "Invalid address" without submitting', async () => {
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      await userEvent.type(screen.getByPlaceholderText('0x...'), '0x0000000000000000000000000000000000000000')
      await userEvent.click(screen.getByRole('button', { name: /^send$/i }))
      expect(screen.getByText(/invalid address/i)).toBeInTheDocument()
      expect(mockMutate).not.toHaveBeenCalled()
    })

    it('Send with valid address calls mutate and shows "Sending…"', async () => {
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      await userEvent.type(screen.getByPlaceholderText('0x...'), VALID_ADDRESS)
      await userEvent.click(screen.getByRole('button', { name: /^send$/i }))
      expect(mockMutate).toHaveBeenCalled()
      expect(screen.getByText(/sending/i)).toBeInTheDocument()
    })

    it('other cards Transfer buttons are disabled while any card is pending', async () => {
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      await userEvent.type(screen.getByPlaceholderText('0x...'), VALID_ADDRESS)
      await userEvent.click(screen.getByRole('button', { name: /^send$/i }))
      // Card 0 is pending — card 1 still shows Transfer but it should be disabled
      const transferBtns = screen.getAllByRole('button', { name: /^transfer$/i })
      expect(transferBtns[0]).toBeDisabled()
    })

    it('onSuccess calls refetch', async () => {
      mockMutate.mockImplementation((_tx: unknown, callbacks: { onSuccess?: () => void }) => {
        callbacks?.onSuccess?.()
      })
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      await userEvent.type(screen.getByPlaceholderText('0x...'), VALID_ADDRESS)
      await userEvent.click(screen.getByRole('button', { name: /^send$/i }))
      expect(mockRefetch).toHaveBeenCalled()
    })

    it('onError shows error message and keeps form open for retry', async () => {
      mockMutate.mockImplementation((_tx: unknown, callbacks: { onError?: (e: Error) => void }) => {
        callbacks?.onError?.(new Error('User rejected'))
      })
      render(<WalletView />)
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      await userEvent.type(screen.getByPlaceholderText('0x...'), VALID_ADDRESS)
      await userEvent.click(screen.getByRole('button', { name: /^send$/i }))
      expect(screen.getByText(/user rejected/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    })

    it('opening Transfer on card B resets card A to idle', async () => {
      render(<WalletView />)
      // Open card A
      await userEvent.click(screen.getAllByRole('button', { name: /^transfer$/i })[0])
      expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument()
      // Card B's Transfer is now the only Transfer button visible
      await userEvent.click(screen.getByRole('button', { name: /^transfer$/i }))
      // Card A back to idle (Transfer button), card B has form — so 1 Transfer button + 1 input
      expect(screen.getAllByRole('button', { name: /^transfer$/i })).toHaveLength(1)
      expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument()
    })
  })
})
