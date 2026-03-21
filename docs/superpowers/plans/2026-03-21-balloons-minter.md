# Balloons in the Sky — Minter & Payment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete mint + payment flow: GPU submits artwork metadata → viewer scans QR → pays via Crossmint (card, Apple Pay, or crypto wallet) → NFT minted on Sepolia → GPU prints image.

**Architecture:** Next.js 14 App Router on Vercel, Supabase (Postgres) as the database and realtime signal bus, Crossmint behind a provider abstraction layer. All code is written test-first (Vitest). The GPU Python script calls one API endpoint to register artwork; the viewer page fetches everything from the database by mint ID — nothing sensitive travels in URLs.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Crossmint (`@crossmint/client-sdk-react-ui`), Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-20-balloons-minter-design.md`

---

## File Map

```
Files to DELETE (written without tests — rewrite TDD):
  lib/metadata.ts
  lib/crossmint.ts
  app/api/create-order/route.ts
  app/api/order-status/route.ts
  components/CheckoutForm.tsx
  app/page.tsx

Files to CREATE:
  vitest.config.ts                                 test runner config
  vitest.setup.ts                                  jest-dom matchers
  supabase/migrations/001_schema.sql               DB schema
  supabase/migrations/002_seed.sql                 initial settings row
  lib/db/types.ts                                  TypeScript DB row types
  lib/db/server.ts                                 Supabase server client (service role)
  lib/db/browser.ts                                Supabase browser client (anon)
  lib/metadata.ts                                  buildMetadataUri() pure function
  lib/payment/provider.ts                          PaymentProvider interface + types
  lib/payment/crossmint.ts                         CrossmintAdapter
  lib/payment/index.ts                             factory export
  app/api/installation/submit/route.ts             GPU → create mint record
  app/api/mint/[id]/order/route.ts                 viewer → create payment order
  app/api/mint/[id]/status/route.ts                GPU + browser → poll status
  app/api/webhooks/crossmint/route.ts              Crossmint → delivery events
  app/api/cron/check-orders/route.ts               Vercel cron safety net
  app/api/settings/price/route.ts                  fetch current mint price
  app/mint/[id]/page.tsx                           viewer page (server component)
  components/WalletButtons.tsx                     wallet deep-link buttons
  components/MintSuccess.tsx                       post-mint success screen
  components/CheckoutForm.tsx                      checkout state machine
  vercel.json                                      cron schedule

Test files (co-located in __tests__ next to source):
  lib/__tests__/metadata.test.ts
  lib/payment/__tests__/crossmint.test.ts
  app/api/installation/submit/__tests__/route.test.ts
  app/api/mint/[id]/order/__tests__/route.test.ts
  app/api/mint/[id]/status/__tests__/route.test.ts
  app/api/webhooks/crossmint/__tests__/route.test.ts
  app/api/cron/check-orders/__tests__/route.test.ts
  app/api/settings/price/__tests__/route.test.ts
  components/__tests__/WalletButtons.test.tsx
  components/__tests__/CheckoutForm.test.tsx
```

---

## Chunk 1: Cleanup & Test Infrastructure

### Task 1: Delete scaffolded code written without tests

**Files:**
- Delete: `lib/metadata.ts`
- Delete: `lib/crossmint.ts`
- Delete: `app/api/create-order/` (directory)
- Delete: `app/api/order-status/` (directory)
- Delete: `components/CheckoutForm.tsx`
- Delete: `app/page.tsx`

- [ ] **Step 1: Delete files**

```bash
cd /home/bardionson/sky_balloons_web
rm lib/metadata.ts lib/crossmint.ts components/CheckoutForm.tsx app/page.tsx
rm -rf app/api/create-order app/api/order-status
```

- [ ] **Step 2: Verify deletions**

```bash
ls lib/ app/api/ components/ 2>/dev/null || echo "(directory empty or gone)"
```
Expected: none of the deleted files appear. `lib/`, `app/api/`, and `components/` will be empty or the `ls` will report "No such file or directory" — both are correct.

> **Note:** Deleting `app/page.tsx` means `npm run dev` will show a "no root page" error until `app/mint/[id]/page.tsx` is created in Chunk 7. The dev server is intentionally broken between Chunk 1 and Chunk 7 — this is expected. Do not create a temporary placeholder.

- [ ] **Step 3: Commit the cleanup**

```bash
git add -A
git commit -m "chore: delete scaffolded code — rewriting TDD"
```

---

### Task 2: Install dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Check whether `@crossmint/client-sdk-react-ui` is already installed**

```bash
source ~/.nvm/nvm.sh
grep '@crossmint' package.json
```
Expected: `@crossmint/client-sdk-react-ui` is present (it was installed during scaffolding). If missing, run `npm install @crossmint/client-sdk-react-ui` before continuing.

- [ ] **Step 2: Install Supabase**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Install Vitest and React Testing Library**

```bash
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 4: Verify installs**

```bash
grep -E '"vitest|@vitejs/plugin-react|@supabase|@testing-library' package.json
```
Expected: all four package groups present (`vitest`, `@vitejs/plugin-react`, `@supabase/supabase-js` or `@supabase/ssr`, `@testing-library/react`).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Supabase, Vitest, React Testing Library"
```

---

### Task 3: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (add test script)

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Add test script to `package.json`**

Use a `node` one-liner to add the two scripts (avoids colon-in-key issues with other tools):
```bash
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts['test'] = 'vitest run';
pkg.scripts['test:watch'] = 'vitest';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
```

Verify the result:
```bash
grep -E 'vitest' package.json
```
Expected: two lines — `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 4: Write a smoke test to verify the setup**

```bash
mkdir -p lib/__tests__
```

Create `lib/__tests__/smoke.test.ts`:
```typescript
describe('test setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the smoke test**

```bash
source ~/.nvm/nvm.sh && npm test
```
Expected: `1 passed`.

- [ ] **Step 6: Delete smoke test and commit**

```bash
rm lib/__tests__/smoke.test.ts
git add -A
git commit -m "chore: configure Vitest + React Testing Library"
```

---

## Chunk 2: Database Schema & Supabase Client

### Task 4: Write SQL migrations

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/migrations/002_seed.sql`

- [ ] **Step 1: Create `supabase/migrations/001_schema.sql`**

```sql
-- Settings: admin-controlled key/value pairs
CREATE TABLE IF NOT EXISTS settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Collectors: one record per buyer (upsert on email)
CREATE TABLE IF NOT EXISTS collectors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  name            text NOT NULL,
  wallet_address  text,
  street_address  text,
  city            text,
  state           text,
  postal_code     text,
  country         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Mints: one record per balloon artwork from the installation
CREATE TABLE IF NOT EXISTS mints (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- GAN metadata from GPU
  cid              text NOT NULL,
  unique_name      text NOT NULL,
  unit_number      integer NOT NULL,
  seed             bigint NOT NULL,
  timestamp        text NOT NULL,
  orientation      smallint NOT NULL CHECK (orientation IN (0, 1)),
  imagination      integer NOT NULL,
  event_name       text NOT NULL,
  type             text NOT NULL DEFAULT 'Standard',
  pixel_dimensions text NOT NULL DEFAULT '1920x1080',
  -- Payment & delivery state
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','ordered','paid','minting','minted','printed','failed')),
  order_id         text,
  token_id         text,
  tx_hash          text,
  collector_id     uuid REFERENCES collectors(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Webhook events: audit log of all inbound provider webhooks
CREATE TABLE IF NOT EXISTS webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,
  event_type   text NOT NULL,
  order_id     text,
  payload      jsonb NOT NULL,
  processed    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at on mints and collectors
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mints_updated_at
  BEFORE UPDATE ON mints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER collectors_updated_at
  BEFORE UPDATE ON collectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for GPU polling and cron job
CREATE INDEX mints_status_idx ON mints (status);
CREATE INDEX mints_order_id_idx ON mints (order_id) WHERE order_id IS NOT NULL;
```

- [ ] **Step 2: Create `supabase/migrations/002_seed.sql`**

