import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'
import { mintOnChain } from '@/lib/chain/mint'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Pack both Thirdweb signature headers into the signatureHeader param
  const signatureHeader = JSON.stringify({
    signature: req.headers.get('x-payload-signature') ?? '',
    timestamp: req.headers.get('x-timestamp') ?? '',
  })

  const event = paymentProvider.verifyWebhook(rawBody, signatureHeader)
  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const db = serverClient()

    await db.from('webhook_events').insert({
      provider: 'thirdweb',
      event_type: event.type,
      order_id: event.orderId || null,
      payload: parsedBody,
      processed: false,
    })

    if (event.type === 'payment.succeeded' && event.orderId) {
      // Look up the mint and collector to get recipient address + token URI
      const { data: mint } = await db
        .from('mints')
        .select('*, collectors(email, wallet_address)')
        .eq('order_id', event.orderId)
        .single()

      if (mint && mint.status !== 'minted') {
        await db.from('mints').update({ status: 'minting' }).eq('order_id', event.orderId)

        try {
          const collector = Array.isArray(mint.collectors)
            ? mint.collectors[0]
            : mint.collectors

          const recipientAddress: string =
            collector?.wallet_address ??
            // Fallback: derive Thirdweb in-app wallet address for the email
            // TODO: call Thirdweb embedded wallet API to get address by email
            // For now, throw if no wallet address available
            (() => { throw new Error(`No wallet address for mint ${mint.id} — wallet_address required`) })()

          const { buildMetadataUri } = await import('@/lib/metadata')
          const uri = buildMetadataUri(mint)

          const { tokenId, txHash } = await mintOnChain(recipientAddress, uri)

          await db
            .from('mints')
            .update({ status: 'minted', token_id: tokenId, tx_hash: txHash })
            .eq('order_id', event.orderId)

          await db.from('webhook_events').update({ processed: true }).eq('order_id', event.orderId)
        } catch (mintErr) {
          console.error('[webhook/thirdweb] Mint failed:', mintErr)
          await db.from('mints').update({ status: 'failed' }).eq('order_id', event.orderId)
        }
      }
    } else if (event.type === 'delivery.failed' && event.orderId) {
      await db.from('mints').update({ status: 'failed' }).eq('order_id', event.orderId)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook/thirdweb] Unexpected error:', err)
    return NextResponse.json({ received: true })
  }
}
