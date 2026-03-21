# Balloons in the Sky — Minter & Payment System Design

**Date:** 2026-03-20
**Scope:** Phase 1 — mint flow, payment, GPU integration. Gallery, stats, and control pages are future phases.
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres) · Vercel · Crossmint (via abstraction layer)

---

## 1. System Overview

A generative AI art installation (StyleGAN2 on a local Ubuntu GPU machine) produces unique balloon artworks. When a viewer presses a button, the installation captures GAN metadata, uploads the image to IPFS, and calls a web API to register the artwork. The API returns a short URL encoded into a printed QR label. The viewer scans the QR on their phone, sees the artwork, and pays to mint an NFT. The NFT is minted on Sepolia via Crossmint. The installation polls for completion and prints the physical image.

**What is NOT in scope for Phase 1:**
- Gallery page
- Live stats / Installation contract dashboard
- Deed holder control panel

---

## 2. Architecture & Data Flow

```
GPU (Python/Ubuntu)
  → POST /api/installation/submit  { metadata fields, cid }
  ← { mint_id, mint_url }
  → Generates QR from mint_url → prints label

Viewer scans QR → phone opens /mint/[id]
  → Server fetches mint record from Supabase
  → Viewer sees artwork + metadata + price
  → Enters email, name, optional wallet + mailing address
  → Chooses: wallet deep link (MetaMask/Coinbase/Rainbow/Trust)
             OR card / Apple Pay / Google Pay (Crossmint embedded)

  POST /api/mint/[id]/order
  → Creates/updates collector record in Supabase
  → Reads mint metadata from Supabase
  → buildMetadataUri(fields) → data:application/json;base64,...
  → PaymentProvider.createOrder({ uri, email, wallet, priceUsd })
  → Returns { orderId, clientSecret }

CrossmintEmbeddedCheckout renders on viewer's phone
  → Buyer pays (card / Apple Pay / Google Pay / crypto via wallet)
  → Crossmint mints NFT on Sepolia
  → POST /api/webhooks/crossmint fires
  → Backend verifies signature, updates mint: status='minted', token_id, tx_hash
  → Viewer browser polls /api/mint/[id]/status → shows success screen

GPU:
  → Supabase Realtime subscription fires instantly on status='minted'
  → HTTP polling /api/mint/[id]/status every 10s (fallback)
  → Either path triggers local image printer
```

**Key principles:**
- GPU never talks to Crossmint — only to the Next.js API and Supabase
- Metadata never appears in the URL — stored server-side, fetched by mint ID
- Status in Supabase is the single source of truth
- Payment provider is abstracted — swapping Crossmint touches one file

---

## 3. Database Schema (Supabase / Postgres)

### `settings`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
key         text UNIQUE NOT NULL    -- 'mint_price_usd'
value       text NOT NULL           -- '50.00'
updated_at  timestamptz DEFAULT now()
```
Initial row: `{ key: 'mint_price_usd', value: '1.00' }` (low for testing, raise before exhibition).

### `collectors`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
email           text UNIQUE NOT NULL
name            text NOT NULL
wallet_address  text
street_address  text
city            text
state           text
postal_code     text
country         text
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```
One record per collector. If same email mints again, existing record is reused (upsert on email).

### `mints`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
-- GPU-submitted GAN metadata
cid              text NOT NULL
unique_name      text NOT NULL
unit_number      integer NOT NULL
seed             bigint NOT NULL
timestamp        text NOT NULL        -- pre-formatted: "16/03/2026 14:32 CET"
orientation      smallint NOT NULL    -- 0=Portrait, 1=Landscape
imagination      integer NOT NULL     -- ×100 (75 = 0.75)
event_name       text NOT NULL
type             text NOT NULL DEFAULT 'Standard'
pixel_dimensions text NOT NULL DEFAULT '1920x1080'
-- Payment & delivery
status           text NOT NULL DEFAULT 'pending'
order_id         text                 -- provider order ID
token_id         text                 -- on-chain token ID
tx_hash          text                 -- mint transaction hash
collector_id     uuid REFERENCES collectors(id)
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()
```

**Status lifecycle:** `pending → ordered → paid → minting → minted → printed | failed`

Supabase Realtime is enabled on the `mints` table. GPU subscribes filtered to its specific `id` row.

### `webhook_events`
```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
provider     text NOT NULL         -- 'crossmint'
event_type   text NOT NULL         -- 'orders.delivery.completed'
order_id     text
payload      jsonb NOT NULL
processed    boolean DEFAULT false
created_at   timestamptz DEFAULT now()
```
Audit log of all inbound webhooks. Used to reprocess if handler fails mid-flight.

---

## 4. Payment Provider Abstraction

### `lib/payment/provider.ts` — interface
```typescript
export interface CreateOrderParams {
  recipientEmail: string
  recipientWallet?: string
  uri: string           // data:application/json;base64,...
  priceUsd: number
}