```sql
-- Initial price (low for testing — raise before exhibition in Supabase dashboard)
INSERT INTO settings (key, value)
VALUES ('mint_price_usd', '1.00')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 3: Apply migrations in Supabase dashboard**

Go to your Supabase project → SQL Editor → run `001_schema.sql` then `002_seed.sql`. Verify all four tables appear in Table Editor.

- [ ] **Step 4: Enable Realtime on the mints table**

In Supabase dashboard → Database → Replication → enable `mints` table for realtime.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema migrations"
```

---

### Task 5: TypeScript DB types

**Files:**
- Create: `lib/db/types.ts`

- [ ] **Step 1: Create `lib/db/types.ts`**

```typescript
export type MintStatus =
  | 'pending'
  | 'ordered'
  | 'paid'
  | 'minting'
  | 'minted'
  | 'printed'
  | 'failed'

export interface Mint {
  id: string
  cid: string
  unique_name: string
  unit_number: number
  seed: number
  timestamp: string
  orientation: 0 | 1
  imagination: number
  event_name: string
  type: string
  pixel_dimensions: string
  status: MintStatus
  order_id: string | null
  token_id: string | null
  tx_hash: string | null
  collector_id: string | null
  created_at: string
  updated_at: string
}

export interface Collector {
  id: string
  email: string
  name: string
  wallet_address: string | null
  street_address: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  created_at: string
  updated_at: string
}

export interface Setting {
  id: string
  key: string
  value: string
  updated_at: string
}

export interface WebhookEvent {
  id: string
  provider: string
  event_type: string
  order_id: string | null
  payload: Record<string, unknown>
  processed: boolean
  created_at: string
}

/** Fields the GPU sends when submitting a new artwork */
export interface InstallationSubmitBody {
  cid: string
  unique_name: string
  unit_number: number
  seed: number
  timestamp: string
  orientation: 0 | 1
  imagination: number
  event_name: string
  type?: string
  pixel_dimensions?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/types.ts
git commit -m "feat: add TypeScript DB row types"
```

---

### Task 6: Supabase client helpers

**Files:**
- Create: `lib/db/server.ts`
- Create: `lib/db/browser.ts`

- [ ] **Step 1: Create `lib/db/server.ts`**

Server-side client uses the service role key (bypasses Row Level Security — for API routes only).

```typescript
import { createClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client using the service role key.
 * Never import this in client components or expose to the browser.
 * Call this function inside each API route handler — do not share across requests.
 */
export function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase server env vars')
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
```

- [ ] **Step 2: Create `lib/db/browser.ts`**

Browser client uses the anon key — safe to expose.

```typescript
import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client using the anon key.
 * Safe to use in client components. Call once per component.
 */
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createBrowserClient(url, key)
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/
git commit -m "feat: add Supabase server and browser client helpers"
```

---

## Chunk 3: Metadata Builder (TDD)

### Task 7: Build `lib/metadata.ts` test-first

**Files:**
- Create: `lib/__tests__/metadata.test.ts`
- Create: `lib/metadata.ts`

The `buildMetadataUri` function is a pure function with no side effects — the ideal TDD starting point.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/metadata.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildMetadataUri } from '../metadata'
import type { InstallationSubmitBody } from '../db/types'

const BASE_PARAMS: InstallationSubmitBody = {
  cid: 'QmTestCid123',
  unique_name: 'Drifting Over Azure',
  unit_number: 42,
  seed: 839201,
  timestamp: '16/03/2026 14:32 CET',
  orientation: 0,
  imagination: 75,
  event_name: 'NFC Lisbon 2026',
  type: 'Standard',
  pixel_dimensions: '1920x1080',
}

