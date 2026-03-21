'use client'

import { useState, useEffect } from 'react'
import { CrossmintProvider, CrossmintEmbeddedCheckout } from '@crossmint/client-sdk-react-ui'
import WalletButtons from './WalletButtons'
import MintSuccess from './MintSuccess'

type Phase = 'form' | 'submitting' | 'payment' | 'success' | 'error'

interface Props {
  mintId: string
  mintUrl: string
  priceUsd: string
  unitNumber?: number
}

export default function CheckoutForm({ mintId, mintUrl, priceUsd, unitNumber = 0 }: Props) {
  const [phase, setPhase] = useState<Phase>('form')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [wallet, setWallet] = useState('')
  const [showAddress, setShowAddress] = useState(false)
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postal, setPostal] = useState('')
  const [country, setCountry] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [tokenId, setTokenId] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const clientKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('submitting')
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/mint/${mintId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, name,
          ...(wallet && { wallet_address: wallet }),
          ...(street && { street_address: street }),
          ...(city && { city }),
          ...(state && { state }),
          ...(postal && { postal_code: postal }),
          ...(country && { country }),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Order creation failed')

      setOrderId(data.orderId)
      setClientSecret(data.clientSecret ?? null)
      if (!data.clientSecret) {
        setErrorMsg('Payment session unavailable — please try again')
        setPhase('error')
      } else {
        setPhase('payment')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setPhase('error')
    }
  }

  // Poll for mint completion after order is created.
  // Status endpoint looks up by mintId (URL path param). Since the order route
  // enforces 409 if a mint already has an order, a mint only ever has one order
  // at a time — so polling by mintId is correct and no orderId scoping is needed.
  useEffect(() => {
    if (!orderId) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mint/${mintId}/status`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'minted') {
          clearInterval(interval)
          setTokenId(data.token_id ?? null)
          setTxHash(data.tx_hash ?? null)
          setPhase('success')
        }
      } catch { /* keep polling */ }
    }, 5000)

    return () => clearInterval(interval)
  }, [orderId, mintId])

  if (phase === 'success') {
    return <MintSuccess tokenId={tokenId} txHash={txHash} unitNumber={unitNumber} />
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-red-400 text-sm">{errorMsg}</p>
        <button
          onClick={() => { setPhase('form'); setErrorMsg(null) }}
          className="text-white/60 underline text-sm hover:text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  if (phase === 'payment' && orderId && clientSecret) {
    return (
      <div className="w-full max-w-md">
        <CrossmintProvider apiKey={clientKey}>
          <CrossmintEmbeddedCheckout
            orderId={orderId}
            clientSecret={clientSecret}
            payment={{
              crypto: { enabled: false },
              fiat: { enabled: true, allowedMethods: { card: true } },
              defaultMethod: 'fiat',
              receiptEmail: email,
            }}
          />
        </CrossmintProvider>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <WalletButtons mintUrl={mintUrl} />

      <form
        aria-label="Checkout form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full"
      >
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Email *
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-white/80">
          Name *
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-white/80">
          Wallet address <span className="text-white/30">(optional)</span>
          <input
            id="wallet"
            type="text"
            value={wallet}
            onChange={e => setWallet(e.target.value)}
            placeholder="0x..."
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50 font-mono text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowAddress(!showAddress)}
          className="text-white/40 text-xs text-left hover:text-white/60 underline"
        >
          {showAddress ? '▲ Hide mailing address' : '▼ Add mailing address (for postcards)'}
        </button>

        {showAddress && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-white/80">
              Street
              <input id="street" type="text" value={street} onChange={e => setStreet(e.target.value)}
                className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm text-white/80">
                City
                <input id="city" type="text" value={city} onChange={e => setCity(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-white/80">
                State / Region
                <input id="state" type="text" value={state} onChange={e => setState(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-sm text-white/80">
                Postal code
                <input id="postal" type="text" value={postal} onChange={e => setPostal(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-white/80">
                Country
                <input id="country" type="text" value={country} onChange={e => setCountry(e.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50" />
              </label>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={phase === 'submitting'}
          className="rounded-lg bg-white px-6 py-3 font-semibold text-black hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {phase === 'submitting'
            ? 'Preparing order…'
            : `Mint Now — $${priceUsd}`}
        </button>
      </form>
    </div>
  )
}
