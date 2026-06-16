// studio/src/ui/campaign/previews/PhoneSmsBubble.tsx
//
// Phone frame + SMS bubble + character counter (red if >160, the carrier
// segmentation threshold). Char counter uses the RAW string length — the
// "raw" mode is the source of truth for SMS length because the LLM authors
// with tokens and we ship those tokens to the SMS gateway, which substitutes
// downstream. Showing merged-mode length would be misleading.

import {Box, Card, Flex, Stack, Text} from '@sanity/ui'
import type {SanityClient} from '@sanity/client'
import {TokenText, type TokenMode} from './TokenText'
import type {MergeField, MinimalBrief} from '../../../personalization/generate/tokens'

export interface SmsContent {
  message?: string
  link?: string
}

export interface PhoneSmsBubbleProps {
  client: SanityClient
  sms?: SmsContent
  brand?: string
  brandColor?: string
  brief: MinimalBrief
  mergeFields: MergeField[]
  tokenMode: TokenMode
}

export function PhoneSmsBubble({
  client,
  sms,
  brand,
  brandColor,
  brief,
  mergeFields,
  tokenMode,
}: PhoneSmsBubbleProps) {
  const accent = brandColor ?? '#1f2937'
  const message = sms?.message ?? ''
  const length = message.length
  const tooLong = length > 160

  return (
    <Card radius={2} border overflow="hidden" tone="default">
      <Stack space={3} padding={3}>
        {/* Phone frame — a rounded rectangle that visually evokes an iMessage screen */}
        <Box
          style={{
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 24,
            padding: 12,
            minHeight: 180,
          }}
        >
          <Stack space={2}>
            <Flex align="center" justify="center">
              <Text size={0} muted>
                {brand ?? 'AT&T'} · now
              </Text>
            </Flex>
            <Flex justify="flex-start">
              <Box
                paddingX={3}
                paddingY={2}
                style={{
                  background: accent,
                  borderRadius: 18,
                  borderBottomLeftRadius: 4,
                  maxWidth: '85%',
                  color: '#fff',
                }}
              >
                <Stack space={2}>
                  <Text size={1} style={{color: '#fff', whiteSpace: 'pre-wrap'}}>
                    {message ? (
                      <TokenText
                        text={message}
                        mode={tokenMode}
                        brief={brief}
                        mergeFields={mergeFields}
                        client={client}
                        size={1}
                      />
                    ) : (
                      <Text size={1} style={{color: 'rgba(255,255,255,0.85)'}}>(empty)</Text>
                    )}
                  </Text>
                  {sms?.link ? (
                    <Text size={0} style={{color: 'rgba(255,255,255,0.9)', textDecoration: 'underline'}}>
                      {sms.link}
                    </Text>
                  ) : null}
                </Stack>
              </Box>
            </Flex>
          </Stack>
        </Box>

        {/* Char counter — red if >160 */}
        <Flex justify="space-between" align="center">
          <Text size={0} muted>SMS</Text>
          <Text size={0} style={tooLong ? {color: '#dc2626'} : undefined} muted={!tooLong}>
            {length}/160 {tooLong ? '· over limit' : ''}
          </Text>
        </Flex>
      </Stack>
    </Card>
  )
}
