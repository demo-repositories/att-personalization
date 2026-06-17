import {describe, expect, it} from 'vitest'
import {
  formatAllowedMediaForPrompt,
  heroImageFromMedia,
  pickAllowedMedia,
} from './allowedMedia'

const items = [
  {_id: 'media-a', title: '5G family', assetRef: 'image-aaa', description: 'Outdoor family'},
  {_id: 'media-b', title: 'Phone close-up', assetRef: 'image-bbb', alt: 'Phone'},
  {_id: 'media-c', title: 'No asset'},
]

describe('pickAllowedMedia', () => {
  it('returns undefined for empty list', () => {
    expect(pickAllowedMedia([], 'new', 'default')).toBeUndefined()
  })

  it('is deterministic for the same segment/step', () => {
    const a = pickAllowedMedia(items, 'loyal', 'default')
    const b = pickAllowedMedia(items, 'loyal', 'default')
    expect(a).toBe(b)
  })

  it('can vary by segment', () => {
    const picks = new Set(['new', 'loyal', 'business', 'value'].map((s) => pickAllowedMedia(items, s, 'default')?._id))
    expect(picks.size).toBeGreaterThan(1)
  })
})

describe('formatAllowedMediaForPrompt', () => {
  it('lists only items with assetRef', () => {
    const out = formatAllowedMediaForPrompt(items)
    expect(out).toContain('image-aaa')
    expect(out).toContain('image-bbb')
    expect(out).not.toContain('media-c')
  })
})

describe('heroImageFromMedia', () => {
  it('builds a Sanity image object', () => {
    expect(heroImageFromMedia(items[1]!)).toEqual({
      _type: 'image',
      asset: {_type: 'reference', _ref: 'image-bbb'},
      alt: 'Phone',
    })
  })
})