function decodeUri(uri: string): Record<string, unknown> {
  const base64 = uri.replace('data:application/json;base64,', '')
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

describe('buildMetadataUri', () => {
  it('returns a data URI with correct MIME type', () => {
    const uri = buildMetadataUri(BASE_PARAMS)
    expect(uri).toMatch(/^data:application\/json;base64,/)
  })

  it('encodes the correct name including unit number and unique name', () => {
    const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
    expect(meta.name).toBe('Balloons in the Sky #42 \u2014 Drifting Over Azure')
  })

  it('sets image to ipfs:// URI using the CID', () => {
    const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
    expect(meta.image).toBe('ipfs://QmTestCid123')
  })

  it('includes hardcoded description and license', () => {
    const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
    expect(meta.description).toBe('Balloons in the Sky by B\u00e5rd Ionson & Jennifer Ionson')
    expect(meta.license).toBe('CC BY-NC 4.0')
  })

  it('renders orientation 0 as Portrait', () => {
    const meta = decodeUri(buildMetadataUri({ ...BASE_PARAMS, orientation: 0 }))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Orientation')
    expect(attr?.value).toBe('Portrait')
  })

  it('renders orientation 1 as Landscape', () => {
    const meta = decodeUri(buildMetadataUri({ ...BASE_PARAMS, orientation: 1 }))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Orientation')
    expect(attr?.value).toBe('Landscape')
  })

  it('formats imagination 75 as "0.75"', () => {
    const meta = decodeUri(buildMetadataUri({ ...BASE_PARAMS, imagination: 75 }))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Imagination')
    expect(attr?.value).toBe('0.75')
  })

  it('formats negative imagination -150 as "-1.50"', () => {
    const meta = decodeUri(buildMetadataUri({ ...BASE_PARAMS, imagination: -150 }))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Imagination')
    expect(attr?.value).toBe('-1.50')
  })

  it('includes all 8 expected attributes', () => {
    const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
    const traits = (meta.attributes as Array<{ trait_type: string }>)
      .map(a => a.trait_type)
    expect(traits).toEqual([
      'Unit Number', 'Seed', 'Orientation', 'Imagination',
      'Event', 'Timestamp', 'Type', 'Pixel Dimensions',
    ])
  })

  it('defaults type to Standard when not provided', () => {
    const params = { ...BASE_PARAMS }
    delete (params as Partial<InstallationSubmitBody>).type
    const meta = decodeUri(buildMetadataUri(params))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Type')
    expect(attr?.value).toBe('Standard')
  })
})
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
source ~/.nvm/nvm.sh && npm test lib/__tests__/metadata.test.ts
```
Expected: `Cannot find module '../metadata'`

- [ ] **Step 3: Create `lib/metadata.ts`**

```typescript
import type { InstallationSubmitBody } from './db/types'

function formatImagination(imagination: number): string {
  const val = imagination / 100
  const sign = val < 0 ? '-' : ''
  const abs = Math.abs(val)
  return `${sign}${abs.toFixed(2)}`
}

/**
 * Assemble NFT metadata JSON from GAN parameters and return a
 * data:application/json;base64 string for use as the `_uri` argument
 * to BalloonsNFT.mint(address to, string _uri).
 */
export function buildMetadataUri(params: InstallationSubmitBody): string {
  const metadata = {
    name: `Balloons in the Sky #${params.unit_number} \u2014 ${params.unique_name}`,
    description: 'Balloons in the Sky by B\u00e5rd Ionson & Jennifer Ionson',
    image: `ipfs://${params.cid}`,
    license: 'CC BY-NC 4.0',
    attributes: [
      { trait_type: 'Unit Number',      value: params.unit_number },
      { trait_type: 'Seed',             value: params.seed },
      { trait_type: 'Orientation',      value: params.orientation === 0 ? 'Portrait' : 'Landscape' },
      { trait_type: 'Imagination',      value: formatImagination(params.imagination) },
      { trait_type: 'Event',            value: params.event_name },
      { trait_type: 'Timestamp',        value: params.timestamp },
      { trait_type: 'Type',             value: params.type ?? 'Standard' },
      { trait_type: 'Pixel Dimensions', value: params.pixel_dimensions ?? '1920x1080' },
    ],
  }

  const json = JSON.stringify(metadata)
  const base64 = Buffer.from(json).toString('base64')
  return `data:application/json;base64,${base64}`
}
```

- [ ] **Step 4: Run tests — verify they all pass**

```bash
source ~/.nvm/nvm.sh && npm test lib/__tests__/metadata.test.ts
```
Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/metadata.ts lib/__tests__/metadata.test.ts
git commit -m "feat: add metadata URI builder (TDD)"
```

---

## Chunk 4: Payment Provider Abstraction (TDD)

### Task 8: Define the PaymentProvider interface

**Files:**
- Create: `lib/payment/provider.ts`

No tests needed for a pure TypeScript interface — it is verified by the compiler when the adapter implements it.

- [ ] **Step 1: Create `lib/payment/provider.ts`**

```typescript
export interface CreateOrderParams {
  recipientEmail: string
  recipientWallet?: string
  uri: string        // data:application/json;base64,...
  priceUsd: number
}

export interface OrderResult {
  orderId: string
  clientSecret?: string   // for Stripe Elements card payments
  status: OrderStatus
}

export type OrderStatus =
  | 'pending'
  | 'awaiting-payment'
  | 'processing'
  | 'delivery-initiated'
  | 'completed'
  | 'failed'

export interface ProviderWebhookEvent {
  type: 'payment.succeeded' | 'delivery.initiated' | 'delivery.completed' | 'delivery.failed' | 'unknown'
  orderId: string
  tokenId?: string
  txHash?: string
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<OrderResult>
  getOrder(orderId: string): Promise<OrderResult>
  /**
   * Verify the webhook signature and parse the event.
   * Returns null if signature is invalid.
   */
  verifyWebhook(rawBody: string, signatureHeader: string): ProviderWebhookEvent | null
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/payment/provider.ts
git commit -m "feat: add PaymentProvider interface"
```

---

### Task 9: CrossmintAdapter (TDD)

**Files:**
- Create: `lib/payment/__tests__/crossmint.test.ts`
- Create: `lib/payment/crossmint.ts`
- Create: `lib/payment/index.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/payment/__tests__/crossmint.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CrossmintAdapter } from '../crossmint'

const COLLECTION_ID = 'test-collection-id'
const SERVER_KEY = 'sk_staging_test'
const WEBHOOK_SECRET = 'whsec_test'

// Mock environment variables
vi.stubEnv('CROSSMINT_COLLECTION_ID', COLLECTION_ID)
vi.stubEnv('CROSSMINT_SERVER_KEY', SERVER_KEY)
vi.stubEnv('CROSSMINT_WEBHOOK_SECRET', WEBHOOK_SECRET)

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('CrossmintAdapter.createOrder', () => {
  beforeEach(() => mockFetch.mockReset())

  it('POSTs to Crossmint orders endpoint with correct auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        orderId: 'order-123',
        payment: { preparation: { clientSecret: 'cs_test' } },
        status: 'awaiting-payment',
      }),
    })

    const adapter = new CrossmintAdapter()
    await adapter.createOrder({
      recipientEmail: 'buyer@example.com',
      uri: 'data:application/json;base64,abc',
      priceUsd: 50,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.crossmint.com/api/2022-06-09/orders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-KEY': SERVER_KEY }),
      })
    )
  })

  it('sends _uri in contractArguments', async () => {
    const uri = 'data:application/json;base64,abc123'
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orderId: 'o1', payment: {}, status: 'pending' }),
    })

    const adapter = new CrossmintAdapter()
    await adapter.createOrder({ recipientEmail: 'a@b.com', uri, priceUsd: 50 })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.lineItems[0].callData.contractArguments._uri).toBe(uri)
  })

  it('returns orderId and clientSecret from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        orderId: 'order-abc',
        payment: { preparation: { clientSecret: 'cs_xyz' } },
        status: 'awaiting-payment',
      }),
    })

    const adapter = new CrossmintAdapter()
    const result = await adapter.createOrder({
      recipientEmail: 'a@b.com',
      uri: 'data:application/json;base64,x',
      priceUsd: 50,
    })

    expect(result.orderId).toBe('order-abc')
    expect(result.clientSecret).toBe('cs_xyz')
  })

  it('throws when Crossmint returns non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    })

    const adapter = new CrossmintAdapter()
    await expect(
      adapter.createOrder({ recipientEmail: 'a@b.com', uri: 'x', priceUsd: 50 })
    ).rejects.toThrow('400')
  })
})

describe('CrossmintAdapter.getOrder', () => {
  beforeEach(() => mockFetch.mockReset())

  it('GETs the correct order URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orderId: 'o1', payment: { status: 'completed' }, phase: 'completed' }),
    })

    const adapter = new CrossmintAdapter()
    await adapter.getOrder('order-123')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.crossmint.com/api/2022-06-09/orders/order-123',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-API-KEY': SERVER_KEY }) })
    )
  })

  it('maps completed phase to completed status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        orderId: 'o1',
        payment: { status: 'completed' },
        phase: 'completed',
        lineItems: [{ metadata: { tokenId: '7', transactionHash: '0xabc' } }],
      }),
    })

    const adapter = new CrossmintAdapter()
    const result = await adapter.getOrder('o1')
    expect(result.status).toBe('completed')
  })
})

describe('CrossmintAdapter.verifyWebhook', () => {
  it('returns null for an invalid signature', () => {
    const adapter = new CrossmintAdapter()
    const result = adapter.verifyWebhook('{}', 'invalid-sig')
    expect(result).toBeNull()
  })

  it('parses delivery.completed event', () => {
    // Valid webhook payloads require HMAC signing — test with a known payload + signature.
    // Implementation note: use the Crossmint webhook signing algorithm to pre-compute
    // a valid signature for this test payload, or mock the verification step.
    // See CrossmintAdapter implementation for signing algorithm.
    const adapter = new CrossmintAdapter()
    const payload = JSON.stringify({
      type: 'orders.delivery.completed',
      data: { order: { orderId: 'o1' }, lineItems: [{ tokenId: '5', transactionHash: '0xdef' }] },
    })
    // Stub the internal verify method to return true for this test
    vi.spyOn(adapter as never, '_verifySignature').mockReturnValue(true)
    const event = adapter.verifyWebhook(payload, 'any-sig')
    expect(event?.type).toBe('delivery.completed')
    expect(event?.tokenId).toBe('5')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test lib/payment/__tests__/crossmint.test.ts
```
Expected: `Cannot find module '../crossmint'`

- [ ] **Step 3: Create `lib/payment/crossmint.ts`**

```typescript
import crypto from 'crypto'
import type { PaymentProvider, CreateOrderParams, OrderResult, ProviderWebhookEvent } from './provider'

const BASE_URL = 'https://www.crossmint.com/api/2022-06-09'

function mapStatus(phase: string, paymentStatus: string): OrderResult['status'] {
  if (phase === 'completed' || paymentStatus === 'completed') return 'completed'
  if (paymentStatus === 'awaiting-payment') return 'awaiting-payment'
  if (paymentStatus === 'processing') return 'processing'
  if (phase === 'delivery') return 'delivery-initiated'
  if (paymentStatus === 'failed') return 'failed'
  return 'pending'
}

export class CrossmintAdapter implements PaymentProvider {
  private get serverKey(): string {
    const key = process.env.CROSSMINT_SERVER_KEY
    if (!key) throw new Error('CROSSMINT_SERVER_KEY is not set')
    return key
  }

  private get collectionId(): string {
    const id = process.env.CROSSMINT_COLLECTION_ID
    if (!id) throw new Error('CROSSMINT_COLLECTION_ID is not set')
    return id
  }

  private get webhookSecret(): string {
    const s = process.env.CROSSMINT_WEBHOOK_SECRET
    if (!s) throw new Error('CROSSMINT_WEBHOOK_SECRET is not set')
    return s
  }

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    const body = {
      recipient: {
        email: params.recipientEmail,
        ...(params.recipientWallet && { walletAddress: `ethereum-sepolia:${params.recipientWallet}` }),
      },
      payment: {
        method: 'stripe-payment-element',
        currency: 'usd',
      },
      lineItems: [{
        collectionLocator: `crossmint:${this.collectionId}`,
        callData: {
          contractArguments: { _uri: params.uri },
          totalPrice: String(params.priceUsd.toFixed(2)),
        },
      }],
    }

    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.serverKey,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Crossmint createOrder failed (${res.status}): ${text}`)
    }

    const data = await res.json()
    return {
      orderId: data.orderId,
      clientSecret: data.payment?.preparation?.clientSecret,
      status: mapStatus(data.phase ?? '', data.payment?.status ?? ''),
    }
  }

  async getOrder(orderId: string): Promise<OrderResult> {
    const res = await fetch(`${BASE_URL}/orders/${orderId}`, {
      headers: { 'X-API-KEY': this.serverKey },
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`Crossmint getOrder failed (${res.status})`)

    const data = await res.json()
    const tokenId = data.lineItems?.[0]?.metadata?.tokenId as string | undefined
    const txHash = data.lineItems?.[0]?.metadata?.transactionHash as string | undefined

    return {
      orderId: data.orderId,
      status: mapStatus(data.phase ?? '', data.payment?.status ?? ''),
      ...(tokenId && { tokenId }),
      ...(txHash && { txHash }),
    } as OrderResult
  }

  /** @internal — separated for testability */
  _verifySignature(rawBody: string, signature: string): boolean {
    try {
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex')
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    } catch {
      return false
    }
  }

  verifyWebhook(rawBody: string, signatureHeader: string): ProviderWebhookEvent | null {
    if (!this._verifySignature(rawBody, signatureHeader)) return null

    try {
      const payload = JSON.parse(rawBody)
      const type = payload.type as string
      const order = payload.data?.order
      const lineItem = payload.data?.lineItems?.[0]

      if (type === 'orders.delivery.completed') {
        return {
          type: 'delivery.completed',
          orderId: order?.orderId ?? '',
          tokenId: lineItem?.tokenId,
          txHash: lineItem?.transactionHash,
        }
      }
      if (type === 'orders.delivery.initiated') {
        return { type: 'delivery.initiated', orderId: order?.orderId ?? '' }
      }
      if (type === 'orders.delivery.failed') {
        return { type: 'delivery.failed', orderId: order?.orderId ?? '' }
      }
      if (type === 'orders.payment.succeeded') {
        return { type: 'payment.succeeded', orderId: order?.orderId ?? '' }
      }
      return { type: 'unknown', orderId: order?.orderId ?? '' }
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 4: Create `lib/payment/index.ts`**

```typescript
import { CrossmintAdapter } from './crossmint'
import type { PaymentProvider } from './provider'

// Swap this line to change payment providers
export const paymentProvider: PaymentProvider = new CrossmintAdapter()
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test lib/payment/__tests__/crossmint.test.ts
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add lib/payment/
git commit -m "feat: add payment provider abstraction + CrossmintAdapter (TDD)"
```

---

## Chunk 5: API Routes — Installation & Mint

### Task 10: `POST /api/installation/submit` (TDD)

**Files:**
- Create: `app/api/installation/submit/__tests__/route.test.ts`
- Create: `app/api/installation/submit/route.ts`

- [ ] **Step 1: Write failing tests**

Create `app/api/installation/submit/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase server client
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: () => ({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
    }),
  }),
}))

vi.stubEnv('INSTALLATION_API_KEY', 'test-api-key')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com')

import { POST } from '../route'

const VALID_BODY = {
  cid: 'QmTest123',
  unique_name: 'Azure Dream',
  unit_number: 1,
  seed: 12345,
  timestamp: '21/03/2026 10:00 CET',
  orientation: 0,
  imagination: 75,
  event_name: 'Test Exhibition',
}

describe('POST /api/installation/submit', () => {
  beforeEach(() => {
    mockSingle.mockReset()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when API key is wrong', async () => {
    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-key' },
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-api-key' },
      body: JSON.stringify({ cid: 'QmTest' }), // missing fields
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns mint_id and mint_url on success', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'mint-uuid-123' },
      error: null,
    })

    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-api-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.mint_id).toBe('mint-uuid-123')
    expect(data.mint_url).toBe('https://example.com/mint/mint-uuid-123')
  })

  it('returns 500 when database insert fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB error' },
    })

    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-api-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test app/api/installation/submit/__tests__/route.test.ts
```
Expected: `Cannot find module '../route'`

- [ ] **Step 3: Create `app/api/installation/submit/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import type { InstallationSubmitBody } from '@/lib/db/types'

const REQUIRED_FIELDS: (keyof InstallationSubmitBody)[] = [
  'cid', 'unique_name', 'unit_number', 'seed',
  'timestamp', 'orientation', 'imagination', 'event_name',
]

function verifyApiKey(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? ''
  const token = header.replace('Bearer ', '').trim()
  return token === process.env.INSTALLATION_API_KEY
}

export async function POST(req: NextRequest) {
  if (!verifyApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<InstallationSubmitBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  const db = serverClient()
  const { data, error } = await db
    .from('mints')
    .insert({
      cid: body.cid,
      unique_name: body.unique_name,
      unit_number: body.unit_number,
      seed: body.seed,
      timestamp: body.timestamp,
      orientation: body.orientation,
      imagination: body.imagination,
      event_name: body.event_name,
      type: body.type ?? 'Standard',
      pixel_dimensions: body.pixel_dimensions ?? '1920x1080',
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('mint insert error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.json({
    mint_id: data.id,
    mint_url: `${appUrl}/mint/${data.id}`,
  })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test app/api/installation/submit/__tests__/route.test.ts
```
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/installation/
git commit -m "feat: add installation submit API route (TDD)"
```

---

### Task 11: `POST /api/mint/[id]/order` (TDD)

**Files:**
- Create: `app/api/mint/[id]/order/__tests__/route.test.ts`
- Create: `app/api/mint/[id]/order/route.ts`

- [ ] **Step 1: Write failing tests**

Create `app/api/mint/[id]/order/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockMintQuery = vi.fn()
const mockCollectorUpsert = vi.fn()
const mockMintUpdate = vi.fn()

vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: (table: string) => {
      if (table === 'mints') return {
        select: () => ({ eq: () => ({ single: mockMintQuery }) }),
        update: () => ({ eq: mockMintUpdate }),
      }
      if (table === 'settings') return {
        select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
          data: { value: '50.00' }, error: null,
        }) }) }),
      }
      if (table === 'collectors') return {
        upsert: () => ({ select: () => ({ single: mockCollectorUpsert }) }),
      }
      return {}
    },
  }),
}))

