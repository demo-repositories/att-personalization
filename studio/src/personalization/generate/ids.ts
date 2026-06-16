// studio/src/personalization/generate/ids.ts
//
// Pure: deterministic _id for a contentVariation cell.
// Re-runs of generateMatrix produce the SAME id set → createOrReplace overwrites cleanly.

export type ChannelKey = 'web' | 'email' | 'sms'

const PREFIX = 'variation'

/** Strip any `drafts.` prefix so a draft brief and its published twin share variation ids. */
function stripDrafts(briefId: string): string {
  return briefId.startsWith('drafts.') ? briefId.slice('drafts.'.length) : briefId
}

/**
 * variationId — deterministic id for a single cell.
 *
 * Promotional briefs use `stepKey = 'default'`. Abandoned-cart briefs pass the
 * `flowStep.stepKey` (e.g. `reminder`, `incentive`, `urgency`).
 *
 * Format: `variation.${briefId}.${stepKey}.${channelKey}.${segmentKey}`
 */
export function variationId(
  briefId: string,
  stepKey: string,
  channelKey: ChannelKey,
  segmentKey: string,
): string {
  const cleanBrief = stripDrafts(briefId)
  return [PREFIX, cleanBrief, stepKey, channelKey, segmentKey].join('.')
}

export interface ParsedVariationId {
  briefId: string
  stepKey: string
  channelKey: ChannelKey
  segmentKey: string
}

/** Inverse of variationId. Throws on a malformed id. */
export function parseVariationId(id: string): ParsedVariationId {
  const parts = id.split('.')
  if (parts.length < 5 || parts[0] !== PREFIX) {
    throw new Error(`parseVariationId: not a variation id: ${id}`)
  }
  // Brief ids never contain a dot in our seed; if that ever changes, the last
  // three segments are stepKey/channelKey/segmentKey and everything between
  // the prefix and those is the briefId.
  const segmentKey = parts[parts.length - 1]!
  const channelKey = parts[parts.length - 2]! as ChannelKey
  const stepKey = parts[parts.length - 3]!
  const briefId = parts.slice(1, parts.length - 3).join('.')
  return {briefId, stepKey, channelKey, segmentKey}
}
