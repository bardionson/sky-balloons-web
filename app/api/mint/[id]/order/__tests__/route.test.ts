import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockMintQuery = vi.hoisted(() => vi.fn())
const mockCollectorUpsert = vi.hoisted(() => vi.fn())
const mockMintUpdate = vi.hoisted(() => vi.fn())
const mockCreateOrder = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/server', () => ({
  serverClient: () => ({
    from: (table: string) => {
      if (table === 'mints') return {
        select: () => ({ eq: () => ({ single: mockMintQuery }) }),
        update: () => ({ eq: mockMintUpdate }),
      }
      if (table === 'settings') return {
        select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
          data: { value: '50.00' }, error: null,
        }) }) }),
      }
      if (table === 'collectors') return {
        upsert: () => ({ select: () => ({ single: mockCollectorUpsert }) }),
      }
      return {}
    },
  }),
}))

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
    mockMintQuery.mockReset()
    mockCollectorUpsert.mockReset()
    mockMintUpdate.mockReset()
    mockCreateOrder.mockReset()
  })

  it('returns 404 when mint does not exist', async () => {
    mockMintQuery.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(404)
  })

  it('returns 409 when mint is already ordered', async () => {
    mockMintQuery.mockResolvedValueOnce({
      data: { id: MINT_ID, status: 'ordered', order_id: 'existing-order' },
      error: null,
    })
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify(VALID_BODY),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(409)
  })

  it('returns 400 when email is missing', async () => {
    mockMintQuery.mockResolvedValueOnce({
      data: { id: MINT_ID, status: 'pending' },
      error: null,
    })
    const req = new NextRequest(`http://localhost/api/mint/${MINT_ID}/order`, {
      method: 'POST',
      body: JSON.stringify({ name: 'No Email' }),
    })
    const res = await POST(req, { params: { id: MINT_ID } })
    expect(res.status).toBe(400)
  })

  it('returns orderId and clientSecret on success', async () => {
    mockMintQuery.mockResolvedValueOnce({
      data: { id: MINT_ID, status: 'pending', cid: 'QmTest', unique_name: 'Test',
              unit_number: 1, seed: 1, timestamp: 'now', orientation: 0,
              imagination: 75, event_name: 'Test', type: 'Standard',
              pixel_dimensions: '1920x1080' },
      error: null,
    })
    mockCollectorUpsert.mockResolvedValueOnce({ data: { id: 'col-1' }, error: null })
    mockMintUpdate.mockResolvedValueOnce({ error: null })
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
