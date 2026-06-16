import {Card, Stack, Text, Box, Flex} from '@sanity/ui'
import {TokenText, type TokenMode, type TokenInfo} from './TokenText'

export interface WebHeroCardProps {
  headline?: string
  subheadline?: string
  ctaLabel?: string
  ctaUrl?: string
  brandColor?: string
  mode: TokenMode
  tokens: Record<string, TokenInfo>
}

export function WebHeroCard({headline, subheadline, ctaLabel, brandColor, mode, tokens}: WebHeroCardProps) {
  const bg = brandColor || '#1a1a1a'
  return (
    <Card border radius={2} overflow="hidden">
      <Box
        padding={4}
        style={{
          background: `linear-gradient(135deg, ${bg} 0%, ${bg}cc 100%)`,
          minHeight: 160,
          color: '#ffffff',
        }}
      >
        <Stack space={3}>
          <Box style={{color: '#ffffff'}}>
            <Text size={2} weight="bold" style={{color: '#ffffff'}}>
              <TokenText text={headline ?? '—'} mode={mode} tokens={tokens} size={2} />
            </Text>
          </Box>
          <Box style={{color: '#ffffff', opacity: 0.9}}>
            <TokenText text={subheadline ?? ''} mode={mode} tokens={tokens} size={1} />
          </Box>
          <Flex>
            <Box
              padding={2}
              style={{
                background: '#ffffff',
                color: bg,
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 12,
                padding: '6px 14px',
              }}
            >
              {ctaLabel || 'Learn more'}
            </Box>
          </Flex>
        </Stack>
      </Box>
    </Card>
  )
}
