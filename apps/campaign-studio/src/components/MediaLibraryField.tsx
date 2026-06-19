// apps/campaign-studio/src/components/MediaLibraryField.tsx
//
// Browse-and-select media field for a brief's `allowedMedia`. Opens a dialog
// that browses the org's **Sanity Media Library** (a separate resource, read
// via the App SDK with an explicit `resource: {mediaLibraryId}` — see
// useMediaLibraryAssets) as a thumbnail grid with search + multi-select.
//
// Picking an asset that isn't curated yet auto-creates its `mediaAsset`
// document, storing the Media Library CDN url (ML assets are not project-dataset
// assets, so there's no `image.asset._ref` to reference). The field value is a
// list of `mediaAsset` document ids; legacy project-asset selections are
// preserved untouched.

import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Spinner,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@sanity/ui'
import {CheckmarkCircleIcon, ImagesIcon, SearchIcon, TrashIcon} from '@sanity/icons'
import imageUrlBuilder from '@sanity/image-url'
import {Suspense, useEffect, useMemo, useState} from 'react'
import type {SanityClient} from '@sanity/client'
import {PROJECT_ID, DATASET, MEDIA_LIBRARY_ID} from '../constants'
import {useMediaLibraryAssets, mlThumbUrl} from '../hooks/useMediaLibraryAssets'

export interface MediaDoc {
  _id: string
  title?: string
  /** Project-dataset asset ref (legacy assets). */
  assetRef?: string
  /** Media Library CDN url (assets curated from the Media Library). */
  url?: string
  /** Media Library container id this doc was curated from, if any. */
  mlAssetId?: string
}

// Build URLs from the project/dataset the app is explicitly configured with
// (see App.tsx) rather than reading config off the App SDK client. Used only
// for legacy project-asset mediaAssets — Media Library assets carry a CDN url.
const urlBuilder = imageUrlBuilder({projectId: PROJECT_ID, dataset: DATASET})

function projectThumb(assetRef: string, w: number, h: number): string | undefined {
  try {
    return urlBuilder.image({_ref: assetRef}).width(w).height(h).fit('crop').url()
  } catch {
    return undefined
  }
}

/** Best thumbnail for a curated mediaAsset doc — ML url first, else project ref. */
function mediaDocThumb(m: MediaDoc | undefined, w: number, h: number): string | undefined {
  if (!m) return undefined
  if (m.url) return mlThumbUrl(m.url, w, h)
  if (m.assetRef) return projectThumb(m.assetRef, w, h)
  return undefined
}

/** Derive a short, human title from a (often very long) original filename. */
function titleFromName(name?: string): string {
  if (!name) return 'Untitled asset'
  const base = name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  const short = base.split(/\s+/).slice(0, 8).join(' ')
  if (!short) return 'Untitled asset'
  return short.charAt(0).toUpperCase() + short.slice(1)
}

