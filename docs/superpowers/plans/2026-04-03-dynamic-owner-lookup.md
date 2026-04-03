# Dynamic Owner Lookup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `OWNER_ADDRESS` env var with a live on-chain lookup of whoever holds deed NFT token ID 0.

**Architecture:** A `useOwnerAddress()` hook reads `ownerOf(0)` from the deed contract via Thirdweb's `useReadContract`. It returns `{ ownerAddress, isBlocked }` where `isBlocked` covers both in-flight and error states. `AccessControl` and `Header` consume the hook instead of the static env var.

**Tech Stack:** Next.js 14, Thirdweb v5 React SDK (`useReadContract`, `thirdweb/extensions/erc721`), Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-03-dynamic-owner-lookup-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/project-config.ts` | Modify | Add `DEED_CONTRACT_ADDRESS`, `DEED_TOKEN_ID`; remove `OWNER_ADDRESS` |
| `vitest.setup.ts` | Modify | Add `NEXT_PUBLIC_DEED_CONTRACT_ADDRESS` stub |
| `lib/hooks/useOwnerAddress.ts` | **Create** | Hook: reads `ownerOf(0)` from deed contract, returns `{ ownerAddress, isBlocked }` |
| `lib/hooks/__tests__/useOwnerAddress.test.ts` | **Create** | Unit tests for the hook |
| `components/AccessControl.tsx` | Modify | Use hook; add lookup indicator for the pending state |
| `components/__tests__/AccessControl.test.tsx` | **Create** | Tests for all three owner access states |
| `components/Header.tsx` | Modify | Use hook; conditionally show ADMIN link |

> **Task ordering note:** `OWNER_ADDRESS` is removed from `lib/project-config.ts` in Task 1. Because `Header.tsx` and `AccessControl.tsx` import it, those component files must be updated in the same commit (Task 1) to avoid broken imports breaking the test suite before the hook exists. The hook is created in Task 2 as a follow-up.

---

## Chunk 1: Config, env stub, and hook (TDD)

### Task 1: Update config, env stub, and strip `OWNER_ADDRESS` from components

**Files:**
- Modify: `lib/project-config.ts`
- Modify: `vitest.setup.ts`
- Modify: `components/AccessControl.tsx` (import only — remove `OWNER_ADDRESS`, add placeholder)
- Modify: `components/Header.tsx` (import only — remove `OWNER_ADDRESS`, add placeholder)

This task removes `OWNER_ADDRESS` everywhere it is used so the test suite stays green before the hook lands in Task 2.

- [ ] **Step 1: Update `lib/project-config.ts`**

  Remove the line:
  ```ts
  export const OWNER_ADDRESS = process.env.NEXT_PUBLIC_OWNER_ADDRESS?.toLowerCase() ?? ''
  ```

  Add in its place:
  ```ts
  if (!process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS) {
    throw new Error('NEXT_PUBLIC_DEED_CONTRACT_ADDRESS is not set')
  }
  export const DEED_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS as `0x${string}`
  export const DEED_TOKEN_ID = 0n
  ```

- [ ] **Step 2: Add deed contract stub to `vitest.setup.ts`**

  Add alongside the existing stubs (use a valid 40-char hex address as the stub value):
  ```ts
  process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS = '0xDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEd'
  ```

  The file should now look like:
  ```ts
  import '@testing-library/jest-dom'

  process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS = '0xTEST_NFT_ADDRESS'
  process.env.NEXT_PUBLIC_INSTALLATION_CONTRACT_ADDRESS = '0xTEST_INSTALLATION_ADDRESS'
  process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS = '0xDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEdDeEd'
  ```

- [ ] **Step 3: Strip `OWNER_ADDRESS` from `components/AccessControl.tsx`**

  Replace the import line:
  ```ts
  import { OWNER_ADDRESS, ARTIST_ADDRESS } from '@/lib/project-config'
  ```
  with:
  ```ts
  import { ARTIST_ADDRESS } from '@/lib/project-config'
  ```

  Replace the access check for the owner role. The component currently has:
  ```ts
  const hasAccess = isDev || (requiredRole === 'artist'
    ? address === ARTIST_ADDRESS
    : address === OWNER_ADDRESS)
  ```

  Temporarily replace with a stub that always denies owner access (the real logic lands in Task 3):
  ```ts
  const hasAccess = isDev || (requiredRole === 'artist'
    ? address === ARTIST_ADDRESS
    : false)
  ```

- [ ] **Step 4: Strip `OWNER_ADDRESS` from `components/Header.tsx`**

  Replace the import line:
  ```ts
  import { PROJECT_NAME, OWNER_ADDRESS, ARTIST_ADDRESS } from '@/lib/project-config'
  ```
  with:
  ```ts
  import { PROJECT_NAME, ARTIST_ADDRESS } from '@/lib/project-config'
  ```

  Remove the block that pushes the ADMIN link (the real logic lands in Task 4):
  ```ts
  if (isDev || (account?.address && account.address.toLowerCase() === OWNER_ADDRESS)) {
    links.push({ label: 'ADMIN', href: '/owner' })
  }
  ```

- [ ] **Step 5: Run tests to confirm the suite is green**

  Run: `npm test`

  Expected: all existing tests PASS. (Owner-gated access now always denies in non-dev mode; this is intentional and temporary.)

- [ ] **Step 6: Commit**

  ```bash
  git add lib/project-config.ts vitest.setup.ts components/AccessControl.tsx components/Header.tsx
  git commit -m "feat: add deed contract config, remove static OWNER_ADDRESS"
  ```

---

### Task 2: Create `useOwnerAddress` hook (TDD)

**Files:**
- Create: `lib/hooks/__tests__/useOwnerAddress.test.ts`
- Create: `lib/hooks/useOwnerAddress.ts`

- [ ] **Step 1: Create the test file with failing tests**

  Create directory `lib/hooks/__tests__/` if it doesn't exist, then create `lib/hooks/__tests__/useOwnerAddress.test.ts`:

  ```ts
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
    useReadContract: mockUseReadContract,
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
  ```

- [ ] **Step 2: Run the tests to confirm they fail**

  Run: `npm test lib/hooks/__tests__/useOwnerAddress.test.ts`

  Expected: FAIL — `useOwnerAddress` does not exist yet.

- [ ] **Step 3: Create `lib/hooks/useOwnerAddress.ts`**

  Create `lib/hooks/useOwnerAddress.ts`:

  ```ts
  'use client'

  import { getContract } from 'thirdweb'
  import { mainnet, sepolia } from 'thirdweb/chains'
  import { useReadContract } from 'thirdweb/react'
  import { ownerOf } from 'thirdweb/extensions/erc721'
  import { thirdwebClient } from '@/components/WalletConnectSection'
  import { DEED_CONTRACT_ADDRESS, DEED_TOKEN_ID } from '@/lib/project-config'

  const CHAIN_ID = Number(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID ?? '11155111')
  const chain = CHAIN_ID === 1 ? mainnet : sepolia

  const deedContract = getContract({
    client: thirdwebClient,
    address: DEED_CONTRACT_ADDRESS,
    chain,
  })

  export function useOwnerAddress(): { ownerAddress: string | undefined; isBlocked: boolean } {
    const { data, isPending, isError } = useReadContract(ownerOf, {
      contract: deedContract,
      tokenId: DEED_TOKEN_ID,
    })

    const isBlocked = isPending || isError
    const ownerAddress = data ? (data as string).toLowerCase() : undefined

    return { ownerAddress, isBlocked }
  }
  ```

- [ ] **Step 4: Run the tests to confirm they pass**

  Run: `npm test lib/hooks/__tests__/useOwnerAddress.test.ts`

  Expected: all 4 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

  Run: `npm test`

  Expected: all tests PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/hooks/useOwnerAddress.ts lib/hooks/__tests__/useOwnerAddress.test.ts
  git commit -m "feat: add useOwnerAddress hook — reads deed NFT holder on-chain"
  ```

