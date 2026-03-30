# Supabase → Neon Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase with Neon (serverless PostgreSQL) across the web app — same schema, no Supabase packages, cleaner raw-SQL interface.

**Architecture:** `@neondatabase/serverless` provides a tagged-template `sql` function that parameterises queries safely and works over HTTP (no persistent connections — required for Next.js serverless). `lib/db/server.ts` exports `sql` directly; every API route and page imports it and writes plain SQL. The browser client (`lib/db/browser.ts`) is dead code and gets deleted.

**Tech Stack:** `@neondatabase/serverless`, Next.js App Router, Vitest

---

## Pre-requisite: Provision Neon (manual step — do this first)

```bash
npx neonctl@latest init
```

This creates a Neon project and writes a `DATABASE_URL` to `.env`. Copy that value — you will need it in Task 1.

Then run the schema on your new database:

```bash
npx neonctl@latest sql --file supabase/migrations/001_schema.sql
npx neonctl@latest sql --file supabase/migrations/002_seed.sql
```

---

## File Map

| File | Action |
|---|---|
| `package.json` | Remove `@supabase/ssr`, `@supabase/supabase-js`; add `@neondatabase/serverless` |
| `.env.local` | Replace 3 Supabase vars with `DATABASE_URL` |
| `lib/db/server.ts` | Replace with Neon `sql` export |
| `lib/db/browser.ts` | Delete (unused) |
| `lib/db/types.ts` | No change |
| `app/api/installation/submit/route.ts` | Replace Supabase queries with SQL |
| `app/api/mint/[id]/order/route.ts` | Replace Supabase queries with SQL |
| `app/api/mint/[id]/status/route.ts` | Replace Supabase queries with SQL |
| `app/api/settings/price/route.ts` | Replace Supabase queries with SQL |
| `app/api/cron/check-orders/route.ts` | Replace Supabase queries with SQL |
| `app/api/webhooks/thirdweb/route.ts` | Replace Supabase queries with SQL |
| `app/mint/[id]/page.tsx` | Replace Supabase queries with SQL |
| All `__tests__/route.test.ts` files | Update mocks from fluent-chain to `sql` vi.fn() |

---

## Task 1: Packages + env

**Files:** `package.json`, `.env.local`

- [ ] **Step 1: Install Neon driver, remove Supabase packages**

```bash
cd sky_balloons_web
PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  npm install @neondatabase/serverless && \
  npm uninstall @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Update `.env.local`**

Remove:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Add:
```dotenv
# Neon PostgreSQL
DATABASE_URL=<paste value from neonctl init>
```

- [ ] **Step 3: Verify install**

```bash
PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node -e "require('@neondatabase/serverless'); console.log('ok')"
```

Expected: `ok`

---

## Task 2: Replace `lib/db/server.ts`, delete `lib/db/browser.ts`

**Files:** `sky_balloons_web/lib/db/server.ts`, `sky_balloons_web/lib/db/browser.ts`

- [ ] **Step 1: Replace `lib/db/server.ts`**

```typescript
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

/**
 * Neon serverless SQL client.
 * Use as a tagged template: await sql`SELECT * FROM mints WHERE id = ${id}`
 * Results are typed as unknown[] — cast to your type at the call site.
 */
export const sql = neon(process.env.DATABASE_URL)
```

- [ ] **Step 2: Delete `lib/db/browser.ts`**

```bash
rm sky_balloons_web/lib/db/browser.ts
```

- [ ] **Step 3: Run all existing tests to see what breaks**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run 2>&1 | tail -20
```

Expected: multiple test files fail because mocks still reference Supabase fluent API. That's expected — fix them in subsequent tasks.

---

## Task 3: `installation/submit` route + test

**Files:**
- Modify: `sky_balloons_web/app/api/installation/submit/route.ts`
- Modify: `sky_balloons_web/app/api/installation/submit/__tests__/route.test.ts`

- [ ] **Step 1: Update the test mock**

Replace the `vi.mock('@/lib/db/server', ...)` block with:

```typescript
const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))
```

In tests that check a successful insert, add:
```typescript
mockSql.mockResolvedValueOnce([{ id: 'new-mint-id' }])
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run app/api/installation/submit
```

- [ ] **Step 3: Update `route.ts`**

Replace the `serverClient()` block with:

```typescript
import { sql } from '@/lib/db/server'
```

Replace the insert query:
```typescript
// OLD:
const db = serverClient()
const { data, error } = await db.from('mints').insert({ ... }).select('id').single()
if (error || !data) { ... }

// NEW:
const [mint] = await sql`
  INSERT INTO mints (cid, unique_name, unit_number, seed, timestamp, orientation, imagination, event_name, type, pixel_dimensions)
  VALUES (
    ${body.cid}, ${body.unique_name}, ${body.unit_number}, ${body.seed},
    ${body.timestamp}, ${body.orientation}, ${body.imagination}, ${body.event_name},
    ${body.type ?? 'Standard'}, ${body.pixel_dimensions ?? '1920x1080'}
  )
  RETURNING id