export interface OrderResult {
  orderId: string
  clientSecret?: string   // for Stripe Elements (card payments)
  status: OrderStatus
}

export type OrderStatus =
  | 'pending' | 'awaiting-payment' | 'processing'
  | 'delivery-initiated' | 'completed' | 'failed'

export interface WebhookEvent {
  type: 'payment.succeeded' | 'delivery.completed' | 'delivery.failed' | 'unknown'
  orderId: string
  tokenId?: string
  txHash?: string
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<OrderResult>
  getOrder(orderId: string): Promise<OrderResult>
  verifyWebhook(rawBody: string, signatureHeader: string): WebhookEvent | null
}
```

### `lib/payment/crossmint.ts` — adapter
Implements `PaymentProvider`. Calls Crossmint REST API with `CROSSMINT_SERVER_KEY`. Maps Crossmint-specific response shapes to the provider-agnostic types above.

### `lib/payment/index.ts` — factory
```typescript
export const paymentProvider: PaymentProvider = new CrossmintAdapter()
```
Swapping providers = change this one line.

---

## 5. API Endpoints

### `POST /api/installation/submit`
**Auth:** `Authorization: Bearer INSTALLATION_API_KEY` (verified against env var)
**Body:** `{ cid, unique_name, unit_number, seed, timestamp, orientation, imagination, event_name, type?, pixel_dimensions? }`
**Response:** `{ mint_id, mint_url }` where `mint_url = https://yoursite.com/mint/{mint_id}`
**Effect:** Creates `mints` row with `status = 'pending'`
**Error:** 401 if API key missing/wrong, 400 if required fields missing

### `POST /api/mint/[id]/order`
**Body:** `{ email, name, wallet_address?, street_address?, city?, state?, postal_code?, country? }`
**Effect:** Upserts collector, links to mint, calls `paymentProvider.createOrder()`, updates mint `status = 'ordered'`, `order_id`
**Response:** `{ orderId, clientSecret }`
**Error:** 404 if mint not found, 409 if mint already ordered/minted, 400 if required fields missing
**Race condition:** Status check and order_id write must happen inside a single DB transaction to prevent double-submissions if a viewer taps the button twice rapidly.

### `GET /api/mint/[id]/status`
**Auth:** None (public — only exposes status string, no PII)
**Response:** `{ status, token_id?, tx_hash? }`
**Called by:** GPU polling loop + viewer browser polling

### `POST /api/webhooks/crossmint`
**Auth:** Crossmint signature header (verified via `paymentProvider.verifyWebhook()`)
**Effect:** Logs to `webhook_events`, updates `mints` status based on event type:
- `orders.payment.succeeded` → `status = 'paid'`
- `orders.delivery.initiated` → `status = 'minting'`
- `orders.delivery.completed` → `status = 'minted'`, writes `token_id`, `tx_hash`
- `orders.delivery.failed` → `status = 'failed'`
**Response:** 200 immediately (Crossmint requires fast response)

### `GET /api/settings/price`
**Auth:** None
**Response:** `{ price_usd: "50.00" }`
**Effect:** Reads `settings` table `WHERE key = 'mint_price_usd'`

### `GET /api/cron/check-orders` (Vercel Cron — every minute)
**Auth:** Vercel cron secret header
**Effect:** Finds all mints with `status IN ('ordered', 'paid', 'minting')`, calls `paymentProvider.getOrder()` for each, updates status if changed. Safety net for viewers who close phone before mint completes.

---

## 6. Viewer Page — `/mint/[id]`

### Server component (initial render)
- Fetches mint record from Supabase by ID
- Fetches price from settings
- If mint `status = 'minted'`: renders success/already-minted view (token ID, Etherscan link)
- If mint not found: 404

### Client component — CheckoutForm
**State machine:**
```
form → submitting → payment → polling → success
                            ↘ error
```

**Form fields:**
- Email (required)
- Name (required)
- Wallet address (optional)
- Mailing address (optional, collapsible section): street, city, state, postal code, country

