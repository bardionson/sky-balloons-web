#!/usr/bin/env node
/**
 * Simulates a Thirdweb Pay webhook for a completed payment.
 * Usage: node scripts/simulate-webhook.mjs <orderId>
 */
import crypto from 'crypto'

const orderId = process.argv[2]
if (!orderId) {
  console.error('Usage: node scripts/simulate-webhook.mjs <orderId>')
  process.exit(1)
}

const WEBHOOK_SECRET = '0xdff5c0d5eab58afb5e0d062b12edf36bee38655c03fadea93df13780c8b06647'
const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/thirdweb'

const timestamp = Math.floor(Date.now() / 1000).toString()

const payload = JSON.stringify({
  status: 'COMPLETED',
  transactionId: 'sim-' + crypto.randomUUID(),
  purchaseData: { orderId },
})

const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(`${timestamp}.${payload}`)
  .digest('hex')

console.log(`\nFiring webhook for orderId: ${orderId}`)
console.log(`Timestamp: ${timestamp}`)
console.log(`Payload: ${payload}\n`)

const res = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-payload-signature': signature,
    'x-timestamp': timestamp,
  },
  body: payload,
})

const body = await res.json()
console.log(`Response: ${res.status}`, body)
