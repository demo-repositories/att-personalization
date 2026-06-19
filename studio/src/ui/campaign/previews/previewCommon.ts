import type {CSSProperties} from 'react'

/** Shared layout constraints so matrix cells render identically in Studio + App SDK. */
export const previewCardStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  overflow: 'hidden',
}

export const previewTextFlow: CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  lineHeight: 1.5,
}

interface HeroImageRef {
  asset?: {_ref?: string} | null
  /** Direct CDN URL for assets curated from the Sanity Media Library. */
  url?: string
  alt?: string
}

interface VariationWithWeb {
  channel?: string
  segment?: string
  flowStep?: string
  web?: {heroImage?: HeroImageRef; [key: string]: unknown}
}

/**
 * Pull the web hero image for a cell. Prefers the same-step web sibling, but
 * falls back to any web hero for the same segment (e.g. the first step's) so
 * that in multistep flows every step's email still shows the brand image even
 * when that step has no web variation of its own.
 */
export function webHeroForCell(
  variations: VariationWithWeb[],
  segment: string,
  flowStep: string,
): HeroImageRef | undefined {
  const step = flowStep || 'default'
  const hasHero = (v: VariationWithWeb): boolean =>
    Boolean(v.web?.heroImage?.url || v.web?.heroImage?.asset?._ref)
  const segmentWebVars = variations.filter((v) => v.channel === 'web' && v.segment === segment)

  const sameStep = segmentWebVars.find((v) => (v.flowStep ?? 'default') === step)
  if (sameStep && hasHero(sameStep)) return sameStep.web?.heroImage

  // No usable hero on this step — reuse another step's web hero for this segment.
  const fallback = segmentWebVars.find(hasHero)
  return (fallback ?? sameStep)?.web?.heroImage
}
