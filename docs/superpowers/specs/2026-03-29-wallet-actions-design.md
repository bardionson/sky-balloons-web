# Wallet Actions — Design Spec
**Date:** 2026-03-29
**Status:** Approved

## Context
Collectors need two improvements on the `/wallet` page:
1. The `ConnectButton` should always be visible (even when connected) so users can access wallet management features — including the built-in private key export — via the Thirdweb wallet modal.
2. Each NFT card should have an inline transfer form to send the token to another address.

Both changes modify the existing `WalletView` component only.

## Route
`/wallet` — existing page, no changes to the page shell.

## Components

### `components/WalletView.tsx` (modify)

---

#### 1. Persistent ConnectButton

**Current behaviour:** `ConnectButton` is only rendered in the `!account` (disconnected) state and disappears once a wallet connects.

**New behaviour:** `ConnectButton` is always rendered at the top of `WalletViewInner`, regardless of connection state. When connected, Thirdweb renders it as a wallet management icon (shows address, disconnect option, private key export, etc.). When disconnected, it renders as the connect prompt as before.

The "Connect your wallet to view your collection." instructional paragraph is removed — the `ConnectButton` alone is sufficient affordance.

---

#### 2. NFT Transfer

**Transfer function:** Use `transferFrom` from `thirdweb/extensions/erc721` with params `{ from: account.address, to: destinationAddress, tokenId: nft.id }`. Submit via `useSendTransaction`'s `mutate(tx, { onSuccess, onError })` callbacks.

**Transaction lifecycle:**
- `mutate()` called → card enters `pending` state
- `onSuccess` fires when tx is confirmed on-chain → call `refetch()` (from `useReadContract`) then the card disappears once the NFT is no longer returned
- `onError` fires if tx is rejected or fails → card transitions to `error` state

**Per-card state machine:** Each NFT card independently tracks one of: `idle`, `open`, `pending`, `error`. Only one card may be in `open` state at a time — opening the form on a new card resets any other `open` card to `idle`. While any card is in `pending` state, the Transfer button on all other cards is visually disabled and non-interactive (prevents concurrent transfers).

**States:**
- **Idle:** "Transfer" button visible below the token ID.
- **Open:** Address input + "Send" + "Cancel" buttons below the token ID. "Cancel" returns to `idle`.
- **Pending:** "Send" button shows "Sending…" (disabled). Address input disabled. Other cards' Transfer buttons are disabled.
- **Success:** `refetch()` called via `onSuccess`. Card disappears once refetch returns without this tokenId. If refetch returns stale data, card remains — no further error handling.
- **Error:** Inline error message shown on the card. Card returns to `open` state so user can retry or cancel.

**Address validation:** Validate on "Send" click (not on input change). Reject if the input does not match `/^0x[0-9a-fA-F]{40}$/` or equals the zero address (`0x0000000000000000000000000000000000000000`). Show "Invalid address" inline without submitting.

**Wallet disconnect during pending transfer:** The tx may still confirm on-chain. Transition the card to `error` state with message "Wallet disconnected." (detected via `useActiveAccount()` returning `undefined`).

---

## Style
Matches existing wallet page: black background, `white/5` card backgrounds, `white/10` borders, white text, monospace for addresses.

## Files to create/modify
- `components/WalletView.tsx` — modify
- `components/__tests__/WalletView.test.tsx` — modify

## Test Cases

**Persistent ConnectButton:**
- ConnectButton rendered when no wallet connected
- ConnectButton rendered when wallet is connected

**NFT Transfer:**
- Transfer button visible on each NFT card in idle state
- Clicking Transfer shows address input + Send/Cancel
- Cancel returns card to idle
- Send with empty/invalid address shows "Invalid address" without calling transferFrom
- Send with zero address shows "Invalid address"
- Send with valid address transitions to pending (Send button shows "Sending…", disabled)
- Other cards' Transfer buttons are disabled while any card is pending
- On success (onSuccess fires), refetch is called and card is removed
- On error (onError fires), inline error shown; card stays in open state
- Opening Transfer on card B while card A has form open: card A resets to idle

## Dependencies
All already installed — `thirdweb` ^5.119.1. No new packages.

## Confirmed API
- `transferFrom` from `thirdweb/extensions/erc721` — params: `{ contract, from, to, tokenId }`
- `useSendTransaction` — `useMutation` wrapper; `mutate(tx, { onSuccess, onError })`
- `useReadContract` returns `UseQueryResult` from `@tanstack/react-query`, which includes `refetch()`
- `ConnectButton` from `thirdweb/react` — renders connect UI when disconnected, wallet management UI when connected

## Out of scope (this iteration)
- Custom private key export UI (available via ConnectButton modal)
- Confirmation dialogs before transfer
- Batch transfers
- Post-mint email
