import crypto from 'crypto'
import type { PaymentProvider, CreateOrderParams, OrderResult, ProviderWebhookEvent } from './provider'

const BASE_URL = 'https://www.crossmint.com/api/2022-06-09'

function mapStatus(phase: string, paymentStatus: string): OrderResult['status'] {
  if (phase === 'completed' || paymentStatus === 'completed') return 'completed'
  if (paymentStatus === 'awaiting-payment') return 'awaiting-payment'
  if (paymentStatus === 'processing') return 'processing'
  if (phase === 'delivery') return 'delivery-initiated'
  if (paymentStatus === 'failed') return 'failed'
  return 'pending'
}

export class CrossmintAdapter implements PaymentProvider {
  private get serverKey(): string {
    const key = process.env.CROSSMINT_SERVER_KEY
    if (!key) throw new Error('CROSSMINT_SERVER_KEY is not set')
    return key
  }

  private get collectionId(): string {
    const id = process.env.CROSSMINT_COLLECTION_ID
    if (!id) throw new Error('CROSSMINT_COLLECTION_ID is not set')
    return id
  }

  private get webhookSecret(): string {
    const s = process.env.CROSSMINT_WEBHOOK_SECRET
    if (!s) throw new Error('CROSSMINT_WEBHOOK_SECRET is not set')
    return s
  }

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    const body = {
      recipient: {
        email: params.recipientEmail,
        ...(params.recipientWallet && { walletAddress: `ethereum-sepolia:${params.recipientWallet}` }),
      },
      payment: {
        method: 'stripe-payment-element',
        currency: 'usd',
      },
      lineItems: [{
        collectionLocator: `crossmint:${this.collectionId}`,
        callData: {
          contractArguments: { _uri: params.uri },
          totalPrice: String(params.priceUsd.toFixed(2)),
        },
      }],
    }

    const res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.serverKey,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Crossmint createOrder failed (${res.status}): ${text}`)
    }

    const data = await res.json()
    return {
      orderId: data.orderId,
      clientSecret: data.payment?.preparation?.clientSecret,
      status: mapStatus(data.phase ?? '', data.payment?.status ?? ''),
    }
  }

  async getOrder(orderId: string): Promise<OrderResult> {
    const res = await fetch(`${BASE_URL}/orders/${orderId}`, {
      headers: { 'X-API-KEY': this.serverKey },
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`Crossmint getOrder failed (${res.status})`)

    const data = await res.json()
    const tokenId = data.lineItems?.[0]?.metadata?.tokenId as string | undefined
    const txHash = data.lineItems?.[0]?.metadata?.transactionHash as string | undefined

    return {
      orderId: data.orderId,
      status: mapStatus(data.phase ?? '', data.payment?.status ?? ''),
      ...(tokenId && { tokenId }),
      ...(txHash && { txHash }),
    } as OrderResult
  }

  /** @internal — separated for testability */
  _verifySignature(rawBody: string, signature: string): boolean {
    try {
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody)
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
    if (!this._verifySignature(rawBody, signatureHeader)) return null

    try {
      const payload = JSON.parse(rawBody)
      const type = payload.type as string
      const order = payload.data?.order
      const lineItem = payload.data?.lineItems?.[0]

      if (type === 'orders.delivery.completed') {
        return {
          type: 'delivery.completed',
          orderId: order?.orderId ?? '',
          tokenId: lineItem?.tokenId,
          txHash: lineItem?.transactionHash,
        }
      }
      if (type === 'orders.delivery.initiated') {
        return { type: 'delivery.initiated', orderId: order?.orderId ?? '' }
      }
      if (type === 'orders.delivery.failed') {
        return { type: 'delivery.failed', orderId: order?.orderId ?? '' }
      }
      if (type === 'orders.payment.succeeded') {
        return { type: 'payment.succeeded', orderId: order?.orderId ?? '' }
      }
      return { type: 'unknown', orderId: order?.orderId ?? '' }
    } catch {
      return null
    }
  }
}
