# Dynamic Owner Lookup via Deed NFT

**Date:** 2026-04-03  
**Status:** Approved

## Problem

`OWNER_ADDRESS` is currently a static env var. The true owner of the installation is whoever holds the deed NFT (token ID 0) on a dedicated deed contract. The app should resolve the owner dynamically by reading the deed contract on-chain rather than relying on a configured address.

## Solution

A `useOwnerAddress()` React hook reads `ownerOf(DEED_TOKEN_ID)` from the deed contract via Thirdweb's `useReadContract`. Components that previously compared against the static `OWNER_ADDRESS` consume the hook instead.

## Scope

- Add `DEED_CONTRACT_ADDRESS` and `DEED_TOKEN_ID` to `lib/project-config.ts`
- Create `lib/hooks/useOwnerAddress.ts`
- Update `components/Header.tsx`
- Update `components/AccessControl.tsx`
- Add `NEXT_PUBLIC_DEED_CONTRACT_ADDRESS` stub to `vitest.setup.ts`
- Remove `OWNER_ADDRESS` from `lib/project-config.ts` and `.env`

## Config (`lib/project-config.ts`)

Add:
```ts
export const DEED_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS as `0x${string}`
export const DEED_TOKEN_ID = 0n
```

`DEED_CONTRACT_ADDRESS` must be validated at module load time: if the value is falsy, throw an error with a clear message (`"NEXT_PUBLIC_DEED_CONTRACT_ADDRESS is not set"`). This is the same guard pattern used elsewhere in the app and ensures a misconfigured env is immediately obvious rather than silently producing a permanently locked UI.

`DEED_TOKEN_ID` is exported from config (not hardcoded in the hook) to avoid magic literals.

Remove:
```ts
export const OWNER_ADDRESS = ...
```

The deed contract address is in env (not hardcoded) so the codebase can be reused for other projects.

## Hook (`lib/hooks/useOwnerAddress.ts`)

Uses Thirdweb's `useReadContract` with the ERC-721 `ownerOf(uint256)` ABI, passing `DEED_TOKEN_ID` from config.

Returns:
```ts
{ ownerAddress: string | undefined, isBlocked: boolean }
```

- `ownerAddress` — the lowercased address of the deed holder when resolved; `undefined` otherwise
- `isBlocked` — `true` when the result is not yet usable: covers both in-flight RPC calls (`isPending` from React Query) and RPC errors. The hook maps `isError → isBlocked: true` so consumers never need to distinguish the two; both mean "we don't know who the owner is yet."
- React Query (used internally by Thirdweb) deduplicates the RPC call across multiple hook consumers

**Chain resolution:** Resolve the chain at module level using the same conditional as `lib/chain/stats.ts`:
```ts
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID ?? '11155111')
const chain = CHAIN_ID === 1 ? mainnet : sepolia
```

**Contract object:** Call `getContract` at module level (after the env var guard), using `thirdwebClient` imported from `components/WalletConnectSection` — the same shared client used in `WalletView.tsx`:
```ts
const deedContract = getContract({
  client: thirdwebClient,
  address: DEED_CONTRACT_ADDRESS,
  chain,
})
```

This matches the exact pattern in `WalletView.tsx` (module-level guard → module-level `getContract`). The guard in the Config section ensures `DEED_CONTRACT_ADDRESS` is defined before `getContract` is called.

## Component Updates

### `Header.tsx`

- Call `useOwnerAddress()`, destructure `{ ownerAddress, isBlocked }`
- The existing pattern builds `links` as a plain `const` array inside the render function, then conditionally pushes to it. This remains the approach — no state needed. When `isBlocked` is true or `ownerAddress` doesn't match the connected wallet, the ADMIN link is simply not pushed to the array. When `isBlocked` transitions to `false` and a matching wallet is connected, a re-render will include the ADMIN link. No flicker, no extra complexity.

### `AccessControl.tsx`

The existing `isMounted` guard (which returns `null` until client hydration completes) is preserved unchanged. The hook is always called (hooks must not be conditional), but its result is only used after `isMounted` is true.

The render logic for `requiredRole === 'owner'` follows this explicit decision tree:

```
if (!isMounted)           → return null          // SSR hydration guard — unchanged
if (isDev)                → return children       // dev bypass — unchanged
if (isBlocked)            → return <LookupIndicator />   // RPC in-flight or error
if (address !== ownerAddress) → return <AccessDenied />
return children
```

`requiredRole === 'artist'` path is unchanged — no `isBlocked` state applies there.

## Error Handling

If `ownerOf` reverts or the contract address is misconfigured at runtime (e.g., wrong network), `useReadContract` will surface an error state. The hook maps this to `isBlocked: true`. Components render the "Lookup in progress" indicator rather than an access denied screen or raw RPC errors. A misconfigured `DEED_CONTRACT_ADDRESS` env var will be caught at module load time (see Config section above) before any hook is called.

## Testing

- Add `process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS = '0x...'` stub to `vitest.setup.ts` alongside the existing contract address stubs
- In component tests that exercise owner-gated paths, mock the `useOwnerAddress` hook return value directly (e.g., `{ ownerAddress: '0xabc', isBlocked: false }`) rather than relying on a live RPC call

## Non-goals

- Caching / revalidation strategy beyond React Query defaults
- Reactivity to deed transfers mid-session (a page refresh is acceptable)
- Context provider abstraction (React Query deduplicates; not needed)
