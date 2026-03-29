import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/server'
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

  // Fetch mint — check status before creating order
  const mintRows = await sql`
    SELECT * FROM mints WHERE id = ${params.id}
  ` as Record<string, unknown>[]

  if (!mintRows[0]) {
    return NextResponse.json({ error: 'Mint not found' }, { status: 404 })
  }

  const mint = mintRows[0]

  // Guard against double-submission
  if (mint.status !== 'pending') {
    return NextResponse.json({ error: 'Mint already in progress or completed' }, { status: 409 })
  }

  // Fetch current price from settings
  const settingRows = await sql`
    SELECT value FROM settings WHERE key = 'mint_price_usd'
  ` as { value: string }[]
  const priceUsd = parseFloat(settingRows[0]?.value ?? '50.00')

  // Upsert collector (same email = same collector record)
  const collectorRows = await sql`
    INSERT INTO collectors (email, name, wallet_address, street_address, city, state, postal_code, country)
    VALUES (
      ${body.email}, ${body.name},
      ${body.wallet_address ?? null}, ${body.street_address ?? null},
      ${body.city ?? null}, ${body.state ?? null},
      ${body.postal_code ?? null}, ${body.country ?? null}
    )
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      wallet_address = COALESCE(EXCLUDED.wallet_address, collectors.wallet_address),
      street_address = COALESCE(EXCLUDED.street_address, collectors.street_address),
      city           = COALESCE(EXCLUDED.city, collectors.city),
      state          = COALESCE(EXCLUDED.state, collectors.state),
      postal_code    = COALESCE(EXCLUDED.postal_code, collectors.postal_code),
      country        = COALESCE(EXCLUDED.country, collectors.country)
    RETURNING id
  ` as { id: string }[]

  if (!collectorRows[0]) {
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

  // Update mint record with order ID and collector
  await sql`
    UPDATE mints
    SET status = 'ordered', order_id = ${order.orderId}, collector_id = ${collectorRows[0].id}
    WHERE id = ${params.id}
  `

  return NextResponse.json({ orderId: order.orderId, clientSecret: order.clientSecret })
}
