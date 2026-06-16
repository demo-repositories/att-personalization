import {describe, expect, it, vi} from 'vitest'
import {extractTokens, resolveTokens, tokenChipMeta} from './tokens'
import type {MergeField} from './tokens'

const registry: MergeField[] = [
  {key: 'product.name', source: 'external', sampleValue: 'iPhone 16 Pro', sanityResolver: 'featuredProduct->name'},
  {key: 'product.price', source: 'external', sampleValue: '$29.99/mo', sanityResolver: 'featuredProduct->price'},
  {key: 'cart.recoveryUrl', source: 'external', sampleValue: 'https://www.att.com/cart/abc123'},
  {key: 'offer.amount', source: 'sanity', sanityResolver: 'offer'},
]

describe('extractTokens', () => {
  it('finds every {{key}} occurrence', () => {
    const text = 'Buy {{product.name}} for {{product.price}}. Cart: {{cart.recoveryUrl}}'
    const found = extractTokens(text).map((t) => t.key)
    expect(found).toEqual(['product.name', 'product.price', 'cart.recoveryUrl'])
  })

  it('returns empty array when no tokens present', () => {
    expect(extractTokens('plain text')).toEqual([])
  })
})

describe('resolveTokens', () => {
  it('resolves external tokens from sampleValue', async () => {
    const out = await resolveTokens('Buy {{product.name}} now', {
      brief: {},
      mergeFields: registry,
    })
    expect(out).toBe('Buy iPhone 16 Pro now')
  })

  it('resolves Sanity field-path resolvers from the brief', async () => {
    const out = await resolveTokens('Save {{offer.amount}}', {
      brief: {offer: '$30/mo off for 12 months'},
      mergeFields: registry,
    })
    expect(out).toBe('Save $30/mo off for 12 months')
  })

  it('leaves unresolved tokens as literal {{key}} chips', async () => {
    const out = await resolveTokens('Hello {{customer.firstName}}', {
      brief: {},
      mergeFields: registry,
    })
    expect(out).toBe('Hello {{customer.firstName}}')
  })

  it('featuredProduct flip: product.* tokens resolve from Sanity product doc', async () => {
    const client = {
      fetch: vi.fn(async (_q: string, params?: Record<string, unknown>) => {
        // Verifies we deref via params.id matching the product ref.
        expect(params).toEqual({id: 'product-iphone16pro'})
        return {name: 'iPhone 16 Pro (from Sanity)', price: '$29.99/mo (Sanity)'}
      }),
    }
    const out = await resolveTokens('Buy {{product.name}} for {{product.price}}', {
      brief: {featuredProduct: {_ref: 'product-iphone16pro'}},
      mergeFields: registry,
      client,
    })
    expect(out).toBe('Buy iPhone 16 Pro (from Sanity) for $29.99/mo (Sanity)')
    // Two product.* tokens but the dereffed doc is fetched once per token key.
    expect(client.fetch).toHaveBeenCalledTimes(2)
  })

  it('falls back to literal {{key}} if Sanity resolve returns null', async () => {
    const client = {fetch: vi.fn(async () => null)}
    const out = await resolveTokens('Buy {{product.name}}', {
      brief: {featuredProduct: {_ref: 'product-missing'}},
      mergeFields: registry,
      client,
    })
    expect(out).toBe('Buy {{product.name}}')
  })
})

describe('tokenChipMeta', () => {
  it('reports the registry source for ordinary tokens', () => {
    expect(tokenChipMeta('product.name', registry).source).toBe('external')
    expect(tokenChipMeta('offer.amount', registry).source).toBe('sanity')
  })

  it('reports unresolved for unknown tokens', () => {
    expect(tokenChipMeta('customer.firstName', registry).source).toBe('unresolved')
  })

  it('flips product.* to sanity when brief.featuredProduct is set', () => {
    const meta = tokenChipMeta('product.name', registry, {featuredProduct: {_ref: 'product-iphone16pro'}})
    expect(meta.source).toBe('sanity')
    expect(meta.resolverHint).toBe('featuredProduct->name')
  })

  it('does NOT flip product.* when brief has no featuredProduct', () => {
    const meta = tokenChipMeta('product.name', registry, {})
    expect(meta.source).toBe('external')
  })
})
