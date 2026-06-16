import type {MergeFieldDoc} from './types'

export interface TokenInfo {
  key: string
  source: 'sanity' | 'external' | 'unresolved'
  sampleValue?: string
  label?: string
}

/**
 * Build a token info map for preview rendering.
 *
 * Mirrors the resolution rules in studio/src/personalization/generate/tokens.ts:
 *   - source 'external'  → sampleValue (the merge field's sample)
 *   - source 'sanity'    → sampleValue (we approximate in preview; real merge
 *                                       happens at send time)
 *   - special: when a brief has featuredProduct, product.* tokens
 *              flip to Sanity-resolved (preview-only mock: still uses sampleValue).
 *   - {{offer.amount}}   → brief.offer if set, else sampleValue
 */
export function buildTokenMap(
  mergeFields: MergeFieldDoc[],
  opts: {offer?: string; featuredProductRef?: string; product?: {name?: string; price?: string}},
): Record<string, TokenInfo> {
  const out: Record<string, TokenInfo> = {}
  for (const mf of mergeFields) {
    let sample = mf.sampleValue
    let source: TokenInfo['source'] = mf.source

    if (mf.key === 'offer.amount' && opts.offer) {
      sample = opts.offer
      source = 'sanity'
    }
    if (mf.key.startsWith('product.') && opts.featuredProductRef && opts.product) {
      // featuredProduct flip — Sanity-resolved
      const field = mf.key.split('.')[1]
      if (field === 'name' && opts.product.name) sample = opts.product.name
      else if (field === 'price' && opts.product.price) sample = opts.product.price
      source = 'sanity'
    }
    out[mf.key] = {key: mf.key, source, sampleValue: sample, label: mf.label}
  }
  return out
}
