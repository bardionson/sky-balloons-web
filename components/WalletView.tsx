'use client'

import { getContract } from 'thirdweb'
import { ethereum } from 'thirdweb/chains'
import { ThirdwebProvider, ConnectButton, useActiveAccount, useReadContract } from 'thirdweb/react'
import { getOwnedNFTs } from 'thirdweb/extensions/erc721'
import { thirdwebClient } from './WalletConnectSection'
import IpfsImage from './IpfsImage'

const NFT_ADDRESS = process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS
if (!NFT_ADDRESS) throw new Error('NEXT_PUBLIC_BALLOONS_NFT_ADDRESS is not set')

const contract = getContract({
  client: thirdwebClient,
  address: NFT_ADDRESS as `0x${string}`,
  chain: ethereum,
})

function WalletViewInner() {
  const account = useActiveAccount()

  const { data: ownedNFTs, isLoading } = useReadContract(getOwnedNFTs, {
    contract,
    owner: account?.address ?? '0x0',
    queryOptions: { enabled: !!account?.address },
  })

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <ConnectButton client={thirdwebClient} theme="dark" />

      {account && isLoading && (
        <p className="text-white/40 text-sm">Loading your collection…</p>
      )}

      {account && !isLoading && (!ownedNFTs || ownedNFTs.length === 0) && (
        <div className="text-center">
          <p className="text-white/40 text-sm">No Balloons found in this wallet.</p>
          <p className="text-white/20 text-xs mt-2 font-mono">{account.address}</p>
        </div>
      )}

      {account && !isLoading && ownedNFTs && ownedNFTs.length > 0 && (
        <div className="flex flex-col gap-4 w-full">
          <p className="text-white/30 text-xs font-mono text-center truncate">{account.address}</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {ownedNFTs.map((nft) => {
              const cid = (nft.metadata.image as string ?? '').replace('ipfs://', '')
              return (
                <div
                  key={nft.id.toString()}
                  className="rounded-xl overflow-hidden bg-white/5 border border-white/10"
                >
                  <IpfsImage
                    cid={cid}
                    alt={nft.metadata.name ?? ''}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="p-3">
                    <p className="text-white text-sm font-medium">{nft.metadata.name}</p>
                    <p className="text-white/40 text-xs mt-1">Token #{nft.id.toString()}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WalletView() {
  return (
    <ThirdwebProvider>
      <WalletViewInner />
    </ThirdwebProvider>
  )
}
