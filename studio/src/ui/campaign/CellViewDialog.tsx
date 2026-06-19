// studio/src/ui/campaign/CellViewDialog.tsx
//
// Shared per-cell View dialog used by both Studio's VariationMatrixView and the
// App SDK's MatrixView. Renders a larger version of the cell's channel preview
// with a raw/merged token toggle in the dialog header.
//
// **App-SDK-compatible**: takes `client` as a prop, imports nothing from
// `sanity` or `sanity/structure`. Only depends on `@sanity/ui` + `@sanity/client`.
//
// Optional footer slot lets the App SDK plug an "Open in Studio" button without
// the shared component depending on `@sanity/sdk-react`.

import {Badge, Box, Button, Dialog, Flex, Inline, Stack, Text} from '@sanity/ui'
import type {SanityClient} from '@sanity/client'
import type {ReactNode} from 'react'
import {EmailClientMock, type EmailContent} from './previews/EmailClientMock'
import {PhoneSmsBubble, type SmsContent} from './previews/PhoneSmsBubble'
import {WebHeroCard, type WebContent} from './previews/WebHeroCard'
import {TokenLegend, type TokenMode} from './previews/TokenText'
import type {MergeField, MinimalBrief} from '../../personalization/generate/tokens'

export type ChannelKey = 'web' | 'email' | 'sms'

export interface CellViewDialogProps {
  client: SanityClient
  channelKey: ChannelKey
  /** Title-cased channel name for the dialog header (e.g. "Web", "Email"). */
  channelLabel?: string
  segmentTitle: string
  brand?: string
  brandColor?: string
  /** Optional flow-step intent — shown in the dialog header for multi-step flows. */
  stepIntent?: string
  stepKey?: string
  web?: WebContent
  email?: EmailContent
  sms?: SmsContent
  brief: MinimalBrief
  briefRev?: string
  mergeFields: MergeField[]
  tokenMode: TokenMode
  onTokenModeChange: (m: TokenMode) => void
  outOfDate?: boolean
  /** Optional regenerate handler; renders a "Regenerate" footer action when present. */
  onRegenerate?: () => void
  regenerating?: boolean
  /** App-SDK-only footer slot (e.g., <OpenInStudioButton documentId={cell._id}/>). */
  extraFooter?: ReactNode
  onClose: () => void
}

/**
 * Wraps the cell preview in a Sanity-UI Dialog at a larger scale. The dialog
 * is `width={2}` — wide enough to render the hero/email/phone mockups at near
 * real demo scale.
 */
export function CellViewDialog(props: CellViewDialogProps) {
  const {
    client,
    channelKey,
    channelLabel,
    segmentTitle,
    brand,
    brandColor,
    stepIntent,
    stepKey,
    web,
    email,
    sms,
    brief,
    briefRev: _briefRev,
    mergeFields,
    tokenMode,
    onTokenModeChange,
    outOfDate,
    onRegenerate,
    regenerating,
    extraFooter,
    onClose,
  } = props

  const channelName = channelLabel ?? channelKey.toUpperCase()
  const headerTitle = `${channelName} × ${segmentTitle}${
    stepKey ? ` · ${stepKey}` : ''
  }`

  return (
    <Dialog
      id="cell-view-dialog"
      header={headerTitle}
      onClose={onClose}
      width={2}
      footer={
        onRegenerate || extraFooter ? (
          <Flex padding={3} justify="flex-end" gap={2} wrap="wrap">
            {onRegenerate ? (
              <Button
                text={regenerating ? 'Regenerating…' : 'Regenerate'}
                mode="ghost"
                tone="primary"
                disabled={regenerating}
                loading={regenerating}
                onClick={onRegenerate}
              />
            ) : null}
            {extraFooter}
          </Flex>
        ) : undefined
      }
    >
      <Box padding={4}>
        <Stack space={4}>
          {/* Sub-header — token toggle + intent + out-of-date */}
          <Flex align="flex-start" justify="space-between" gap={3} wrap="wrap">
            <Stack space={2} flex={1}>
              {stepIntent ? (
                <Stack space={1}>
                  <Text size={0} muted style={{textTransform: 'uppercase', letterSpacing: 0.5}}>
                    Step intent
                  </Text>
                  <Text size={1}>{stepIntent}</Text>
                </Stack>
              ) : null}
              {outOfDate ? (
                <Inline space={2}>
                  <Badge tone="caution">Out of date</Badge>
                  <Text size={0} muted>
                    Brief was edited after this variation was generated.
                  </Text>
                </Inline>
              ) : null}
            </Stack>
            <Stack space={2} style={{minWidth: 220}}>
              <Inline space={2}>
                <Text size={1} muted>Tokens:</Text>
                <Button
                  text="Raw"
                  mode={tokenMode === 'raw' ? 'default' : 'ghost'}
                  tone={tokenMode === 'raw' ? 'primary' : 'default'}
                  onClick={() => onTokenModeChange('raw')}
                />
                <Button
                  text="Merged"
                  mode={tokenMode === 'merged' ? 'default' : 'ghost'}
                  tone={tokenMode === 'merged' ? 'primary' : 'default'}
                  onClick={() => onTokenModeChange('merged')}
                />
              </Inline>
              {tokenMode === 'raw' ? <TokenLegend /> : null}
            </Stack>
          </Flex>

          {/* The preview itself, at a slightly larger comfortable scale. */}
          <Box style={{maxWidth: 720, margin: '0 auto', width: '100%'}}>
            {channelKey === 'web' ? (
              <WebHeroCard
                client={client}
                web={web}
                brandColor={brandColor}
                brief={brief}
                mergeFields={mergeFields}
                tokenMode={tokenMode}
              />
            ) : channelKey === 'email' ? (
              <EmailClientMock
                client={client}
                email={email}
                heroImage={web?.heroImage}
                brand={brand}
                brandColor={brandColor}
                brief={brief}
                mergeFields={mergeFields}
                tokenMode={tokenMode}
              />
            ) : (
              <PhoneSmsBubble
                client={client}
                sms={sms}
                brand={brand}
                brandColor={brandColor}
                brief={brief}
                mergeFields={mergeFields}
                tokenMode={tokenMode}
              />
            )}
          </Box>
        </Stack>
      </Box>
    </Dialog>
  )
}
