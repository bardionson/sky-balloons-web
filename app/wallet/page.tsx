import type { Metadata } from 'next'
import WalletView from '@/components/WalletView'
import { PROJECT_NAME, ARTIST_NAME, NETWORK_NAME } from '@/lib/project-config'

export const metadata: Metadata = {
  title: `${PROJECT_NAME} — My Collection`,
  description: `View your ${PROJECT_NAME} NFTs by ${ARTIST_NAME}`,
}

export default function WalletPage() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-white/40 text-xs tracking-widest uppercase mb-2">{ARTIST_NAME}</p>
        <h1 className="text-3xl font-light text-white tracking-wide">{PROJECT_NAME}</h1>
        <p className="text-white/30 text-sm mt-2">My Collection</p>
      </div>

      <div className="w-full max-w-xl">
        <WalletView />
      </div>

      <footer className="mt-16 text-white/20 text-xs text-center">
        <p>{NETWORK_NAME}</p>
      </footer>
    </main>
  )
}