---

## Chunk 2: AccessControl and Header updates

### Task 3: Update `AccessControl.tsx` (TDD)

**Files:**
- Create: `components/__tests__/AccessControl.test.tsx`
- Modify: `components/AccessControl.tsx`

- [ ] **Step 1: Write failing tests for `AccessControl`**

  Create `components/__tests__/AccessControl.test.tsx`:

  ```tsx
  import { render, screen } from '@testing-library/react'
  import { vi, describe, it, expect, beforeEach } from 'vitest'

  // ARTIST_ADDRESS is a module-level const in project-config — env mutation after import has no effect.
  // Mock the whole module so AccessControl sees a known value.
  const TEST_ARTIST = '0xartist00000000000000000000000000000000000'
  vi.mock('@/lib/project-config', () => ({
    ARTIST_ADDRESS: TEST_ARTIST,
  }))

  // Mock useOwnerAddress — we test AccessControl's logic, not the hook internals
  const mockUseOwnerAddress = vi.fn()
  vi.mock('@/lib/hooks/useOwnerAddress', () => ({
    useOwnerAddress: mockUseOwnerAddress,
  }))

  // Mock useActiveAccount to control which wallet is connected
  const mockUseActiveAccount = vi.fn()
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
      expect(screen.getByText(/lookup in progress/i)).toBeInTheDocument()
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
  ```

