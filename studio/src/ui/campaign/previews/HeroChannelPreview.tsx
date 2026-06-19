// Shared hero + content panel layout for web and email matrix previews.

import {Box, Card, Text} from '@sanity/ui'
import imageUrlBuilder from '@sanity/image-url'
import type {SanityClient} from '@sanity/client'
import type {ReactNode} from 'react'
import {TokenText, type TokenMode} from './TokenText'
import type {MergeField, MinimalBrief} from '../../../personalization/generate/tokens'
import {previewCardStyle} from './previewCommon'

export interface HeroImage {
  asset?: {_ref?: string} | null
  /** Direct CDN URL for assets curated from the Sanity Media Library. */
  url?: string
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
  let src: string | undefined
  if (heroImage?.url) {
    // Media Library asset — use the CDN URL directly, requesting a sized crop.
    src = `${heroImage.url}?w=640&fit=crop&auto=format`
  } else if (heroImage?.asset?._ref) {
    try {
      src = imageUrlBuilder(client).image(heroImage).width(640).fit('crop').url()
    } catch {
      src = undefined
    }
  }

  const blocks = (body ?? []) as PortableTextBlock[]
  // Whether the variation has a hero asset at all. When it doesn't, the image
  // block is skipped entirely (no placeholder) — briefs without allowed media
  // generate text-only.
  const hasHero = Boolean(heroImage?.url || heroImage?.asset?._ref)

  return (
    <Card radius={2} border overflow="hidden" tone="default" style={previewCardStyle}>
      {topChrome ? (
        <Box style={{padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}>
          {topChrome}
        </Box>
      ) : null}

      {hasHero ? (
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
                {placeholderLabel}
              </Text>
            </Box>
          )}
        </Box>
      ) : null}

      {/*
        Content panel — type + spacing scale per the "Edit Variation" brief §03.
        Explicit px (not Sanity space tokens) so the rhythm is exact: 20px inner
        padding, 16px between blocks, 24px before the CTA, headline 18/600,
        body 14/1.55, subheadline as muted meta.
      */}
      <Box
        style={{
          background: '#fff',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
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
            style={{color: '#111827', fontSize: 18, fontWeight: 600, lineHeight: 1.25}}
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
            muted
            block
            style={{color: '#6b7280', fontSize: 13, lineHeight: 1.5}}
          />
        ) : null}

        {blocks.length > 0
          ? blocks.slice(0, 4).map((b, i) => {
              const txt = blockText(b)
              if (!txt) return null
              const heading = isHeading(b)
              return (
                <TokenText
                  key={i}
                  text={txt}
                  mode={tokenMode}
                  brief={brief}
                  mergeFields={mergeFields}
                  client={client}
                  size={heading ? 2 : 1}
                  weight={heading ? 'semibold' : 'regular'}
                  block
                  style={{
                    color: '#374151',
                    fontSize: heading ? 18 : 14,
                    fontWeight: heading ? 600 : 400,
                    lineHeight: 1.55,
                  }}
                />
              )
            })
          : null}

        {blocks.length > 4 ? (
          <Box>
            <Box
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
              }}
            >
              <Text size={0} muted weight="medium">
                +{blocks.length - 4} more
              </Text>
            </Box>
          </Box>
        ) : null}

        {ctaLabel ? (
          <Box style={{marginTop: 8}}>
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
      </Box>
    </Card>
  )
}
