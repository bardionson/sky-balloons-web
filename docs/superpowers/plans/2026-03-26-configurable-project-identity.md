# Configurable Project Identity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all hardcoded project-identity strings (name, artist, symbol, explorer URLs, network name) into environment variables so the app and contracts can be deployed as a different project for testing without exposing the real project.

**Architecture:** A single `lib/project-config.ts` module reads all project-identity env vars and re-exports typed constants — every UI file imports from there instead of using `process.env` directly or hardcoding strings. Solidity constructors accept `name` and `symbol` as parameters; the deploy script reads them from `.env`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Foundry/Solidity, Vitest

---

## Chunk 1: Web App — Central Config + Env Vars

### Task 1: Add project-identity env vars to `.env.local`

**Files:**
- Modify: `sky_balloons_web/.env.local`

- [ ] **Step 1: Append new vars to `.env.local`**

Add these lines at the end of `.env.local`:

```dotenv
# Project identity — change these to deploy as a different project
NEXT_PUBLIC_PROJECT_NAME="Balloons in the Sky"
NEXT_PUBLIC_PROJECT_SYMBOL="BSKY"
NEXT_PUBLIC_ARTIST_NAME="Bård Ionson & Jennifer Ionson"
NEXT_PUBLIC_NFT_LICENSE="CC BY-NC 4.0"
NEXT_PUBLIC_EXPLORER_BASE_URL="https://sepolia.etherscan.io"
NEXT_PUBLIC_NETWORK_NAME="Sepolia testnet"
NEXT_PUBLIC_NFT_ITEM_LABEL="Balloon"
NEXT_PUBLIC_NFT_SUCCESS_EMOJI="🎈"
```

> **For a test deployment**, change these to something obscure (e.g. `"Geometric Forms"`, `"GEO"`, `"Studio Test"`) before deploying. The real project values stay in `.env.local` for production.

- [ ] **Step 2: Commit**

```bash
cd sky_balloons_web
git add .env.local
git commit -m "config: add project-identity env vars"
```

---

### Task 2: Create `lib/project-config.ts`

**Files:**
- Create: `sky_balloons_web/lib/project-config.ts`

- [ ] **Step 1: Create the module**

```typescript
/**
 * Central project-identity config.
 * All project-specific strings come from here — never hardcode them elsewhere.
 * To deploy as a test/obscured project, change the env vars in .env.local.
 */

export const PROJECT_NAME    = process.env.NEXT_PUBLIC_PROJECT_NAME    ?? 'Balloons in the Sky'
export const PROJECT_SYMBOL  = process.env.NEXT_PUBLIC_PROJECT_SYMBOL  ?? 'BSKY'
export const ARTIST_NAME     = process.env.NEXT_PUBLIC_ARTIST_NAME     ?? 'Bård Ionson & Jennifer Ionson'
export const NFT_LICENSE     = process.env.NEXT_PUBLIC_NFT_LICENSE     ?? 'CC BY-NC 4.0'
export const EXPLORER_BASE   = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ?? 'https://sepolia.etherscan.io'
export const NETWORK_NAME    = process.env.NEXT_PUBLIC_NETWORK_NAME    ?? 'Sepolia testnet'
export const NFT_ITEM_LABEL  = process.env.NEXT_PUBLIC_NFT_ITEM_LABEL  ?? 'Balloon'
export const NFT_SUCCESS_EMOJI = process.env.NEXT_PUBLIC_NFT_SUCCESS_EMOJI ?? '🎈'
```

- [ ] **Step 2: Commit**

```bash
git add lib/project-config.ts
git commit -m "feat: add central project-config module"
```

---

## Chunk 2: Web App — Wire Config into Source Files

### Task 3: Update `lib/metadata.ts`

**Files:**
- Modify: `sky_balloons_web/lib/metadata.ts`

- [ ] **Step 1: Replace hardcoded strings with config imports**

Replace the top of the file with:

```typescript
import type { InstallationSubmitBody } from './db/types'
import { PROJECT_NAME, ARTIST_NAME, NFT_LICENSE } from './project-config'
```

