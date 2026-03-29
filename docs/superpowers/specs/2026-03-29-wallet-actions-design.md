# Wallet Actions — Design Spec
**Date:** 2026-03-29
**Status:** Approved

## Context
Collectors need two additional capabilities on the `/wallet` page: exporting their private key (to import into MetaMask or another wallet) and transferring an NFT to a different address. Both actions extend the existing `WalletView` component.

## Route
`/wallet` — existing page, no changes to the page shell.

## Components

### `components/WalletView.tsx` (modify)
Add two features to the existing component:

#### 1. Private Key Export
- Shown only when an in-app wallet is connected (wallet type `"inApp"`). Hidden for MetaMask, Coinbase, etc.
- An "Export Private Key" button sits above the NFT grid.
- Clicking it calls the in-app wallet's export method and reveals the key in a monospace box below the button, with a "Copy" button.
- Clicking "Export Private Key" again hides the box (toggle).
- Implementation: `useActiveWallet()` to get the wallet instance; check `wallet.id === "inApp"`; call `wallet.export({ format: "privateKey" })` to retrieve the key.

#### 2. NFT Transfer
- Each NFT card gets a "Transfer" button below the token ID line.
- Clicking it reveals an inline address input and "Send" / "Cancel" buttons on that card.
- Only one card can be in transfer mode at a time — opening one closes any other.
- "Send" calls `transfer` from `thirdweb/extensions/erc721` via `useSendTransaction`.
- While the tx is pending the "Send" button shows "Sending…" and is disabled.
- On success the card is removed from the grid (NFT no longer owned by this address).
- On error a short inline error message appears on the card.

## Style
Matches existing wallet page: black background, `white/5` card backgrounds, `white/10` borders, white text, monospace for addresses and keys.

## Files to create/modify
- `components/WalletView.tsx` — modify (add private key export + transfer UI)
- `components/__tests__/WalletView.test.tsx` — modify (add tests for new states)

## Dependencies
All already installed — `thirdweb` ^5.119.1. No new packages.

## Out of scope (this iteration)
- Confirmation dialogs before export or transfer
- Batch transfers
- Post-mint email