- [ ] **Step 2: Run the tests to confirm they fail**

  Run: `npm test components/__tests__/AccessControl.test.tsx`

  Expected: FAIL — `AccessControl` still uses the old stub that always denies owner access, not the hook.

- [ ] **Step 3: Update `components/AccessControl.tsx`**

  Replace the entire file with:

  ```tsx
  'use client'

  import { useActiveAccount } from 'thirdweb/react'
  import { ARTIST_ADDRESS } from '@/lib/project-config'
  import { useOwnerAddress } from '@/lib/hooks/useOwnerAddress'
  import { ReactNode, useEffect, useState } from 'react'

  export default function AccessControl({
    children,
    requiredRole
  }: {
    children: ReactNode,
    requiredRole: 'artist' | 'owner'
  }) {
    const account = useActiveAccount()
    const { ownerAddress, isBlocked } = useOwnerAddress()
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
      setIsMounted(true)
    }, [])

    if (!isMounted) return null

    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) return <>{children}</>

    const address = account?.address?.toLowerCase()

    if (requiredRole === 'artist') {
      if (address !== ARTIST_ADDRESS) {
        return (
          <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-8">
            <div className="bg-error_container/20 border border-error_container p-8 rounded-sm text-center max-w-md">
              <p className="font-mono text-error font-bold mb-4">[ ACCESS_DENIED ]</p>
              <p className="font-mono text-error/80 text-xs">
                Unrecognized signature. You do not have `ARTIST` clearance to view this directory.
              </p>
            </div>
          </main>
        )
      }
      return <>{children}</>
    }

    // requiredRole === 'owner'
    if (isBlocked) {
      return (
        <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-8">
          <div className="bg-surface_container_highest border border-outline_variant/30 p-8 rounded-sm text-center max-w-md">
            <p className="font-mono text-on_surface_variant text-xs">[ Lookup in progress… ]</p>
            <p className="font-mono text-on_surface_variant/60 text-xs mt-2">
              Resolving deed holder from chain.
            </p>
          </div>
        </main>
      )
    }

    if (address !== ownerAddress) {
      return (
        <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-8">
          <div className="bg-error_container/20 border border-error_container p-8 rounded-sm text-center max-w-md">
            <p className="font-mono text-error font-bold mb-4">[ ACCESS_DENIED ]</p>
            <p className="font-mono text-error/80 text-xs">
              Unrecognized signature. You do not have `OWNER` clearance to view this directory.
            </p>
          </div>
        </main>
      )
    }

    return <>{children}</>
  }
  ```

