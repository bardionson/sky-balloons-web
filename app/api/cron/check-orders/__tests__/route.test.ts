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
})
