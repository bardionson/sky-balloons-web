import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('crossmint-signature') ?? ''

    const event = paymentProvider.verifyWebhook(rawBody, signature)

    if (!event) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const db = serverClient()

    // Log every webhook for audit / reprocessing
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

    // Update mint status based on event type
    if (event.type === 'delivery.completed' && event.orderId) {
      const { error: updateError } = await db
        .from('mints')
        .update({
          status: 'minted',
          token_id: event.tokenId ?? null,
          tx_hash: event.txHash ?? null,
        })
        .eq('order_id', event.orderId)
      if (updateError) {
        console.error('[webhook/crossmint] Failed to update mint status (delivery.completed):', updateError)
      }
    } else if (event.type === 'delivery.initiated' && event.orderId) {
      const { error: updateError } = await db
        .from('mints')
        .update({ status: 'minting' })
        .eq('order_id', event.orderId)
      if (updateError) {
        console.error('[webhook/crossmint] Failed to update mint status (delivery.initiated):', updateError)
      }
    } else if (event.type === 'delivery.failed' && event.orderId) {
      const { error: updateError } = await db
        .from('mints')
        .update({ status: 'failed' })
        .eq('order_id', event.orderId)
      if (updateError) {
        console.error('[webhook/crossmint] Failed to update mint status (delivery.failed):', updateError)
      }
    } else if (event.type === 'payment.succeeded' && event.orderId) {
      const { error: updateError } = await db
        .from('mints')
        .update({ status: 'paid' })
        .eq('order_id', event.orderId)
      if (updateError) {
        console.error('[webhook/crossmint] Failed to update mint status (payment.succeeded):', updateError)
      }
    }

    // Always return 200 quickly — Crossmint retries on non-2xx
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook/crossmint] Unexpected error:', err)
    return NextResponse.json({ received: true })
  }
}
