import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('THIRDWEB_SECRET_KEY', 'test-secret-key')

const mockSql = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db/server', () => ({ sql: mockSql }))

const mockVerifyWebhook = vi.fn()
const mockMintOnChain = vi.fn().mockResolvedValue({ tokenId: '42', txHash: '0xmint' })

vi.mock('@/lib/payment', () => ({
  paymentProvider: { verifyWebhook: mockVerifyWebhook },
}))

vi.mock('@/lib/chain/mint', () => ({
  mintOnChain: mockMintOnChain,
}))

vi.mock('thirdweb', () => ({
  createThirdwebClient: () => ({}),
  getUser: vi.fn().mockResolvedValue({ walletAddress: '0xInAppWallet' }),
}))

vi.mock('@/lib/metadata', () => ({
  buildMetadataUri: vi.fn().mockReturnValue('data:application/json;base64,abc'),
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
    mockSql.mockReset()
    mockVerifyWebhook.mockReset()
    mockMintOnChain.mockReset()
    mockMintOnChain.mockResolvedValue({ tokenId: '42', txHash: '0xmint' })
  })

  it('returns 401 for invalid signature', async () => {
    mockVerifyWebhook.mockReturnValue(null)
    const { POST } = await import('../route')
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(401)
  })

  it('passes packed signature headers to verifyWebhook', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'unknown', orderId: '' })
    mockSql.mockResolvedValue([]) // INSERT webhook_event
    const { POST } = await import('../route')
    await POST(makeRequest('{}'))

    const sigArg = mockVerifyWebhook.mock.calls[0][1]
    const parsed = JSON.parse(sigArg)
    expect(parsed.signature).toBe('sig123')
    expect(parsed.timestamp).toBe('1234567890')
  })

  it('returns 200 for unknown event type', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'unknown', orderId: 'o1' })
    mockSql.mockResolvedValue([]) // INSERT webhook_event
    const { POST } = await import('../route')
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })

  it('updates mint to failed on delivery.failed event', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'delivery.failed', orderId: 'order-fail' })
    mockSql
      .mockResolvedValueOnce([])  // INSERT webhook_event
      .mockResolvedValueOnce([])  // UPDATE mints failed
    const { POST } = await import('../route')
    await POST(makeRequest('{}'))
    expect(mockSql).toHaveBeenCalledTimes(2)
  })

  it('calls mintOnChain on payment.succeeded when wallet_address is provided', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'payment.succeeded', orderId: 'order-pay' })
    mockSql
      .mockResolvedValueOnce([])  // INSERT webhook_event
      .mockResolvedValueOnce([{   // SELECT mint + collector JOIN
        id: 'mint-1', status: 'ordered', collector_wallet_address: '0xRecipient',
        collector_email: 'a@b.com', cid: 'QmTest', unique_name: 'Test',
        unit_number: 1, seed: 1, timestamp: 'now', orientation: 0,
        imagination: 75, event_name: 'Test',
      }])
      .mockResolvedValueOnce([])  // UPDATE mint to minting
      .mockResolvedValueOnce([])  // UPDATE mint to minted
      .mockResolvedValueOnce([])  // UPDATE webhook_event processed

    const { POST } = await import('../route')
    await POST(makeRequest('{}'))

    expect(mockMintOnChain).toHaveBeenCalledWith('0xRecipient', 'data:application/json;base64,abc')
  })

  it('updates mint to minted with tokenId and txHash after successful mint', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'payment.succeeded', orderId: 'order-pay' })
    mockSql
      .mockResolvedValueOnce([])  // INSERT webhook_event
      .mockResolvedValueOnce([{   // SELECT mint + collector JOIN
        id: 'mint-1', status: 'ordered', collector_wallet_address: '0xRecipient',
        collector_email: 'a@b.com',
      }])
      .mockResolvedValueOnce([])  // UPDATE mint to minting
      .mockResolvedValueOnce([])  // UPDATE mint to minted
      .mockResolvedValueOnce([])  // UPDATE webhook_event processed

    const { POST } = await import('../route')
    await POST(makeRequest('{}'))

    expect(mockMintOnChain).toHaveBeenCalled()
  })

  it('skips minting if mint is already minted', async () => {
    mockVerifyWebhook.mockReturnValue({ type: 'payment.succeeded', orderId: 'order-done' })
    mockSql
      .mockResolvedValueOnce([])  // INSERT webhook_event
      .mockResolvedValueOnce([{   // SELECT mint + collector JOIN
        id: 'mint-1', status: 'minted', collector_wallet_address: '0xRecipient',
        collector_email: 'a@b.com',
      }])

    const { POST } = await import('../route')
    await POST(makeRequest('{}'))

    expect(mockMintOnChain).not.toHaveBeenCalled()
  })
})
