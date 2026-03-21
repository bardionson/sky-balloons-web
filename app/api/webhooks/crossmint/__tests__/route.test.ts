import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockInsertWebhook = vi.hoisted(() => vi.fn())
const mockMintUpdate = vi.hoisted(() => vi.fn())
const mockUpdateMint = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: (table: string) => {
      if (table === 'webhook_events') return { insert: mockInsertWebhook }
      if (table === 'mints') return {
        update: (payload: unknown) => { mockMintUpdate(payload); return { eq: mockUpdateMint } },
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
    mockMintUpdate.mockReset()
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

  it('updates mint status to paid on payment.succeeded', async () => {
    mockVerifyWebhook.mockReturnValueOnce({ type: 'payment.succeeded', orderId: 'order-3' })
    mockInsertWebhook.mockResolvedValueOnce({ error: null })
    mockUpdateMint.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: JSON.stringify({ type: 'orders.payment.succeeded' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockMintUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }))
    expect(mockUpdateMint).toHaveBeenCalledWith('order_id', 'order-3')
  })

  it('updates mint status to minting on delivery.initiated', async () => {
    mockVerifyWebhook.mockReturnValueOnce({ type: 'delivery.initiated', orderId: 'order-4' })
    mockInsertWebhook.mockResolvedValueOnce({ error: null })
    mockUpdateMint.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: JSON.stringify({ type: 'orders.delivery.initiated' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockMintUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'minting' }))
    expect(mockUpdateMint).toHaveBeenCalledWith('order_id', 'order-4')
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
    expect(mockMintUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'minted', token_id: '7', tx_hash: '0xdef' }))
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
    expect(mockMintUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
    expect(mockUpdateMint).toHaveBeenCalledWith('order_id', 'order-2')
  })

  it('returns 400 on malformed JSON body', async () => {
    mockVerifyWebhook.mockReturnValueOnce({ type: 'unknown', orderId: 'o1' })
    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: 'not-valid-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 even when webhook_events insert fails', async () => {
    mockVerifyWebhook.mockReturnValueOnce({ type: 'unknown', orderId: 'o1' })
    mockInsertWebhook.mockResolvedValueOnce({ error: { message: 'constraint violation' } })
    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: '{"type":"orders.something"}',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('lets unexpected verifyWebhook throws propagate (returns 500 to trigger Crossmint retry)', async () => {
    mockVerifyWebhook.mockImplementationOnce(() => { throw new Error('library crash') })
    const req = new NextRequest('http://localhost/api/webhooks/crossmint', {
      method: 'POST',
      headers: { 'crossmint-signature': 'valid' },
      body: '{}',
    })
    // verifyWebhook throws → Next.js returns 500 → Crossmint retries → correct behavior
    // The handler itself doesn't catch this, so it propagates
    await expect(POST(req)).rejects.toThrow('library crash')
  })
})
