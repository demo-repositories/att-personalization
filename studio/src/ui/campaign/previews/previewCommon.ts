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

interface VariationWithWeb {
  channel?: string
  segment?: string
  flowStep?: string
  web?: {heroImage?: {asset?: {_ref?: string} | null; alt?: string}; [key: string]: unknown}
}

/** Pull the web hero image from the sibling web variation for the same cell row. */
export function webHeroForCell(
  variations: VariationWithWeb[],
  segment: string,
  flowStep: string,
): {asset?: {_ref?: string} | null; alt?: string} | undefined {
  const step = flowStep || 'default'
  const webVar = variations.find(
    (v) =>
      v.channel === 'web' &&
      v.segment === segment &&
      (v.flowStep ?? 'default') === step,
  )
  return webVar?.web?.heroImage
}
