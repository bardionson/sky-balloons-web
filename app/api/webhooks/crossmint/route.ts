import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'

export async function POST(req: NextRequest) {
  // Read raw body and verify signature — let these throw (→ 500) so Crossmint retries
  const rawBody = await req.text()
  const signature = req.headers.get('crossmint-signature') ?? ''

  const event = paymentProvider.verifyWebhook(rawBody, signature)
  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse JSON — return 400 on malformed body (Crossmint won't retry 4xx)
  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // DB operations — catch unexpected errors here and return 200 to prevent infinite retries
  try {
    const db = serverClient()

    const { error: insertError } = await db.from('webhook_events').insert({
      provider: 'crossmint',
      event_type: event.type,
      order_id: event.orderId || null,
      payload: parsedBody,
      processed: false,
    })
    if (insertError) {
      console.error('[webhook/crossmint] Failed to log webhook event:', insertError)
    }

    if (event.type === 'delivery.completed' && event.orderId) {
      const { error: updateError } = await db
        .from('mints')
        .update({
          status: 'minted',
          token_id: event.tokenId ?? null,
          tx_hash: event.txHash ?? null,
        })
        .eq('order_id', event.orderId)
      if (updateError) console.error('[webhook/crossmint] Failed to update mint (completed):', updateError)
    } else if (event.type === 'delivery.initiated' && event.orderId) {
      const { error: updateError } = await db
        .from('mints')
        .update({ status: 'minting' })
        .eq('order_id', event.orderId)
      if (updateError) console.error('[webhook/crossmint] Failed to update mint (initiated):', updateError)
    } else if (event.type === 'delivery.failed' && event.orderId) {
      const { error: updateError } = await db
        .from('mints')
        .update({ status: 'failed' })
        .eq('order_id', event.orderId)
      if (updateError) console.error('[webhook/crossmint] Failed to update mint (failed):', updateError)
    } else if (event.type === 'payment.succeeded' && event.orderId) {
      const { error: updateError } = await db
        .from('mints')
        .update({ status: 'paid' })
        .eq('order_id', event.orderId)
      if (updateError) console.error('[webhook/crossmint] Failed to update mint (paid):', updateError)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook/crossmint] Unexpected error in DB operations:', err)
    return NextResponse.json({ received: true })
  }
}
