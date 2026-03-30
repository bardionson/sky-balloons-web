import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/server'
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

  let mint: { id: string } | undefined
  try {
    const rows = await sql`
      INSERT INTO mints (cid, unique_name, unit_number, seed, timestamp, orientation, imagination, event_name, type, pixel_dimensions, status)
      VALUES (${body.cid}, ${body.unique_name}, ${body.unit_number}, ${body.seed},
              ${body.timestamp}, ${body.orientation}, ${body.imagination}, ${body.event_name},
              ${body.type ?? 'Standard'}, ${body.pixel_dimensions ?? '1920x1080'}, 'pending')
      RETURNING id
    ` as { id: string }[]
    mint = rows[0]
  } catch (err) {
    console.error('mint insert error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!mint) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.json({
    mint_id: mint.id,
    mint_url: `${appUrl}/mint/${mint.id}`,
  })
}
