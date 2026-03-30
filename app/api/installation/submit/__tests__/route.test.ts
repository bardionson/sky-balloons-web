import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))

vi.stubEnv('INSTALLATION_API_KEY', 'test-api-key')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.com')

import { POST } from '../route'

const VALID_BODY = {
  cid: 'QmTest123',
  unique_name: 'Azure Dream',
  unit_number: 1,
  seed: 12345,
  timestamp: '21/03/2026 10:00 CET',
  orientation: 0,
  imagination: 75,
  event_name: 'Test Exhibition',
}

describe('POST /api/installation/submit', () => {
  beforeEach(() => {
    mockSql.mockReset()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when API key is wrong', async () => {
    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-key' },
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-api-key' },
      body: JSON.stringify({ cid: 'QmTest' }), // missing fields
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns mint_id and mint_url on success', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'mint-uuid-123' }])

    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-api-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.mint_id).toBe('mint-uuid-123')
    expect(data.mint_url).toBe('https://example.com/mint/mint-uuid-123')
  })

  it('returns 500 when database insert fails', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB error'))

    const req = new NextRequest('http://localhost/api/installation/submit', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-api-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
