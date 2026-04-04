import { createPublicClient, http, formatEther, parseAbi } from 'viem'
import { sepolia, mainnet } from 'viem/chains'

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID ?? '11155111')
const chain = CHAIN_ID === 1 ? mainnet : sepolia

const INSTALLATION_ABI = parseAbi([
  'function mintPrice() external view returns (uint256)',
  'function isPreSale() external view returns (bool)',
  'function endowmentBalance() external view returns (uint256)',
  'function artistBalance() external view returns (uint256)',
  'function galleryBalance() external view returns (uint256)',
])

export type ContractStats = {
  mintPriceEth: string
  endowmentBalanceEth: string
  artistBalanceEth: string
  galleryBalanceEth: string
  isPreSale: boolean
  revenueEth: string   // mintCount × mintPrice
}

export async function getContractStats(mintCount: number): Promise<ContractStats> {
  const installationAddress = process.env.NEXT_PUBLIC_INSTALLATION_CONTRACT_ADDRESS as `0x${string}`
  if (!installationAddress) throw new Error('NEXT_PUBLIC_INSTALLATION_CONTRACT_ADDRESS not set')

  const client = createPublicClient({ chain, transport: http() })

  const [mintPriceWei, preSale, endowmentWei, artistWei, galleryWei] = await Promise.all([
    client.readContract({ address: installationAddress, abi: INSTALLATION_ABI, functionName: 'mintPrice' }),
    client.readContract({ address: installationAddress, abi: INSTALLATION_ABI, functionName: 'isPreSale' }),
    client.readContract({ address: installationAddress, abi: INSTALLATION_ABI, functionName: 'endowmentBalance' }),
    client.readContract({ address: installationAddress, abi: INSTALLATION_ABI, functionName: 'artistBalance' }),
    client.readContract({ address: installationAddress, abi: INSTALLATION_ABI, functionName: 'galleryBalance' }),
  ])

  const revenueWei = (mintPriceWei as bigint) * BigInt(mintCount)

  return {
    mintPriceEth: formatEther(mintPriceWei as bigint),
    endowmentBalanceEth: formatEther(endowmentWei as bigint),
    artistBalanceEth: formatEther(artistWei as bigint),
    galleryBalanceEth: formatEther(galleryWei as bigint),
    isPreSale: preSale as boolean,
    revenueEth: formatEther(revenueWei),
  }
}
