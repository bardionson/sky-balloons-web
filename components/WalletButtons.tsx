'use client'

interface Props {
  mintUrl: string
}

function walletDeepLink(wallet: string, mintUrl: string): string {
  const encoded = encodeURIComponent(mintUrl)
  const host = mintUrl.replace(/^https?:\/\//, '').split('?')[0]

  switch (wallet) {
    case 'metamask':
      return `https://metamask.app.link/dapp/${host}`
    case 'coinbase':
      return `https://go.cb-wallet.com/dapp?url=${encoded}`
    case 'rabby':
      // Note: verify this deep link format before shipping — Rabby Mobile docs are sparse
      return `https://link.rabby.io/dapp?url=${encoded}`
    case 'rainbow':
      return `https://rnbwapp.com/dapp?url=${encoded}`
    default:
      return mintUrl
  }
}

const WALLETS = [
  { key: 'metamask', label: '🦊 MetaMask' },
  { key: 'coinbase', label: '🔵 Coinbase' },
  { key: 'rabby',    label: '🐰 Rabby' },
  { key: 'rainbow',  label: '🌈 Rainbow' },
]

export default function WalletButtons({ mintUrl }: Props) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <p className="text-white/50 text-xs text-center">Open in your wallet browser</p>
      <div className="grid grid-cols-2 gap-2">
        {WALLETS.map(({ key, label }) => (
          <a
            key={key}
            href={walletDeepLink(key, mintUrl)}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white text-center hover:bg-white/10 transition-colors"
          >
            {label}
          </a>
        ))}
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/40 text-center col-span-2">
          🔗 Other Wallet — use the checkout form below (WalletConnect)
        </p>
      </div>
      <p className="text-white/30 text-xs text-center">
        ── or pay with card / Apple Pay below ──
      </p>
    </div>
  )
}
