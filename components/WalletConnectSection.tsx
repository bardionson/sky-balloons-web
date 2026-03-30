'use client'

import { useEffect } from 'react'
import { createThirdwebClient } from 'thirdweb'
import { ThirdwebProvider, ConnectButton, useActiveAccount } from 'thirdweb/react'
import { inAppWallet, createWallet } from 'thirdweb/wallets'

export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? '',
})

const wallets = [
  inAppWallet(),
  createWallet('com.coinbase.wallet'),   // Coinbase Smart Wallet
  createWallet('io.metamask'),           // MetaMask
  createWallet('com.trustwallet.app'),   // Trust Wallet
  createWallet('com.binance.wallet'),    // Binance Web3 Wallet
  createWallet('com.okex.wallet'),       // OKX Wallet (wallet ID is okex)
  createWallet('me.rainbow'),            // Rainbow
  createWallet('io.rabby'),              // Rabby
]

function Inner({ onAddress }: { onAddress: (addr: string) => void }) {
  const account = useActiveAccount()

  useEffect(() => {
    if (account?.address) onAddress(account.address)
  }, [account?.address, onAddress])

  return (
    <ConnectButton
      client={thirdwebClient}
      wallets={wallets}
      theme="dark"
    />
  )
}

export default function WalletConnectSection({
  onAddress,
}: {
  onAddress: (addr: string) => void
}) {
  return (
    <ThirdwebProvider>
      <Inner onAddress={onAddress} />
    </ThirdwebProvider>
  )
}
