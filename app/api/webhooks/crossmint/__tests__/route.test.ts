import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockInsertWebhook = vi.hoisted(() => vi.fn())
const mockUpdateMint = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: (table: string) => {
      if (table === 'webhook_events') return { insert: mockInsertWebhook }
      if (table === 'mints') return {
        update: () => ({ eq: mockUpdateMint }),
      }
      return {}
    },
  }),
}))

const mockVerifyWebhook = vi.hoisted(() => vi.fn())
vi.mock('@/lib/payment', () => ({
  paymentProvider: { verifyWebhook: mockVerifyWebhook },
}))

import { POST } from '../route'

describe('POST /api/webhooks/crossmint', () => {
  beforeEach(() => {
    mockVerifyWebhook.mockReset()
    mockInsertWebhook.mockReset()
    mockUpdateMint.mockReset()
  })

  it('returns 401 when signature is invalid', async () => {
    mockVerifyWebhook.mockReturnValueOnce(null)
    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'bad-sig' },
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 quickly even on unknown event type', async () => {
    mockVerifyWebhook.mockReturnValueOnce({ type: 'unknown', orderId: 'o1' })
    mockInsertWebhook.mockResolvedValueOnce({ error: null })
    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: '{"type":"orders.something.else"}',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('updates mint status to minted on delivery.completed', async () => {
    mockVerifyWebhook.mockReturnValueOnce({
      type: 'delivery.completed',
      orderId: 'order-1',
      tokenId: '7',
      txHash: '0xdef',
    })
    mockInsertWebhook.mockResolvedValueOnce({ error: null })
    mockUpdateMint.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: JSON.stringify({ type: 'orders.delivery.completed' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockUpdateMint).toHaveBeenCalledWith('order_id', 'order-1')
  })

  it('updates mint status to failed on delivery.failed', async () => {
    mockVerifyWebhook.mockReturnValueOnce({ type: 'delivery.failed', orderId: 'order-2' })
    mockInsertWebhook.mockResolvedValueOnce({ error: null })
    mockUpdateMint.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: JSON.stringify({ type: 'orders.delivery.failed' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