const mockCreateOrder = vi.fn()
vi.mock('@/lib/payment', () => ({
  paymentProvider: { createOrder: mockCreateOrder },
}))

vi.mock('@/lib/metadata', () => ({
  buildMetadataUri: vi.fn().mockReturnValue('data:application/json;base64,test'),
}))

import { POST } from '../route'

const VALID_BODY = { email: 'buyer@test.com', name: 'Test Buyer' }
const MINT_ID = 'mint-id-123'

describe('POST /api/mint/[id]/order', () => {
  beforeEach(() => {
    mockMintQuery.mockReset()
    mockCollectorUpsert.mockReset()
    mockMintUpdate.mockReset()
    mockCreateOrder.mockReset()
  })

  it('returns 404 when mint does not exist', async () => {
    mockMintQuery.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(404)
  })

  it('returns 409 when mint is already ordered', async () => {
    mockMintQuery.mockResolvedValueOnce({
      data: { id: MINT_ID, status: 'ordered', order_id: 'existing-order' },
      error: null,
    })
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(409)
  })

  it('returns 400 when email is missing', async () => {
    mockMintQuery.mockResolvedValueOnce({
      data: { id: MINT_ID, status: 'pending' },
      error: null,
    })
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify({ name: 'No Email' }),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(400)
  })

  it('returns orderId and clientSecret on success', async () => {
    mockMintQuery.mockResolvedValueOnce({
      data: { id: MINT_ID, status: 'pending', cid: 'QmTest', unique_name: 'Test',
              unit_number: 1, seed: 1, timestamp: 'now', orientation: 0,
              imagination: 75, event_name: 'Test', type: 'Standard',
              pixel_dimensions: '1920x1080' },
      error: null,
    })
    mockCollectorUpsert.mockResolvedValueOnce({ data: { id: 'col-1' }, error: null })
    mockMintUpdate.mockResolvedValueOnce({ error: null })
    mockCreateOrder.mockResolvedValueOnce({
      orderId: 'order-xyz',
      clientSecret: 'cs_test',
      status: 'awaiting-payment',
    })

    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.orderId).toBe('order-xyz')
    expect(data.clientSecret).toBe('cs_test')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test "app/api/mint/\[id\]/order/__tests__/route.test.ts"
```
Expected: `Cannot find module '../route'`

- [ ] **Step 3: Create `app/api/mint/[id]/order/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'
import { buildMetadataUri } from '@/lib/metadata'
import type { InstallationSubmitBody } from '@/lib/db/types'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { email?: string; name?: string; wallet_address?: string;
              street_address?: string; city?: string; state?: string;
              postal_code?: string; country?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.email || !body.name) {
    return NextResponse.json({ error: 'email and name are required' }, { status: 400 })
  }

  const db = serverClient()

  // Fetch mint — inside a logical transaction: check status, then update
  const { data: mint, error: mintError } = await db
    .from('mints')
    .select('*')
    .eq('id', params.id)
    .single()

  if (mintError || !mint) {
    return NextResponse.json({ error: 'Mint not found' }, { status: 404 })
  }

  // Guard against double-submission
  if (mint.status !== 'pending') {
    return NextResponse.json({ error: 'Mint already in progress or completed' }, { status: 409 })
  }

  // Fetch current price from settings
  const { data: setting } = await db
    .from('settings')
    .select('value')
    .eq('key', 'mint_price_usd')
    .single()
  const priceUsd = parseFloat(setting?.value ?? '50.00')

  // Upsert collector (same email = same collector record)
  const { data: collector, error: collectorError } = await db
    .from('collectors')
    .upsert({
      email: body.email,
      name: body.name,
      ...(body.wallet_address && { wallet_address: body.wallet_address }),
      ...(body.street_address && { street_address: body.street_address }),
      ...(body.city && { city: body.city }),
      ...(body.state && { state: body.state }),
      ...(body.postal_code && { postal_code: body.postal_code }),
      ...(body.country && { country: body.country }),
    }, { onConflict: 'email' })
    .select('id')
    .single()

  if (collectorError || !collector) {
    return NextResponse.json({ error: 'Failed to save collector' }, { status: 500 })
  }

  // Build the token URI from stored metadata
  const uri = buildMetadataUri(mint as unknown as InstallationSubmitBody)

  // Create payment order
  let order
  try {
    order = await paymentProvider.createOrder({
      recipientEmail: body.email,
      ...(body.wallet_address && { recipientWallet: body.wallet_address }),
      uri,
      priceUsd,
    })
  } catch (err) {
    console.error('createOrder error:', err)
    return NextResponse.json({ error: 'Payment provider error' }, { status: 502 })
  }

  // Update mint record with order ID and collector — mark as ordered
  await db
    .from('mints')
    .update({ status: 'ordered', order_id: order.orderId, collector_id: collector.id })
    .eq('id', params.id)

  return NextResponse.json({ orderId: order.orderId, clientSecret: order.clientSecret })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test "app/api/mint/\[id\]/order/__tests__/route.test.ts"
```
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add "app/api/mint/[id]/order/"
git commit -m "feat: add mint order API route (TDD)"
```

---

### Task 12: `GET /api/mint/[id]/status` (TDD)

**Files:**
- Create: `app/api/mint/[id]/status/__tests__/route.test.ts`
- Create: `app/api/mint/[id]/status/route.ts`

- [ ] **Step 1: Write failing tests**

Create `app/api/mint/[id]/status/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery = vi.fn()
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: mockQuery }) }) }),
  }),
}))

import { GET } from '../route'

describe('GET /api/mint/[id]/status', () => {
  it('returns 404 when mint does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })
    const req = new NextRequest('http://localhost/api/mint/bad-id/status')
    const res = await GET(req, { params: { id: 'bad-id' } })
    expect(res.status).toBe(404)
  })

  it('returns status for a pending mint', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { status: 'pending', token_id: null, tx_hash: null },
      error: null,
    })
    const req = new NextRequest('http://localhost/api/mint/mint-1/status')
    const res = await GET(req, { params: { id: 'mint-1' } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('pending')
  })

  it('returns token_id and tx_hash when minted', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { status: 'minted', token_id: '42', tx_hash: '0xabc' },
      error: null,
    })
    const req = new NextRequest('http://localhost/api/mint/mint-2/status')
    const res = await GET(req, { params: { id: 'mint-2' } })
    const data = await res.json()
    expect(data.status).toBe('minted')
    expect(data.token_id).toBe('42')
    expect(data.tx_hash).toBe('0xabc')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test "app/api/mint/\[id\]/status/__tests__/route.test.ts"
```
Expected: `Cannot find module '../route'`

- [ ] **Step 3: Create `app/api/mint/[id]/status/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = serverClient()
  const { data, error } = await db
    .from('mints')
    .select('status, token_id, tx_hash')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Mint not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: data.status,
    ...(data.token_id && { token_id: data.token_id }),
    ...(data.tx_hash && { tx_hash: data.tx_hash }),
  })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test "app/api/mint/\[id\]/status/__tests__/route.test.ts"
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add "app/api/mint/[id]/status/"
git commit -m "feat: add mint status API route (TDD)"
```

---

## Chunk 6: Webhook, Cron & Settings Routes (TDD)

### Task 13: `POST /api/webhooks/crossmint` (TDD)

**Files:**
- Create: `app/api/webhooks/crossmint/__tests__/route.test.ts`
- Create: `app/api/webhooks/crossmint/route.ts`

- [ ] **Step 1: Write failing tests**

Create `app/api/webhooks/crossmint/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockInsertWebhook = vi.fn()
const mockUpdateMint = vi.fn()
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: (table: string) => {
      if (table === 'webhook_events') return { insert: mockInsertWebhook }
      if (table === 'mints') return {
        update: () => ({ eq: mockUpdateMint }),
      }
      return {}
    },
  }),
}))

const mockVerifyWebhook = vi.fn()
vi.mock('@/lib/payment', () => ({
  paymentProvider: { verifyWebhook: mockVerifyWebhook },
}))

import { POST } from '../route'

describe('POST /api/webhooks/crossmint', () => {
  beforeEach(() => {
    mockVerifyWebhook.mockReset()
    mockInsertWebhook.mockReset()
    mockUpdateMint.mockReset()
  })

  it('returns 401 when signature is invalid', async () => {
    mockVerifyWebhook.mockReturnValueOnce(null)
    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'bad-sig' },
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 quickly even on unknown event type', async () => {
    mockVerifyWebhook.mockReturnValueOnce({ type: 'unknown', orderId: 'o1' })
    mockInsertWebhook.mockResolvedValueOnce({ error: null })
    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: '{"type":"orders.something.else"}',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('updates mint status to minted on delivery.completed', async () => {
    mockVerifyWebhook.mockReturnValueOnce({
      type: 'delivery.completed',
      orderId: 'order-1',
      tokenId: '7',
      txHash: '0xdef',
    })
    mockInsertWebhook.mockResolvedValueOnce({ error: null })
    mockUpdateMint.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: JSON.stringify({ type: 'orders.delivery.completed' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpdateMint).toHaveBeenCalledWith('order_id', 'order-1')
  })

  it('updates mint status to failed on delivery.failed', async () => {
    mockVerifyWebhook.mockReturnValueOnce({ type: 'delivery.failed', orderId: 'order-2' })
    mockInsertWebhook.mockResolvedValueOnce({ error: null })
    mockUpdateMint.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: JSON.stringify({ type: 'orders.delivery.failed' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test app/api/webhooks/crossmint/__tests__/route.test.ts
```
Expected: `Cannot find module '../route'`

- [ ] **Step 3: Create `app/api/webhooks/crossmint/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('crossmint-signature') ?? ''

  const event = paymentProvider.verifyWebhook(rawBody, signature)
  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const db = serverClient()

  // Log every webhook for audit / reprocessing
  await db.from('webhook_events').insert({
    provider: 'crossmint',
    event_type: event.type,
    order_id: event.orderId || null,
    payload: JSON.parse(rawBody),
    processed: false,
  })

  // Update mint status based on event type
  if (event.type === 'delivery.completed' && event.orderId) {
    await db
      .from('mints')
      .update({
        status: 'minted',
        token_id: event.tokenId ?? null,
        tx_hash: event.txHash ?? null,
      })
      .eq('order_id', event.orderId)
  } else if (event.type === 'delivery.initiated' && event.orderId) {
    await db
      .from('mints')
      .update({ status: 'minting' })
      .eq('order_id', event.orderId)
  } else if (event.type === 'delivery.failed' && event.orderId) {
    await db
      .from('mints')
      .update({ status: 'failed' })
      .eq('order_id', event.orderId)
  } else if (event.type === 'payment.succeeded' && event.orderId) {
    await db
      .from('mints')
      .update({ status: 'paid' })
      .eq('order_id', event.orderId)
  }

  // Always return 200 quickly — Crossmint retries on non-2xx
  return NextResponse.json({ received: true })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test app/api/webhooks/crossmint/__tests__/route.test.ts
```
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/
git commit -m "feat: add Crossmint webhook handler (TDD)"
```

---

### Task 14: Vercel Cron — `GET /api/cron/check-orders` (TDD)

**Files:**
- Create: `app/api/cron/check-orders/__tests__/route.test.ts`
- Create: `app/api/cron/check-orders/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write failing tests**

Create `app/api/cron/check-orders/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSelect = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: () => ({
      select: () => ({ in: mockSelect }),
      update: () => ({ eq: mockUpdate }),
    }),
  }),
}))

const mockGetOrder = vi.fn()
vi.mock('@/lib/payment', () => ({
  paymentProvider: { getOrder: mockGetOrder },
}))

vi.stubEnv('CRON_SECRET', 'test-cron-secret')

import { GET } from '../route'

describe('GET /api/cron/check-orders', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockUpdate.mockReset()
    mockGetOrder.mockReset()
  })

  it('returns 401 without cron secret', async () => {
    const req = new NextRequest('http://localhost/api/cron/check-orders')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with no pending orders', async () => {
    mockSelect.mockResolvedValueOnce({ data: [], error: null })
    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.checked).toBe(0)
  })

  it('updates mint to minted when provider reports completed', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [{ id: 'mint-1', order_id: 'order-1' }],
      error: null,
    })
    mockGetOrder.mockResolvedValueOnce({ status: 'completed', orderId: 'order-1',
                                         tokenId: '5', txHash: '0xabc' })
    mockUpdate.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test app/api/cron/check-orders/__tests__/route.test.ts
```
Expected: `Cannot find module '../route'`

- [ ] **Step 3: Create `app/api/cron/check-orders/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'

export async function GET(req: NextRequest) {
  // Vercel cron requests include the CRON_SECRET as a Bearer token
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serverClient()

  // Find all mints that are in-flight but not yet completed
  const { data: mints, error } = await db
    .from('mints')
    .select('id, order_id')
    .in('status', ['ordered', 'paid', 'minting'])

  if (error || !mints) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  let updated = 0
  for (const mint of mints) {
    if (!mint.order_id) continue
    try {
      const order = await paymentProvider.getOrder(mint.order_id)
      if (order.status === 'completed') {
        await db
          .from('mints')
          .update({ status: 'minted', token_id: (order as never as { tokenId?: string }).tokenId ?? null,
                    tx_hash: (order as never as { txHash?: string }).txHash ?? null })
          .eq('id', mint.id)
        updated++
      } else if (order.status === 'failed') {
        await db.from('mints').update({ status: 'failed' }).eq('id', mint.id)
        updated++
      }
    } catch {
      // Individual order check failure — continue with others
    }
  }

  return NextResponse.json({ checked: mints.length, updated })
}
```

- [ ] **Step 4: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-orders",
      "schedule": "* * * * *"
    }
  ]
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test app/api/cron/check-orders/__tests__/route.test.ts
```
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/ vercel.json
git commit -m "feat: add cron order checker + vercel.json schedule (TDD)"
```

---

### Task 15: `GET /api/settings/price` (TDD)

**Files:**
- Create: `app/api/settings/price/__tests__/route.test.ts`
- Create: `app/api/settings/price/route.ts`

- [ ] **Step 1: Write failing tests**

Create `app/api/settings/price/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery = vi.fn()
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: mockQuery }) }) }),
  }),
}))

import { GET } from '../route'

describe('GET /api/settings/price', () => {
  it('returns the current mint price', async () => {
    mockQuery.mockResolvedValueOnce({ data: { value: '50.00' }, error: null })
    const req = new NextRequest('http://localhost/api/settings/price')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.price_usd).toBe('50.00')
  })

  it('returns default price when setting is missing', async () => {
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    const req = new NextRequest('http://localhost/api/settings/price')
    const res = await GET(req)
    const data = await res.json()
    expect(data.price_usd).toBe('50.00')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test app/api/settings/price/__tests__/route.test.ts
```
Expected: `Cannot find module '../route'`

- [ ] **Step 3: Create `app/api/settings/price/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'

export async function GET(_req: NextRequest) {
  const db = serverClient()
  const { data, error } = await db
    .from('settings')
    .select('value')
    .eq('key', 'mint_price_usd')
    .single()

  const price = (!error && data) ? data.value : '50.00'
  return NextResponse.json({ price_usd: price })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test app/api/settings/price/__tests__/route.test.ts
```
Expected: `2 passed`

- [ ] **Step 5: Run full test suite**

```bash
source ~/.nvm/nvm.sh && npm test
```
Expected: all tests pass, no failures.

- [ ] **Step 6: Commit**

```bash
git add app/api/settings/
git commit -m "feat: add settings price API route (TDD)"
```

---

## Chunk 7: UI Components (TDD)

### Task 16: `WalletButtons` component (TDD)

**Files:**
- Create: `components/__tests__/WalletButtons.test.tsx`
- Create: `components/WalletButtons.tsx`

- [ ] **Step 1: Write failing tests**

Create `components/__tests__/WalletButtons.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import WalletButtons from '../WalletButtons'

const MINT_URL = 'https://example.com/mint/abc-123'

describe('WalletButtons', () => {
  it('renders all four wallet buttons', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    expect(screen.getByText(/MetaMask/i)).toBeInTheDocument()
    expect(screen.getByText(/Coinbase/i)).toBeInTheDocument()
    expect(screen.getByText(/Rabby/i)).toBeInTheDocument()
    expect(screen.getByText(/Rainbow/i)).toBeInTheDocument()
    expect(screen.getByText(/Other Wallet/i)).toBeInTheDocument()
  })

  it('MetaMask link uses metamask.app.link format', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    const link = screen.getByText(/MetaMask/i).closest('a')
    expect(link?.href).toContain('metamask.app.link/dapp/')
    expect(link?.href).toContain('example.com/mint/abc-123')
  })

  it('Coinbase link uses go.cb-wallet.com format', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    const link = screen.getByText(/Coinbase/i).closest('a')
    expect(link?.href).toContain('go.cb-wallet.com/dapp')
  })

  it('Rainbow link uses rnbwapp.com format', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    const link = screen.getByText(/Rainbow/i).closest('a')
    expect(link?.href).toContain('rnbwapp.com/dapp')
  })

  it('all wallet links open in the same tab (no target _blank)', () => {
    render(<WalletButtons mintUrl={MINT_URL} />)
    const links = screen.getAllByRole('link')
    // Deep links must open in the same tab — _blank breaks mobile wallet deep links
    links.forEach(link => {
      expect(link).not.toHaveAttribute('target', '_blank')
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test components/__tests__/WalletButtons.test.tsx
```
Expected: `Cannot find module '../WalletButtons'`

- [ ] **Step 3: Create `components/WalletButtons.tsx`**

```typescript
'use client'

interface Props {
  mintUrl: string
}

function walletDeepLink(wallet: string, mintUrl: string): string {
  const encoded = encodeURIComponent(mintUrl)
  const host = mintUrl.replace(/^https?:\/\//, '').split('?')[0]

  switch (wallet) {
    case 'metamask':
      return `https://metamask.app.link/dapp/${host}`
    case 'coinbase':
      return `https://go.cb-wallet.com/dapp?url=${encoded}`
    case 'rabby':
      // Note: verify this deep link format before shipping — Rabby Mobile docs are sparse
      return `https://link.rabby.io/dapp?url=${encoded}`
    case 'rainbow':
      return `https://rnbwapp.com/dapp?url=${encoded}`
    default:
      return mintUrl
  }
}

