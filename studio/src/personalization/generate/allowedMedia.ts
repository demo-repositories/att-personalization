// Helpers for brief-scoped media library enforcement during Generate.

export interface AllowedMediaItem {
  _id: string
  title?: string
  description?: string
  alt?: string
  assetRef?: string
  /** Direct CDN URL for assets curated from the Sanity Media Library. */
  url?: string
}

/** An asset is usable as a hero if it has either a project ref or an ML URL. */
export function hasMediaSource(m: AllowedMediaItem): boolean {
  return Boolean(m.assetRef || m.url)
}

/** Stable pick so the same cell always gets the same asset on re-run. */
export function pickAllowedMedia(
  items: AllowedMediaItem[],
  segmentKey: string,
  stepKey: string,
): AllowedMediaItem | undefined {
  if (items.length === 0) return undefined
  const seed = `${stepKey}:${segmentKey}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return items[hash % items.length]
}

export function formatAllowedMediaForPrompt(items: AllowedMediaItem[]): string {
  return items
    .filter(hasMediaSource)
    .map(
      (m, i) =>
        `${i + 1}. "${m.title ?? m._id}" (assetId: ${m.assetRef ?? m.url})${m.description ? ` — ${m.description}` : ''}`,
    )
    .join('\n')
}

export function heroImageFromMedia(item: AllowedMediaItem): Record<string, unknown> | null {
  // Media Library asset — no project ref, so carry the CDN URL directly.
  if (item.url) {
    return {
      _type: 'image',
      url: item.url,
      alt: item.alt || item.title || '',
    }
  }
  if (!item.assetRef) return null
  return {
    _type: 'image',
    asset: {_type: 'reference', _ref: item.assetRef},
    alt: item.alt || item.title || '',
  }
}

export function allowedAssetRefs(items: AllowedMediaItem[]): Set<string> {
  return new Set(items.map((m) => m.assetRef).filter(Boolean) as string[])
}
