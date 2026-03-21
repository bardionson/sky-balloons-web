import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import { paymentProvider } from '@/lib/payment'

export async function GET(req: NextRequest) {
  // Vercel cron requests include the CRON_SECRET as a Bearer token
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serverClient()

  // Find all mints that are in-flight but not yet completed
  const { data: mints, error } = await db
    .from('mints')
    .select('id, order_id')
    .in('status', ['ordered', 'paid', 'minting'])

  if (error || !mints) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  let updated = 0
  for (const mint of mints) {
    if (!mint.order_id) continue
    try {
      const order = await paymentProvider.getOrder(mint.order_id)
      if (order.status === 'completed') {
        await db
          .from('mints')
          .update({ status: 'minted', token_id: (order as never as { tokenId?: string }).tokenId ?? null,
                    tx_hash: (order as never as { txHash?: string }).txHash ?? null })
          .eq('id', mint.id)
        updated++
      } else if (order.status === 'failed') {
        await db.from('mints').update({ status: 'failed' }).eq('id', mint.id)
        updated++
      }
    } catch {
      // Individual order check failure — continue with others
    }
  }

  return NextResponse.json({ checked: mints.length, updated })
}
