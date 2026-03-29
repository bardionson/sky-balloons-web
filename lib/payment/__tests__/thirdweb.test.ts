import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThirdwebAdapter } from '../thirdweb'

vi.mock('@/lib/chain/price', () => ({
  getMintPriceEth: vi.fn().mockResolvedValue('0.05'),
}))

const WEBHOOK_SECRET = 'whsec_thirdweb_test'
const TREASURY = '0xTreasuryWallet'

vi.stubEnv('THIRDWEB_WEBHOOK_SECRET', WEBHOOK_SECRET)
vi.stubEnv('TREASURY_WALLET_ADDRESS', TREASURY)
vi.stubEnv('NEXT_PUBLIC_PAYMENT_CHAIN_ID', '11155111')

describe('ThirdwebAdapter.createOrder', () => {
  it('returns a UUID orderId', async () => {
    const adapter = new ThirdwebAdapter()
    const result = await adapter.createOrder({ recipientEmail: 'a@b.com', uri: 'u', priceUsd: 50 })
    expect(result.orderId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('encodes treasury address and chain in clientSecret', async () => {
    const adapter = new ThirdwebAdapter()
    const result = await adapter.createOrder({ recipientEmail: 'a@b.com', uri: 'u', priceUsd: 50 })
    const config = JSON.parse(result.clientSecret!)
    expect(config.treasuryAddress).toBe(TREASURY)
    expect(config.chainId).toBe(11155111)
    expect(config.priceEth).toBe('0.05')
  })

  it('includes orderId in clientSecret', async () => {
    const adapter = new ThirdwebAdapter()
    const result = await adapter.createOrder({ recipientEmail: 'a@b.com', uri: 'u', priceUsd: 50 })
    const config = JSON.parse(result.clientSecret!)
    expect(config.orderId).toBe(result.orderId)
  })

  it('includes recipientWallet in clientSecret when provided', async () => {
    const adapter = new ThirdwebAdapter()
    const result = await adapter.createOrder({
      recipientEmail: 'a@b.com',
      recipientWallet: '0xabc',
      uri: 'u',
      priceUsd: 50,
    })
    const config = JSON.parse(result.clientSecret!)
    expect(config.recipientWallet).toBe('0xabc')
  })

  it('returns awaiting-payment status', async () => {
    const adapter = new ThirdwebAdapter()
    const result = await adapter.createOrder({ recipientEmail: 'a@b.com', uri: 'u', priceUsd: 50 })
    expect(result.status).toBe('awaiting-payment')
  })

  it('throws when on-chain mint price is zero', async () => {
    const { getMintPriceEth } = await import('@/lib/chain/price')
    vi.mocked(getMintPriceEth).mockRejectedValueOnce(new Error('Mint price is not set on-chain'))
    const adapter = new ThirdwebAdapter()
    await expect(adapter.createOrder({ recipientEmail: 'a@b.com', uri: 'u', priceUsd: 50 }))
      .rejects.toThrow('Mint price is not set on-chain')
  })
})

describe('ThirdwebAdapter.getOrder', () => {
  it('returns pending status (webhook-driven, not polled)', async () => {
    const adapter = new ThirdwebAdapter()
    const result = await adapter.getOrder('some-order-id')
    expect(result.status).toBe('pending')
  })
})

describe('ThirdwebAdapter.verifyWebhook', () => {
  it('returns null for an invalid signature', () => {
    const adapter = new ThirdwebAdapter()
    const signatureHeader = JSON.stringify({ signature: 'bad', timestamp: '12345' })
    expect(adapter.verifyWebhook('{}', signatureHeader)).toBeNull()
  })

  it('returns null for unparseable signatureHeader', () => {
    const adapter = new ThirdwebAdapter()
    expect(adapter.verifyWebhook('{}', 'not-json')).toBeNull()
  })

  it('maps COMPLETED status to payment.succeeded event', () => {
    const adapter = new ThirdwebAdapter()
    const rawBody = JSON.stringify({ status: 'COMPLETED', purchaseData: { orderId: 'order-123' } })
    vi.spyOn(adapter as never, '_verifySignature').mockReturnValue(true)
    const event = adapter.verifyWebhook(rawBody, '{}')
    expect(event?.type).toBe('payment.succeeded')
    expect(event?.orderId).toBe('order-123')
  })

  it('maps FAILED status to delivery.failed event', () => {
    const adapter = new ThirdwebAdapter()
    const rawBody = JSON.stringify({ status: 'FAILED', purchaseData: { orderId: 'order-456' } })
    vi.spyOn(adapter as never, '_verifySignature').mockReturnValue(true)
    const event = adapter.verifyWebhook(rawBody, '{}')
    expect(event?.type).toBe('delivery.failed')
    expect(event?.orderId).toBe('order-456')
  })

  it('maps ERRORED status to delivery.failed event', () => {
    const adapter = new ThirdwebAdapter()
    const rawBody = JSON.stringify({ status: 'ERRORED', purchaseData: { orderId: 'order-789' } })
    vi.spyOn(adapter as never, '_verifySignature').mockReturnValue(true)
    const event = adapter.verifyWebhook(rawBody, '{}')
    expect(event?.type).toBe('delivery.failed')
  })

  it('maps unknown status to unknown event', () => {
    const adapter = new ThirdwebAdapter()
    const rawBody = JSON.stringify({ status: 'PENDING', purchaseData: { orderId: 'order-000' } })
    vi.spyOn(adapter as never, '_verifySignature').mockReturnValue(true)
    const event = adapter.verifyWebhook(rawBody, '{}')
    expect(event?.type).toBe('unknown')
  })
})