` as { id: string }[]
if (!mint) return NextResponse.json({ error: 'Failed to create mint' }, { status: 500 })
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run app/api/installation/submit
```

---

## Task 4: `mint/[id]/order` route + test

**Files:**
- Modify: `sky_balloons_web/app/api/mint/[id]/order/route.ts`
- Modify: `sky_balloons_web/app/api/mint/[id]/order/__tests__/route.test.ts`

- [ ] **Step 1: Update the test mock**

```typescript
const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))
```

The route makes 4 SQL calls in sequence. Use `mockResolvedValueOnce` for each in order:
1. `SELECT * FROM mints WHERE id = ?` → `[{ id, status: 'pending', ... }]` or `[]`
2. `SELECT value FROM settings WHERE key = 'mint_price_usd'` → `[{ value: '50.00' }]`
3. `INSERT INTO collectors ... ON CONFLICT ... RETURNING id` → `[{ id: 'collector-id' }]`
4. `UPDATE mints SET status = 'ordered' ...` → `[]`

Update test assertions to match (no more `{ data, error }` — just arrays).

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run "app/api/mint/\[id\]/order"
```

- [ ] **Step 3: Update `route.ts`**

Remove `serverClient` import, add `import { sql } from '@/lib/db/server'`.

Replace the 4 queries:

```typescript
// 1. Fetch mint
const [mint] = await sql`SELECT * FROM mints WHERE id = ${params.id}` as Mint[]
if (!mint) return NextResponse.json({ error: 'Mint not found' }, { status: 404 })
if (mint.status !== 'pending') {
  return NextResponse.json({ error: 'Mint already in progress or completed' }, { status: 409 })
}

// 2. Fetch price
const [setting] = await sql`SELECT value FROM settings WHERE key = 'mint_price_usd'` as { value: string }[]
const priceUsd = parseFloat(setting?.value ?? '50.00')

// 3. Upsert collector
const [collector] = await sql`
  INSERT INTO collectors (email, name, wallet_address, street_address, city, state, postal_code, country)
  VALUES (
    ${body.email}, ${body.name},
    ${body.wallet_address ?? null}, ${body.street_address ?? null},
    ${body.city ?? null}, ${body.state ?? null},
    ${body.postal_code ?? null}, ${body.country ?? null}
  )
  ON CONFLICT (email) DO UPDATE SET
    name            = EXCLUDED.name,
    wallet_address  = COALESCE(EXCLUDED.wallet_address, collectors.wallet_address),
    street_address  = COALESCE(EXCLUDED.street_address, collectors.street_address),
    city            = COALESCE(EXCLUDED.city,            collectors.city),
    state           = COALESCE(EXCLUDED.state,           collectors.state),
    postal_code     = COALESCE(EXCLUDED.postal_code,     collectors.postal_code),
    country         = COALESCE(EXCLUDED.country,         collectors.country)
  RETURNING id
` as { id: string }[]
if (!collector) return NextResponse.json({ error: 'Failed to save collector' }, { status: 500 })

// 4. Update mint
await sql`
  UPDATE mints SET status = 'ordered', order_id = ${order.orderId}, collector_id = ${collector.id}
  WHERE id = ${params.id}
`
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run "app/api/mint/\[id\]/order"
```

---

## Task 5: `mint/[id]/status` route + test

**Files:**
- Modify: `sky_balloons_web/app/api/mint/[id]/status/route.ts`
- Modify: `sky_balloons_web/app/api/mint/[id]/status/__tests__/route.test.ts`

- [ ] **Step 1: Update test mock**

```typescript
const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))
// Mock returns: [{ status: 'minted', token_id: '42', tx_hash: '0xabc' }]
```

- [ ] **Step 2: Update `route.ts`**

```typescript
import { sql } from '@/lib/db/server'

const [mint] = await sql`
  SELECT status, token_id, tx_hash FROM mints WHERE id = ${params.id}
` as { status: string; token_id: string | null; tx_hash: string | null }[]

if (!mint) return NextResponse.json({ error: 'Not found' }, { status: 404 })
return NextResponse.json({ status: mint.status, token_id: mint.token_id, tx_hash: mint.tx_hash })
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run "app/api/mint/\[id\]/status"
```

---

## Task 6: `settings/price` route + test

**Files:**
- Modify: `sky_balloons_web/app/api/settings/price/route.ts`
- Modify: `sky_balloons_web/app/api/settings/price/__tests__/route.test.ts`

- [ ] **Step 1: Update test mock + route**

Test mock:
```typescript
const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))
mockSql.mockResolvedValueOnce([{ value: '75.00' }])
```

Route:
```typescript
import { sql } from '@/lib/db/server'

const [setting] = await sql`SELECT value FROM settings WHERE key = 'mint_price_usd'` as { value: string }[]
const price = setting?.value ?? '50.00'
return NextResponse.json({ price_usd: price })
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run app/api/settings/price
```

---

## Task 7: `cron/check-orders` route + test

**Files:**
- Modify: `sky_balloons_web/app/api/cron/check-orders/route.ts`
- Modify: `sky_balloons_web/app/api/cron/check-orders/__tests__/route.test.ts`

- [ ] **Step 1: Update test mock + route**

Test mock:
```typescript
const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))
// First call: SELECT mints — returns stale orders
// Subsequent calls: UPDATE mints — return []
```

Route — replace the Supabase query:
```typescript
import { sql } from '@/lib/db/server'

