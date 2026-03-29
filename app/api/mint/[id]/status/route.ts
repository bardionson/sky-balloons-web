import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rows = await sql`
    SELECT status, token_id, tx_hash FROM mints WHERE id = ${params.id}
  ` as { status: string; token_id: string | null; tx_hash: string | null }[]

  if (!rows[0]) {
    return NextResponse.json({ error: 'Mint not found' }, { status: 404 })
  }

  const row = rows[0]
  return NextResponse.json({
    status: row.status,
    ...(row.token_id && { token_id: row.token_id }),
    ...(row.tx_hash && { tx_hash: row.tx_hash }),
  })
}
