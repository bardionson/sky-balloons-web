import { describe, it, expect } from 'vitest'
import { buildMetadataUri } from '../metadata'
import { PROJECT_NAME, ARTIST_NAME, NFT_LICENSE } from '../project-config'
import type { InstallationSubmitBody } from '../db/types'

const BASE_PARAMS: InstallationSubmitBody = {
  cid: 'QmTestCid123',
  unique_name: 'Drifting Over Azure',
  unit_number: 42,
  seed: 839201,
  timestamp: '16/03/2026 14:32 CET',
  orientation: 0,
  imagination: 75,
  event_name: 'NFC Lisbon 2026',
  type: 'Standard',
  pixel_dimensions: '1920x1080',
}

function decodeUri(uri: string): Record<string, unknown> {
  const base64 = uri.replace('data:application/json;base64,', '')
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

describe('buildMetadataUri', () => {
  it('returns a data URI with correct MIME type', () => {
    const uri = buildMetadataUri(BASE_PARAMS)
    expect(uri).toMatch(/^data:application\/json;base64,/)
  })

  it('encodes the correct name including unit number and unique name', () => {
    const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
    expect(meta.name).toBe(`${PROJECT_NAME} #42 \u2014 Drifting Over Azure`)
  })

  it('sets image to ipfs:// URI using the CID', () => {
    const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
    expect(meta.image).toBe('ipfs://QmTestCid123')
  })

  it('includes description and license from project config', () => {
    const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
    expect(meta.description).toBe(`${PROJECT_NAME} by ${ARTIST_NAME}`)
    expect(meta.license).toBe(NFT_LICENSE)
  })

  it('renders orientation 0 as Portrait', () => {
    const meta = decodeUri(buildMetadataUri({ ...BASE_PARAMS, orientation: 0 }))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Orientation')
    expect(attr?.value).toBe('Portrait')
  })

  it('renders orientation 1 as Landscape', () => {
    const meta = decodeUri(buildMetadataUri({ ...BASE_PARAMS, orientation: 1 }))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Orientation')
    expect(attr?.value).toBe('Landscape')
  })

  it('formats imagination 75 as "0.75"', () => {
    const meta = decodeUri(buildMetadataUri({ ...BASE_PARAMS, imagination: 75 }))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Imagination')
    expect(attr?.value).toBe('0.75')
  })

  it('formats negative imagination -150 as "-1.50"', () => {
    const meta = decodeUri(buildMetadataUri({ ...BASE_PARAMS, imagination: -150 }))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Imagination')
    expect(attr?.value).toBe('-1.50')
  })

  it('includes all 8 expected attributes', () => {
    const meta = decodeUri(buildMetadataUri(BASE_PARAMS))
    const traits = (meta.attributes as Array<{ trait_type: string }>)
      .map(a => a.trait_type)
    expect(traits).toEqual([
      'Unit Number', 'Seed', 'Orientation', 'Imagination',
      'Event', 'Timestamp', 'Type', 'Pixel Dimensions',
    ])
  })

  it('defaults type to Standard when not provided', () => {
    const params = { ...BASE_PARAMS }
    delete (params as Partial<InstallationSubmitBody>).type
    const meta = decodeUri(buildMetadataUri(params))
    const attr = (meta.attributes as Array<{ trait_type: string; value: unknown }>)
      .find(a => a.trait_type === 'Type')
    expect(attr?.value).toBe('Standard')
  })
})
