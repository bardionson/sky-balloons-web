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
      <div className="flex flex-col gap-3 text-center bg-error_container/20 border border-error_container p-6 rounded-sm">
        <p className="font-mono text-error text-sm">{errorMsg}</p>
        <button
          onClick={() => { setPhase('form'); setErrorMsg(null) }}
          className="font-mono text-error/60 underline decoration-error/30 text-xs hover:text-error transition-colors mt-2"
        >
          [ REBOOT_PROCESS ]
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
        {/* Wallet — first step */}
        <div className="flex flex-col gap-3 rounded-sm border border-outline_variant/30 bg-surface_container_low p-5">
          <div className="flex justify-between items-start">
            <p className="font-mono text-[10px] text-tertiary">
              {wallet ? '[ AUTHENTICATED ]' : '[ REQ: WALLET_AUTH ]'}
            </p>
            {wallet && <div className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(57,255,20,0.8)] animate-pulse" />}
          </div>
          <p className="text-xs text-on_surface_variant">
            {wallet
              ? <span className="font-mono text-primary truncate block p-2 bg-surface_container rounded border border-primary/20">{wallet.slice(0, 8)}…{wallet.slice(-6)}</span>
              : 'Secure an identity to access the terminal. Email fallback available.'}
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
            <label className="flex flex-col gap-1 font-mono text-[10px] text-outline mt-3">
              // MANUAL_ENTRY
              <input
                id="wallet"
                type="text"
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                placeholder="0x..."
                className="bg-transparent border-b-2 border-surface_container_highest px-0 py-2 text-on_surface placeholder-outline/50 outline-none focus:border-primary focus:shadow-[0_2px_10px_rgba(135,206,235,0.2)] font-mono text-sm transition-all"
              />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1 font-mono text-[10px] text-outline mt-2">
          TARGET_EMAIL *
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="operator@terminal.net"
            className="bg-transparent border-b-2 border-surface_container_highest px-0 py-2.5 text-on_surface placeholder-outline/50 outline-none focus:border-primary focus:shadow-[0_2px_10px_rgba(135,206,235,0.2)] transition-all font-sans text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 font-mono text-[10px] text-outline mt-2">
          DESIGNATION *
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Operator Name"
            className="bg-transparent border-b-2 border-surface_container_highest px-0 py-2.5 text-on_surface placeholder-outline/50 outline-none focus:border-primary focus:shadow-[0_2px_10px_rgba(135,206,235,0.2)] transition-all font-sans text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => setShowAddress(!showAddress)}
          className="font-mono text-tertiary/70 hover:text-tertiary text-[10px] text-left mt-2 transition-colors flex items-center gap-2"
        >
          {showAddress ? '[-] CANCEL_PHYSICAL_ROUTING' : '[+] ADD_PHYSICAL_ROUTING_DATA (POSTCARDS)'}
        </button>

        {showAddress && (
          <div className="flex flex-col gap-4 mt-2 p-4 border border-outline_variant/20 bg-surface_container relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-outline_variant/30" />
            <label className="flex flex-col gap-1 font-mono text-[10px] text-outline">
              STREET
              <input id="street" type="text" value={street} onChange={e => setStreet(e.target.value)}
                className="bg-transparent border-b-2 border-surface_container_highest px-0 py-2 text-on_surface placeholder-outline/50 outline-none focus:border-primary font-sans text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 font-mono text-[10px] text-outline">
                CITY
                <input id="city" type="text" value={city} onChange={e => setCity(e.target.value)}
                  className="bg-transparent border-b-2 border-surface_container_highest px-0 py-2 text-on_surface placeholder-outline/50 outline-none focus:border-primary font-sans text-sm" />
              </label>
              <label className="flex flex-col gap-1 font-mono text-[10px] text-outline">
                REGION
                <input id="state" type="text" value={state} onChange={e => setState(e.target.value)}
                  className="bg-transparent border-b-2 border-surface_container_highest px-0 py-2 text-on_surface placeholder-outline/50 outline-none focus:border-primary font-sans text-sm" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 font-mono text-[10px] text-outline">
                POSTAL_CODE
                <input id="postal" type="text" value={postal} onChange={e => setPostal(e.target.value)}
                  className="bg-transparent border-b-2 border-surface_container_highest px-0 py-2 text-on_surface placeholder-outline/50 outline-none focus:border-primary font-sans text-sm" />
              </label>
              <label className="flex flex-col gap-1 font-mono text-[10px] text-outline">
                COUNTRY
                <input id="country" type="text" value={country} onChange={e => setCountry(e.target.value)}
                  className="bg-transparent border-b-2 border-surface_container_highest px-0 py-2 text-on_surface placeholder-outline/50 outline-none focus:border-primary font-sans text-sm" />
              </label>
            </div>
          </div>
        )}

        {errorMsg && phase === 'form' && (
          <p className="font-mono text-error text-[10px] text-center border border-error/20 bg-error_container/10 p-2 mt-2">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={phase === 'submitting'}
          className="mt-4 rounded-md bg-gradient-to-r from-primary to-primary_container px-6 py-4 font-mono font-bold tracking-wider text-on_primary hover:shadow-[0_0_20px_rgba(135,206,235,0.4)] transition-all disabled:opacity-50 disabled:grayscale"
        >
          {phase === 'submitting'
            ? 'INITIATING_SEQUENCE...'
            : `EXECUTE_MINT // $${priceUsd}`}
        </button>
      </form>
    </div>
  )
}
