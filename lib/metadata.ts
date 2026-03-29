import type { InstallationSubmitBody } from './db/types'
import { PROJECT_NAME, ARTIST_NAME, NFT_LICENSE } from './project-config'

function formatImagination(imagination: number): string {
  const val = imagination / 100
  const sign = val < 0 ? '-' : ''
  const abs = Math.abs(val)
  return `${sign}${abs.toFixed(2)}`
}

/**
 * Assemble NFT metadata JSON from GAN parameters and return a
 * data:application/json;base64 string for use as the `_uri` argument
 * to BalloonsNFT.mint(address to, string _uri).
 */
export function buildMetadataUri(params: InstallationSubmitBody): string {
  const metadata = {
    name: `${PROJECT_NAME} #${params.unit_number} \u2014 ${params.unique_name}`,
    description: `${PROJECT_NAME} by ${ARTIST_NAME}`,
    image: `ipfs://${params.cid}`,
    license: NFT_LICENSE,
    attributes: [
      { trait_type: 'Unit Number',      value: params.unit_number },
      { trait_type: 'Seed',             value: params.seed },
      { trait_type: 'Orientation',      value: params.orientation === 0 ? 'Portrait' : 'Landscape' },
      { trait_type: 'Imagination',      value: formatImagination(params.imagination) },
      { trait_type: 'Event',            value: params.event_name },
      { trait_type: 'Timestamp',        value: params.timestamp },
      { trait_type: 'Type',             value: params.type ?? 'Standard' },
      { trait_type: 'Pixel Dimensions', value: params.pixel_dimensions ?? '1920x1080' },
    ],
  }

  const json = JSON.stringify(metadata)
  const base64 = Buffer.from(json).toString('base64')
  return `data:application/json;base64,${base64}`
}