export function MediaLibraryField({
  client,
  value,
  onChange,
}: {
  client: SanityClient
  /** Selected `mediaAsset` document ids. */
  value: string[]
  onChange: (ids: string[]) => void
}) {
  // Curated mediaAsset docs — used to render the selected thumbnails. Kept in
  // sync as the browser creates new ones.
  const [media, setMedia] = useState<MediaDoc[]>([])
  const [loaded, setLoaded] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    client
      .fetch<MediaDoc[]>(
        `*[_type == "mediaAsset"]{_id, title, url, mlAssetId, "assetRef": image.asset._ref}`,
      )
      .then((r) => {
        if (cancelled) return
        setMedia(r || [])
        setLoaded(true)
      })
      .catch(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [client])

  const byId = useMemo(() => new Map(media.map((m) => [m._id, m])), [media])

  return (
    <Stack space={3}>
      {value.length > 0 ? (
        <Grid columns={[2, 3, 4]} gap={2}>
          {value.map((id) => {
            const m = byId.get(id)
            const src = mediaDocThumb(m, 200, 120)
            return (
              <Card key={id} radius={2} border overflow="hidden" tone="default">
                <Box style={{aspectRatio: '5 / 3', background: '#e5e7eb', position: 'relative'}}>
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
                    />
                  ) : null}
                </Box>
                <Flex align="center" justify="space-between" gap={1} padding={2}>
                  <Text size={0} muted textOverflow="ellipsis" style={{flex: 1, minWidth: 0}}>
                    {m?.title || (loaded ? 'Selected asset' : '…')}
                  </Text>
                  <Button
                    icon={TrashIcon}
                    mode="bleed"
                    tone="critical"
                    padding={1}
                    fontSize={0}
                    title="Remove"
                    onClick={() => onChange(value.filter((v) => v !== id))}
                  />
                </Flex>
              </Card>
            )
          })}
        </Grid>
      ) : (
        <Text size={1} muted>
          No media selected yet.
        </Text>
      )}

      <Box>
        <Button
          icon={ImagesIcon}
          text="Browse media library"
          mode="ghost"
          onClick={() => setBrowseOpen(true)}
        />
      </Box>

      {browseOpen ? (
        <Suspense fallback={<BrowserLoadingDialog onClose={() => setBrowseOpen(false)} />}>
          <MediaLibraryBrowser
            client={client}
            value={value}
            onClose={() => setBrowseOpen(false)}
            onConfirm={(ids, freshMedia) => {
              setMedia(freshMedia)
              onChange(ids)
              setBrowseOpen(false)
            }}
          />
        </Suspense>
      ) : null}
    </Stack>
  )
}

function BrowserLoadingDialog({onClose}: {onClose: () => void}) {
  return (
    <Dialog id="media-library-browser-loading" header="Media library" width={3} onClose={onClose}>
      <Flex align="center" justify="center" gap={3} padding={6}>
        <Spinner muted />
        <Text muted size={1}>
          Loading Sanity Media Library…
        </Text>
      </Flex>
    </Dialog>
  )
}

