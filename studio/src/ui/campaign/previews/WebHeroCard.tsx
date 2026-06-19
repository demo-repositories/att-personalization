// studio/src/ui/campaign/previews/WebHeroCard.tsx
//
// Web landing preview — shares layout with email (hero image + content panel).

import type {SanityClient} from '@sanity/client'
import {HeroChannelPreview} from './HeroChannelPreview'
import type {TokenMode} from './TokenText'
import type {MergeField, MinimalBrief} from '../../../personalization/generate/tokens'

export interface WebContent {
  headline?: string
  subheadline?: string
  body?: unknown[]
  ctaLabel?: string
  ctaUrl?: string
  heroImage?: {asset?: {_ref?: string} | null; url?: string; alt?: string}
}

export interface WebHeroCardProps {
  client: SanityClient
  web?: WebContent
  brandColor?: string
  brief: MinimalBrief
  mergeFields: MergeField[]
  tokenMode: TokenMode
}

export function WebHeroCard({
  client,
  web,
  brandColor,
  brief,
  mergeFields,
  tokenMode,
}: WebHeroCardProps) {
  return (
    <HeroChannelPreview
      client={client}
      brief={brief}
      mergeFields={mergeFields}
      tokenMode={tokenMode}
      brandColor={brandColor}
      heroImage={web?.heroImage}
      headline={web?.headline}
      subheadline={web?.subheadline}
      body={web?.body}
      ctaLabel={web?.ctaLabel}
      placeholderLabel="Hero image"
    />
  )
}
