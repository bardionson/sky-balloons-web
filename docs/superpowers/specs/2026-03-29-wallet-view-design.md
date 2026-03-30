# Wallet View — Design Spec
**Date:** 2026-03-29
**Status:** Approved

## Context
Collectors who mint an NFT via Thirdweb in-app wallet (email) have no way to verify their NFT outside of Etherscan (which lacks an NFT tab for contract-level views). This page gives them a simple way to connect their wallet and confirm ownership.

## Route
`/wallet` — standalone page, no auth required beyond wallet connection.

## Components

### `app/wallet/page.tsx`
Server component. Renders page chrome (title, dark background matching the mint page) and the `WalletView` client component.

### `components/WalletView.tsx`
Client component. Full behaviour:

1. **Connect prompt** — shows `ConnectButton` from `thirdweb/react` with `inAppWallet()` + MetaMask/Coinbase/etc. Reuses `thirdwebClient` exported from `WalletConnectSection`.
2. **NFT fetch** — once an account is active (`useActiveAccount()`), calls:
   ```tsx
   useReadContract(getOwnedNFTs, { contract, address: account.address })
   ```
   where `contract = getContract({ client, address: BALLOONS_NFT_ADDRESS, chain: mainnet })`.
3. **Loading state** — spinner / "Loading your collection…" while fetching.
4. **Empty state** — "No Balloons found in this wallet."
5. **NFT grid** — one card per token:
   - Artwork via `IpfsImage` (reuse existing component, CID extracted from `nft.metadata.image`)
   - Token name (`nft.metadata.name`)
   - Token ID

## Style
Matches existing mint page: black background, white text, `white/5` card backgrounds, same font stack.

## Dependencies
All already installed — `thirdweb` ^5.119.1, `viem` (for chain constant). No new packages.

## Files to create/modify
- `app/wallet/page.tsx` — new
- `components/WalletView.tsx` — new

## Out of scope (this iteration)
- Transfer controls
- Private key export
- Any server-side data fetching
