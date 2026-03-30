import crypto from 'crypto'
import type { PaymentProvider, CreateOrderParams, OrderResult, ProviderWebhookEvent } from './provider'
import { getMintPriceEth } from '@/lib/chain/price'

/**
 * Thirdweb Pay adapter.
 *
 * Architecture: Thirdweb handles payment collection only. Our own backend
 * wallet calls BalloonsNFT.mint() via viem after payment is confirmed by webhook.
 *
 * createOrder() generates a local UUID and returns the payment config the
 * frontend needs to render the Thirdweb BuyWidget (encoded as clientSecret JSON).
 *
 * getOrder() returns 'pending' — all status updates are driven by webhooks, not polling.
 *
 * verifyWebhook() verifies the HMAC-SHA256 signature using timestamp + body.
 * The caller must pack both headers into signatureHeader as JSON:
 *   JSON.stringify({ signature: req.headers.get('x-payload-signature'), timestamp: req.headers.get('x-timestamp') })
 */

export interface ThirdwebPaymentConfig {
  orderId: string
  treasuryAddress: string
  chainId: number
  priceEth: string
}

export class ThirdwebAdapter implements PaymentProvider {
  private get webhookSecret(): string {
    const s = process.env.THIRDWEB_WEBHOOK_SECRET
    if (!s) throw new Error('THIRDWEB_WEBHOOK_SECRET is not set')
    return s
  }

  private get treasuryAddress(): string {
    const a = process.env.TREASURY_WALLET_ADDRESS
    if (!a) throw new Error('TREASURY_WALLET_ADDRESS is not set')
    return a
  }

  private get chainId(): number {
    return Number(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID ?? '11155111')
  }

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    // No server-side session needed for Thirdweb Pay — we generate our own orderId.
    // The frontend uses the clientSecret config to render the BuyWidget.
    const orderId  = crypto.randomUUID()
    const priceEth = await getMintPriceEth()

    const config: ThirdwebPaymentConfig = {
      orderId,
      treasuryAddress: this.treasuryAddress,
      chainId: this.chainId,
      priceEth,
    }

    // Store recipient info in the config so webhook handler can mint to right address
    const clientSecret = JSON.stringify({
      ...config,
      recipientEmail: params.recipientEmail,
      recipientWallet: params.recipientWallet ?? null,
    })

    return {
      orderId,
      clientSecret,
      status: 'awaiting-payment',
    }
  }

  async getOrder(_orderId: string): Promise<OrderResult> {
    // Status updates are driven entirely by webhooks. The cron safety-net
    // cannot poll Thirdweb without a transaction ID, which is only known
    // after the user initiates payment client-side.
    return {
      orderId: _orderId,
      status: 'pending',
    }
  }

  /** @internal — separated for testability */
  _verifySignature(rawBody: string, signature: string, timestamp: string): boolean {
    try {
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex')
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    } catch {
      return false
    }
  }

  verifyWebhook(rawBody: string, signatureHeader: string): ProviderWebhookEvent | null {
    // signatureHeader is JSON-encoded { signature, timestamp }
    let signature: string
    let timestamp: string
    try {
      const parsed = JSON.parse(signatureHeader) as { signature?: string; timestamp?: string }
      signature = parsed.signature ?? ''
      timestamp = parsed.timestamp ?? ''
    } catch {
      return null
    }

    if (!this._verifySignature(rawBody, signature, timestamp)) return null

    try {
      const payload = JSON.parse(rawBody) as {
        status?: string
        purchaseData?: { orderId?: string }
      }

      const orderId = payload.purchaseData?.orderId ?? ''
      const status = (payload.status ?? '').toUpperCase()

      if (status === 'COMPLETED') {
        return { type: 'payment.succeeded', orderId }
      }
      if (status === 'FAILED' || status === 'ERRORED') {
        return { type: 'delivery.failed', orderId }
      }
      return { type: 'unknown', orderId }
    } catch {
      return null
    }
  }
}
