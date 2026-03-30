#!/usr/bin/env node
/**
 * Resets a stuck mint back to 'pending' for retesting.
 * Usage: node scripts/reset-mint.mjs <mint-id>
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envLines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
}

const id = process.argv[2]
if (!id) {
  console.error('Usage: node scripts/reset-mint.mjs <mint-id>')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const rows = await sql`
  UPDATE mints SET status = 'pending', order_id = NULL WHERE id = ${id} RETURNING id, status
`
if (!rows[0]) {
  console.error('Mint not found:', id)
  process.exit(1)
}
console.log(`Reset mint ${rows[0].id} → ${rows[0].status}`)