const WALLETS = [
  { key: 'metamask', label: '🦊 MetaMask' },
  { key: 'coinbase', label: '🔵 Coinbase' },
  { key: 'rabby',    label: '🐰 Rabby' },
  { key: 'rainbow',  label: '🌈 Rainbow' },
]

export default function WalletButtons({ mintUrl }: Props) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <p className="text-white/50 text-xs text-center">Open in your wallet browser</p>
      <div className="grid grid-cols-2 gap-2">
        {WALLETS.map(({ key, label }) => (
          <a
            key={key}
            href={walletDeepLink(key, mintUrl)}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white text-center hover:bg-white/10 transition-colors"
          >
            {label}
          </a>
        ))}
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/40 text-center col-span-2">
          🔗 Other Wallet — use the checkout form below (WalletConnect)
        </p>
      </div>
      <p className="text-white/30 text-xs text-center">
        ── or pay with card / Apple Pay below ──
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test components/__tests__/WalletButtons.test.tsx
```
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add components/WalletButtons.tsx components/__tests__/WalletButtons.test.tsx
git commit -m "feat: add WalletButtons component with deep links (TDD)"
```

---

### Task 17: `CheckoutForm` component (TDD)

**Files:**
- Create: `components/__tests__/CheckoutForm.test.tsx`
- Create: `components/CheckoutForm.tsx`
- Create: `components/MintSuccess.tsx`

