import { createWalletClient, createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia, mainnet } from 'viem/chains'

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_PAYMENT_CHAIN_ID ?? '11155111')
const chain = CHAIN_ID === 1 ? mainnet : sepolia

const NFT_ABI = parseAbi([
  'function mint(address to, string memory _uri) external',
])

// ERC721 Transfer event topic (keccak256 of "Transfer(address,address,uint256)")
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export async function mintOnChain(
  to: string,
  uri: string
): Promise<{ tokenId: string; txHash: string }> {
  const privateKey = process.env.MINTER_PRIVATE_KEY
  if (!privateKey) throw new Error('MINTER_PRIVATE_KEY is not set')

  const contractAddress = process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS as `0x${string}`
  if (!contractAddress) throw new Error('NEXT_PUBLIC_BALLOONS_NFT_ADDRESS is not set')

  const account = privateKeyToAccount(privateKey as `0x${string}`)

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  })

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  })

  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: NFT_ABI,
    functionName: 'mint',
    args: [to as `0x${string}`, uri],
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash })

  // Extract token ID from ERC721 Transfer event emitted during mint
  // Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
  const transferLog = receipt.logs.find(
    (log) => log.topics[0] === TRANSFER_TOPIC
  )
  const tokenId = transferLog?.topics[3]
    ? BigInt(transferLog.topics[3]).toString()
    : '0'

  return { tokenId, txHash: hash }
}
