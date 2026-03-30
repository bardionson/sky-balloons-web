# Wallet Actions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent ConnectButton (wallet management icon) and per-card NFT transfer to the `/wallet` page.

**Architecture:** Both features modify `components/WalletView.tsx` only. Task 1 restructures `WalletViewInner` so `ConnectButton` always renders at the top. Task 2 adds a `transferState` state variable and per-card transfer UI using `transferFrom` + `useSendTransaction` from Thirdweb v5.

**Tech Stack:** Next.js 14 App Router, Thirdweb v5 (`thirdweb/react`, `thirdweb/extensions/erc721`), Vitest + Testing Library

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/WalletView.tsx` | Modify | ConnectButton always visible + per-card transfer UI |
| `components/__tests__/WalletView.test.tsx` | Modify | Tests for persistent ConnectButton + all transfer states |

---

## Task 1: Persistent ConnectButton

**Files:**
- Modify: `components/WalletView.tsx`
- Modify: `components/__tests__/WalletView.test.tsx`

### Context

`WalletViewInner` currently returns early with a connect-only screen when `!account`. The `ConnectButton` never renders in the connected state. Users have no way to access the Thirdweb wallet modal (which contains private key export) after connecting.

The fix: restructure `WalletViewInner` to always render `ConnectButton` at the top, then conditionally render NFT content below.

The existing test at line 47 checks for `"connect your wallet"` text that will be removed — update that test too.

- [ ] **Step 1: Write the failing test**

Open `components/__tests__/WalletView.test.tsx`. Make two changes:

1. Replace the `'shows connect prompt when no wallet is connected'` test body — remove the `connect your wallet` text check (that text is being deleted) and keep only the button check.

2. Add a new test after it: `'renders ConnectButton when wallet is connected'`.

The updated/new tests:

```tsx
it('shows ConnectButton when no wallet is connected', () => {
  mockUseActiveAccount.mockReturnValue(undefined)
  mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false })
  render(<WalletView />)
  expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
})