- [ ] **Step 1: Write failing tests**

Create `components/__tests__/CheckoutForm.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CheckoutForm from '../CheckoutForm'

// Mock Crossmint SDK
vi.mock('@crossmint/client-sdk-react-ui', () => ({
  CrossmintProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CrossmintEmbeddedCheckout: () => <div data-testid="crossmint-checkout">Checkout</div>,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const BASE_PROPS = {
  mintId: 'mint-123',
  mintUrl: 'https://example.com/mint/mint-123',
  priceUsd: '50.00',
}

describe('CheckoutForm', () => {
  beforeEach(() => mockFetch.mockReset())

  it('renders the email and name fields', () => {
    render(<CheckoutForm {...BASE_PROPS} />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
  })

  it('renders the mint price on the submit button', () => {
    render(<CheckoutForm {...BASE_PROPS} />)
    expect(screen.getByRole('button', { name: /Mint Now.*50/i })).toBeInTheDocument()
  })

  it('shows mailing address fields when expanded', async () => {
    render(<CheckoutForm {...BASE_PROPS} />)
    const toggle = screen.getByText(/add mailing address/i)
    await userEvent.click(toggle)
    expect(screen.getByLabelText(/street/i)).toBeInTheDocument()
  })

  it('shows error message when order creation fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Payment provider error' }),
    })

    render(<CheckoutForm {...BASE_PROPS} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'test@test.com')
    await userEvent.type(screen.getByLabelText(/name/i), 'Test User')
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      expect(screen.getByText(/payment provider error/i)).toBeInTheDocument()
    })
  })

  it('renders CrossmintEmbeddedCheckout after successful order creation', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orderId: 'order-1', clientSecret: 'cs_test' }),
      })
      // Status polling returns pending first
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'pending' }),
      })

    render(<CheckoutForm {...BASE_PROPS} />)
    await userEvent.type(screen.getByLabelText(/email/i), 'buyer@test.com')
    await userEvent.type(screen.getByLabelText(/name/i), 'Buyer Name')
    fireEvent.submit(screen.getByRole('form'))

    await waitFor(() => {
      expect(screen.getByTestId('crossmint-checkout')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && npm test components/__tests__/CheckoutForm.test.tsx
```
Expected: `Cannot find module '../CheckoutForm'`

