// apps/campaign-studio/src/hooks/useMediaLibraryAssets.ts
//
// SDK-native browse of the org's Sanity Media Library. The key bit is the
// `resource: {mediaLibraryId}` option — without it the GROQ runs against the
// project dataset and returns nothing. The result auto-updates via the SDK's
// listener, so uploads/edits in the Media Library flow through reactively.
//
// Every ML asset is two joined docs: the *container* (`sanity.asset`, holds
// title / aspects / folder parent / currentVersion) and the *instance*
// (`sanity.imageAsset` etc., holds url / filename / metadata). The
// `currentVersion->` arrow dereferences container → instance in one query.

import {useQuery} from '@sanity/sdk-react'
import {MEDIA_LIBRARY_ID} from '../constants'

export interface MediaLibraryAsset {
  _id: string
  _type: string
  _createdAt?: string
  assetType?: string
  title?: string
  instance?: {
    _id?: string
    url?: string
    originalFilename?: string
    size?: number
    mimeType?: string
    metadata?: {dimensions?: {width?: number; height?: number; aspectRatio?: number}}
  }
  parent?: {_ref?: string} | null
}

const ML_ASSETS_QUERY = `*[_type == "sanity.asset" && assetType == "sanity.imageAsset"] | order(_createdAt desc) {
  _id,
  _type,
  _createdAt,
  assetType,
  title,
  "instance": currentVersion->{
    _id,
    url,
    originalFilename,
    size,
    mimeType,
    metadata
  },
  parent
}`

/** All image assets in the configured Sanity Media Library (reactive). */
export function useMediaLibraryAssets(): {assets: MediaLibraryAsset[]; isPending: boolean} {
  const {data, isPending} = useQuery<MediaLibraryAsset[]>({
    query: ML_ASSETS_QUERY,
    resource: {mediaLibraryId: MEDIA_LIBRARY_ID},
  })
  return {assets: data ?? [], isPending}
}

/** Append Sanity CDN transform params to a Media Library asset URL. */
export function mlThumbUrl(url: string | undefined, w: number, h?: number): string | undefined {
  if (!url) return undefined
  const params = h ? `w=${w}&h=${h}&fit=crop&auto=format` : `w=${w}&auto=format`
  return `${url}?${params}`
}
