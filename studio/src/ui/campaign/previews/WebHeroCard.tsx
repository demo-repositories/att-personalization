// studio/src/ui/campaign/previews/WebHeroCard.tsx
//
// Full-bleed hero mock — null-guards heroImage.asset because Agent Actions
// image gen is async; the asset may be undefined for a short window after
// generate() returns. PRD Appendix B pattern.

import {Box, Card, Flex, Inline, Stack, Text} from '@sanity/ui'
import imageUrlBuilder from '@sanity/image-url'
import type {SanityClient} from '@sanity/client'
import {TokenText, type TokenMode} from './TokenText'
import type {MergeField, MinimalBrief} from '../../../personalization/generate/tokens'

export interface WebContent {
  headline?: string
  subheadline?: string
  body?: unknown[]
  ctaLabel?: string
  ctaUrl?: string
  heroImage?: {asset?: {_ref?: string} | null; alt?: string}
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
  // GUARD: heroImage.asset may be undefined for a short window after generate()
  // returns. Build the URL only when we have a real asset ref.
  const hasImage = Boolean(web?.heroImage?.asset?._ref)
  let src: string | undefined
  try {
    src = hasImage
      ? imageUrlBuilder(client).image(web!.heroImage!).width(640).fit('crop').url()
      : undefined
  } catch {
    src = undefined
  }

  const accent = brandColor ?? '#1f2937'

  return (
    <Card radius={2} border overflow="hidden" tone="default">
      <Box
        style={{
          aspectRatio: '16 / 9',
          background: src ? '#000' : accent,
          position: 'relative',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={web?.heroImage?.alt ?? ''}
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
          />
        ) : (
          <Flex
            align="center"
            justify="center"
            style={{position: 'absolute', inset: 0}}
          >
            <Text size={1} style={{color: 'rgba(255,255,255,0.85)'}}>
              {hasImage ? 'Loading image…' : 'Generating image…'}
            </Text>
          </Flex>
        )}
        {/* gradient overlay so text reads on top of photo */}
        {src ? (
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))',
            }}
          />
        ) : null}
        {/* headline overlay */}
        {web?.headline ? (
          <Box
            paddingX={3}
            paddingY={3}
            style={{position: 'absolute', left: 0, right: 0, bottom: 0}}
          >
            <Stack space={2}>
              <Text
                size={2}
                weight="semibold"
                style={{color: src ? '#fff' : 'rgba(255,255,255,0.95)'}}
              >
                <TokenText
                  text={web.headline}
                  mode={tokenMode}
                  brief={brief}
                  mergeFields={mergeFields}
                  client={client}
                  size={2}
                />
              </Text>
              {web.subheadline ? (
                <Text size={1} style={{color: src ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.85)'}}>
                  <TokenText
                    text={web.subheadline}
                    mode={tokenMode}
                    brief={brief}
                    mergeFields={mergeFields}
                    client={client}
                    size={1}
                  />
                </Text>
              ) : null}
            </Stack>
          </Box>
        ) : null}
      </Box>
      <Stack padding={3} space={3}>
        {!web?.headline && web?.subheadline ? (
          <Text size={1}>
            <TokenText
              text={web.subheadline}
              mode={tokenMode}
              brief={brief}
              mergeFields={mergeFields}
              client={client}
              size={1}
            />
          </Text>
        ) : null}
        {web?.ctaLabel ? (
          <Inline space={2}>
            <Box
              paddingX={3}
              paddingY={2}
              style={{
                background: accent,
                color: '#fff',
                borderRadius: 4,
                display: 'inline-block',
              }}
            >
              <Text size={1} weight="semibold" style={{color: '#fff'}}>
                <TokenText
                  text={web.ctaLabel}
                  mode={tokenMode}
                  brief={brief}
                  mergeFields={mergeFields}
                  client={client}
                  size={1}
                />
              </Text>
            </Box>
          </Inline>
        ) : null}
      </Stack>
    </Card>
  )
}
