import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))

import { GET } from '../route'

describe('GET /api/settings/price', () => {
  it('returns the current mint price', async () => {
    mockSql.mockResolvedValueOnce([{ value: '50.00' }])
    const req = new NextRequest('http://localhost/api/settings/price')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.price_usd).toBe('50.00')
  })

  it('returns default price when setting is missing', async () => {
    mockSql.mockResolvedValueOnce([])
    const req = new NextRequest('http://localhost/api/settings/price')
    const res = await GET(req)
    const data = await res.json()
    expect(data.price_usd).toBe('50.00')
  })
})