it('renders ConnectButton when wallet is connected', () => {
  mockUseActiveAccount.mockReturnValue({ address: '0xABC' })
  mockUseReadContract.mockReturnValue({ data: [], isLoading: false })
  render(<WalletView />)
  expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify the new test fails**

```bash
cd /home/bardionson/sky_balloons_web
npx vitest run components/__tests__/WalletView.test.tsx
```

Expected: `'renders ConnectButton when wallet is connected'` FAILS. The other tests should still pass.

- [ ] **Step 3: Rewrite `components/WalletView.tsx`**

Replace the entire file with:

```tsx
'use client'

import { getContract } from 'thirdweb'
import { ethereum } from 'thirdweb/chains'
import { ThirdwebProvider, ConnectButton, useActiveAccount, useReadContract } from 'thirdweb/react'
import { getOwnedNFTs } from 'thirdweb/extensions/erc721'
import { thirdwebClient } from './WalletConnectSection'
import IpfsImage from './IpfsImage'

const NFT_ADDRESS = process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS
if (!NFT_ADDRESS) throw new Error('NEXT_PUBLIC_BALLOONS_NFT_ADDRESS is not set')

const contract = getContract({
  client: thirdwebClient,
  address: NFT_ADDRESS as `0x${string}`,
  chain: ethereum,
})

function WalletViewInner() {
  const account = useActiveAccount()

  const { data: ownedNFTs, isLoading } = useReadContract(getOwnedNFTs, {
    contract,
    owner: account?.address ?? '0x0',
    queryOptions: { enabled: !!account?.address },
  })

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <ConnectButton client={thirdwebClient} theme="dark" />

      {account && isLoading && (
        <p className="text-white/40 text-sm">Loading your collection…</p>
      )}

      {account && !isLoading && (!ownedNFTs || ownedNFTs.length === 0) && (
        <div className="text-center">
          <p className="text-white/40 text-sm">No Balloons found in this wallet.</p>
          <p className="text-white/20 text-xs mt-2 font-mono">{account.address}</p>
        </div>
      )}

      {account && !isLoading && ownedNFTs && ownedNFTs.length > 0 && (
        <div className="flex flex-col gap-4 w-full">
          <p className="text-white/30 text-xs font-mono text-center truncate">{account.address}</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {ownedNFTs.map((nft) => {
              const cid = (nft.metadata.image as string ?? '').replace('ipfs://', '')
              return (
                <div
                  key={nft.id.toString()}
                  className="rounded-xl overflow-hidden bg-white/5 border border-white/10"
                >
                  <IpfsImage
                    cid={cid}
                    alt={nft.metadata.name ?? ''}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="p-3">
                    <p className="text-white text-sm font-medium">{nft.metadata.name}</p>
                    <p className="text-white/40 text-xs mt-1">Token #{nft.id.toString()}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WalletView() {
  return (
    <ThirdwebProvider>
      <WalletViewInner />
    </ThirdwebProvider>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/bardionson/sky_balloons_web
npx vitest run components/__tests__/WalletView.test.tsx
```

Expected: All 6 tests pass (5 original, 1 new — the renamed "shows connect prompt" and new "renders ConnectButton when connected").

- [ ] **Step 5: Commit**

```bash
cd /home/bardionson/sky_balloons_web
git add components/WalletView.tsx components/__tests__/WalletView.test.tsx
git commit -m "feat: always render ConnectButton in WalletView for wallet management access"
```

---

## Task 2: NFT Transfer

**Files:**
- Modify: `components/WalletView.tsx`
- Modify: `components/__tests__/WalletView.test.tsx`

### Context

Each NFT card gets an inline transfer form. State is tracked in a single `transferState` variable (one card active at a time). The transfer uses `transferFrom` from `thirdweb/extensions/erc721` submitted via `useSendTransaction`.

**State shape:**
```tsx
type TransferState = {
  tokenId: bigint
  status: 'open' | 'pending'
  address: string
  error?: string  // validation error OR tx error — both shown in 'open' status
}
```

**Address validation helper:**
```tsx
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr) && addr !== ZERO_ADDRESS
}
```

- [ ] **Step 1: Write the failing tests**

Replace the entire `components/__tests__/WalletView.test.tsx` with:

```tsx
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
```

- [ ] **Step 2: Run tests to verify the new tests fail**

```bash
cd /home/bardionson/sky_balloons_web
npx vitest run components/__tests__/WalletView.test.tsx
```

Expected: The 10 new transfer tests FAIL with "Unable to find role 'button' name /^transfer$/i" (Transfer button doesn't exist yet). The 6 existing tests pass.

- [ ] **Step 3: Rewrite `components/WalletView.tsx` with transfer feature**

Replace the entire file with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { getContract } from 'thirdweb'
import { ethereum } from 'thirdweb/chains'
import { ThirdwebProvider, ConnectButton, useActiveAccount, useReadContract, useSendTransaction } from 'thirdweb/react'
import { getOwnedNFTs, transferFrom } from 'thirdweb/extensions/erc721'
import { thirdwebClient } from './WalletConnectSection'
import IpfsImage from './IpfsImage'

const NFT_ADDRESS = process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS
if (!NFT_ADDRESS) throw new Error('NEXT_PUBLIC_BALLOONS_NFT_ADDRESS is not set')

const contract = getContract({
  client: thirdwebClient,
  address: NFT_ADDRESS as `0x${string}`,
  chain: ethereum,
})

type TransferState = {
  tokenId: bigint
  status: 'open' | 'pending'
  address: string
  error?: string
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr) && addr !== ZERO_ADDRESS
}

function WalletViewInner() {
  const account = useActiveAccount()
  const [transfer, setTransfer] = useState<TransferState | null>(null)

  const { data: ownedNFTs, isLoading, refetch } = useReadContract(getOwnedNFTs, {
    contract,
    owner: account?.address ?? '0x0',
    queryOptions: { enabled: !!account?.address },
  })

  const { mutate: sendTx } = useSendTransaction()

  // Detect wallet disconnect during pending transfer
  useEffect(() => {
    if (!account && transfer?.status === 'pending') {
      setTransfer(prev => prev ? { ...prev, status: 'open', error: 'Wallet disconnected.' } : null)
    }
  }, [account, transfer?.status])

  const anyPending = transfer?.status === 'pending'

  function openTransfer(tokenId: bigint) {
    if (anyPending) return
    setTransfer({ tokenId, status: 'open', address: '' })
  }

  function handleSend(tokenId: bigint) {
    const addr = transfer?.address ?? ''
    if (!isValidAddress(addr)) {
      setTransfer(prev => prev ? { ...prev, error: 'Invalid address' } : null)
      return
    }
    setTransfer(prev => prev ? { ...prev, status: 'pending', error: undefined } : null)
    const tx = transferFrom({
      contract,
      from: account!.address as `0x${string}`,
      to: addr as `0x${string}`,
      tokenId,
    })
    sendTx(tx, {
      onSuccess: () => refetch(),
      onError: (e: Error) =>
        setTransfer(prev => prev ? { ...prev, status: 'open', error: e.message || 'Transfer failed.' } : null),
    })
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <ConnectButton client={thirdwebClient} theme="dark" />

      {account && isLoading && (
        <p className="text-white/40 text-sm">Loading your collection…</p>
      )}

      {account && !isLoading && (!ownedNFTs || ownedNFTs.length === 0) && (
        <div className="text-center">
          <p className="text-white/40 text-sm">No Balloons found in this wallet.</p>
          <p className="text-white/20 text-xs mt-2 font-mono">{account.address}</p>
        </div>
      )}

      {account && !isLoading && ownedNFTs && ownedNFTs.length > 0 && (
        <div className="flex flex-col gap-4 w-full">
          <p className="text-white/30 text-xs font-mono text-center truncate">{account.address}</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {ownedNFTs.map((nft) => {
              const cid = (nft.metadata.image as string ?? '').replace('ipfs://', '')
              const isThisCard = transfer?.tokenId === nft.id
              const cardStatus = isThisCard ? transfer!.status : null

              return (
                <div
                  key={nft.id.toString()}
                  className="rounded-xl overflow-hidden bg-white/5 border border-white/10"
                >
                  <IpfsImage
                    cid={cid}
                    alt={nft.metadata.name ?? ''}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="p-3">
                    <p className="text-white text-sm font-medium">{nft.metadata.name}</p>
                    <p className="text-white/40 text-xs mt-1">Token #{nft.id.toString()}</p>

                    {cardStatus === null && (
                      <button
                        onClick={() => openTransfer(nft.id)}
                        disabled={anyPending}
                        className="mt-2 text-xs text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Transfer
                      </button>
                    )}

                    {cardStatus === 'open' && (
                      <div className="mt-2 flex flex-col gap-2">
                        <input
                          type="text"
                          value={transfer?.address ?? ''}
                          onChange={(e) =>
                            setTransfer(prev => prev ? { ...prev, address: e.target.value, error: undefined } : null)
                          }
                          placeholder="0x..."
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white placeholder-white/20"
                        />
                        {transfer?.error && (
                          <p className="text-red-400 text-xs">{transfer.error}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSend(nft.id)}
                            className="text-xs text-white/70 hover:text-white border border-white/20 rounded px-2 py-1"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => setTransfer(null)}
                            className="text-xs text-white/40 hover:text-white/60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {cardStatus === 'pending' && (
                      <div className="mt-2 flex flex-col gap-2">
                        <input
                          type="text"
                          value={transfer?.address ?? ''}
                          disabled
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white/40"
                        />
                        <button
                          disabled
                          className="text-xs text-white/30 border border-white/10 rounded px-2 py-1 cursor-not-allowed"
                        >
                          Sending…
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WalletView() {
  return (
    <ThirdwebProvider>
      <WalletViewInner />
    </ThirdwebProvider>
  )
}
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
cd /home/bardionson/sky_balloons_web
npx vitest run components/__tests__/WalletView.test.tsx
```

Expected: All 16 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd /home/bardionson/sky_balloons_web
npx vitest run
```

Expected: All tests pass (no regressions).

- [ ] **Step 6: Commit**

```bash
cd /home/bardionson/sky_balloons_web
git add components/WalletView.tsx components/__tests__/WalletView.test.tsx
git commit -m "feat: add NFT transfer to wallet view"
```
