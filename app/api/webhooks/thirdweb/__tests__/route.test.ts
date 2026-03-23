import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifyWebhook = vi.fn()
const mockMintOnChain = vi.fn().mockResolvedValue({ tokenId: '42', txHash: '0xmint' })

vi.mock('@/lib/payment', () => ({
  paymentProvider: { verifyWebhook: mockVerifyWebhook },
}))

vi.mock('@/lib/chain/mint', () => ({
  mintOnChain: mockMintOnChain,
}))

vi.mock('@/lib/metadata', () => ({
  buildMetadataUri: vi.fn().mockReturnValue('data:application/json;base64,abc'),
}))

// Build a chainable Supabase mock where each method returns the same query builder
function makeDb(mintRow?: Record<string, unknown> | null) {
  const queryBuilder: Record<string, unknown> = {}

  queryBuilder.insert = vi.fn().mockResolvedValue({ error: null })
  queryBuilder.update = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.select = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.eq = vi.fn().mockReturnValue(queryBuilder)
  queryBuilder.single = vi.fn().mockResolvedValue({ data: mintRow ?? null, error: null })

  return {
    from: vi.fn().mockReturnValue(queryBuilder),
    _qb: queryBuilder,
  }
}

let db = makeDb()

vi.mock('@/lib/db/server', () => ({
  serverClient: () => db,
}))

function makeRequest(body: string, extraHeaders?: Record<string, string>) {
  return new NextRequest('http://localhost/api/webhooks/thirdweb', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-payload-signature': 'sig123',
      'x-timestamp': '1234567890',
      ...extraHeaders,
    },
  })
}

describe('POST /api/webhooks/thirdweb', () => {
  beforeEach(() => {
    vi.resetModules()
    mockVerifyWebhook.mockReset()
    mockMintOnChain.mockReset()
    mockMintOnChain.mockResolvedValue({ tokenId: '42', txHash: '0xmint' })
    db = makeDb()
  })

  it('returns 401 for invalid signature', async () => {
    mockVerifyWebhook.mockReturnValue(null)
    const { POST } = await import('../route')
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(401)
  })

  it('passes packed signature headers to verifyWebhook', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'unknown', orderId: '' })
    const { POST } = await import('../route')
    await POST(makeRequest('{}'))

    const sigArg = mockVerifyWebhook.mock.calls[0][1]
    const parsed = JSON.parse(sigArg)
    expect(parsed.signature).toBe('sig123')
    expect(parsed.timestamp).toBe('1234567890')
  })

  it('returns 200 for unknown event type', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'unknown', orderId: 'o1' })
    const { POST } = await import('../route')
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })

  it('updates mint to failed on delivery.failed event', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'delivery.failed', orderId: 'order-fail' })
    const { POST } = await import('../route')
    await POST(makeRequest('{}'))
    expect(db._qb.update).toHaveBeenCalledWith({ status: 'failed' })
  })

  it('calls mintOnChain on payment.succeeded when wallet_address is provided', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'payment.succeeded', orderId: 'order-pay' })
    db = makeDb({
      id: 'mint-1',
      status: 'ordered',
      collectors: { email: 'a@b.com', wallet_address: '0xRecipient' },
      installation_name: 'Test',
    })

    const { POST } = await import('../route')
    await POST(makeRequest('{}'))

    expect(mockMintOnChain).toHaveBeenCalledWith('0xRecipient', 'data:application/json;base64,abc')
  })

  it('updates mint to minted with tokenId and txHash after successful mint', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'payment.succeeded', orderId: 'order-pay' })
    db = makeDb({
      id: 'mint-1',
      status: 'ordered',
      collectors: { email: 'a@b.com', wallet_address: '0xRecipient' },
    })

    const { POST } = await import('../route')
    await POST(makeRequest('{}'))

    expect(db._qb.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'minted', token_id: '42', tx_hash: '0xmint' })
    )
  })

  it('skips minting if mint is already minted', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'payment.succeeded', orderId: 'order-done' })
    db = makeDb({
      id: 'mint-1',
      status: 'minted',
      collectors: { email: 'a@b.com', wallet_address: '0xRecipient' },
    })

    const { POST } = await import('../route')
    await POST(makeRequest('{}'))

    expect(mockMintOnChain).not.toHaveBeenCalled()
  })
})
