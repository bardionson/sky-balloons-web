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
    description: `Collect a digital art artifact by ${ARTIST_NAME}`,
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
    <main className="min-h-screen bg-surface flex flex-col relative overflow-hidden pb-16">
      {/* Background Gradient Blur */}
      <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-primary/10 via-surface to-surface pointer-events-none blur-[120px] -z-10" />

      {/* Header - Intentional Asymmetry */}
      <div className="w-full pt-16 pb-8 pl-8 md:pl-24 relative">
        <p className="font-mono text-tertiary text-xs tracking-widest uppercase mb-4">
          _001. {ARTIST_NAME}
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-bold text-on_surface tracking-tight mb-2">
          {PROJECT_NAME}
        </h1>
        <p className="font-mono text-[10px] text-outline uppercase tracking-wider">
          SYS.TARGET: MINT_INTERFACE // STATUS: ACTIVE
        </p>
      </div>

      {/* Main Content Card - Tonal Stacking */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-0 bg-surface_container rounded-sm shadow-[0_0_40px_rgba(135,206,235,0.04)] relative border border-outline_variant/15 overflow-hidden">
          
          {/* Data Anchor Top Left */}
          <div className="absolute top-3 left-4 font-mono text-[10px] text-outline z-10 mix-blend-difference">ART_ID: {params.id}</div>

          {/* Artwork Container */}
          <div className="relative bg-surface p-4 md:p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-overlay_variant/10">
            <div className={`relative rounded-xl overflow-hidden shadow-2xl w-full bg-surface_container_highest ${
              m.orientation === 1
                ? 'max-w-xl aspect-video'
                : 'max-w-md aspect-[9/16]'
            }`}>
              <IpfsImage
                cid={m.cid}
                alt={`${PROJECT_NAME} #${m.unit_number} — ${m.unique_name}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Metadata & Controls */}
          <div className="flex flex-col relative bg-surface_container_low p-6 md:p-12">
            {/* Data Anchor Top Right */}
            <div className="absolute top-4 right-4 font-mono text-[10px] text-tertiary flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(57,255,20,0.8)] animate-pulse" />
              ONLINE
            </div>

            <div className="mb-12 mt-4">
              <div className="font-mono text-tertiary text-xs mb-2">SEQUENCE // #{m.unit_number}</div>
              <h2 className="font-display text-4xl text-on_surface mb-3 leading-none">
                {m.unique_name}
              </h2>
              <p className="font-mono text-outline text-xs mt-4">
                [ LOC: {m.event_name} ]<br/>
                [ TME: {m.timestamp} ]
              </p>
            </div>

            <div className="mt-auto">
              <div className="bg-surface_container_highest rounded-sm p-6 relative border border-outline_variant/20 shadow-inner">
                {/* Already minted — show success view */}
                {m.status === 'minted' || m.status === 'printed' ? (
                  <div className="flex flex-col items-start gap-4">
                    <div className="font-mono text-xl text-tertiary flex items-center gap-3">
                      <span>◈</span> ACQUIRED
                    </div>
                    <p className="font-sans text-on_surface_variant text-sm border-l-2 border-primary/30 pl-3">This digital artifact has been logged in the permanent ledger.</p>
                    {m.token_id && (
                      <a
                        href={`${EXPLORER_BASE}/token/${process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS}?a=${m.token_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary hover:text-primary_container transition-colors text-[10px] sm:text-xs tracking-wider border-b border-primary/30 pb-0.5 mt-2 inline-flex items-center"
                      >
                        READ_LEDGER_HASH #{m.token_id} ↗
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-20 text-outline text-xs text-center font-mono">
        <p>TERMINAL &middot; {NETWORK_NAME}</p>
      </footer>
    </main>
  )
}
