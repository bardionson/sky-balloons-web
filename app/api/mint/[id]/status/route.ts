import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = serverClient()
  const { data, error } = await db
    .from('mints')
    .select('status, token_id, tx_hash')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Mint not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: data.status,
    ...(data.token_id && { token_id: data.token_id }),
    ...(data.tx_hash && { tx_hash: data.tx_hash }),
  })
}
