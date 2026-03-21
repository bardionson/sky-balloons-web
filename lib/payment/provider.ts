export interface CreateOrderParams {
  recipientEmail: string
  recipientWallet?: string
  uri: string        // data:application/json;base64,...
  priceUsd: number
}

export interface OrderResult {
  orderId: string
  clientSecret?: string   // for Stripe Elements card payments
  status: OrderStatus
  tokenId?: string   // populated when status === 'completed'
  txHash?: string    // populated when status === 'completed'
}

export type OrderStatus =
  | 'pending'
  | 'awaiting-payment'
  | 'processing'
  | 'delivery-initiated'
  | 'completed'
  | 'failed'

export interface ProviderWebhookEvent {
  type: 'payment.succeeded' | 'delivery.initiated' | 'delivery.completed' | 'delivery.failed' | 'unknown'
  orderId: string
  tokenId?: string
  txHash?: string
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<OrderResult>
  getOrder(orderId: string): Promise<OrderResult>
  /**
   * Verify the webhook signature and parse the event.
   * Returns null if signature is invalid.
   */
  verifyWebhook(rawBody: string, signatureHeader: string): ProviderWebhookEvent | null
}
