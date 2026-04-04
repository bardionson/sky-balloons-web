import type { Metadata } from 'next'
import Link from 'next/link'
import { sql } from '@/lib/db/server'
import IpfsImage from '@/components/IpfsImage'
import type { Mint } from '@/lib/db/types'
import { PROJECT_NAME, ARTIST_NAME, NETWORK_NAME } from '@/lib/project-config'

export const metadata: Metadata = {
  title: `${PROJECT_NAME} — Visitor Gallery`,
  description: `View the latest collected and available artifacts by ${ARTIST_NAME}`,
}

export default async function GalleryPage() {
  const mints = await sql`SELECT * FROM mints ORDER BY unit_number DESC LIMIT 50` as Mint[]

  return (
    <main className="min-h-screen bg-surface flex flex-col relative overflow-hidden pb-16">
      {/* Background Gradient Blur */}
      <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-primary/10 via-surface to-surface pointer-events-none blur-[120px] -z-10" />

      {/* Header - Intentional Asymmetry */}
      <div className="w-full pt-16 pb-8 pl-8 md:pl-24 relative">
        <p className="font-mono text-tertiary text-xs tracking-widest uppercase mb-4">
          _000. {ARTIST_NAME}
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-bold text-on_surface tracking-tight mb-2">
          {PROJECT_NAME}
        </h1>
        <p className="font-mono text-[10px] text-outline uppercase tracking-wider">
          SYS.TARGET: VISITOR_GALLERY // STATUS: ACTIVE
        </p>
      </div>

      {/* Main Content Card - Tonal Stacking */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 mt-4">
        <div className="bg-surface_container p-6 md:p-12 rounded-sm shadow-[0_0_40px_rgba(135,206,235,0.04)] relative border border-outline_variant/15">
          {/* Data Anchor Top Left */}
          <div className="absolute top-4 left-4 font-mono text-[10px] text-outline mix-blend-difference">VOL: PUBLIC_LEDGER</div>
          {/* Data Anchor Top Right */}
          <div className="absolute top-4 right-4 font-mono text-[10px] text-tertiary flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(57,255,20,0.8)] animate-pulse" />
            LIVE_STREAM
          </div>

          <div className="mt-8 mb-12 flex justify-between items-end border-b border-outline_variant/30 pb-4">
            <div className="font-mono text-tertiary text-xs">LATEST_ACQUISITIONS</div>
            <div className="font-mono text-outline text-[10px]">TOTAL_RECORDS: {mints.length}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {mints.map((mint) => (
              <Link href={`/mint/${mint.id}`} key={mint.id} className="group relative block rounded-xl overflow-hidden bg-surface_container_highest border border-outline_variant/20 hover:border-primary/50 transition-colors shadow-inner">
                <div className={`w-full ${mint.orientation === 1 ? 'aspect-video' : 'aspect-[9/16]'}`}>
                  <IpfsImage
                    cid={mint.cid}
                    alt={mint.unique_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </div>
                
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface_container_lowest to-transparent p-4 flex flex-col justify-end pt-12">
                  <div className="font-mono text-[10px] text-tertiary mb-1">#{mint.unit_number}</div>
                  <h3 className="font-display text-lg text-on_surface truncate">{mint.unique_name}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`font-mono text-[10px] ${mint.status === 'minted' || mint.status === 'printed' ? 'text-primary' : 'text-outline'}`}>
                      {mint.status === 'minted' || mint.status === 'printed' ? 'ACQUIRED' : 'AVAILABLE'}
                    </span>
                    <span className="font-mono text-[10px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">INSPECT ↗</span>
                  </div>
                </div>
              </Link>
            ))}
            
            {mints.length === 0 && (
               <div className="col-span-full py-20 text-center font-mono text-outline text-sm">
                 NO DATA // THE LEDGER IS EMPTY
               </div>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-20 text-outline text-xs text-center font-mono">
        <p>TERMINAL &middot; {NETWORK_NAME}</p>
      </footer>
    </main>
  )
}
