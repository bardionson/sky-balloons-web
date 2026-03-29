import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { sql } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'
import { mintOnChain } from '@/lib/chain/mint'

async function resolveAddress(addressOrEns: string): Promise<string> {
  if (addressOrEns.startsWith('0x')) return addressOrEns
  // Resolve ENS name to address using Ethereum mainnet
  const client = createPublicClient({ chain: mainnet, transport: http() })
  const resolved = await client.getEnsAddress({ name: addressOrEns })
  if (!resolved) throw new Error(`Could not resolve ENS name: ${addressOrEns}`)
  return resolved
}

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
    await sql`
      INSERT INTO webhook_events (provider, event_type, order_id, payload, processed)
      VALUES ('thirdweb', ${event.type}, ${event.orderId || null}, ${JSON.stringify(parsedBody)}, false)
    `

    if (event.type === 'payment.succeeded' && event.orderId) {
      // Look up the mint and collector via JOIN to get recipient address + token URI
      const rows = await sql`
        SELECT m.*, c.email AS collector_email, c.wallet_address AS collector_wallet_address
        FROM mints m
        LEFT JOIN collectors c ON m.collector_id = c.id
        WHERE m.order_id = ${event.orderId}
        LIMIT 1
      ` as Record<string, unknown>[]

      const mint = rows[0]

      if (mint && mint.status !== 'minted') {
        await sql`UPDATE mints SET status = 'minting' WHERE order_id = ${event.orderId}`

        try {
          const rawAddress: string =
            (mint.collector_wallet_address as string | null) ??
            (() => { throw new Error(`No wallet address for mint ${mint.id} — wallet_address required`) })()

          const recipientAddress = await resolveAddress(rawAddress)

          const { buildMetadataUri } = await import('@/lib/metadata')
          const uri = buildMetadataUri(mint as never)

          const { tokenId, txHash } = await mintOnChain(recipientAddress, uri)

          await sql`
            UPDATE mints
            SET status = 'minted', token_id = ${tokenId}, tx_hash = ${txHash}
            WHERE order_id = ${event.orderId}
          `

          await sql`
            UPDATE webhook_events SET processed = true WHERE order_id = ${event.orderId}
          `
        } catch (mintErr) {
          console.error('[webhook/thirdweb] Mint failed:', mintErr)
          await sql`UPDATE mints SET status = 'failed' WHERE order_id = ${event.orderId}`
        }
      }
    } else if (event.type === 'delivery.failed' && event.orderId) {
      await sql`UPDATE mints SET status = 'failed' WHERE order_id = ${event.orderId}`
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook/thirdweb] Unexpected error:', err)
    return NextResponse.json({ received: true })
  }
}