Replace the `metadata` object literal (lines 16–31) with:

```typescript
  const metadata = {
    name: `${PROJECT_NAME} #${params.unit_number} \u2014 ${params.unique_name}`,
    description: `${PROJECT_NAME} by ${ARTIST_NAME}`,
    image: `ipfs://${params.cid}`,
    license: NFT_LICENSE,
    attributes: [
```

> Leave the `attributes` array and the rest of the function unchanged.

- [ ] **Step 2: Run the existing metadata tests to confirm they still pass**

```bash
cd sky_balloons_web
npx vitest run lib/__tests__/metadata.test.ts
```

Expected: **FAIL** on the `name` and `description` assertions (they still assert the hardcoded strings). That is expected — we fix the tests next.

- [ ] **Step 3: Commit the implementation change**

```bash
git add lib/metadata.ts
git commit -m "feat: use project-config in metadata builder"
```

---

### Task 4: Update metadata tests

**Files:**
- Modify: `sky_balloons_web/lib/__tests__/metadata.test.ts`

- [ ] **Step 1: Update the test assertions to read from config**

Replace the two hardcoded assertions in the `'includes hardcoded description and license'` test:

```typescript
import { PROJECT_NAME, ARTIST_NAME, NFT_LICENSE } from '../project-config'

// ...inside the test:
it('includes description and license from project config', () => {
  const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
  expect(meta.description).toBe(`${PROJECT_NAME} by ${ARTIST_NAME}`)
  expect(meta.license).toBe(NFT_LICENSE)
})
```

Replace the `name` assertion in `'encodes the correct name including unit number and unique name'`:

```typescript
it('encodes the correct name including unit number and unique name', () => {
  const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
  expect(meta.name).toBe(`${PROJECT_NAME} #42 \u2014 Drifting Over Azure`)
})
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
npx vitest run lib/__tests__/metadata.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/__tests__/metadata.test.ts
git commit -m "test: update metadata tests to use project-config"
```

---

### Task 5: Update `app/mint/[id]/page.tsx`

**Files:**
- Modify: `sky_balloons_web/app/mint/[id]/page.tsx`

- [ ] **Step 1: Add import**

Add at the top after the existing imports:

```typescript
import { PROJECT_NAME, ARTIST_NAME, EXPLORER_BASE, NETWORK_NAME } from '@/lib/project-config'
```

- [ ] **Step 2: Update `generateMetadata`**

Replace:
```typescript
  return {
    title: 'Balloons in the Sky — Mint',
    description: 'Mint your generative balloon NFT by Bård Ionson & Jennifer Ionson',
  }
```

With:
```typescript
  return {
    title: `${PROJECT_NAME} — Mint`,
    description: `Mint your generative NFT by ${ARTIST_NAME}`,
  }
```

- [ ] **Step 3: Update the page header JSX (lines 46–51)**

Replace:
```tsx
        <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
          Bård Ionson &amp; Jennifer Ionson
        </p>
        <h1 className="text-3xl font-light text-white tracking-wide">
          Balloons in the Sky
        </h1>
```

With:
```tsx
        <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
          {ARTIST_NAME}
        </p>
        <h1 className="text-3xl font-light text-white tracking-wide">
          {PROJECT_NAME}
        </h1>
```

- [ ] **Step 4: Update the Etherscan token link (line 80)**

Replace:
```tsx
              href={`https://sepolia.etherscan.io/token/${process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS}?a=${m.token_id}`}
```

With:
```tsx
              href={`${EXPLORER_BASE}/token/${process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS}?a=${m.token_id}`}
```

- [ ] **Step 5: Update the footer (line 99)**

Replace:
```tsx
        <p>Sepolia testnet &middot; Powered by Crossmint</p>
```

With:
```tsx
        <p>{NETWORK_NAME} &middot; Powered by Crossmint</p>
```

- [ ] **Step 6: Commit**

```bash
git add app/mint/\[id\]/page.tsx
git commit -m "feat: use project-config in mint page"
```

---

### Task 6: Update `components/CheckoutForm.tsx`

**Files:**
- Modify: `sky_balloons_web/components/CheckoutForm.tsx`

- [ ] **Step 1: Add import**

Add after the existing imports:

```typescript
import { PROJECT_NAME } from '@/lib/project-config'
```

- [ ] **Step 2: Replace the hardcoded `name` prop on `CheckoutWidget` (line 42)**

Replace:
```tsx
        name="Balloons in the Sky NFT"
```

With:
```tsx
        name={`${PROJECT_NAME} NFT`}
```

- [ ] **Step 3: Commit**

```bash
git add components/CheckoutForm.tsx
git commit -m "feat: use project-config in CheckoutForm"
```

---

### Task 7: Update `components/MintSuccess.tsx`

**Files:**
- Modify: `sky_balloons_web/components/MintSuccess.tsx`

- [ ] **Step 1: Add import**

Add after the existing line 7:

```typescript
import { EXPLORER_BASE, NFT_ITEM_LABEL, NFT_SUCCESS_EMOJI } from '@/lib/project-config'
```

- [ ] **Step 2: Replace hardcoded emoji and item label (lines 12–15)**

Replace:
```tsx
      <div className="text-5xl">🎈</div>
      <h2 className="text-xl font-semibold text-white">
        Balloon #{unitNumber} is yours!
      </h2>
```

With:
```tsx
      <div className="text-5xl">{NFT_SUCCESS_EMOJI}</div>
      <h2 className="text-xl font-semibold text-white">
        {NFT_ITEM_LABEL} #{unitNumber} is yours!
      </h2>
```

- [ ] **Step 3: Replace hardcoded Sepolia Etherscan URLs (lines 21 and 30)**

Replace:
```tsx
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
```

With:
```tsx
          href={`${EXPLORER_BASE}/tx/${txHash}`}
```

Replace:
```tsx
        href={`https://sepolia.etherscan.io/address/${NFT_ADDRESS}`}
```

With:
```tsx
        href={`${EXPLORER_BASE}/address/${NFT_ADDRESS}`}
```

- [ ] **Step 4: Commit**

```bash
git add components/MintSuccess.tsx
git commit -m "feat: use project-config in MintSuccess"
```

---

## Chunk 3: Smart Contracts — Configurable Name/Symbol

### Task 8: Make `BalloonsNFT` constructor accept name and symbol

**Files:**
- Modify: `sky_balloons_contracts/src/BalloonsNFT.sol`

- [ ] **Step 1: Update the constructor signature**

Replace (line 64–69):
```solidity
    constructor(
        address _deed,
        address _installation,
        address _artist,
        address _minter
    ) ERC721("Balloons in the Sky", "BSKY") {
```

With:
```solidity
    constructor(
        address _deed,
        address _installation,
        address _artist,
        address _minter,
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) {
```

- [ ] **Step 2: Build to confirm it compiles**

```bash
cd sky_balloons_contracts
forge build
```

Expected: compilation succeeds.

- [ ] **Step 3: Run existing tests — expect compile errors on any test that calls the old constructor**

```bash
forge test
```

If tests fail because they call `new BalloonsNFT(deed, installation, artist, minter)` with 4 args, find those test files and add the two new string args (e.g. `"Test NFT"`, `"TEST"`).

- [ ] **Step 4: Fix test constructor calls (if needed)**

Search for usages:
```bash
grep -rn "new BalloonsNFT(" test/
```

For each occurrence, add the two new trailing args:
```solidity
new BalloonsNFT(address(deed), address(installation), artist, minter, "Test NFT", "TEST")
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
forge test
```

- [ ] **Step 6: Commit**

```bash
cd sky_balloons_contracts
git add src/BalloonsNFT.sol test/
git commit -m "feat: BalloonsNFT constructor accepts name and symbol params"
```

---

### Task 9: Make `DeedNFT` constructor accept name and symbol

**Files:**
- Modify: `sky_balloons_contracts/src/DeedNFT.sol`

- [ ] **Step 1: Update the constructor signature (line 58–59)**

Replace:
```solidity
    constructor(address artist, string memory uri)
        ERC721("Balloons in the Sky \u2014 Deed", "BSKY-DEED")
```

With:
```solidity
    constructor(address artist, string memory uri, string memory _name, string memory _symbol)
        ERC721(_name, _symbol)
```

- [ ] **Step 2: Build**

```bash
forge build
```

- [ ] **Step 3: Run tests — fix any constructor call sites in tests**

```bash
forge test
grep -rn "new DeedNFT(" test/
```

Update each occurrence to pass name + symbol. Use `"Test Deed"` and `"TEST-DEED"` for tests.

- [ ] **Step 4: Run tests — expect PASS**

```bash
forge test
```

- [ ] **Step 5: Commit**

```bash
git add src/DeedNFT.sol test/
git commit -m "feat: DeedNFT constructor accepts name and symbol params"
```

---

### Task 10: Update `Deploy.s.sol` to read name/symbol from env

**Files:**
- Modify: `sky_balloons_contracts/script/Deploy.s.sol`

- [ ] **Step 1: Add name/symbol constants block**

After the existing constants block (after line 27), add:

```solidity
    // Collection identity — override to deploy as a test/obscured project
    string constant NFT_NAME        = "Balloons in the Sky";
    string constant NFT_SYMBOL      = "BSKY";
    string constant DEED_NAME       = "Balloons in the Sky \u2014 Deed";
    string constant DEED_SYMBOL     = "BSKY-DEED";
```

> These are the production values. To deploy a test project, change them before running the script. They are not read from env because Forge scripts use string constants more reliably than `vm.envString` for non-address values.

- [ ] **Step 2: Pass them into the constructors (lines 43 and 57)**

Replace:
```solidity
        DeedNFT deed = new DeedNFT(ARTIST_ADDRESS, DEED_METADATA_URI);
```

With:
```solidity
        DeedNFT deed = new DeedNFT(ARTIST_ADDRESS, DEED_METADATA_URI, DEED_NAME, DEED_SYMBOL);
```

Replace:
```solidity
        BalloonsNFT balloons = new BalloonsNFT(
            address(deed),
            address(installation),
            ARTIST_ADDRESS,
            MINTER_ADDRESS
        );
```

With:
```solidity
        BalloonsNFT balloons = new BalloonsNFT(
            address(deed),
            address(installation),
            ARTIST_ADDRESS,
            MINTER_ADDRESS,
            NFT_NAME,
            NFT_SYMBOL
        );
```

- [ ] **Step 3: Build to confirm**

```bash
forge build
```

- [ ] **Step 4: Commit**

```bash
git add script/Deploy.s.sol
git commit -m "feat: Deploy script passes configurable name/symbol to constructors"
```

---

## How To Deploy a Test Project

With this plan implemented, creating an obscured test deployment requires only:

**Web app** — edit `.env.local`:
```dotenv
NEXT_PUBLIC_PROJECT_NAME="Geometric Forms"
NEXT_PUBLIC_PROJECT_SYMBOL="GEO"
NEXT_PUBLIC_ARTIST_NAME="Studio Test"
NEXT_PUBLIC_NFT_LICENSE="All Rights Reserved"
NEXT_PUBLIC_EXPLORER_BASE_URL="https://sepolia.etherscan.io"
NEXT_PUBLIC_NETWORK_NAME="Sepolia testnet"
NEXT_PUBLIC_NFT_ITEM_LABEL="Form"
NEXT_PUBLIC_NFT_SUCCESS_EMOJI="◆"
NEXT_PUBLIC_BALLOONS_NFT_ADDRESS=<test contract address>
```

**Contracts** — edit the four constants in `Deploy.s.sol`:
```solidity
string constant NFT_NAME   = "Geometric Forms";
string constant NFT_SYMBOL = "GEO";
string constant DEED_NAME  = "Geometric Forms — Deed";
string constant DEED_SYMBOL = "GEO-DEED";
```

Then deploy normally: `forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast`
