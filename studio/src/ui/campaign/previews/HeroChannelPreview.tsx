// Shared hero + content panel layout for web and email matrix previews.

import {Box, Card, Stack, Text} from '@sanity/ui'
import imageUrlBuilder from '@sanity/image-url'
import type {SanityClient} from '@sanity/client'
import type {ReactNode} from 'react'
import {TokenText, type TokenMode} from './TokenText'
import type {MergeField, MinimalBrief} from '../../../personalization/generate/tokens'
import {previewCardStyle} from './previewCommon'

export interface HeroImage {
  asset?: {_ref?: string} | null
  alt?: string
}

interface PortableTextSpan {
  _type?: 'span'
  text?: string
}
interface PortableTextBlock {
  _type?: 'block'
  style?: string
  children?: PortableTextSpan[]
}

export interface HeroChannelPreviewProps {
  client: SanityClient
  brief: MinimalBrief
  mergeFields: MergeField[]
  tokenMode: TokenMode
  brandColor?: string
  heroImage?: HeroImage
  headline?: string
  subheadline?: string
  body?: PortableTextBlock[] | unknown[]
  ctaLabel?: string
  /** Slim bar above the hero (e.g. email from line). */
  topChrome?: ReactNode
  placeholderLabel?: string
}

function blockText(block: PortableTextBlock): string {
  return (block.children ?? [])
    .map((c) => c?.text ?? '')
    .join('')
}

function isHeading(block: PortableTextBlock): boolean {
  return typeof block.style === 'string' && /^h[1-6]$/i.test(block.style)
}

export function HeroChannelPreview({
  client,
  brief,
  mergeFields,
  tokenMode,
  brandColor,
  heroImage,
  headline,
  subheadline,
  body,
  ctaLabel,
  topChrome,
  placeholderLabel = 'Hero image',
}: HeroChannelPreviewProps) {
  const accent = brandColor ?? '#00A8E0'
  const hasImage = Boolean(heroImage?.asset?._ref)
  let src: string | undefined
  try {
    src = hasImage
      ? imageUrlBuilder(client).image(heroImage!).width(640).fit('crop').url()
      : undefined
  } catch {
    src = undefined
  }

  const blocks = (body ?? []) as PortableTextBlock[]

  return (
    <Card radius={2} border overflow="hidden" tone="default" style={previewCardStyle}>
      {topChrome ? (
        <Box padding={3} style={{background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}>
          {topChrome}
        </Box>
      ) : null}

      <Box
        style={{
          aspectRatio: '16 / 9',
          background: src ? '#1a1a2e' : `linear-gradient(135deg, ${accent} 0%, #00388f 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={heroImage?.alt ?? ''}
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
          />
        ) : (
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text size={1} style={{color: 'rgba(255,255,255,0.75)'}}>
              {hasImage ? 'Loading image…' : placeholderLabel}
            </Text>
          </Box>
        )}
      </Box>

      <Stack padding={3} space={3} style={{background: '#fff'}}>
        {headline ? (
          <TokenText
            text={headline}
            mode={tokenMode}
            brief={brief}
            mergeFields={mergeFields}
            client={client}
            size={2}
            weight="semibold"
            block
            style={{color: '#111827', lineHeight: 1.25}}
          />
        ) : null}

        {subheadline ? (
          <TokenText
            text={subheadline}
            mode={tokenMode}
            brief={brief}
            mergeFields={mergeFields}
            client={client}
            size={1}
            block
            style={{color: '#4b5563', lineHeight: 1.5}}
          />
        ) : null}

        {blocks.length > 0
          ? blocks.slice(0, 4).map((b, i) => {
              const txt = blockText(b)
              if (!txt) return null
              return (
                <TokenText
                  key={i}
                  text={txt}
                  mode={tokenMode}
                  brief={brief}
                  mergeFields={mergeFields}
                  client={client}
                  size={isHeading(b) ? 2 : 1}
                  weight={isHeading(b) ? 'semibold' : 'regular'}
                  block
                  style={{color: '#374151', lineHeight: 1.55}}
                />
              )
            })
          : null}

        {blocks.length > 4 ? (
          <Text size={0} muted>
            … {blocks.length - 4} more block(s)
          </Text>
        ) : null}

        {ctaLabel ? (
          <Box paddingTop={1}>
            <Box
              paddingX={3}
              paddingY={2}
              style={{
                background: accent,
                borderRadius: 6,
                display: 'inline-block',
              }}
            >
              <TokenText
                text={ctaLabel}
                mode={tokenMode}
                brief={brief}
                mergeFields={mergeFields}
                client={client}
                size={1}
                weight="semibold"
                style={{color: '#fff'}}
              />
            </Box>
          </Box>
        ) : null}
      </Stack>
    </Card>
  )
}
