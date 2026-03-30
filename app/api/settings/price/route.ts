import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/server'

export async function GET(_req: NextRequest) {
  const rows = await sql`
    SELECT value FROM settings WHERE key = 'mint_price_usd'
  ` as { value: string }[]

  const price = rows[0]?.value ?? '50.00'
  return NextResponse.json({ price_usd: price })
}
