import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
}))

// Controlled mocks for account + query state
const mockUseActiveAccount = vi.fn()
const mockUseReadContract = vi.fn()

vi.mock('thirdweb/react', () => ({
  ThirdwebProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConnectButton: () => <button>Connect Wallet</button>,
  useActiveAccount: () => mockUseActiveAccount(),
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
}))

// Mock IpfsImage
vi.mock('../IpfsImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

describe('WalletView', () => {
  it('shows connect prompt when no wallet is connected', () => {
    mockUseActiveAccount.mockReturnValue(undefined)
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false })
    render(<WalletView />)
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('shows loading state while fetching NFTs', () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: true })
    render(<WalletView />)
    expect(screen.getByText(/loading your collection/i)).toBeInTheDocument()
  })

  it('shows empty state when wallet has no NFTs', () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
    mockUseReadContract.mockReturnValue({ data: [], isLoading: false })
    render(<WalletView />)
    expect(screen.getByText(/no balloons found/i)).toBeInTheDocument()
  })

  it('renders NFT cards when NFTs are present', () => {
    mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
    mockUseReadContract.mockReturnValue({
      data: [
        {
          id: 0n,
          metadata: {
            name: 'Balloons in the Sky #0 — Sunrise',
            image: 'ipfs://QmTest123',
          },
        },
      ],
      isLoading: false,
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
    mockUseReadContract.mockReturnValue({
      data: [
        { id: 0n, metadata: { name: 'Balloon #0', image: 'ipfs://QmA' } },
        { id: 1n, metadata: { name: 'Balloon #1', image: 'ipfs://QmB' } },
      ],
      isLoading: false,
    })
    render(<WalletView />)
    expect(screen.getByText('Balloon #0')).toBeInTheDocument()
    expect(screen.getByText('Balloon #1')).toBeInTheDocument()
  })
})
