# Dynamic Owner Lookup via Deed NFT

**Date:** 2026-04-03  
**Status:** Approved

## Problem

`OWNER_ADDRESS` is currently a static env var. The true owner of the installation is whoever holds the deed NFT (token ID 0) on a dedicated deed contract. The app should resolve the owner dynamically by reading the deed contract on-chain rather than relying on a configured address.

## Solution

A `useOwnerAddress()` React hook reads `ownerOf(0)` from the deed contract via Thirdweb's `useReadContract`. Components that previously compared against the static `OWNER_ADDRESS` consume the hook instead.

## Scope

- Add `DEED_CONTRACT_ADDRESS` to `lib/project-config.ts`
- Create `lib/hooks/useOwnerAddress.ts`
- Update `components/Header.tsx`
- Update `components/AccessControl.tsx`
- Remove `OWNER_ADDRESS` from `lib/project-config.ts` and `.env`

## Config (`lib/project-config.ts`)

Add:
```ts
export const DEED_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS as `0x${string}`
export const DEED_TOKEN_ID = 0n
```

Remove:
```ts
export const OWNER_ADDRESS = ...
```

The deed contract address is in env (not hardcoded) so the codebase can be reused for other projects.

## Hook (`lib/hooks/useOwnerAddress.ts`)

Uses Thirdweb's `useReadContract` with the ERC-721 `ownerOf(uint256)` ABI. Returns:

```ts
{ ownerAddress: string | undefined, isPending: boolean }
```

- `ownerAddress` is lowercased when defined, matching the comparison convention used throughout the app
- `isPending` is `true` while the RPC call is in-flight
- Uses the same chain as the rest of the app (`NEXT_PUBLIC_PAYMENT_CHAIN_ID`)
- React Query (used internally by Thirdweb) deduplicates the RPC call across multiple hook consumers

## Component Updates

### `Header.tsx`

- Call `useOwnerAddress()`
- Replace `OWNER_ADDRESS` comparison with `ownerAddress`
- While `isPending`: ADMIN link does not appear (safe default — no link flash)

### `AccessControl.tsx`

- Call `useOwnerAddress()`
- Three states for `requiredRole === 'owner'`:
  1. `isPending` → render a "Lookup in progress" indicator (not access denied, not children)
  2. Resolved, wallet does not match → render access denied screen
  3. Resolved, wallet matches (or dev mode) → render children
- `requiredRole === 'artist'` path is unchanged

## Error Handling

If `ownerOf` reverts or the contract address is misconfigured, `useReadContract` will return an error state. Treat this the same as pending/unknown: deny access and show the lookup indicator. Do not surface raw RPC errors to the user.

## Testing

No new test infrastructure needed. Existing tests that mock `OWNER_ADDRESS` should be updated to mock the hook return value instead.

## Non-goals

- Caching / revalidation strategy (React Query defaults are sufficient)
- Reactivity to deed transfers mid-session (a page refresh is acceptable)
- Context provider abstraction (React Query deduplicates; not needed)