- [ ] **Step 4: Run the AccessControl tests to confirm they pass**

  Run: `npm test components/__tests__/AccessControl.test.tsx`

  Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

  Run: `npm test`

  Expected: all tests PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add components/AccessControl.tsx components/__tests__/AccessControl.test.tsx
  git commit -m "feat: AccessControl reads owner dynamically from deed NFT holder"
  ```

---

### Task 4: Update `Header.tsx`

**Files:**
- Modify: `components/Header.tsx`

No new tests are written for Header — the ADMIN link visibility is a convenience nav feature (access is enforced by `AccessControl` on the owner page). The existing test suite confirms no regressions.

- [ ] **Step 1: Update `components/Header.tsx`**

  Add a new import after the existing imports:
  ```ts
  import { useOwnerAddress } from '@/lib/hooks/useOwnerAddress'
  ```

  Inside the `Header()` function, after `const account = useActiveAccount()`, add:
  ```ts
  const { ownerAddress, isBlocked: ownerIsBlocked } = useOwnerAddress()
  ```

  Re-add the ADMIN link block (which was removed in Task 1), now driven by the hook:
  ```ts
  if (!ownerIsBlocked && account?.address && account.address.toLowerCase() === ownerAddress) {
    links.push({ label: 'ADMIN', href: '/owner' })
  }
  ```

  The full updated `components/Header.tsx`:

  ```tsx
  'use client'

  import Link from 'next/link'
  import { usePathname } from 'next/navigation'
  import { PROJECT_NAME, ARTIST_ADDRESS } from '@/lib/project-config'
  import { useOwnerAddress } from '@/lib/hooks/useOwnerAddress'
  import { createThirdwebClient } from 'thirdweb'
  import { ConnectButton, useActiveAccount } from 'thirdweb/react'
  import { inAppWallet, createWallet } from 'thirdweb/wallets'

  const thirdwebClient = createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? '',
  })

  const wallets = [
    inAppWallet(),
    createWallet('com.coinbase.wallet'),
    createWallet('io.metamask'),
  ]

  export default function Header() {
    const pathname = usePathname()
    const account = useActiveAccount()
    const { ownerAddress, isBlocked: ownerIsBlocked } = useOwnerAddress()

    const links = [
      { label: 'GALLERY', href: '/' },
      { label: 'WALLET', href: '/wallet' },
    ]

    const isDev = process.env.NODE_ENV === 'development'

    if (isDev || (account?.address && account.address.toLowerCase() === ARTIST_ADDRESS)) {
      links.push({ label: 'OPS', href: '/artist' })
    }

    if (!ownerIsBlocked && account?.address && account.address.toLowerCase() === ownerAddress) {
      links.push({ label: 'ADMIN', href: '/owner' })
    }

    return (
      <header className="sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-md border-b border-outline_variant/30 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display font-bold text-on_surface tracking-tight hover:text-primary transition-colors">
            {PROJECT_NAME}
          </Link>
          <nav className="hidden md:flex gap-6">
            {links.map(link => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-mono text-[10px] tracking-widest ${isActive ? 'text-tertiary border-b border-tertiary/50 pb-1' : 'text-outline hover:text-on_surface_variant transition-colors'}`}
                >
                  [{link.label}]
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <ConnectButton
            client={thirdwebClient}
            wallets={wallets}
            theme="dark"
            connectButton={{ className: "!bg-surface_container_highest !text-[10px] !font-mono !text-primary !border !border-outline_variant/30 !rounded-sm !py-2 !px-4 hover:!bg-surface_container_low !h-auto !min-w-0" }}
          />
        </div>
      </header>
    )
  }
  ```

- [ ] **Step 2: Run the full test suite**

  Run: `npm test`

  Expected: all tests PASS.

- [ ] **Step 3: Remove `NEXT_PUBLIC_OWNER_ADDRESS` from env files and add deed contract address**

  Find all env files that contain `NEXT_PUBLIC_OWNER_ADDRESS`:
  ```bash
  grep -rl "NEXT_PUBLIC_OWNER_ADDRESS" . --include="*.env" --include=".env*"
  ```

  For each file found: remove the `NEXT_PUBLIC_OWNER_ADDRESS=...` line and add:
  ```
  NEXT_PUBLIC_DEED_CONTRACT_ADDRESS=0xfC4A567e31974e7e472F30f0D616397a879F4699
  ```

- [ ] **Step 4: Final commit**

  Stage Header and any env files modified in Step 3:
  ```bash
  git add components/Header.tsx
  # Also stage any env files that were modified in Step 3, e.g.:
  # git add .env.ldft .env.local
  git commit -m "feat: Header shows ADMIN link only when connected wallet holds deed NFT"
  ```
