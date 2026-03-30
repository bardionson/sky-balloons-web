# Wallet View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/wallet` page where collectors can connect their Thirdweb in-app wallet and see their owned Balloons NFTs.

**Architecture:** A server page at `app/wallet/page.tsx` renders a client component `WalletView` that uses Thirdweb's `useActiveAccount` + `useReadContract(getOwnedNFTs)` to fetch and display tokens. No new dependencies — thirdweb is already installed.

**Tech Stack:** Next.js 14 App Router, Thirdweb v5 (`thirdweb/react`, `thirdweb/extensions/erc721`), viem (mainnet chain constant), Vitest + Testing Library

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/WalletView.tsx` | Create | Connect button + NFT grid client component |
| `components/__tests__/WalletView.test.tsx` | Create | Unit tests for all WalletView states |
| `app/wallet/page.tsx` | Create | Server page wrapper |

---

## Task 1: WalletView component (TDD)

**Files:**
- Create: `components/__tests__/WalletView.test.tsx`
- Create: `components/WalletView.tsx`

- [ ] **Step 1: Write the failing tests**

Create `components/__tests__/WalletView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WalletView from '../WalletView'

// Mock WalletConnectSection (provides thirdwebClient)
vi.mock('../WalletConnectSection', () => ({
  thirdwebClient: {},
}))

// Mock thirdweb core
vi.mock('thirdweb', () => ({
  getContract: vi.fn(() => ({ address: '0xNFT' })),
}))

// Mock thirdweb chains
vi.mock('viem/chains', () => ({
  mainnet: { id: 1 },
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
  useReadContract: () => mockUseReadContract(),
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/bardionson/sky_balloons_web
npx vitest run components/__tests__/WalletView.test.tsx
```

Expected: FAIL — `Cannot find module '../WalletView'`

- [ ] **Step 3: Create `components/WalletView.tsx`**

```tsx
'use client'

import { getContract } from 'thirdweb'
import { mainnet } from 'viem/chains'
import { ThirdwebProvider, ConnectButton, useActiveAccount, useReadContract } from 'thirdweb/react'
import { getOwnedNFTs } from 'thirdweb/extensions/erc721'
import { thirdwebClient } from './WalletConnectSection'
import IpfsImage from './IpfsImage'

const NFT_ADDRESS = process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS ?? ''

const contract = getContract({
  client: thirdwebClient,
  address: NFT_ADDRESS as `0x${string}`,
  chain: mainnet as unknown as Parameters<typeof getContract>[0]['chain'],
})

function WalletViewInner() {
  const account = useActiveAccount()

  const { data: ownedNFTs, isLoading } = useReadContract(getOwnedNFTs, {
    contract,
    address: account?.address ?? '0x0',
    queryOptions: { enabled: !!account?.address },
  })

  if (!account) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-white/60 text-sm">Connect your wallet to view your collection.</p>
        <ConnectButton client={thirdwebClient} theme="dark" />
      </div>
    )
  }

  if (isLoading) {
    return <p className="text-white/40 text-sm">Loading your collection…</p>
  }

  if (!ownedNFTs || ownedNFTs.length === 0) {
    return (
      <div className="text-center">
        <p className="text-white/40 text-sm">No Balloons found in this wallet.</p>
        <p className="text-white/20 text-xs mt-2 font-mono">{account.address}</p>
      </div>
    )
  }

  return (
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

Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
cd /home/bardionson/sky_balloons_web
git add components/WalletView.tsx components/__tests__/WalletView.test.tsx
git commit -m "feat: add WalletView component with NFT display"
```

---

## Task 2: Wallet page

**Files:**
- Create: `app/wallet/page.tsx`

- [ ] **Step 1: Create `app/wallet/page.tsx`**

```tsx
import type { Metadata } from 'next'
import WalletView from '@/components/WalletView'
import { PROJECT_NAME, ARTIST_NAME, NETWORK_NAME } from '@/lib/project-config'

export const metadata: Metadata = {
  title: `${PROJECT_NAME} — My Collection`,
  description: `View your ${PROJECT_NAME} NFTs by ${ARTIST_NAME}`,
}

export default function WalletPage() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-white/40 text-xs tracking-widest uppercase mb-2">{ARTIST_NAME}</p>
        <h1 className="text-3xl font-light text-white tracking-wide">{PROJECT_NAME}</h1>
        <p className="text-white/30 text-sm mt-2">My Collection</p>
      </div>

      <div className="w-full max-w-xl">
        <WalletView />
      </div>

      <footer className="mt-16 text-white/20 text-xs text-center">
        <p>{NETWORK_NAME}</p>
      </footer>
    </main>
  )
}
```

- [ ] **Step 2: Verify it renders**

Start the dev server and open `http://localhost:3000/wallet`. You should see:
- The project header
- "Connect your wallet to view your collection." with a Connect button
- After connecting with the email used during minting, your Balloon NFT card should appear

- [ ] **Step 3: Run the full test suite**

```bash
cd /home/bardionson/sky_balloons_web
npx vitest run
```

Expected: All existing tests still pass + 5 new WalletView tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/bardionson/sky_balloons_web
git add app/wallet/page.tsx
git commit -m "feat: add /wallet page for NFT collection view"
```
