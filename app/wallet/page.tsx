import type { Metadata } from 'next'
import WalletView from '@/components/WalletView'
import { PROJECT_NAME, ARTIST_NAME, NETWORK_NAME } from '@/lib/project-config'

export const metadata: Metadata = {
  title: `${PROJECT_NAME} — My Collection`,
  description: `View your ${PROJECT_NAME} NFTs by ${ARTIST_NAME}`,
}

export default function WalletPage() {
  return (
    <main className="min-h-screen bg-surface flex flex-col relative overflow-hidden pb-16">
      <div className="absolute top-[-20%] right-[-10%] w-[120%] h-[120%] bg-gradient-to-bl from-primary/10 via-surface to-surface pointer-events-none blur-[120px] -z-10" />

      <div className="w-full pt-16 pb-8 pl-8 md:pl-24 relative">
        <p className="font-mono text-tertiary text-xs tracking-widest uppercase mb-4">
          _002. {ARTIST_NAME}
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-bold text-on_surface tracking-tight mb-2">
          {PROJECT_NAME}
        </h1>
        <p className="font-mono text-[10px] text-outline uppercase tracking-wider">
          SYS.TARGET: WALLET_INTERFACE // STATUS: ACTIVE
        </p>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 mt-8">
        <div className="bg-surface_container rounded-sm shadow-[0_0_40px_rgba(135,206,235,0.04)] relative border border-outline_variant/15 p-6 md:p-12">
          {/* Data Anchor Top Left */}
          <div className="absolute top-4 left-4 font-mono text-[10px] text-outline mix-blend-difference">VOL: USER_COLLECTION</div>
          {/* Data Anchor Top Right */}
          <div className="absolute top-4 right-4 font-mono text-[10px] text-tertiary flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(57,255,20,0.8)] animate-pulse" />
            SYNCED
          </div>
          
          <div className="mt-8">
            <div className="font-mono text-tertiary text-xs mb-4 border-b border-outline_variant/30 pb-2">LEDGER // MY_COLLECTION</div>
            <WalletView />
          </div>
        </div>
      </div>

      <footer className="mt-20 text-outline text-xs text-center font-mono">
        <p>TERMINAL &middot; {NETWORK_NAME}</p>
      </footer>
    </main>
  )
}