- [ ] **Step 3: Create `components/MintSuccess.tsx`**

```typescript
interface Props {
  tokenId: string | null
  txHash: string | null
  unitNumber: number
}

const NFT_ADDRESS = process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS ?? ''

export default function MintSuccess({ tokenId, txHash, unitNumber }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-5xl">🎈</div>
      <h2 className="text-xl font-semibold text-white">
        Balloon #{unitNumber} is yours!
      </h2>
      {tokenId && (
        <p className="text-white/60 text-sm">Token ID: {tokenId}</p>
      )}
      {txHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/50 underline text-xs hover:text-white/80"
        >
          View transaction on Etherscan ↗
        </a>
      )}
      <a
        href={`https://sepolia.etherscan.io/address/${NFT_ADDRESS}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/30 underline text-xs hover:text-white/60"
      >
        View contract ↗
      </a>
      <p className="text-white/40 text-sm mt-2">
        Check your email — Crossmint will send wallet access instructions.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/CheckoutForm.tsx`**

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { CrossmintProvider, CrossmintEmbeddedCheckout } from '@crossmint/client-sdk-react-ui'
import WalletButtons from './WalletButtons'
import MintSuccess from './MintSuccess'

type Phase = 'form' | 'submitting' | 'payment' | 'success' | 'error'

interface Props {
  mintId: string
  mintUrl: string
  priceUsd: string
  unitNumber?: number
}

export default function CheckoutForm({ mintId, mintUrl, priceUsd, unitNumber = 0 }: Props) {
  const [phase, setPhase] = useState<Phase>('form')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [wallet, setWallet] = useState('')
  const [showAddress, setShowAddress] = useState(false)
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postal, setPostal] = useState('')
  const [country, setCountry] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [tokenId, setTokenId] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clientKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('submitting')
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/mint/${mintId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, name,
          ...(wallet && { wallet_address: wallet }),
          ...(street && { street_address: street }),
          ...(city && { city }),
          ...(state && { state }),
          ...(postal && { postal_code: postal }),
          ...(country && { country }),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Order creation failed')

      setOrderId(data.orderId)
      setClientSecret(data.clientSecret ?? null)
      setPhase('payment')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setPhase('error')
    }
  }

  // Poll for mint completion after order is created
  useEffect(() => {
    if (!orderId || phase === 'success' || phase === 'error') return

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mint/${mintId}/status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'minted') {
          clearInterval(pollRef.current!)
          setTokenId(data.token_id ?? null)
          setTxHash(data.tx_hash ?? null)
          setPhase('success')
        }
      } catch { /* keep polling */ }
    }, 5000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [orderId, phase, mintId])

  if (phase === 'success') {
    return <MintSuccess tokenId={tokenId} txHash={txHash} unitNumber={unitNumber} />
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-red-400 text-sm">{errorMsg}</p>
        <button
          onClick={() => { setPhase('form'); setErrorMsg(null) }}
          className="text-white/60 underline text-sm hover:text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  if (phase === 'payment' && orderId && clientSecret) {
    return (
      <div className="w-full max-w-md">
        <CrossmintProvider apiKey={clientKey}>
          <CrossmintEmbeddedCheckout
            orderId={orderId}
            clientSecret={clientSecret}
            payment={{
              crypto: { enabled: false },
              fiat: { enabled: true, allowedMethods: { card: true } },
              defaultMethod: 'fiat',
              receiptEmail: email,
            }}
          />
        </CrossmintProvider>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <WalletButtons mintUrl={mintUrl} />

      <form
        aria-label="Checkout form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full"
      >
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Email *
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-white/80">
          Name *
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-white/80">
          Wallet address <span className="text-white/30">(optional)</span>
          <input
            id="wallet"
            type="text"
            value={wallet}
            onChange={e => setWallet(e.target.value)}
            placeholder="0x..."
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50 font-mono text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowAddress(!showAddress)}
          className="text-white/40 text-xs text-left hover:text-white/60 underline"
        >
          {showAddress ? '▲ Hide mailing address' : '▼ Add mailing address (for postcards)'}
        </button>

        {showAddress && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-white/80">
              Street
              <input id="street" type="text" value={street} onChange={e => setStreet(e.target.value)}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm text-white/80">
                City
                <input id="city" type="text" value={city} onChange={e => setCity(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-white/80">
                State / Region
                <input id="state" type="text" value={state} onChange={e => setState(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm text-white/80">
                Postal code
                <input id="postal" type="text" value={postal} onChange={e => setPostal(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-white/80">
                Country
                <input id="country" type="text" value={country} onChange={e => setCountry(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
              </label>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={phase === 'submitting'}
          className="rounded-lg bg-white px-6 py-3 font-semibold text-black hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {phase === 'submitting'
            ? 'Preparing order…'
            : `Mint Now — $${priceUsd}`}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
source ~/.nvm/nvm.sh && npm test components/__tests__/CheckoutForm.test.tsx
```
Expected: `5 passed`

