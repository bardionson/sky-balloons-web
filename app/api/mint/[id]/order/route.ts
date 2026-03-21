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

  // Fetch mint — check status before creating order
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

  // Update mint record with order ID and collector
  await db
    .from('mints')
    .update({ status: 'ordered', order_id: order.orderId, collector_id: collector.id })
    .eq('id', params.id)

  return NextResponse.json({ orderId: order.orderId, clientSecret: order.clientSecret })
}
