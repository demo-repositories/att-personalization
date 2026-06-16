// studio/src/ui/campaign/previews/EmailClientMock.tsx
//
// Inbox-chrome email preview: From (brand) / subjectLine / preheader (greyed) /
// body / CTA. Body is portable text (array of blocks) — we render a simplified
// plain-text projection (the demo cares about token visibility, not full PT
// fidelity).

import {Box, Card, Flex, Inline, Stack, Text} from '@sanity/ui'
import type {SanityClient} from '@sanity/client'
import {TokenText, type TokenMode} from './TokenText'
import type {MergeField, MinimalBrief} from '../../../personalization/generate/tokens'

interface PortableTextSpan {
  _type?: 'span'
  text?: string
  marks?: string[]
}
interface PortableTextBlock {
  _type?: 'block'
  style?: string
  listItem?: string
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
}

function blockText(block: PortableTextBlock): string {
  return (block.children ?? [])
    .map((c) => c?.text ?? '')
    .join('')
}

function isHeading(block: PortableTextBlock): boolean {
  return typeof block.style === 'string' && /^h[1-6]$/i.test(block.style)
}

export function EmailClientMock({
  client,
  email,
  brand,
  brandColor,
  brief,
  mergeFields,
  tokenMode,
}: EmailClientMockProps) {
  const accent = brandColor ?? '#1f2937'
  const brandName = brand ?? 'AT&T'
  const blocks = (email?.body ?? []) as PortableTextBlock[]

  return (
    <Card radius={2} border overflow="hidden" tone="default">
      {/* Inbox chrome — From + subject row */}
      <Box padding={3} style={{background: '#f8fafc', borderBottom: '1px solid #e2e8f0'}}>
        <Stack space={2}>
          <Flex align="center" gap={2}>
            <Box
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: accent,
                flexShrink: 0,
              }}
            />
            <Stack space={1} flex={1}>
              <Text size={1} weight="semibold" textOverflow="ellipsis">
                {brandName}
              </Text>
              <Text size={0} muted>noreply@{brandName.toLowerCase().replace(/[^a-z]/g, '')}.com</Text>
            </Stack>
          </Flex>
          <Box>
            <Text size={1} weight="semibold">
              <TokenText
                text={email?.subjectLine ?? '(no subject)'}
                mode={tokenMode}
                brief={brief}
                mergeFields={mergeFields}
                client={client}
                size={1}
              />
            </Text>
          </Box>
          {email?.preheader ? (
            <Box>
              <Text size={0} muted>
                <TokenText
                  text={email.preheader}
                  mode={tokenMode}
                  brief={brief}
                  mergeFields={mergeFields}
                  client={client}
                  size={0}
                  muted
                />
              </Text>
            </Box>
          ) : null}
        </Stack>
      </Box>

      {/* Body */}
      <Stack padding={3} space={3}>
        {blocks.length === 0 ? (
          <Text size={1} muted>(empty body)</Text>
        ) : (
          blocks.slice(0, 8).map((b, i) => {
            const txt = blockText(b)
            if (!txt) return null
            if (isHeading(b)) {
              return (
                <Text key={i} size={2} weight="semibold">
                  <TokenText
                    text={txt}
                    mode={tokenMode}
                    brief={brief}
                    mergeFields={mergeFields}
                    client={client}
                    size={2}
                  />
                </Text>
              )
            }
            if (b.listItem) {
              return (
                <Inline key={i} space={2}>
                  <Text size={1} muted>•</Text>
                  <Text size={1}>
                    <TokenText
                      text={txt}
                      mode={tokenMode}
                      brief={brief}
                      mergeFields={mergeFields}
                      client={client}
                      size={1}
                    />
                  </Text>
                </Inline>
              )
            }
            return (
              <Text key={i} size={1}>
                <TokenText
                  text={txt}
                  mode={tokenMode}
                  brief={brief}
                  mergeFields={mergeFields}
                  client={client}
                  size={1}
                />
              </Text>
            )
          })
        )}
        {blocks.length > 8 ? (
          <Text size={0} muted>… {blocks.length - 8} more block(s)</Text>
        ) : null}

        {email?.ctaLabel ? (
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
                  text={email.ctaLabel}
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
