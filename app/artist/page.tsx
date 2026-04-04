import type { Metadata } from 'next'
import { sql } from '@/lib/db/server'
import type { Mint } from '@/lib/db/types'
import { PROJECT_NAME, ARTIST_NAME, NETWORK_NAME } from '@/lib/project-config'
import AccessControl from '@/components/AccessControl'
import { getContractStats } from '@/lib/chain/stats'

export const metadata: Metadata = {
  title: `${PROJECT_NAME} — Artist Dashboard`,
  description: `Operating Terminal for ${ARTIST_NAME}`,
}

export default async function ArtistDashboardPage() {
  const mints = await sql`SELECT * FROM mints` as Mint[]

  const mintedCount = mints.filter(m => m.status === 'minted' || m.status === 'printed').length
  const pendingCount = mints.filter(m => m.status === 'pending').length

  const stats = await getContractStats(mintedCount)
  
  return (
    <AccessControl requiredRole="artist">
      <main className="min-h-screen bg-surface flex flex-col relative overflow-hidden pb-16">
        <div className="absolute top-[-20%] right-[-10%] w-[120%] h-[120%] bg-gradient-to-bl from-primary/10 via-surface to-surface pointer-events-none blur-[120px] -z-10" />

      <div className="w-full pt-16 pb-8 pl-8 md:pl-24 relative border-b border-outline_variant/20 mb-8">
        <p className="font-mono text-tertiary text-xs tracking-widest uppercase mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(57,255,20,0.8)] animate-pulse" />
          SECURE_TERMINAL_ACCESS
        </p>
        <h1 className="font-display text-5xl md:text-6xl font-bold text-on_surface tracking-tight mb-2">
          {PROJECT_NAME} // OPS
        </h1>
        <p className="font-mono text-[10px] text-outline uppercase tracking-wider">
          AUTH_LEVEL: ARTIST_ADMIN // STATUS: CONNECTED
        </p>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Analytics Column */}
        <div className="col-span-1 lg:col-span-1 flex flex-col gap-6">
          <div className="bg-surface_container p-8 rounded-sm shadow-inner border border-outline_variant/15 relative">
             <div className="absolute top-4 right-4 font-mono text-[10px] text-tertiary">
               {stats.isPreSale ? 'PRE_SALE' : 'POST_SALE'}
             </div>
             <h3 className="font-mono text-xs text-outline mb-6 border-b border-outline_variant/30 pb-2">FINANCIAL_METRICS</h3>

             <div className="flex flex-col gap-1 mb-6">
               <span className="font-mono text-[10px] text-on_surface_variant">REVENUE_ETH (MINTS × PRICE)</span>
               <span className="font-display text-4xl text-primary">Ξ{stats.revenueEth}</span>
             </div>

             <div className="flex flex-col gap-1 mb-6">
               <span className="font-mono text-[10px] text-on_surface_variant">ENDOWMENT_POOL (COLLECTOR)</span>
               <span className="font-display text-3xl text-tertiary">Ξ{stats.endowmentBalanceEth}</span>
             </div>

             <div className="flex flex-col gap-1 mb-6">
               <span className="font-mono text-[10px] text-on_surface_variant">ARTIST_BALANCE (CLAIMABLE)</span>
               <span className="font-display text-2xl text-primary">Ξ{stats.artistBalanceEth}</span>
             </div>

             <div className="flex flex-col gap-1 mb-6">
               <span className="font-mono text-[10px] text-on_surface_variant">GALLERY_BALANCE (CLAIMABLE)</span>
               <span className="font-display text-2xl text-on_surface_variant">Ξ{stats.galleryBalanceEth}</span>
             </div>

             <div className="flex flex-col gap-1 mb-6">
               <span className="font-mono text-[10px] text-on_surface_variant">MINT_PRICE</span>
               <span className="font-display text-xl text-on_surface">Ξ{stats.mintPriceEth}</span>
             </div>

             <div className="flex flex-col gap-1">
               <span className="font-mono text-[10px] text-on_surface_variant">TOTAL_ACQUISITIONS</span>
               <span className="font-display text-3xl text-on_surface">{mintedCount}</span>
               <span className="font-mono text-[10px] text-outline mt-1">+ {pendingCount} PENDING_OPERATIONS</span>
             </div>
          </div>
        </div>

        {/* Mints Column */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-surface_container_highest p-8 rounded-sm shadow-[0_0_40px_rgba(135,206,235,0.02)] border border-outline_variant/15 h-full">
            <div className="flex justify-between items-end border-b border-outline_variant/30 pb-4 mb-6">
              <h3 className="font-mono text-xs text-on_surface">LEDGER_EVENTS_LOG</h3>
              <div className="font-mono text-outline text-[10px]">LATEST 100 RECORDS</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs text-on_surface_variant">
                <thead>
                  <tr className="border-b border-outline_variant/20">
                    <th className="pb-3 text-outline">ID</th>
                    <th className="pb-3 text-outline">UNIQUE_NAME</th>
                    <th className="pb-3 text-outline">TIMESTAMP</th>
                    <th className="pb-3 text-outline text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {mints.slice(0, 50).map((m) => (
                    <tr key={m.id} className="border-b border-outline_variant/10 hover:bg-surface_bright/10 transition-colors">
                      <td className="py-4 text-outline/50">#{m.unit_number}</td>
                      <td className="py-4 text-on_surface">{m.unique_name}</td>
                      <td className="py-4 truncate max-w-[150px] text-outline/50">{new Date(m.created_at).toLocaleString()}</td>
                      <td className={`py-4 text-right ${m.status === 'minted' || m.status === 'printed' ? 'text-primary' : (m.status === 'pending' ? 'text-tertiary' : 'text-error')}`}>
                        [{m.status.toUpperCase()}]
                      </td>
                    </tr>
                  ))}
                  {mints.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-outline">NO_RECORDS_FOUND</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      <footer className="mt-20 text-outline text-xs text-center font-mono">
        <p>TERMINAL &middot; {NETWORK_NAME}</p>
      </footer>
      </main>
    </AccessControl>
  )
}
