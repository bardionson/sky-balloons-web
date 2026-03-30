#!/usr/bin/env node
/**
 * Inserts a test mint record into the database and prints the mint URL.
 * Usage: node scripts/seed-test-mint.mjs <cid>
 *
 * Example:
 *   node scripts/seed-test-mint.mjs bafkreicih6xo633soefkqhhhg5zl732ett4cesgckmedtwh4nccoknqkw4
 */
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
}

const cid = process.argv[2]
if (!cid) {
  console.error('Usage: node scripts/seed-test-mint.mjs <cid>')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

const rows = await sql`
  INSERT INTO mints (cid, unique_name, unit_number, seed, timestamp, orientation, imagination, event_name, type, pixel_dimensions, status)
  VALUES (
    ${cid},
    'Test Balloon',
    1,
    42,
    ${new Date().toISOString()},
    0,
    75,
    'Test Event',
    'Standard',
    '1920x1080',
    'pending'
  )
  RETURNING id
`

const id = rows[0].id
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
console.log(`\nMint created: ${id}`)
console.log(`Mint URL:     ${appUrl}/mint/${id}\n`)
