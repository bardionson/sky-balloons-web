'use client'

import { useState, useEffect } from 'react'
import { defineChain, NATIVE_TOKEN_ADDRESS } from 'thirdweb'
import { CheckoutWidget, ThirdwebProvider } from 'thirdweb/react'
import WalletConnectSection, { thirdwebClient } from './WalletConnectSection'
import MintSuccess from './MintSuccess'
import type { ThirdwebPaymentConfig } from '@/lib/payment/thirdweb'
import { PROJECT_NAME } from '@/lib/project-config'

type Phase = 'form' | 'submitting' | 'payment' | 'success' | 'error'

interface Props {
  mintId: string
  mintUrl: string
  priceUsd: string
  unitNumber?: number
}

function ThirdwebCheckout({
  config,
  onSuccess,
}: {
  config: ThirdwebPaymentConfig & { orderId: string }
  onSuccess: () => void
}) {
  const chain = defineChain(config.chainId)

  return (
    <div className="w-full max-w-md">
      <CheckoutWidget
        client={thirdwebClient}
        chain={chain}
        token={{ address: NATIVE_TOKEN_ADDRESS }}
        amount={config.priceEth}
        seller={config.treasuryAddress as `0x${string}`}
        purchaseData={{ orderId: config.orderId }}
        paymentMethods={['crypto', 'card']}
        theme="dark"
        name={`${PROJECT_NAME} Digital Art Artifact`}
        onSuccess={onSuccess}
      />
    </div>
  )
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
  const [paymentConfig, setPaymentConfig] = useState<ThirdwebPaymentConfig | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [tokenId, setTokenId] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!wallet) {
      setErrorMsg('Please connect a wallet first (Step 1 above) — click the button to create a free wallet with your email, no download needed')
      return
    }
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

      if (!data.clientSecret) {
        setErrorMsg('Payment session unavailable — please try again')
        setPhase('error')
        return
      }

      try {
        const config = JSON.parse(data.clientSecret) as ThirdwebPaymentConfig
        setPaymentConfig(config)
        setPhase('payment')
      } catch {
        setErrorMsg('Invalid payment config — please try again')
        setPhase('error')
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setPhase('error')
    }
  }

  // Poll for mint completion after order is placed.
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

  if (phase === 'payment' && orderId && paymentConfig) {
    return (
      <ThirdwebProvider>
        <ThirdwebCheckout
          config={{ ...paymentConfig, orderId }}
          onSuccess={() => { /* polling will detect completion */ }}
        />
      </ThirdwebProvider>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <form
        aria-label="Checkout form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full"
      >
        {/* Wallet — first step, most important */}
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-white">
            {wallet ? '✓ Wallet connected' : 'Step 1 — Connect or create your wallet'}
          </p>
          <p className="text-xs text-white/50">
            {wallet
              ? <span className="font-mono truncate block">{wallet.slice(0, 6)}…{wallet.slice(-4)}</span>
              : 'No crypto experience needed — use your email to create a free wallet instantly, or connect an existing one.'}
          </p>
          <WalletConnectSection onAddress={(addr) => setWallet(addr)} />

          {/* Mobile-only deep links — open page inside wallet app browser */}
          {!wallet && (
            <div className="md:hidden flex gap-2 mt-1">
              <a
                href={`https://metamask.app.link/dapp/${mintUrl.replace(/^https?:\/\//, '')}`}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 text-center hover:bg-white/10"
              >
                🦊 Open in MetaMask
              </a>
              <a
                href={`https://go.cb-wallet.com/dapp?url=${encodeURIComponent(mintUrl)}`}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 text-center hover:bg-white/10"
              >
                🔵 Open in Coinbase
              </a>
            </div>
          )}

          {!wallet && (
            <label className="flex flex-col gap-1 text-xs text-white/40 mt-1">
              Or paste an existing wallet address
              <input
                id="wallet"
                type="text"
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                placeholder="0x..."
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 outline-none focus:border-white/30 font-mono text-sm"
              />
            </label>
          )}
        </div>

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

        {errorMsg && phase === 'form' && (
          <p className="text-red-400 text-sm text-center">{errorMsg}</p>
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
