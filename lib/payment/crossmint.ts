import crypto from 'crypto'
import type { PaymentProvider, CreateOrderParams, OrderResult, ProviderWebhookEvent } from './provider'

function getBaseUrl(): string {
  return process.env.CROSSMINT_SERVER_KEY?.startsWith('sk_staging_')
    ? 'https://staging.crossmint.com/api/2022-06-09'
    : 'https://www.crossmint.com/api/2022-06-09'
}

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
      recipient: params.recipientWallet
        ? { walletAddress: params.recipientWallet }
        : { email: params.recipientEmail },
      payment: {
        method: 'card',
        currency: 'usd',
        receiptEmail: params.recipientEmail,
      },
      lineItems: [{
        collectionLocator: `crossmint:${this.collectionId}`,
        callData: {
          _uri: params.uri,
          totalPrice: String(params.priceUsd.toFixed(2)),
          reuploadLinkedFiles: false,
        },
      }],
    }

    const res = await fetch(`${getBaseUrl()}/orders`, {
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
    const order = data.order ?? data  // createOrder wraps under .order; fall back for safety
    return {
      orderId: order.orderId,
      clientSecret: data.clientSecret,
      status: mapStatus(order.phase ?? '', order.payment?.status ?? ''),
    }
  }

  async getOrder(orderId: string): Promise<OrderResult> {
    const res = await fetch(`${getBaseUrl()}/orders/${orderId}`, {
      headers: { 'X-API-KEY': this.serverKey },
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`Crossmint getOrder failed (${res.status})`)

    const data = await res.json()
    const delivery = data.lineItems?.[0]?.delivery
    const tokenId = delivery?.tokens?.[0]?.tokenId as string | undefined
    const txHash = delivery?.txId as string | undefined

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
