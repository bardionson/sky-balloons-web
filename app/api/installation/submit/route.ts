import { NextRequest, NextResponse } from 'next/server'
import { serverClient } from '@/lib/db/server'
import type { InstallationSubmitBody } from '@/lib/db/types'

const REQUIRED_FIELDS: (keyof InstallationSubmitBody)[] = [
  'cid', 'unique_name', 'unit_number', 'seed',
  'timestamp', 'orientation', 'imagination', 'event_name',
]

function verifyApiKey(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? ''
  const token = header.replace('Bearer ', '').trim()
  return token === process.env.INSTALLATION_API_KEY
}

export async function POST(req: NextRequest) {
  if (!verifyApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<InstallationSubmitBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  const db = serverClient()
  const { data, error } = await db
    .from('mints')
    .insert({
      cid: body.cid,
      unique_name: body.unique_name,
      unit_number: body.unit_number,
      seed: body.seed,
      timestamp: body.timestamp,
      orientation: body.orientation,
      imagination: body.imagination,
      event_name: body.event_name,
      type: body.type ?? 'Standard',
      pixel_dimensions: body.pixel_dimensions ?? '1920x1080',
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('mint insert error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.json({
    mint_id: data.id,
    mint_url: `${appUrl}/mint/${data.id}`,
  })
}
