import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { createThirdwebClient, getUser } from 'thirdweb'
import { sql } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'
import { mintOnChain } from '@/lib/chain/mint'

const thirdwebServerClient = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY ?? '',
})

async function resolveAddress(addressOrEns: string): Promise<string> {
  if (addressOrEns.startsWith('0x')) return addressOrEns
  // Resolve ENS name to address using Ethereum mainnet
  const client = createPublicClient({ chain: mainnet, transport: http() })
  const resolved = await client.getEnsAddress({ name: addressOrEns })
  if (!resolved) throw new Error(`Could not resolve ENS name: ${addressOrEns}`)
  return resolved
}

async function resolveRecipient(
  walletAddress: string | null,
  email: string | null,
): Promise<string> {
  if (walletAddress) return resolveAddress(walletAddress)

  // No explicit wallet — look up the buyer's Thirdweb in-app wallet by email
  if (!email) throw new Error('No wallet address and no email — cannot determine mint recipient')

  const user = await getUser({ client: thirdwebServerClient, email })
  if (!user?.walletAddress) {
    throw new Error(`No in-app wallet found for email ${email} — user has not completed checkout`)
  }
  return user.walletAddress
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
          const recipientAddress = await resolveRecipient(
            mint.collector_wallet_address as string | null,
            mint.collector_email as string | null,
          )

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
