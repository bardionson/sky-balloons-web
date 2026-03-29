import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))

const mockGetOrder = vi.hoisted(() => vi.fn())
vi.mock('@/lib/payment', () => ({
  paymentProvider: { getOrder: mockGetOrder },
}))

vi.stubEnv('CRON_SECRET', 'test-cron-secret')

import { GET } from '../route'

describe('GET /api/cron/check-orders', () => {
  beforeEach(() => {
    mockSql.mockReset()
    mockGetOrder.mockReset()
  })

  it('returns 401 without cron secret', async () => {
    const req = new NextRequest('http://localhost/api/cron/check-orders')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with no pending orders', async () => {
    mockSql.mockResolvedValueOnce([]) // SELECT mints → empty
    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.checked).toBe(0)
  })

  it('updates mint to minted when provider reports completed', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 'mint-1', order_id: 'order-1' }]) // SELECT mints
      .mockResolvedValueOnce([]) // UPDATE mint
    mockGetOrder.mockResolvedValueOnce({ status: 'completed', orderId: 'order-1',
                                         tokenId: '5', txHash: '0xabc' })

    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockSql).toHaveBeenCalledTimes(2)
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
    mockSql
      .mockResolvedValueOnce([{ id: 'mint-2', order_id: 'order-2' }]) // SELECT mints
      .mockResolvedValueOnce([]) // UPDATE mint
    mockGetOrder.mockResolvedValueOnce({ status: 'failed', orderId: 'order-2' })

    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockSql).toHaveBeenCalledTimes(2)
  })

  it('returns 500 when DB query fails', async () => {
    mockSql.mockRejectedValueOnce(new Error('db error'))
    const req = new NextRequest('http://localhost/api/cron/check-orders', {
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
