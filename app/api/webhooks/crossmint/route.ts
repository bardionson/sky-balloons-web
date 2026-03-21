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
