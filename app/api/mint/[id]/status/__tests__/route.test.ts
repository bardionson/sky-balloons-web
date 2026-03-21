import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockQuery = vi.fn()
vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: mockQuery }) }) }),
  }),
}))

import { GET } from '../route'

describe('GET /api/mint/[id]/status', () => {
  it('returns 404 when mint does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })
    const req = new NextRequest('http://localhost/api/mint/bad-id/status')
    const res = await GET(req, { params: { id: 'bad-id' } })
    expect(res.status).toBe(404)
  })

  it('returns status for a pending mint', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { status: 'pending', token_id: null, tx_hash: null },
      error: null,
    })
    const req = new NextRequest('http://localhost/api/mint/mint-1/status')
    const res = await GET(req, { params: { id: 'mint-1' } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('pending')
  })

  it('returns token_id and tx_hash when minted', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { status: 'minted', token_id: '42', tx_hash: '0xabc' },
      error: null,
    })
    const req = new NextRequest('http://localhost/api/mint/mint-2/status')
    const res = await GET(req, { params: { id: 'mint-2' } })
    const data = await res.json()
    expect(data.status).toBe('minted')
    expect(data.token_id).toBe('42')
    expect(data.tx_hash).toBe('0xabc')
  })
})
