import type { Metadata } from 'next'
import { sql } from '@/lib/db/server'
import type { Mint, Setting } from '@/lib/db/types'
import { PROJECT_NAME, NETWORK_NAME } from '@/lib/project-config'
import AccessControl from '@/components/AccessControl'
import { getContractStats } from '@/lib/chain/stats'

export const metadata: Metadata = {
  title: `${PROJECT_NAME} — Owner Control Center`,
  description: `Global Administrative Terminal`,
}

export default async function OwnerDashboardPage() {
  const mints = await sql`SELECT * FROM mints ORDER BY created_at DESC LIMIT 10` as Mint[]
  const settings = await sql`SELECT * FROM settings` as Setting[]

  const totalMintsRows = await sql`SELECT COUNT(*) as count FROM mints WHERE status IN ('minted','printed')` as { count: string }[]
  const totalMints = parseInt(totalMintsRows[0]?.count || '0', 10)

  const stats = await getContractStats(totalMints)
  
  return (
    <AccessControl requiredRole="owner">
      <main className="min-h-screen bg-surface flex flex-col relative overflow-hidden pb-16">
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-tr from-error/5 via-surface to-surface pointer-events-none blur-[120px] -z-10" />

      <div className="w-full pt-16 pb-8 pl-8 md:pl-24 relative border-b border-error/20 mb-8">
        <p className="font-mono text-error text-xs tracking-widest uppercase mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-error shadow-[0_0_8px_rgba(255,180,171,0.8)] animate-pulse" />
          OWNER_AUTHORIZATION_REQUIRED
        </p>
        <h1 className="font-display text-5xl md:text-6xl font-bold text-on_surface tracking-tight mb-2">
          SYS_CONTROL_CENTER
        </h1>
        <p className="font-mono text-[10px] text-error uppercase tracking-wider">
          AUTH_LEVEL: ROOT_ADMIN // CAUTION: LIVE_ENVIRONMENT
        </p>
      </div>

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Analytics Column */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bg-surface_container p-8 rounded-sm shadow-inner border border-error/15 relative">
             <div className="absolute top-4 right-4 font-mono text-[10px] text-error">
               {stats.isPreSale ? 'PRE_SALE' : 'POST_SALE'}
             </div>
             <h3 className="font-mono text-xs text-outline mb-6 border-b border-outline_variant/30 pb-2">GLOBAL_METRICS</h3>

             <div className="flex flex-col gap-1 mb-6 border-l-2 border-error/50 pl-4 bg-error/5 p-4">
               <span className="font-mono text-[10px] text-error">REVENUE_ETH (MINTS × PRICE)</span>
               <span className="font-display text-4xl text-on_surface">Ξ{stats.revenueEth}</span>
             </div>

             <div className="flex flex-col gap-1 mb-6">
               <span className="font-mono text-[10px] text-on_surface_variant">ENDOWMENT_POOL (COLLECTOR)</span>
               <span className="font-display text-2xl text-tertiary">Ξ{stats.endowmentBalanceEth}</span>
             </div>

             <div className="flex flex-col gap-1 mb-6">
               <span className="font-mono text-[10px] text-on_surface_variant">GALLERY_BALANCE</span>
               <span className="font-display text-xl text-on_surface_variant">Ξ{stats.galleryBalanceEth}</span>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-1">
                 <span className="font-mono text-[10px] text-on_surface_variant">TOTAL_MINTS</span>
                 <span className="font-display text-2xl text-on_surface">{totalMints}</span>
               </div>
               <div className="flex flex-col gap-1">
                 <span className="font-mono text-[10px] text-on_surface_variant">MINT_PRICE</span>
                 <span className="font-display text-2xl text-primary">Ξ{stats.mintPriceEth}</span>
               </div>
             </div>
          </div>
          
          <div className="bg-surface_container_highest p-8 rounded-sm shadow-inner border border-outline_variant/15">
             <h3 className="font-mono text-xs text-outline mb-6 border-b border-outline_variant/30 pb-2">GLOBAL_CONFIGURATIONS</h3>
             <ul className="flex flex-col gap-4">
               {settings.map(s => (
                 <li key={s.id} className="flex flex-col border-b border-outline_variant/10 pb-2">
                   <span className="font-mono text-[10px] text-tertiary">{s.key.toUpperCase()}</span>
                   <span className="font-sans text-sm text-on_surface_variant truncate">{s.value}</span>
                 </li>
               ))}
               {settings.length === 0 && <span className="font-mono text-xs text-outline">NO_CONFIGS_DETECTED</span>}
             </ul>
          </div>
        </div>

        {/* Global Mints/Transactions */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-surface_container_low p-8 rounded-sm shadow-[0_0_40px_rgba(255,180,171,0.02)] border border-outline_variant/15 h-full relative">
            
            {/* Owner Watermark */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-5">
              <span className="font-display text-[150px] text-error font-bold leading-none tracking-tighter">ROOT</span>
            </div>

            <div className="flex justify-between items-end border-b border-outline_variant/30 pb-4 mb-6 relative z-10">
              <h3 className="font-mono text-xs text-on_surface">GLOBAL_LEDGER_STREAM</h3>
              <div className="font-mono text-outline text-[10px]">LATEST ACTIVITY</div>
            </div>

            <div className="overflow-x-auto relative z-10">
              <table className="w-full text-left font-mono text-xs text-on_surface_variant">
                <thead>
                  <tr className="border-b border-outline_variant/20">
                    <th className="pb-3 text-outline">TX_ID</th>
                    <th className="pb-3 text-outline">IDENTIFIER</th>
                    <th className="pb-3 text-outline">WALLET</th>
                    <th className="pb-3 text-outline text-right">STATE</th>
                  </tr>
                </thead>
                <tbody>
                  {mints.map((m) => (
                    <tr key={m.id} className="border-b border-outline_variant/10 hover:bg-error/5 transition-colors group cursor-pointer">
                      <td className="py-4 text-outline/50">#{m.id.substring(0,6)}..</td>
                      <td className="py-4 text-on_surface group-hover:text-primary transition-colors">{m.unique_name}</td>
                      <td className="py-4 text-outline/50 truncate max-w-[120px]">{m.collector_id || 'ANONYMOUS'}</td>
                      <td className={`py-4 text-right ${m.status === 'minted' || m.status === 'printed' ? 'text-primary' : (m.status === 'pending' ? 'text-tertiary' : 'text-error')}`}>
                        [{m.status.toUpperCase()}]
                      </td>
                    </tr>
                  ))}
                  {mints.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-outline">NO_GLOBAL_RECORDS</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
          </div>
        </div>

      </div>

      <footer className="mt-20 text-outline text-xs text-center font-mono">
        <p>ROOT_OWNER_TERMINAL &middot; {NETWORK_NAME}</p>
      </footer>
      </main>
    </AccessControl>
  )
}
