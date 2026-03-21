import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { serverClient } from '@/lib/db/server'
import CheckoutForm from '@/components/CheckoutForm'
import IpfsImage from '@/components/IpfsImage'
import type { Mint } from '@/lib/db/types'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Balloons in the Sky — Mint',
    description: 'Mint your generative balloon NFT by Bård Ionson & Jennifer Ionson',
  }
}

export default async function MintPage({ params }: Props) {
  const db = serverClient()

  const { data: mint, error } = await db
    .from('mints')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !mint) notFound()

  const { data: setting } = await db
    .from('settings')
    .select('value')
    .eq('key', 'mint_price_usd')
    .single()

  const priceUsd = setting?.value ?? '50.00'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const mintUrl = `${appUrl}/mint/${params.id}`

  const m = mint as Mint

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
          Bård Ionson &amp; Jennifer Ionson
        </p>
        <h1 className="text-3xl font-light text-white tracking-wide">
          Balloons in the Sky
        </h1>
      </div>

      {/* Artwork */}
      <div className="mb-6 rounded-xl overflow-hidden shadow-2xl max-w-xs w-full aspect-square bg-white/5">
        <IpfsImage
          cid={m.cid}
          alt={`Balloon #${m.unit_number} — ${m.unique_name}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Metadata */}
      <div className="mb-8 text-center">
        <p className="text-white text-lg font-medium">
          #{m.unit_number} &mdash; {m.unique_name}
        </p>
        <p className="text-white/50 text-sm mt-1">
          {m.event_name} &middot; {m.timestamp}
        </p>
      </div>

      {/* Already minted — show success view */}
      {m.status === 'minted' || m.status === 'printed' ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="text-4xl">🎈</div>
          <p className="text-white/60 text-sm">This balloon has already been minted.</p>
          {m.token_id && (
            <a
              href={`https://sepolia.etherscan.io/token/${process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS}?a=${m.token_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 underline text-xs hover:text-white/60"
            >
              View token #{m.token_id} on Etherscan ↗
            </a>
          )}
        </div>
      ) : (
        <CheckoutForm
          mintId={params.id}
          mintUrl={mintUrl}
          priceUsd={priceUsd}
          unitNumber={m.unit_number}
        />
      )}

      <footer className="mt-16 text-white/20 text-xs text-center">
        <p>Sepolia testnet &middot; Powered by Crossmint</p>
      </footer>
    </main>
  )
}
