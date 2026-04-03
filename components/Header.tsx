'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PROJECT_NAME, ARTIST_ADDRESS } from '@/lib/project-config'
import { createThirdwebClient } from 'thirdweb'
import { ConnectButton, useActiveAccount } from 'thirdweb/react'
import { inAppWallet, createWallet } from 'thirdweb/wallets'

const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? '',
})

const wallets = [
  inAppWallet(),
  createWallet('com.coinbase.wallet'),
  createWallet('io.metamask'),
]

export default function Header() {
  const pathname = usePathname()
  const account = useActiveAccount()

  const links = [
    { label: 'GALLERY', href: '/' },
    { label: 'WALLET', href: '/wallet' },
  ]
  
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev || (account?.address && account.address.toLowerCase() === ARTIST_ADDRESS)) {
    links.push({ label: 'OPS', href: '/artist' })
  }
  
  return (
    <header className="sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-md border-b border-outline_variant/30 flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-8">
        <Link href="/" className="font-display font-bold text-on_surface tracking-tight hover:text-primary transition-colors">
          {PROJECT_NAME}
        </Link>
        <nav className="hidden md:flex gap-6">
          {links.map(link => {
            const isActive = pathname === link.href
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={`font-mono text-[10px] tracking-widest ${isActive ? 'text-tertiary border-b border-tertiary/50 pb-1' : 'text-outline hover:text-on_surface_variant transition-colors'}`}
              >
                [{link.label}]
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Mobile menu trigger could go here */}
        <ConnectButton
          client={thirdwebClient}
          wallets={wallets}
          theme="dark"
          connectButton={{ className: "!bg-surface_container_highest !text-[10px] !font-mono !text-primary !border !border-outline_variant/30 !rounded-sm !py-2 !px-4 hover:!bg-surface_container_low !h-auto !min-w-0" }}
        />
      </div>
    </header>
  )
}
