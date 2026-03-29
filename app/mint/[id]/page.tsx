import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sql } from '@/lib/db/server'
import CheckoutForm from '@/components/CheckoutForm'
import IpfsImage from '@/components/IpfsImage'
import type { Mint } from '@/lib/db/types'
import { PROJECT_NAME, ARTIST_NAME, EXPLORER_BASE, NETWORK_NAME } from '@/lib/project-config'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `${PROJECT_NAME} — Mint`,
    description: `Mint your generative NFT by ${ARTIST_NAME}`,
  }
}

export default async function MintPage({ params }: Props) {
  const mintRows = await sql`SELECT * FROM mints WHERE id = ${params.id}` as Mint[]
  const mint = mintRows[0]
  if (!mint) notFound()

  const settingRows = await sql`SELECT value FROM settings WHERE key = 'mint_price_usd'` as { value: string }[]
  const priceUsd = settingRows[0]?.value ?? '50.00'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const mintUrl = `${appUrl}/mint/${params.id}`

  const m = mint

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
          {ARTIST_NAME}
        </p>
        <h1 className="text-3xl font-light text-white tracking-wide">
          {PROJECT_NAME}
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
              href={`${EXPLORER_BASE}/token/${process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS}?a=${m.token_id}`}
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
        <p>{NETWORK_NAME}</p>
      </footer>
    </main>
  )
}
