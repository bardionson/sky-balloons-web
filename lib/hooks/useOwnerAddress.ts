'use client'

import { getContract } from 'thirdweb'
import { mainnet, sepolia } from 'thirdweb/chains'
import { useReadContract } from 'thirdweb/react'
import { ownerOf } from 'thirdweb/extensions/erc721'
import { thirdwebClient } from '@/components/WalletConnectSection'
import { DEED_CONTRACT_ADDRESS, DEED_TOKEN_ID } from '@/lib/project-config'

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID ?? '11155111')
const chain = CHAIN_ID === 1 ? mainnet : sepolia

const deedContract = getContract({
  client: thirdwebClient,
  address: DEED_CONTRACT_ADDRESS,
  chain,
})

export function useOwnerAddress(): { ownerAddress: string | undefined; isBlocked: boolean } {
  const { data, isPending, isError } = useReadContract(ownerOf, {
    contract: deedContract,
    tokenId: DEED_TOKEN_ID,
  })

  const isBlocked = isPending || isError
  const ownerAddress = data ? (data as string).toLowerCase() : undefined

  return { ownerAddress, isBlocked }
}
