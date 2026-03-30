import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))

const mockCreateOrder = vi.hoisted(() => vi.fn())
vi.mock('@/lib/payment', () => ({
  paymentProvider: { createOrder: mockCreateOrder },
}))

vi.mock('@/lib/metadata', () => ({
  buildMetadataUri: vi.fn().mockReturnValue('data:application/json;base64,test'),
}))

import { POST } from '../route'

const VALID_BODY = { email: 'buyer@test.com', name: 'Test Buyer' }
const MINT_ID = 'mint-id-123'

describe('POST /api/mint/[id]/order', () => {
  beforeEach(() => {
    mockSql.mockReset()
    mockCreateOrder.mockReset()
  })

  it('returns 404 when mint does not exist', async () => {
    mockSql.mockResolvedValueOnce([]) // SELECT mint → empty
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(404)
  })

  it('returns 409 when mint is minting', async () => {
    mockSql.mockResolvedValueOnce([{ id: MINT_ID, status: 'minting' }])
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(409)
  })

  it('returns 409 when mint is already minted', async () => {
    mockSql.mockResolvedValueOnce([{ id: MINT_ID, status: 'minted' }])
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(409)
  })

  it('returns 400 when email is missing', async () => {
    mockSql.mockResolvedValueOnce([{ id: MINT_ID, status: 'pending' }])
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify({ name: 'No Email' }),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(400)
  })

  it('returns orderId and clientSecret on success', async () => {
    mockSql
      .mockResolvedValueOnce([{
        id: MINT_ID, status: 'pending', cid: 'QmTest', image_url: null, ipfs_status: 'done', unique_name: 'Test',
        unit_number: 1, seed: 1, timestamp: 'now', orientation: 0,
        imagination: 75, event_name: 'Test', type: 'Standard',
        pixel_dimensions: '1920x1080',
      }])  // SELECT mint
      .mockResolvedValueOnce([{ value: '50.00' }])  // SELECT settings
      .mockResolvedValueOnce([{ id: 'col-1' }])     // UPSERT collector
      .mockResolvedValueOnce([])                    // UPDATE mint

    mockCreateOrder.mockResolvedValueOnce({
      orderId: 'order-xyz',
      clientSecret: 'cs_test',
      status: 'awaiting-payment',
    })

    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.orderId).toBe('order-xyz')
    expect(data.clientSecret).toBe('cs_test')
  })
})
