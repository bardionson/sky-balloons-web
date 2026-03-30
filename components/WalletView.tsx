'use client'

import { useState, useEffect } from 'react'
import { getContract } from 'thirdweb'
import { ethereum } from 'thirdweb/chains'
import { ThirdwebProvider, ConnectButton, useActiveAccount, useReadContract, useSendTransaction } from 'thirdweb/react'
import { getOwnedNFTs, transferFrom } from 'thirdweb/extensions/erc721'
import { thirdwebClient } from './WalletConnectSection'
import IpfsImage from './IpfsImage'

const NFT_ADDRESS = process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS
if (!NFT_ADDRESS) throw new Error('NEXT_PUBLIC_BALLOONS_NFT_ADDRESS is not set')

const contract = getContract({
  client: thirdwebClient,
  address: NFT_ADDRESS as `0x${string}`,
  chain: ethereum,
})

type TransferState = {
  tokenId: bigint
  status: 'open' | 'pending'
  address: string
  error?: string
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr) && addr !== ZERO_ADDRESS
}

function WalletViewInner() {
  const account = useActiveAccount()
  const [transfer, setTransfer] = useState<TransferState | null>(null)

  const { data: ownedNFTs, isLoading, refetch } = useReadContract(getOwnedNFTs, {
    contract,
    owner: account?.address ?? '0x0',
    queryOptions: { enabled: !!account?.address },
  })

  const { mutate: sendTx } = useSendTransaction()

  // Detect wallet disconnect during pending transfer
  useEffect(() => {
    if (!account && transfer?.status === 'pending') {
      setTransfer(prev => prev ? { ...prev, status: 'open', error: 'Wallet disconnected.' } : null)
    }
  }, [account, transfer?.status])

  const anyPending = transfer?.status === 'pending'

  function openTransfer(tokenId: bigint) {
    if (anyPending) return
    setTransfer({ tokenId, status: 'open', address: '' })
  }

  function handleSend(tokenId: bigint) {
    if (!account) return
    const addr = transfer?.address ?? ''
    if (!isValidAddress(addr)) {
      setTransfer(prev => prev ? { ...prev, error: 'Invalid address' } : null)
      return
    }
    setTransfer(prev => prev ? { ...prev, status: 'pending', error: undefined } : null)
    const tx = transferFrom({
      contract,
      from: account!.address as `0x${string}`,
      to: addr as `0x${string}`,
      tokenId,
    })
    sendTx(tx as Parameters<typeof sendTx>[0], {
      onSuccess: () => { setTransfer(null); refetch() },
      onError: (e: Error) =>
        setTransfer(prev => prev ? { ...prev, status: 'open', error: e.message || 'Transfer failed.' } : null),
    })
  }

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
              const isThisCard = transfer?.tokenId === nft.id
              const cardStatus = isThisCard ? transfer!.status : null

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

                    {cardStatus === null && (
                      <button
                        onClick={() => openTransfer(nft.id)}
                        disabled={anyPending}
                        className="mt-2 text-xs text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Transfer
                      </button>
                    )}

                    {cardStatus === 'open' && (
                      <div className="mt-2 flex flex-col gap-2">
                        <input
                          type="text"
                          value={transfer?.address ?? ''}
                          onChange={(e) =>
                            setTransfer(prev => prev ? { ...prev, address: e.target.value, error: undefined } : null)
                          }
                          placeholder="0x..."
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white placeholder-white/20"
                        />
                        {transfer?.error && (
                          <p className="text-red-400 text-xs">{transfer.error}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSend(nft.id)}
                            className="text-xs text-white/70 hover:text-white border border-white/20 rounded px-2 py-1"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => setTransfer(null)}
                            className="text-xs text-white/40 hover:text-white/60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {cardStatus === 'pending' && (
                      <div className="mt-2 flex flex-col gap-2">
                        <input
                          type="text"
                          value={transfer?.address ?? ''}
                          disabled
                          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white/40"
                        />
                        <button
                          disabled
                          className="text-xs text-white/30 border border-white/10 rounded px-2 py-1 cursor-not-allowed"
                        >
                          Sending…
                        </button>
                      </div>
                    )}
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
