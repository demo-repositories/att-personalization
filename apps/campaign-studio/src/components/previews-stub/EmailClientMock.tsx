import {Card, Stack, Text, Box, Flex} from '@sanity/ui'
import {TokenText, type TokenMode, type TokenInfo} from './TokenText'

export interface EmailClientMockProps {
  brand?: string
  subjectLine?: string
  preheader?: string
  ctaLabel?: string
  ctaUrl?: string
  brandColor?: string
  mode: TokenMode
  tokens: Record<string, TokenInfo>
}

export function EmailClientMock({brand, subjectLine, preheader, ctaLabel, brandColor, mode, tokens}: EmailClientMockProps) {
  return (
    <Card border radius={2} overflow="hidden">
      {/* Email header bar */}
      <Box padding={3} style={{background: '#f3f4f6', borderBottom: '1px solid #e5e7eb'}}>
        <Stack space={2}>
          <Flex align="center" gap={2}>
            <Box
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: brandColor || '#00A8E0',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {(brand || 'AT').slice(0, 2).toUpperCase()}
            </Box>
            <Text size={0} muted weight="medium">
              {brand?.toUpperCase() || 'AT&T'} &lt;promo@${(brand || 'att').toLowerCase()}.com&gt;
            </Text>
          </Flex>
          <Box>
            <Text size={1} weight="bold">
              <TokenText text={subjectLine ?? '—'} mode={mode} tokens={tokens} size={1} />
            </Text>
          </Box>
          <Text size={0} muted>
            <TokenText text={preheader ?? ''} mode={mode} tokens={tokens} size={0} />
          </Text>
        </Stack>
      </Box>
      <Box padding={3}>
        <Flex>
          <Box
            style={{
              background: brandColor || '#00A8E0',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: 4,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {ctaLabel || 'Open offer'}
          </Box>
        </Flex>
      </Box>
    </Card>
  )
}