- [ ] **Step 6: Run full test suite**

```bash
source ~/.nvm/nvm.sh && npm test
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/
git commit -m "feat: add CheckoutForm, WalletButtons, MintSuccess components (TDD)"
```

---

## Chunk 8: Viewer Page & Environment Setup

### Task 18: Viewer page `/mint/[id]`

**Files:**
- Create: `app/mint/[id]/page.tsx`
- Modify: `next.config.mjs`

No unit tests for this server component — it is verified by the end-to-end test plan in the spec. Its logic is thin: fetch from DB, pass to client component.

- [ ] **Step 1: Update `next.config.mjs` to allow both IPFS gateways**

The viewer page uses `dweb.link` as the primary image gateway with `ipfs.io` as fallback. Both must be in the allowlist before the page can render images.

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dweb.link' },
      { protocol: 'https', hostname: 'ipfs.io' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 2: Create `app/mint/[id]/page.tsx`**

```typescript
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { serverClient } from '@/lib/db/server'
import CheckoutForm from '@/components/CheckoutForm'
import type { Mint } from '@/lib/db/types'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Balloons in the Sky — Mint',
    description: 'Mint your generative balloon NFT by Bård Ionson & Jennifer Ionson',
  }
}

export default async function MintPage({ params }: Props) {
  const db = serverClient()

  const { data: mint, error } = await db
    .from('mints')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !mint) notFound()

  const { data: setting } = await db
    .from('settings')
    .select('value')
    .eq('key', 'mint_price_usd')
    .single()

  const priceUsd = setting?.value ?? '50.00'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const mintUrl = `${appUrl}/mint/${params.id}`

  // IPFS image — try dweb.link first, ipfs.io as fallback (handled client-side with onError)
  const imageUrl = `https://dweb.link/ipfs/${mint.cid}`

  const m = mint as Mint

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
          Bård Ionson &amp; Jennifer Ionson
        </p>
        <h1 className="text-3xl font-light text-white tracking-wide">
          Balloons in the Sky
        </h1>
      </div>

      {/* Artwork */}
      <div className="mb-6 rounded-xl overflow-hidden shadow-2xl max-w-xs w-full aspect-square bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`Balloon #${m.unit_number} — ${m.unique_name}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to ipfs.io gateway
            const img = e.currentTarget
            if (!img.src.includes('ipfs.io')) {
              img.src = `https://ipfs.io/ipfs/${m.cid}`
            }
          }}
        />
      </div>

      {/* Metadata */}
      <div className="mb-8 text-center">
        <p className="text-white text-lg font-medium">
          #{m.unit_number} &mdash; {m.unique_name}
        </p>
        <p className="text-white/50 text-sm mt-1">
          {m.event_name} &middot; {m.timestamp}
        </p>
      </div>

      {/* Already minted — show success view */}
      {m.status === 'minted' || m.status === 'printed' ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-4xl">🎈</div>
          <p className="text-white/60 text-sm">This balloon has already been minted.</p>
          {m.token_id && (
            <a
              href={`https://sepolia.etherscan.io/token/${process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS}?a=${m.token_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 underline text-xs hover:text-white/60"
            >
              View token #{m.token_id} on Etherscan ↗
            </a>
          )}
        </div>
      ) : (
        <CheckoutForm
          mintId={params.id}
          mintUrl={mintUrl}
          priceUsd={priceUsd}
          unitNumber={m.unit_number}
        />
      )}

      <footer className="mt-16 text-white/20 text-xs text-center">
        <p>Sepolia testnet &middot; Powered by Crossmint</p>
      </footer>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/mint/" next.config.mjs
git commit -m "feat: add viewer mint page + IPFS gateway config (server component)"
```

---

### Task 19: Environment variables & final wiring

**Files:**
- Modify: `.env.local`
- Modify: `next.config.mjs`

- [ ] **Step 1: Update `.env.local` with all required variables**

```bash
# Supabase — get from https://supabase.com/dashboard/project/<your-project>/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App URL (used to build QR code mint_url)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Installation security — generate a random secret and share with the GPU script
INSTALLATION_API_KEY=generate-a-random-secret-here

# Vercel Cron security — generate a random secret
CRON_SECRET=generate-another-random-secret

# Crossmint (staging)
CROSSMINT_SERVER_KEY=sk_staging_5ZSwTABQamyFZrPk...
CROSSMINT_WEBHOOK_SECRET=get-from-crossmint-console-webhooks
CROSSMINT_COLLECTION_ID=REPLACE_WITH_YOUR_COLLECTION_ID
NEXT_PUBLIC_CROSSMINT_CLIENT_KEY=ck_staging_5ZSwTABQamyFZrPk...
NEXT_PUBLIC_CROSSMINT_COLLECTION_ID=REPLACE_WITH_YOUR_COLLECTION_ID

# Contract
NEXT_PUBLIC_BALLOONS_NFT_ADDRESS=0xaAA89F9C4f784AaB92d0aA3Ca086e6E99bCE9Af7
```

- [ ] **Step 2: Verify `next.config.mjs` has both IPFS gateways**

This was updated in Task 18 Step 1. Confirm `dweb.link` and `ipfs.io` are both present:

```bash
grep -E 'dweb|ipfs' next.config.mjs
```
Expected: two lines, one for each hostname.

- [ ] **Step 3: Run the dev server and verify it starts**

```bash
source ~/.nvm/nvm.sh && npm run dev
```
Expected: server starts on `http://localhost:3000`, no TypeScript errors.

- [ ] **Step 4: Run full test suite one final time**

```bash
source ~/.nvm/nvm.sh && npm test
```
Expected: all tests pass.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: finalize env config and verify full test suite passes"
```

---

## Verification Checklist

Before marking Phase 1 complete, run through the spec's test plan:

- [ ] `curl -X POST http://localhost:3000/api/installation/submit -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" -d '{"cid":"QmTest","unique_name":"Test Balloon","unit_number":1,"seed":12345,"timestamp":"21/03/2026 10:00 CET","orientation":0,"imagination":75,"event_name":"Test Show"}'` → returns `{ mint_id, mint_url }`
- [ ] Open returned `mint_url` in browser → artwork loads from IPFS, price shows correctly
- [ ] Submit checkout form → Crossmint order appears in staging console
- [ ] Pay with Stripe test card `4242 4242 4242 4242` → NFT minted on Sepolia
- [ ] Verify webhook received → `mints` row updated to `status = 'minted'`
- [ ] Call `tokenURI(tokenId)` on Sepolia → base64 JSON decodes to correct metadata
- [ ] Check `GET /api/mint/{id}/status` → returns `{ status: 'minted', token_id, tx_hash }`
- [ ] Register Crossmint webhook in staging console pointing to your Vercel preview URL
- [ ] Deploy to Vercel preview and repeat full flow
