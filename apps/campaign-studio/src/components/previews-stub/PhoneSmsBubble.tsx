import {Card, Stack, Text, Box, Flex} from '@sanity/ui'
import {TokenText, type TokenMode, type TokenInfo} from './TokenText'

export interface PhoneSmsBubbleProps {
  message?: string
  link?: string
  brandColor?: string
  mode: TokenMode
  tokens: Record<string, TokenInfo>
}

export function PhoneSmsBubble({message, link, brandColor, mode, tokens}: PhoneSmsBubbleProps) {
  const merged = (message ?? '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (raw, k) => tokens[k]?.sampleValue ?? raw)
  const len = merged.length
  const over = len > 160
  return (
    <Card border radius={2} overflow="hidden">
      <Box padding={3} style={{background: '#f9fafb', minHeight: 140}}>
        <Stack space={3}>
          {/* Bubble */}
          <Flex>
            <Box
              padding={3}
              style={{
                background: brandColor || '#3b82f6',
                color: '#ffffff',
                borderRadius: '18px 18px 18px 4px',
                maxWidth: '85%',
              }}
            >
              <Stack space={2}>
                <Box style={{color: '#ffffff'}}>
                  <TokenText text={message ?? '—'} mode={mode} tokens={tokens} size={1} />
                </Box>
                {link && <Text size={0} style={{color: '#ffffff', opacity: 0.85, wordBreak: 'break-all'}}>{link}</Text>}
              </Stack>
            </Box>
          </Flex>
          <Flex justify="flex-end">
            <Text size={0} style={{color: over ? '#dc2626' : '#6b7280', fontVariantNumeric: 'tabular-nums'}}>
              {len} / 160
            </Text>
          </Flex>
        </Stack>
      </Box>
    </Card>
  )
}
