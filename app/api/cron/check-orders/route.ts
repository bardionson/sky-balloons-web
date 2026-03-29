import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/check-orders] CRON_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // Vercel cron requests include the CRON_SECRET as a Bearer token
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all mints that are in-flight but not yet completed
  let mints: { id: string; order_id: string | null }[]
  try {
    mints = await sql`
      SELECT id, order_id FROM mints
      WHERE status IN ('ordered', 'paid', 'minting')
    ` as { id: string; order_id: string | null }[]
  } catch (err) {
    console.error('[cron/check-orders] DB error:', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  let updated = 0
  for (const mint of mints) {
    if (!mint.order_id) continue
    try {
      const order = await paymentProvider.getOrder(mint.order_id)
      if (order.status === 'completed') {
        await sql`
          UPDATE mints
          SET status = 'minted',
              token_id = ${order.tokenId ?? null},
              tx_hash = ${order.txHash ?? null}
          WHERE id = ${mint.id}
        `
        updated++
      } else if (order.status === 'failed') {
        await sql`UPDATE mints SET status = 'failed' WHERE id = ${mint.id}`
        updated++
      }
    } catch {
      // Individual order check failure — continue with others
    }
  }

  return NextResponse.json({ checked: mints.length, updated })
}
