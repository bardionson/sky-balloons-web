import { createPublicClient, http, formatEther, parseAbi } from 'viem'
import { sepolia, mainnet } from 'viem/chains'

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID ?? '11155111')
const chain = CHAIN_ID === 1 ? mainnet : sepolia

const INSTALLATION_ABI = parseAbi([
  'function mintPrice() external view returns (uint256)',
])

export async function getMintPriceEth(): Promise<string> {
  const address = process.env.NEXT_PUBLIC_INSTALLATION_CONTRACT_ADDRESS as `0x${string}`
  if (!address) throw new Error('NEXT_PUBLIC_INSTALLATION_CONTRACT_ADDRESS is not set')

  const client = createPublicClient({ chain, transport: http() })
  const wei = await client.readContract({
    address,
    abi: INSTALLATION_ABI,
    functionName: 'mintPrice',
  })
  const eth = formatEther(wei as bigint)
  if (eth === '0.0' || eth === '0') throw new Error('Mint price is not set on-chain')
  return eth
}
