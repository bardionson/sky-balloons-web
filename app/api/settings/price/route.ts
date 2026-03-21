import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'

export async function GET(_req: NextRequest) {
  const db = serverClient()
  const { data, error } = await db
    .from('settings')
    .select('value')
    .eq('key', 'mint_price_usd')
    .single()

  const price = (!error && data) ? (data.value ?? '50.00') : '50.00'
  return NextResponse.json({ price_usd: price })
}
