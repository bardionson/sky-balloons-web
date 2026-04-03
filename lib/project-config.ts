/**
 * Central project-identity config.
 * All project-specific strings come from here — never hardcode them elsewhere.
 * To deploy as a test/obscured project, change the env vars in .env.local.
 */

export const PROJECT_NAME      = process.env.NEXT_PUBLIC_PROJECT_NAME      ?? 'Balloons in the Sky'
export const PROJECT_SYMBOL    = process.env.NEXT_PUBLIC_PROJECT_SYMBOL    ?? 'BSKY'
export const ARTIST_NAME       = process.env.NEXT_PUBLIC_ARTIST_NAME       ?? 'Bård Ionson & Jennifer Ionson'
export const NFT_LICENSE       = process.env.NEXT_PUBLIC_NFT_LICENSE       ?? 'CC BY-NC 4.0'
export const EXPLORER_BASE     = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ?? 'https://sepolia.etherscan.io'
export const NETWORK_NAME      = process.env.NEXT_PUBLIC_NETWORK_NAME      ?? 'Sepolia testnet'
export const NFT_ITEM_LABEL    = process.env.NEXT_PUBLIC_NFT_ITEM_LABEL    ?? 'Balloon'
export const NFT_SUCCESS_EMOJI = process.env.NEXT_PUBLIC_NFT_SUCCESS_EMOJI ?? '🎈'
if (!process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS) {
  throw new Error('NEXT_PUBLIC_DEED_CONTRACT_ADDRESS is not set')
}
export const DEED_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DEED_CONTRACT_ADDRESS as `0x${string}`
export const DEED_TOKEN_ID = 0n
export const ARTIST_ADDRESS    = process.env.NEXT_PUBLIC_ARTIST_ADDRESS?.toLowerCase() ?? ''
