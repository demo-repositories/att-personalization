// studio/src/ui/campaign/previews/EmailClientMock.tsx
//
// Email preview — same hero + content panel layout as web, with a slim inbox bar.

import {Flex, Stack, Text} from '@sanity/ui'
import type {SanityClient} from '@sanity/client'
import {HeroChannelPreview} from './HeroChannelPreview'
import type {TokenMode} from './TokenText'
import type {MergeField, MinimalBrief} from '../../../personalization/generate/tokens'

interface PortableTextSpan {
  _type?: 'span'
  text?: string
}
interface PortableTextBlock {
  _type?: 'block'
  style?: string
  children?: PortableTextSpan[]
}

export interface EmailContent {
  subjectLine?: string
  preheader?: string
  body?: PortableTextBlock[] | unknown[]
  ctaLabel?: string
  ctaUrl?: string
}

export interface EmailClientMockProps {
  client: SanityClient
  email?: EmailContent
  brand?: string
  brandColor?: string
  brief: MinimalBrief
  mergeFields: MergeField[]
  tokenMode: TokenMode
  /** Reuse the web hero image so email and web previews look aligned. */
  heroImage?: {asset?: {_ref?: string} | null; url?: string; alt?: string}
}

export function EmailClientMock({
  client,
  email,
  brand,
  brandColor,
  brief,
  mergeFields,
  tokenMode,
  heroImage,
}: EmailClientMockProps) {
  const accent = brandColor ?? '#00A8E0'
  const brandName = brand ?? 'AT&T'

  return (
    <HeroChannelPreview
      client={client}
      brief={brief}
      mergeFields={mergeFields}
      tokenMode={tokenMode}
      brandColor={brandColor}
      heroImage={heroImage}
      headline={email?.subjectLine}
      subheadline={email?.preheader}
      body={email?.body}
      ctaLabel={email?.ctaLabel}
      placeholderLabel="Email hero"
      topChrome={
        <Flex align="center" gap={2}>
          <Flex
            align="center"
            justify="center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: accent,
              flexShrink: 0,
            }}
          >
            <Text size={0} weight="bold" style={{color: '#fff'}}>
              {brandName.charAt(0)}
            </Text>
          </Flex>
          <Stack space={1} flex={1} style={{minWidth: 0}}>
            <Text size={1} weight="semibold" textOverflow="ellipsis">
              {brandName}
            </Text>
            <Text size={0} muted textOverflow="ellipsis">
              noreply@{brandName.toLowerCase().replace(/[^a-z]/g, '')}.com
            </Text>
          </Stack>
        </Flex>
      }
    />
  )
}