const staleMints = await sql`
  SELECT id, order_id FROM mints WHERE status IN ('ordered', 'paid', 'minting')
` as { id: string; order_id: string }[]
```

And the update calls:
```typescript
await sql`UPDATE mints SET status = 'minted', token_id = ${tokenId}, tx_hash = ${txHash} WHERE id = ${id}`
await sql`UPDATE mints SET status = 'failed' WHERE id = ${id}`
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run app/api/cron
```

---

## Task 8: `webhooks/thirdweb` route + test

**Files:**
- Modify: `sky_balloons_web/app/api/webhooks/thirdweb/route.ts`
- Modify: `sky_balloons_web/app/api/webhooks/thirdweb/__tests__/route.test.ts`

This route has the most complex query (a JOIN) and the most SQL calls.

- [ ] **Step 1: Update test mock**

```typescript
const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))
```

For the `payment.succeeded` path, the mock needs to return (in order):
1. `INSERT INTO webhook_events` → `[]`
2. `SELECT m.*, c.wallet_address ...` → `[{ id, status: 'pending', collector_wallet_address: '0xabc', ... }]`
3. `UPDATE mints SET status = 'minting'` → `[]`
4. `UPDATE mints SET status = 'minted'` → `[]`
5. `UPDATE webhook_events SET processed = true` → `[]`

- [ ] **Step 2: Update `route.ts`**

Remove `serverClient`, add `import { sql } from '@/lib/db/server'`.

Replace all queries:

```typescript
// 1. Insert webhook event audit log
await sql`
  INSERT INTO webhook_events (provider, event_type, order_id, payload, processed)
  VALUES ('thirdweb', ${event.type}, ${event.orderId || null}, ${JSON.stringify(parsedBody)}, false)
`

// 2. JOIN query — replaces select('*, collectors(email, wallet_address)')
const [mint] = await sql`
  SELECT m.*, c.wallet_address AS collector_wallet_address
  FROM mints m
  LEFT JOIN collectors c ON m.collector_id = c.id
  WHERE m.order_id = ${event.orderId}
` as (Mint & { collector_wallet_address: string | null })[]

// 3. Update to minting
await sql`UPDATE mints SET status = 'minting' WHERE order_id = ${event.orderId}`

// 4. Replace collector access (was: mint.collectors[0].wallet_address)
const rawAddress: string =
  mint.collector_wallet_address ??
  (() => { throw new Error(`No wallet address for mint ${mint.id} — wallet_address required`) })()

// 5. Update to minted
await sql`
  UPDATE mints SET status = 'minted', token_id = ${tokenId}, tx_hash = ${txHash}
  WHERE order_id = ${event.orderId}
`

// 6. Mark webhook processed
await sql`UPDATE webhook_events SET processed = true WHERE order_id = ${event.orderId}`

// 7. On failure
await sql`UPDATE mints SET status = 'failed' WHERE order_id = ${event.orderId}`
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run app/api/webhooks
```

---

## Task 9: `app/mint/[id]/page.tsx`

**File:** `sky_balloons_web/app/mint/[id]/page.tsx`

This is a server component — no test file. Just update the queries directly.

- [ ] **Step 1: Replace imports and queries**

Remove `import { serverClient } from '@/lib/db/server'`, add `import { sql } from '@/lib/db/server'`.

Replace the two queries:

```typescript
// OLD:
const db = serverClient()
const { data: mint, error } = await db.from('mints').select('*').eq('id', params.id).single()
if (error || !mint) notFound()

const { data: setting } = await db.from('settings').select('value').eq('key', 'mint_price_usd').single()
const priceUsd = setting?.value ?? '50.00'

// NEW:
const [mint] = await sql`SELECT * FROM mints WHERE id = ${params.id}` as Mint[]
if (!mint) notFound()

const [setting] = await sql`SELECT value FROM settings WHERE key = 'mint_price_usd'` as { value: string }[]
const priceUsd = setting?.value ?? '50.00'
```

Add `import type { Mint } from '@/lib/db/types'` if not already present.

- [ ] **Step 2: Verify the app builds**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/next build 2>&1 | tail -10
```

Expected: build succeeds (or only fails on missing env vars, not type errors).

---

## Task 10: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd sky_balloons_web && \
  PATH="/home/bardionson/.nvm/versions/node/v20.20.1/bin:$PATH" \
  node_modules/.bin/vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 2: Confirm no Supabase imports remain**

```bash
grep -r "supabase\|@supabase" sky_balloons_web/lib sky_balloons_web/app sky_balloons_web/components --include="*.ts" --include="*.tsx"
```

Expected: no output.

- [ ] **Step 3: Manual smoke test**

With `DATABASE_URL` set, run `npm run dev` and open the mint page. If a mint record exists in Neon, it should load. If not, submit via the installation API route to create one.
