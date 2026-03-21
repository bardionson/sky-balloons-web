import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSelect = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: () => ({
      select: () => ({ in: mockSelect }),
      update: () => ({ eq: mockUpdate }),
    }),
  }),
}))

const mockGetOrder = vi.hoisted(() => vi.fn())
vi.mock('@/lib/payment', () => ({
  paymentProvider: { getOrder: mockGetOrder },
}))

vi.stubEnv('CRON_SECRET', 'test-cron-secret')

import { GET } from '../route'

describe('GET /api/cron/check-orders', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockUpdate.mockReset()
    mockGetOrder.mockReset()
  })

  it('returns 401 without cron secret', async () => {
    const req = new NextRequest('http://localhost/api/cron/check-orders')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with no pending orders', async () => {
    mockSelect.mockResolvedValueOnce({ data: [], error: null })
    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.checked).toBe(0)
  })

  it('updates mint to minted when provider reports completed', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [{ id: 'mint-1', order_id: 'order-1' }],
      error: null,
    })
    mockGetOrder.mockResolvedValueOnce({ status: 'completed', orderId: 'order-1',
                                         tokenId: '5', txHash: '0xabc' })
    mockUpdate.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('returns 500 when CRON_SECRET env var is not set', async () => {
    const original = process.env.CRON_SECRET
    delete process.env.CRON_SECRET
    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(500)
    process.env.CRON_SECRET = original
  })

  it('updates mint to failed when provider reports failed', async () => {
    mockSelect.mockResolvedValueOnce({
      data: [{ id: 'mint-2', order_id: 'order-2' }],
      error: null,
    })
    mockGetOrder.mockResolvedValueOnce({ status: 'failed', orderId: 'order-2' })
    mockUpdate.mockResolvedValueOnce({ error: null })

    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('returns 500 when DB query fails', async () => {
    mockSelect.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