function MediaLibraryBrowser({
  client,
  value,
  onClose,
  onConfirm,
}: {
  client: SanityClient
  value: string[]
  onClose: () => void
  /** Returns the resolved mediaAsset ids + the full known mediaAsset list. */
  onConfirm: (ids: string[], media: MediaDoc[]) => void
}) {
  const toast = useToast()
  // Live Media Library assets (suspends on first load — handled by the parent
  // <Suspense> boundary so the dialog appears with a spinner).
  const {assets} = useMediaLibraryAssets()

  // Already-curated mediaAsset docs — for preselect + dedupe on confirm.
  const [existing, setExisting] = useState<MediaDoc[] | null>(null)
  // Selected Media Library container ids.
  const [selectedMlIds, setSelectedMlIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    client
      .fetch<MediaDoc[]>(
        `*[_type == "mediaAsset"]{_id, title, url, mlAssetId, "assetRef": image.asset._ref}`,
      )
      .then((r) => {
        if (cancelled) return
        const docs = r || []
        setExisting(docs)
        // Preselect ML assets already referenced by this brief's value.
        const valueSet = new Set(value)
        const preselect = new Set(
          docs
            .filter((d) => valueSet.has(d._id) && d.mlAssetId)
            .map((d) => d.mlAssetId as string),
        )
        setSelectedMlIds(preselect)
      })
      .catch(
        (e) =>
          !cancelled &&
          toast.push({status: 'error', title: 'Failed to load curated media', description: String(e)}),
      )
    return () => {
      cancelled = true
    }
  }, [client, value, toast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets
    return assets.filter((a) =>
      (a.title || a.instance?.originalFilename || a._id).toLowerCase().includes(q),
    )
  }, [assets, query])

  function toggle(mlId: string) {
    setSelectedMlIds((prev) => {
      const next = new Set(prev)
      if (next.has(mlId)) next.delete(mlId)
      else next.add(mlId)
      return next
    })
  }

  async function confirm() {
    if (!existing) return
    setSaving(true)
    try {
      const existingByMlId = new Map(
        existing.filter((m) => m.mlAssetId).map((m) => [m.mlAssetId as string, m]),
      )
      const created: MediaDoc[] = []
      const mlIds: string[] = []
      for (const mlId of selectedMlIds) {
        const found = existingByMlId.get(mlId)
        if (found) {
          mlIds.push(found._id)
          continue
        }
        const asset = assets.find((a) => a._id === mlId)
        if (!asset?.instance?.url) continue
        // Deterministic id keeps re-selecting the same ML asset idempotent.
        const _id = `media-ml-${mlId}`
        const title = asset.title || titleFromName(asset.instance.originalFilename)
        const doc: MediaDoc = {_id, title, url: asset.instance.url, mlAssetId: mlId}
        await client.createOrReplace({
          _id,
          _type: 'mediaAsset',
          title,
          url: asset.instance.url,
          mediaLibraryId: MEDIA_LIBRARY_ID,
          mlAssetId: mlId,
        })
        created.push(doc)
        mlIds.push(_id)
      }

      // Preserve any legacy (non-ML) selections that the browser can't toggle.
      const valueSet = new Set(value)
      const existingById = new Map(existing.map((m) => [m._id, m]))
      const legacyIds = value.filter((id) => {
        const doc = existingById.get(id)
        return doc ? !doc.mlAssetId : valueSet.has(id)
      })

      const ids = Array.from(new Set([...legacyIds, ...mlIds]))
      onConfirm(ids, [...existing, ...created])
    } catch (e) {
      toast.push({status: 'error', title: 'Could not add media', description: String(e)})
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      id="media-library-browser"
      header="Sanity Media Library"
      width={3}
      onClose={() => (saving ? undefined : onClose())}
      footer={
        <Flex padding={3} justify="space-between" align="center" gap={3} wrap="wrap">
          <Text size={1} muted>
            {selectedMlIds.size} selected
          </Text>
          <Flex gap={2}>
            <Button text="Cancel" mode="ghost" disabled={saving} onClick={onClose} />
            <Button
              text="Use selected"
              tone="primary"
              loading={saving}
              disabled={saving || !existing}
              onClick={confirm}
            />
          </Flex>
        </Flex>
      }
    >
      <Box padding={4}>
        <Stack space={4}>
          <TextInput
            icon={SearchIcon}
            placeholder="Search the media library by name"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          {filtered.length === 0 ? (
            <Text size={1} muted>
              No image assets {query ? 'match your search' : 'found in the media library'}.
            </Text>
          ) : (
            <Grid columns={[2, 3, 4]} gap={3}>
              {filtered.map((asset) => {
                const sel = selectedMlIds.has(asset._id)
                const src = mlThumbUrl(asset.instance?.url, 320, 180)
                const label = asset.title || titleFromName(asset.instance?.originalFilename)
                return (
                  <Card
                    key={asset._id}
                    radius={2}
                    border
                    overflow="hidden"
                    tone={sel ? 'primary' : 'default'}
                    style={{
                      cursor: 'pointer',
                      outline: sel ? '2px solid var(--card-focus-ring-color, #2276fc)' : 'none',
                    }}
                    onClick={() => toggle(asset._id)}
                  >
                    <Box style={{aspectRatio: '16 / 9', background: '#e5e7eb', position: 'relative'}}>
                      {src ? (
                        <img
                          src={src}
                          alt=""
                          style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
                        />
                      ) : null}
                      {sel ? (
                        <Box style={{position: 'absolute', top: 6, right: 6, color: '#2276fc', background: '#fff', borderRadius: '50%', lineHeight: 0}}>
                          <CheckmarkCircleIcon width={22} height={22} />
                        </Box>
                      ) : null}
                    </Box>
                    <Box padding={2}>
                      <Text size={0} muted textOverflow="ellipsis">
                        {label}
                      </Text>
                    </Box>
                  </Card>
                )
              })}
            </Grid>
          )}
        </Stack>
      </Box>
    </Dialog>
  )
}
