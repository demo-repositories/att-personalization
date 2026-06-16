// studio/src/personalization/generate/tokens.ts
//
// Pure (well, async — needs the client for Sanity resolvers): walk `{{key}}`
// tokens in generated copy and replace them. Three sources:
//   - 'external'   → mergeField.sampleValue (simulates the live PIM/CRM lookup)
//   - 'sanity'     → mergeField.sanityResolver against the brief / referenced doc
//   - unresolved   → leave the literal `{{key}}` in place (UI renders as a chip)
//
// Special case — the "featuredProduct flip":
//   When brief.featuredProduct is set, `{{product.*}}` tokens are forced to
//   resolve via Sanity (the dereferenced product doc) regardless of the registry
//   entry's default source. This is the PRD's "same token, Sanity-resolved" demo.

export interface MergeField {
  key: string
  source: 'external' | 'sanity'
  sampleValue?: string
  sanityResolver?: string
  description?: string
  label?: string
}

export interface MinimalBrief {
  _id?: string
  offer?: string
  featuredProduct?: {_ref?: string} | unknown
  // any other fields are fine; only `offer` and `featuredProduct` are read here
  [key: string]: unknown
}

export interface ResolveTokensOpts {
  brief: MinimalBrief
  mergeFields: MergeField[]
  client?: {fetch: (query: string, params?: Record<string, unknown>) => Promise<unknown>}
  sampleMode?: boolean
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

/** Find every `{{key}}` occurrence (used by both resolve and the chip UI). */
export function extractTokens(text: string): {key: string; raw: string}[] {
  const out: {key: string; raw: string}[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(TOKEN_RE)) {
    const raw = m[0]
    const key = m[1]!
    const sig = raw + '@' + m.index
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push({key, raw})
  }
  return out
}

function isFeaturedProductRef(brief: MinimalBrief | undefined): boolean {
  const fp = brief?.featuredProduct as {_ref?: string} | undefined
  return !!(fp && typeof fp === 'object' && typeof fp._ref === 'string' && fp._ref.length > 0)
}

/**
 * tokenChipMeta — metadata for the preview UI chip.
 *
 * Returns the resolved-from source so the preview can color-code Sanity vs
 * external tokens, plus a resolverHint string (e.g. `brief.offer` or
 * `featuredProduct->name`) for debugging.
 */
export function tokenChipMeta(
  key: string,
  mergeFields: MergeField[],
  brief?: MinimalBrief,
): {label: string; source: 'external' | 'sanity' | 'unresolved'; resolverHint?: string} {
  const mf = mergeFields.find((m) => m.key === key)
  if (!mf) {
    return {label: key, source: 'unresolved'}
  }
  // featuredProduct flip: product.* tokens prefer Sanity when the brief points
  // at a product doc.
  const isProductToken = key.startsWith('product.')
  if (isProductToken && isFeaturedProductRef(brief)) {
    return {
      label: mf.label || key,
      source: 'sanity',
      resolverHint: mf.sanityResolver || `featuredProduct->${key.split('.')[1] ?? ''}`,
    }
  }
  return {
    label: mf.label || key,
    source: mf.source,
    resolverHint:
      mf.source === 'sanity' ? mf.sanityResolver : (mf.sampleValue ? `sample: ${mf.sampleValue}` : undefined),
  }
}

/** Run a single mergeField resolver against the brief (and/or referenced docs). */
async function resolveSanityToken(
  mf: MergeField,
  brief: MinimalBrief,
  client?: ResolveTokensOpts['client'],
): Promise<string | null> {
  const resolver = (mf.sanityResolver || '').trim()
  if (!resolver) return null

  // Featured-product deref forms:  `featuredProduct->name`, `featuredProduct->price`
  const fpMatch = resolver.match(/^featuredProduct->([a-zA-Z0-9_]+)$/)
  if (fpMatch) {
    const fieldName = fpMatch[1]!
    const ref = (brief.featuredProduct as {_ref?: string} | undefined)?._ref
    if (!ref || !client) return null
    try {
      const doc = (await client.fetch(`*[_id == $id || _id == "drafts." + $id][0]`, {id: ref})) as Record<string, unknown> | null
      const v = doc?.[fieldName]
      return v == null ? null : String(v)
    } catch {
      return null
    }
  }

  // Plain field reference on the brief itself, e.g. `offer`.
  // Allow dotted paths (`offer.amount` etc.) by walking the brief.
  if (/^[a-zA-Z0-9_.]+$/.test(resolver)) {
    const segments = resolver.split('.')
    let cur: unknown = brief
    for (const seg of segments) {
      if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg]
      } else {
        cur = undefined
        break
      }
    }
    return cur == null ? null : String(cur)
  }

  // Otherwise treat it as a raw GROQ query, with `brief` available as $brief.
  if (!client) return null
  try {
    const v = await client.fetch(resolver, {brief, briefId: brief._id})
    return v == null ? null : String(v)
  } catch {
    return null
  }
}

/**
 * resolveTokens — async because Sanity resolvers may hit the client.
 *
 * Unresolved tokens are left as the literal `{{key}}` so the preview UI can
 * still render them as chips (tokenChipMeta classifies each one).
 */
export async function resolveTokens(
  text: string,
  opts: ResolveTokensOpts,
): Promise<string> {
  const {brief, mergeFields, client} = opts
  const found = extractTokens(text)
  if (found.length === 0) return text

  // Resolve each unique key once.
  const cache = new Map<string, string | null>()
  for (const {key} of found) {
    if (cache.has(key)) continue
    const mf = mergeFields.find((m) => m.key === key)
    if (!mf) {
      cache.set(key, null)
      continue
    }
    const isProductToken = key.startsWith('product.')
    const flip = isProductToken && isFeaturedProductRef(brief)
    if (flip) {
      // Force Sanity path even if registry default is 'external'.
      const forced: MergeField = {
        ...mf,
        source: 'sanity',
        sanityResolver: mf.sanityResolver || `featuredProduct->${key.split('.')[1] ?? ''}`,
      }
      cache.set(key, await resolveSanityToken(forced, brief, client))
      continue
    }
    if (mf.source === 'external') {
      cache.set(key, mf.sampleValue ?? null)
    } else {
      cache.set(key, await resolveSanityToken(mf, brief, client))
    }
  }

  return text.replace(TOKEN_RE, (raw, key) => {
    const v = cache.get(key)
    return v == null ? raw : v
  })
}
