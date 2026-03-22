import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CrossmintAdapter } from '../crossmint'

const COLLECTION_ID = 'test-collection-id'
const SERVER_KEY = 'sk_staging_test'
const WEBHOOK_SECRET = 'whsec_test'

// Mock environment variables
vi.stubEnv('CROSSMINT_COLLECTION_ID', COLLECTION_ID)
vi.stubEnv('CROSSMINT_SERVER_KEY', SERVER_KEY)
vi.stubEnv('CROSSMINT_WEBHOOK_SECRET', WEBHOOK_SECRET)

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('CrossmintAdapter.createOrder', () => {
  beforeEach(() => mockFetch.mockReset())

  it('POSTs to Crossmint orders endpoint with correct auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        clientSecret: 'cs_test',
        order: { orderId: 'order-123', phase: 'payment', payment: { status: 'awaiting-payment' } },
      }),
    })

    const adapter = new CrossmintAdapter()
    await adapter.createOrder({
      recipientEmail: 'buyer@example.com',
      uri: 'data:application/json;base64,abc',
      priceUsd: 50,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://staging.crossmint.com/api/2022-06-09/orders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-KEY': SERVER_KEY }),
      })
    )
  })

  it('sends _uri and reuploadLinkedFiles in callData', async () => {
    const uri = 'data:application/json;base64,abc123'
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ clientSecret: 'cs_x', order: { orderId: 'o1', phase: '', payment: { status: 'pending' } } }),
    })

    const adapter = new CrossmintAdapter()
    await adapter.createOrder({ recipientEmail: 'a@b.com', uri, priceUsd: 50 })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.lineItems[0].callData._uri).toBe(uri)
    expect(body.lineItems[0].callData.reuploadLinkedFiles).toBe(false)
  })

  it('uses walletAddress-only recipient when wallet provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ clientSecret: 'cs_x', order: { orderId: 'o1', phase: '', payment: { status: 'pending' } } }),
    })

    const adapter = new CrossmintAdapter()
    await adapter.createOrder({ recipientEmail: 'a@b.com', recipientWallet: '0xabc', uri: 'u', priceUsd: 1 })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.recipient).toEqual({ walletAddress: '0xabc' })
    expect(body.payment.receiptEmail).toBe('a@b.com')
  })

  it('uses email-only recipient when no wallet provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ clientSecret: 'cs_x', order: { orderId: 'o1', phase: '', payment: { status: 'pending' } } }),
    })

    const adapter = new CrossmintAdapter()
    await adapter.createOrder({ recipientEmail: 'a@b.com', uri: 'u', priceUsd: 1 })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.recipient).toEqual({ email: 'a@b.com' })
  })

  it('returns orderId and clientSecret from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        clientSecret: 'cs_xyz',
        order: { orderId: 'order-abc', phase: 'payment', payment: { status: 'awaiting-payment' } },
      }),
    })

    const adapter = new CrossmintAdapter()
    const result = await adapter.createOrder({
      recipientEmail: 'a@b.com',
      uri: 'data:application/json;base64,x',
      priceUsd: 50,
    })

    expect(result.orderId).toBe('order-abc')
    expect(result.clientSecret).toBe('cs_xyz')
  })

  it('throws when Crossmint returns non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    })

    const adapter = new CrossmintAdapter()
    await expect(
      adapter.createOrder({ recipientEmail: 'a@b.com', uri: 'x', priceUsd: 50 })
    ).rejects.toThrow('400')
  })
})

describe('CrossmintAdapter.getOrder', () => {
  beforeEach(() => mockFetch.mockReset())

  it('GETs the correct order URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orderId: 'o1', payment: { status: 'completed' }, phase: 'completed' }),
    })

    const adapter = new CrossmintAdapter()
    await adapter.getOrder('order-123')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://staging.crossmint.com/api/2022-06-09/orders/order-123',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-API-KEY': SERVER_KEY }) })
    )
  })

  it('maps completed phase to completed status and extracts delivery fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        orderId: 'o1',
        payment: { status: 'completed' },
        phase: 'completed',
        lineItems: [{ delivery: { txId: '0xabc', tokens: [{ tokenId: '7' }] } }],
      }),
    })

    const adapter = new CrossmintAdapter()
    const result = await adapter.getOrder('o1')
    expect(result.status).toBe('completed')
    expect(result.tokenId).toBe('7')
    expect(result.txHash).toBe('0xabc')
  })
})

describe('CrossmintAdapter.verifyWebhook', () => {
  it('returns null for an invalid signature', () => {
    const adapter = new CrossmintAdapter()
    const result = adapter.verifyWebhook('{}', 'invalid-sig')
    expect(result).toBeNull()
  })

  it('parses delivery.completed event', () => {
    const adapter = new CrossmintAdapter()
    const payload = JSON.stringify({
      type: 'orders.delivery.completed',
      data: { order: { orderId: 'o1' }, lineItems: [{ tokenId: '5', transactionHash: '0xdef' }] },
    })
    // Stub the internal verify method to return true for this test
    vi.spyOn(adapter as never, '_verifySignature').mockReturnValue(true)
    const event = adapter.verifyWebhook(payload, 'any-sig')
    expect(event?.type).toBe('delivery.completed')
    expect(event?.tokenId).toBe('5')
  })
})
