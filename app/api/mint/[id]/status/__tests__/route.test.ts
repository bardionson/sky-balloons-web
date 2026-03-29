import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))

import { GET } from '../route'

describe('GET /api/mint/[id]/status', () => {
  it('returns 404 when mint does not exist', async () => {
    mockSql.mockResolvedValueOnce([])
    const req = new NextRequest('http://localhost/api/mint/bad-id/status')
    const res = await GET(req, { params: { id: 'bad-id' } })
    expect(res.status).toBe(404)
  })

  it('returns status for a pending mint', async () => {
    mockSql.mockResolvedValueOnce([{ status: 'pending', token_id: null, tx_hash: null }])
    const req = new NextRequest('http://localhost/api/mint/mint-1/status')
    const res = await GET(req, { params: { id: 'mint-1' } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('pending')
  })

  it('returns token_id and tx_hash when minted', async () => {
    mockSql.mockResolvedValueOnce([{ status: 'minted', token_id: '42', tx_hash: '0xabc' }])
    const req = new NextRequest('http://localhost/api/mint/mint-2/status')
    const res = await GET(req, { params: { id: 'mint-2' } })
    const data = await res.json()
    expect(data.status).toBe('minted')
    expect(data.token_id).toBe('42')
    expect(data.tx_hash).toBe('0xabc')
  })
})
