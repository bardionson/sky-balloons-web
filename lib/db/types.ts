export type MintStatus =
  | 'pending'
  | 'ordered'
  | 'paid'
  | 'minting'
  | 'minted'
  | 'printed'
  | 'failed'

export interface Mint {
  id: string
  cid: string
  unique_name: string
  unit_number: number
  seed: number
  timestamp: string
  orientation: 0 | 1
  imagination: number
  event_name: string
  type: string
  pixel_dimensions: string
  status: MintStatus
  order_id: string | null
  token_id: string | null
  tx_hash: string | null
  collector_id: string | null
  created_at: string
  updated_at: string
}

export interface Collector {
  id: string
  email: string
  name: string
  wallet_address: string | null
  street_address: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  created_at: string
  updated_at: string
}

export interface Setting {
  id: string
  key: string
  value: string
  updated_at: string
}

export interface WebhookEvent {
  id: string
  provider: string
  event_type: string
  order_id: string | null
  payload: Record<string, unknown>
  processed: boolean
  created_at: string
}

/** Fields the GPU sends when submitting a new artwork */
export interface InstallationSubmitBody {
  cid: string
  unique_name: string
  unit_number: number
  seed: number
  timestamp: string
  orientation: 0 | 1
  imagination: number
  event_name: string
  type?: string
  pixel_dimensions?: string
}
