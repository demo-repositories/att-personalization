// studio/src/personalization/generate/releases.ts
//
// Content Releases plumbing for generation. Generated variations are written as
// *version* documents into a per-brief "ongoing" release rather than straight to
// published, so a marketer can review the whole batch and promote it in one
// atomic publish. See Sanity docs: apis-and-sdks/js-client-releases.

import type {SanityClient} from '@sanity/client'

// Release + version APIs require this API version (or later).
export const RELEASES_API_VERSION = '2025-02-19'

/** A version document's id: `versions.<releaseId>.<publishedId>`. */
export function versionDocId(releaseId: string, publishedId: string): string {
  return `versions.${releaseId}.${publishedId}`
}

function releasesClient(client: SanityClient): SanityClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).withConfig({apiVersion: RELEASES_API_VERSION})
}

interface ReleaseRow {
  name: string
  state: string
}

export type ReleaseType = 'asap' | 'scheduled' | 'undecided'

export interface BriefReleaseOptions {
  /** Brief title — used to derive a default release name. */
  briefTitle: string
  /** Explicit release name set on the brief (overrides the default). */
  releaseTitle?: string
  releaseType?: ReleaseType
}

function releaseTitleFor(opts: BriefReleaseOptions): string {
  const explicit = opts.releaseTitle?.trim()
  return explicit || `${opts.briefTitle} — generated variations`
}

/**
 * Find-or-create the ongoing generation release for a brief.
 *
 * The brief stores a `generationReleaseId` pointer. If it points at a still
 * `active` release we reuse it (keeping its name/type in sync with the brief);
 * otherwise we create a fresh release and write the pointer back onto the brief
 * (both published + draft editions).
 */
export async function resolveBriefReleaseId(
  client: SanityClient,
  briefId: string,
  opts: BriefReleaseOptions,
): Promise<string> {
  const c = releasesClient(client)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (c as any).withConfig({perspective: 'raw'})

  const title = releaseTitleFor(opts)
  const releaseType: ReleaseType = opts.releaseType ?? 'asap'

  const existing: string | null = await raw.fetch(
    `*[_id == $id || _id == "drafts." + $id][0].generationReleaseId`,
    {id: briefId},
  )
  if (existing) {
    const row: ReleaseRow | null = await raw.fetch(
      `releases::all()[name == $name][0]{name, state}`,
      {name: existing},
    )
    if (row && row.state === 'active') {
      // Keep the existing release's metadata aligned with the brief.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (c as any).releases.edit({
          releaseId: existing,
          patch: {set: {'metadata.title': title, 'metadata.releaseType': releaseType}},
        })
      } catch {
        /* non-fatal — naming sync is best-effort */
      }
      return existing
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {releaseId} = await (c as any).releases.create({
    metadata: {
      title,
      releaseType,
      description: `Auto-created by Generate for brief ${briefId}.`,
    },
  })

  // Store the pointer on both editions; ignore failures (e.g. draft absent).
  await storeReleasePointer(c, briefId, releaseId)
  return releaseId
}

async function storeReleasePointer(client: SanityClient, briefId: string, releaseId: string) {
  for (const id of [briefId, `drafts.${briefId}`]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).patch(id).set({generationReleaseId: releaseId}).commit()
    } catch {
      /* edition may not exist — ignore */
    }
  }
}

async function clearReleasePointer(client: SanityClient, briefId: string) {
  for (const id of [briefId, `drafts.${briefId}`]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).patch(id).unset(['generationReleaseId']).commit()
    } catch {
      /* ignore */
    }
  }
}

/**
 * Upsert a version document into a release. Tries create, falls back to replace
 * when a version for this cell already exists (re-generating into the same
 * ongoing release).
 */
export async function upsertVersion(
  client: SanityClient,
  releaseId: string,
  publishedId: string,
  document: Record<string, unknown>,
): Promise<void> {
  const c = releasesClient(client)
  const _id = versionDocId(releaseId, publishedId)
  const doc = {...document, _id}
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).action({
      actionType: 'sanity.action.document.version.create',
      publishedId,
      document: doc,
    })
  } catch (err) {
    if (/exist/i.test(String(err))) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (c as any).action({
        actionType: 'sanity.action.document.version.replace',
        document: doc,
      })
    } else {
      throw err
    }
  }
}

/** Publish (promote) the brief's release, then clear the brief pointer. */
export async function publishBriefRelease(
  client: SanityClient,
  briefId: string,
  releaseId: string,
): Promise<void> {
  const c = releasesClient(client)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (c as any).action({actionType: 'sanity.action.release.publish', releaseId})
  await clearReleasePointer(c, briefId)
}

/** Discard (archive) the brief's release without publishing, then clear pointer. */
export async function discardBriefRelease(
  client: SanityClient,
  briefId: string,
  releaseId: string,
): Promise<void> {
  const c = releasesClient(client)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (c as any).action({actionType: 'sanity.action.release.archive', releaseId})
  await clearReleasePointer(c, briefId)
}