**Wallet deep-link buttons (shown above form):**
| Wallet | Deep link |
|---|---|
| MetaMask | `https://metamask.app.link/dapp/{host}/mint/{id}` |
| Coinbase Wallet | `https://go.cb-wallet.com/dapp?url={encoded_url}` |
| Rainbow | `https://rnbwapp.com/dapp?url={encoded_url}` |
| Trust Wallet | `https://link.trustwallet.com/open_url?coin_id=60&url={encoded_url}` |

When opened in a wallet browser, `window.ethereum` is injected — Crossmint's embedded checkout detects it and offers crypto as payment method. **Verify this behaviour against Crossmint staging before shipping:** if `window.ethereum` is not auto-detected, the form should fall back to showing the card payment flow rather than silently showing no payment option.

**Payment button:** "Mint Now — $50" → submits form → `POST /api/mint/[id]/order` → renders `CrossmintEmbeddedCheckout`

**Polling:** Browser calls `/api/mint/[id]/status` every 5 seconds after order created. On `status = 'minted'` → success screen with token ID + Etherscan link.

---

## 7. GPU Integration (Python additions)

Two additions to the existing Python prototype:

### Submit metadata (new)
```python
import requests

def submit_to_backend(metadata: dict, cid: str) -> str:
    resp = requests.post(
        f"{BACKEND_URL}/api/installation/submit",
        json={**metadata, "cid": cid},
        headers={"Authorization": f"Bearer {INSTALLATION_API_KEY}"},
        timeout=10
    )
    resp.raise_for_status()
    return resp.json()["mint_url"]
```

### Watch for mint completion (new)
```python
# Primary: Supabase Realtime subscription
from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def watch_mint(mint_id: str, on_complete: callable):
    def handle_update(payload):
        if payload["new"]["status"] == "minted":
            on_complete()

    supabase.table("mints") \
        .on("UPDATE", handle_update) \
        .eq("id", mint_id) \
        .subscribe()

# Fallback: HTTP polling every 10s
def poll_mint_status(mint_id: str, on_complete: callable):
    while True:
        r = requests.get(f"{BACKEND_URL}/api/mint/{mint_id}/status", timeout=5)
        if r.json().get("status") == "minted":
            on_complete()
            break
        time.sleep(10)
```

Both run concurrently. Whichever fires first triggers the printer. Implementer must use a simple boolean flag (`print_triggered`) to guard against both paths firing the printer simultaneously.

---

## 8. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-side only

# Installation security
INSTALLATION_API_KEY=               # shared secret with GPU script

# Vercel Cron security
CRON_SECRET=

# Payment provider — Crossmint (staging)
CROSSMINT_SERVER_KEY=               # sk_staging_...
CROSSMINT_WEBHOOK_SECRET=           # from Crossmint console
CROSSMINT_COLLECTION_ID=            # from Crossmint console — used server-side in CrossmintAdapter
NEXT_PUBLIC_CROSSMINT_CLIENT_KEY=   # ck_staging_... — used client-side by CrossmintEmbeddedCheckout
NEXT_PUBLIC_CROSSMINT_COLLECTION_ID= # same value as above — exposed to browser for embedded checkout

# Contract
NEXT_PUBLIC_BALLOONS_NFT_ADDRESS=0xaAA89F9C4f784AaB92d0aA3Ca086e6E99bCE9Af7
```

---

## 9. Error Handling

| Scenario | Handling |
|---|---|
| GPU submit fails (network) | GPU retries with exponential backoff |
| IPFS image slow to load | `<img>` with loading state. Primary gateway: `dweb.link`. Fallback: `ipfs.io`. |
| Order creation fails | Error state in form, user can retry |
| Crossmint webhook missed | Vercel Cron catches it within 1 minute |
| Mint delivery fails | `status = 'failed'`, viewer sees error with support contact |
| GPU Realtime drops | Polling fallback fires within 10s |
| Viewer closes phone after paying | Cron updates DB, GPU still gets notified |

---

## 10. Verification / Test Plan

1. Run `npm run dev` locally with staging Crossmint keys
2. Simulate GPU submit: `curl -X POST /api/installation/submit` with test metadata → verify Supabase row created
3. Open returned mint URL → verify artwork loads from IPFS, price shows correctly
4. Submit form → verify collector record created in Supabase, order created in Crossmint staging console
5. Pay with Stripe test card `4242 4242 4242 4242` → verify NFT minted on Sepolia
6. Check `tokenURI(tokenId)` on Sepolia → verify base64 JSON decodes correctly
7. Verify webhook received and `mints` status updated to `'minted'`
8. Verify GPU polling detects `status = 'minted'`
9. Deploy to Vercel preview URL, repeat full flow
