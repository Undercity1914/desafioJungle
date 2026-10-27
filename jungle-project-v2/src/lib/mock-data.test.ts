import { describe, expect, it } from 'vitest'

import { nftCatalog } from './mock-data'

describe('NFT artwork catalog', () => {
  it('uses a distinct image for every catalog item', () => {
    const imageUrls = nftCatalog.map((nft) => nft.image)

    expect(nftCatalog).toHaveLength(13)
    expect(new Set(imageUrls).size).toBe(imageUrls.length)
  })
})
