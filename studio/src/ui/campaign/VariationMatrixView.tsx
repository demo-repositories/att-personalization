// studio/src/ui/campaign/VariationMatrixView.tsx
//
// Document view on campaignBrief — fetches contentVariation docs and renders
// them as a (segment × channel) matrix for single-step campaigns, or a stacked
// per-step layout for multi-step flows (all steps visible at once, scroll
// not click — Shehjad's pass-7 ask).
//
// Each cell shows: status chip + "out of date" badge + the right channel preview
// (WebHeroCard / EmailClientMock / PhoneSmsBubble) with a raw/merged token toggle
// and a per-cell "View" button that opens <CellViewDialog> at near-real scale.

import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Inline,
  Spinner,
  Stack,
  Text,
} from '@sanity/ui'
import {EyeOpenIcon} from '@sanity/icons'
import {useEffect, useMemo, useRef, useState} from 'react'
import {useClient} from 'sanity'
import type {UserViewComponent} from 'sanity/structure'
import {WebHeroCard} from './previews/WebHeroCard'
import {EmailClientMock} from './previews/EmailClientMock'
import {PhoneSmsBubble} from './previews/PhoneSmsBubble'
import {TokenLegend, type TokenMode} from './previews/TokenText'
import {CellViewDialog} from './CellViewDialog'
import type {MergeField, MinimalBrief} from '../../personalization/generate/tokens'
import {webHeroForCell} from './previews/previewCommon'

const API_VERSION = '2024-10-01'

// AT&T brand-color accent for headers/labels. Hex is intentional — chip/header
// brand accent (PRD Appendix D allows brand hex inside brand surfaces).
const ATT_BLUE = '#00A8E0'

// Live-fetched brief shape — enough to drive the matrix.
interface FetchedBrief {
  _id: string
  _rev?: string
  title?: string
  multiStep?: boolean
  offer?: string
  featuredProduct?: {_ref?: string}
  targetChannels?: Array<{_id: string; key: 'web' | 'email' | 'sms'; title?: string}>
  targetSegments?: Array<{
    _id: string
    key: string
    title?: string
    brand?: string
    brandColor?: string
  }>
  flowSteps?: Array<{
    stepKey: string
    delayLabel?: string
    intent?: string
    channels?: Array<{_id: string; key: 'web' | 'email' | 'sms'; title?: string}>
  }>
}

interface FetchedVariation {
  _id: string
  _rev?: string
  channel: 'web' | 'email' | 'sms'
  segment: string
  flowStep?: string
  status?: 'pending' | 'generating' | 'generated' | 'error' | null
  generatedFromBriefRev?: string | null
  error?: string | null
  web?: unknown
  email?: unknown
  sms?: unknown
}

const BRIEF_QUERY = `*[_id == $id || _id == "drafts." + $id][0]{
  _id, _rev, title, multiStep, offer, featuredProduct,
  "targetChannels": targetChannels[]->{_id, key, title},
  "targetSegments": targetSegments[]->{_id, key, title, brand, brandColor},
  "flowSteps": flowSteps[]{
    stepKey, delayLabel, intent,
    "channels": channels[]->{_id, key, title}
  }
}`

// Pull both the drafts AND published variations and prefer the draft when both
// exist (Studio-edited variations land as drafts; orchestrate publishes them).
const VARIATIONS_QUERY = `*[_type == "contentVariation"
  && (brief._ref == $id || brief._ref == "drafts." + $id)]{
    _id, _rev, channel, segment, flowStep, status, generatedFromBriefRev, error,
    web, email, sms
  }`

const MERGE_FIELDS_QUERY = `*[_type == "mergeField"]{key, source, sampleValue, sanityResolver, description, label}`

function preferDraft(vars: FetchedVariation[]): FetchedVariation[] {
  // Group by "_id without drafts.", prefer drafts entry.
  const byKey = new Map<string, FetchedVariation>()
  for (const v of vars) {
    const key = v._id.startsWith('drafts.') ? v._id.slice('drafts.'.length) : v._id
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, v)
      continue
    }
    const isDraft = v._id.startsWith('drafts.')
    if (isDraft) byKey.set(key, v)
  }
  return Array.from(byKey.values())
}

function statusTone(
  status: FetchedVariation['status'],
): 'default' | 'positive' | 'caution' | 'critical' | 'primary' {
  switch (status) {
    case 'generated':
      return 'positive'
    case 'generating':
      return 'primary'
    case 'error':
      return 'critical'
    case 'pending':
      return 'caution'
    default:
      return 'default'
  }
}

function statusLabel(status: FetchedVariation['status']): string {
  return status ?? 'unknown'
}

interface CellOpenRequest {
  channelKey: 'web' | 'email' | 'sms'
  channelTitle?: string
  segment: NonNullable<FetchedBrief['targetSegments']>[number]
  stepKey?: string
  stepIntent?: string
  variation: FetchedVariation
  outOfDate: boolean
}

// Render one cell — the channel-specific preview + the status/out-of-date chips
// + the per-cell "View" button.
function Cell({
  brief,
  briefRev,
  segment,
  channel,
  variation,
  allVariations,
  mergeFields,
  tokenMode,
  stepKey,
  stepIntent,
  onView,
}: {
  brief: MinimalBrief
  briefRev?: string
  segment: NonNullable<FetchedBrief['targetSegments']>[number]
  channel: {_id: string; key: 'web' | 'email' | 'sms'; title?: string}
  variation: FetchedVariation | undefined
  allVariations: FetchedVariation[]
  mergeFields: MergeField[]
  tokenMode: TokenMode
  stepKey?: string
  stepIntent?: string
  onView: (req: CellOpenRequest, returnEl: HTMLElement | null) => void
}) {
  const client = useClient({apiVersion: API_VERSION})
  const viewBtnRef = useRef<HTMLButtonElement>(null)
  const brandColor = segment.brandColor
  const brand = segment.brand?.toUpperCase()
  const status = variation?.status ?? null
  const outOfDate =
    variation?.generatedFromBriefRev != null &&
    briefRev != null &&
    variation.generatedFromBriefRev !== briefRev

  // Empty / skeleton — reserves the same aspect ratio as a real preview so the
  // matrix doesn't reflow once cells fill in.
  const renderSkeleton = () => (
    <Card
      radius={2}
      shadow={1}
      tone="transparent"
      style={{
        border: '1px dashed var(--card-border-color, #d1d5db)',
        aspectRatio: channel.key === 'sms' ? '9 / 16' : '4 / 5',
        minHeight: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack space={2} style={{textAlign: 'center'}}>
        <Text muted size={1} weight="medium">
          No variation yet
        </Text>
        <Text muted size={0}>
          Click <em>Generate</em> to fill this cell
        </Text>
      </Stack>
    </Card>
  )

  let inner: React.ReactNode
  if (!variation) {
    inner = renderSkeleton()
  } else if (status === 'generating') {
    inner = (
      <Card padding={4} tone="primary" radius={2} shadow={1}>
        <Flex align="center" justify="center" gap={2} style={{minHeight: 160}}>
          <Spinner muted />
          <Text size={1}>Generating…</Text>
        </Flex>
      </Card>
    )
  } else if (status === 'error') {
    inner = (
      <Card padding={4} tone="critical" radius={2} shadow={1}>
        <Stack space={2} style={{minHeight: 160}}>
          <Text size={1} weight="semibold">
            Generation failed
          </Text>
          <Text size={0} muted>
            {variation.error ?? 'Unknown error'}
          </Text>
        </Stack>
      </Card>
    )
  } else if (channel.key === 'web') {
    inner = (
      <WebHeroCard
        client={client}
        web={variation.web as never}
        brandColor={brandColor}
        brief={brief}
        mergeFields={mergeFields}
        tokenMode={tokenMode}
      />
    )
  } else if (channel.key === 'email') {
    inner = (
      <EmailClientMock
        client={client}
        email={variation.email as never}
        heroImage={webHeroForCell(allVariations, segment.key, stepKey ?? 'default')}
        brand={brand}
        brandColor={brandColor}
        brief={brief}
        mergeFields={mergeFields}
        tokenMode={tokenMode}
      />
    )
  } else {
    inner = (
      <PhoneSmsBubble
        client={client}
        sms={variation.sms as never}
        brand={brand}
        brandColor={brandColor}
        brief={brief}
        mergeFields={mergeFields}
        tokenMode={tokenMode}
      />
    )
  }

  // Eligible to View when we have a real variation that's been generated
  // (no point showing a giant empty/error preview at scale).
  const canView = !!variation && status !== 'generating' && status !== 'error'

  return (
    <Card radius={2} shadow={1} padding={2} tone="default">
      <Stack space={2}>
        <Flex align="center" justify="space-between" gap={2} wrap="wrap">
          <Inline space={2}>
            <Badge tone={statusTone(status)} mode="outline" padding={1}>
              {statusLabel(status)}
            </Badge>
            {outOfDate ? <Badge tone="caution">Out of date</Badge> : null}
          </Inline>
          {canView && variation ? (
            <Button
              ref={viewBtnRef}
              mode="bleed"
              fontSize={1}
              padding={2}
              icon={EyeOpenIcon}
              text="View"
              onClick={() =>
                onView(
                  {
                    channelKey: channel.key,
                    channelTitle: channel.title,
                    segment,
                    stepKey,
                    stepIntent,
                    variation,
                    outOfDate,
                  },
                  viewBtnRef.current,
                )
              }
            />
          ) : null}
        </Flex>
        {inner}
      </Stack>
    </Card>
  )
}

function findVariation(
  variations: FetchedVariation[],
  channel: string,
  segment: string,
  flowStep: string,
): FetchedVariation | undefined {
  return variations.find(
    (v) => v.channel === channel && v.segment === segment && (v.flowStep ?? 'default') === flowStep,
  )
}

interface MatrixGridProps {
  brief: MinimalBrief
  briefRev?: string
  channels: Array<{_id: string; key: 'web' | 'email' | 'sms'; title?: string}>
  segments: NonNullable<FetchedBrief['targetSegments']>
  variations: FetchedVariation[]
  mergeFields: MergeField[]
  tokenMode: TokenMode
  flowStep: string
  stepIntent?: string
  onView: (req: CellOpenRequest, returnEl: HTMLElement | null) => void
}

function MatrixGrid({
  brief,
  briefRev,
  channels,
  segments,
  variations,
  mergeFields,
  tokenMode,
  flowStep,
  stepIntent,
  onView,
}: MatrixGridProps) {
  const cols = channels.length || 1
  const gridStyle = {gridTemplateColumns: `180px repeat(${cols}, minmax(300px, 1fr))`}

  return (
    <Stack space={4}>
      {/* Channel header row */}
      <Grid columns={cols + 1} gap={4} style={gridStyle}>
        <Box />
        {channels.map((ch) => (
          <Box key={ch._id} paddingX={2} paddingY={2}>
            <Inline space={2}>
              <Box
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: ATT_BLUE,
                }}
              />
              <Text size={1} weight="semibold" textOverflow="ellipsis" style={{color: ATT_BLUE}}>
                {(ch.title ?? ch.key).toUpperCase()}
              </Text>
            </Inline>
          </Box>
        ))}
      </Grid>

      {segments.map((seg) => (
        <Grid key={seg._id} columns={cols + 1} gap={4} style={gridStyle}>
          {/* Segment label cell */}
          <Card padding={3} radius={2} tone="transparent">
            <Stack space={2}>
              <Text size={1} weight="semibold" textOverflow="ellipsis">
                {seg.title ?? seg.key}
              </Text>
              {seg.brand ? (
                <Text size={0} muted style={{textTransform: 'uppercase', letterSpacing: 0.5}}>
                  {seg.brand}
                </Text>
              ) : null}
              {seg.brandColor ? (
                <Inline space={2}>
                  <Box
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      background: seg.brandColor,
                      border: '1px solid rgba(0,0,0,0.1)',
                    }}
                  />
                  <Text size={0} muted style={{fontFamily: 'ui-monospace, monospace'}}>
                    {seg.brandColor}
                  </Text>
                </Inline>
              ) : null}
            </Stack>
          </Card>

          {channels.map((ch) => (
            <Box key={ch._id}>
              <Cell
                brief={brief}
                briefRev={briefRev}
                segment={seg}
                channel={ch}
                variation={findVariation(variations, ch.key, seg.key, flowStep)}
                allVariations={variations}
                mergeFields={mergeFields}
                tokenMode={tokenMode}
                stepKey={flowStep === 'default' ? undefined : flowStep}
                stepIntent={stepIntent}
                onView={onView}
              />
            </Box>
          ))}
        </Grid>
      ))}
    </Stack>
  )
}

export const VariationMatrixView: UserViewComponent = ({documentId}: {documentId: string}) => {
  const client = useClient({apiVersion: API_VERSION})
  const [brief, setBrief] = useState<FetchedBrief | null>(null)
  const [variations, setVariations] = useState<FetchedVariation[]>([])
  const [mergeFields, setMergeFields] = useState<MergeField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tokenMode, setTokenMode] = useState<TokenMode>('raw')
  const [reloadTick, setReloadTick] = useState(0)
  // Per-cell dialog state. We track the element to restore focus to on close.
  const [dialogReq, setDialogReq] = useState<CellOpenRequest | null>(null)
  const dialogFocusReturnRef = useRef<HTMLElement | null>(null)
  // Independent token mode inside the dialog so toggling it doesn't reset the matrix.
  const [dialogTokenMode, setDialogTokenMode] = useState<TokenMode>('raw')

  // Strip drafts. prefix if present — documentId can come either way depending on perspective.
  const baseId = useMemo(
    () => (documentId?.startsWith('drafts.') ? documentId.slice('drafts.'.length) : documentId),
    [documentId],
  )

  useEffect(() => {
    if (!baseId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      client.fetch<FetchedBrief | null>(BRIEF_QUERY, {id: baseId}),
      client.fetch<FetchedVariation[]>(VARIATIONS_QUERY, {id: baseId}),
      client.fetch<MergeField[]>(MERGE_FIELDS_QUERY),
    ])
      .then(([b, vars, mfs]) => {
        if (cancelled) return
        setBrief(b)
        setVariations(preferDraft(vars ?? []))
        setMergeFields(mfs ?? [])
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [client, baseId, reloadTick])

  // Live-update: subscribe to variations changes for this brief.
  useEffect(() => {
    if (!baseId) return
    const sub = client
      .listen(VARIATIONS_QUERY, {id: baseId}, {includeResult: true, visibility: 'query'})
      .subscribe({
        next: () => setReloadTick((t) => t + 1),
        error: () => {
          /* live updates are nice-to-have; ignore */
        },
      })
    return () => sub.unsubscribe()
  }, [client, baseId])

  if (loading && !brief) {
    return (
      <Flex align="center" justify="center" padding={5} style={{minHeight: 240}}>
        <Inline space={2}>
          <Spinner />
          <Text muted>Loading brief…</Text>
        </Inline>
      </Flex>
    )
  }

  if (error) {
    return (
      <Box padding={4}>
        <Card padding={4} tone="critical" radius={2} shadow={1}>
          <Stack space={2}>
            <Text weight="semibold">Failed to load the matrix.</Text>
            <Text size={1}>{error}</Text>
          </Stack>
        </Card>
      </Box>
    )
  }

  if (!brief) {
    return (
      <Box padding={4}>
        <Card padding={4} radius={2} tone="caution" shadow={1}>
          <Text>Brief not found.</Text>
        </Card>
      </Box>
    )
  }

  const segments = brief.targetSegments ?? []
  const isAbandonedCart = !!brief.multiStep

  const briefForTokens: {
    _id: string
    offer?: string
    featuredProduct?: unknown
    [key: string]: unknown
  } = {
    _id: brief._id,
    offer: brief.offer,
    featuredProduct: brief.featuredProduct,
  }

  const handleOpenView = (req: CellOpenRequest, returnEl: HTMLElement | null) => {
    dialogFocusReturnRef.current = returnEl
    setDialogTokenMode(tokenMode)
    setDialogReq(req)
  }

  const handleCloseView = () => {
    setDialogReq(null)
    // Restore focus to the originating View button.
    requestAnimationFrame(() => {
      dialogFocusReturnRef.current?.focus?.()
    })
  }

  return (
    <Box padding={4} style={{overflowY: 'auto', maxHeight: '100%'}}>
      <Stack space={5}>
        {/* Header — title + token toggle + summary stats */}
        <Flex align="flex-start" justify="space-between" gap={3} wrap="wrap">
          <Stack space={2}>
            <Heading size={1}>{brief.title ?? '(untitled brief)'}</Heading>
            <Inline space={2}>
              <Badge tone={isAbandonedCart ? 'primary' : 'positive'} mode="outline">
                {isAbandonedCart ? 'Multi-step' : 'Single-step'}
              </Badge>
              <Badge mode="outline">
                {segments.length} segment{segments.length === 1 ? '' : 's'}
              </Badge>
              <Badge mode="outline">
                {variations.length} variation{variations.length === 1 ? '' : 's'}
              </Badge>
            </Inline>
          </Stack>
          <Stack space={2}>
            <Inline space={2}>
              <Text size={1} muted>
                Tokens:
              </Text>
              <Button
                text="Raw"
                mode={tokenMode === 'raw' ? 'default' : 'ghost'}
                tone={tokenMode === 'raw' ? 'primary' : 'default'}
                onClick={() => setTokenMode('raw')}
              />
              <Button
                text="Merged"
                mode={tokenMode === 'merged' ? 'default' : 'ghost'}
                tone={tokenMode === 'merged' ? 'primary' : 'default'}
                onClick={() => setTokenMode('merged')}
              />
            </Inline>
            {tokenMode === 'raw' ? <TokenLegend /> : null}
          </Stack>
        </Flex>

        {isAbandonedCart ? (
          <AbandonedCartStacked
            brief={brief}
            briefForTokens={briefForTokens}
            variations={variations}
            mergeFields={mergeFields}
            tokenMode={tokenMode}
            onView={handleOpenView}
          />
        ) : (
          <MatrixGrid
            brief={briefForTokens}
            briefRev={brief._rev}
            channels={brief.targetChannels ?? []}
            segments={segments}
            variations={variations}
            mergeFields={mergeFields}
            tokenMode={tokenMode}
            flowStep="default"
            onView={handleOpenView}
          />
        )}
      </Stack>

      {dialogReq ? (
        <CellViewDialog
          client={client}
          channelKey={dialogReq.channelKey}
          channelLabel={dialogReq.channelTitle}
          segmentTitle={dialogReq.segment.title ?? dialogReq.segment.key}
          brand={dialogReq.segment.brand?.toUpperCase()}
          brandColor={dialogReq.segment.brandColor}
          stepKey={dialogReq.stepKey}
          stepIntent={dialogReq.stepIntent}
          web={
            (dialogReq.variation.web ??
              variations.find(
                (v) =>
                  v.channel === 'web' &&
                  v.segment === dialogReq.segment.key &&
                  (v.flowStep ?? 'default') === (dialogReq.stepKey ?? 'default'),
              )?.web) as never
          }
          email={dialogReq.variation.email as never}
          sms={dialogReq.variation.sms as never}
          brief={briefForTokens}
          briefRev={brief._rev}
          mergeFields={mergeFields}
          tokenMode={dialogTokenMode}
          onTokenModeChange={setDialogTokenMode}
          outOfDate={dialogReq.outOfDate}
          onClose={handleCloseView}
        />
      ) : null}
    </Box>
  )
}

/**
 * Abandoned-cart layout: every flow step is rendered as a stacked section in
 * one scrollable column. No tabs — Shehjad wants the whole journey visible at
 * once for stakeholder demos. Each section has a Card wrapper with the step
 * intent and delay called out above its grid.
 */
function AbandonedCartStacked({
  brief,
  briefForTokens,
  variations,
  mergeFields,
  tokenMode,
  onView,
}: {
  brief: FetchedBrief
  briefForTokens: MinimalBrief
  variations: FetchedVariation[]
  mergeFields: MergeField[]
  tokenMode: TokenMode
  onView: (req: CellOpenRequest, returnEl: HTMLElement | null) => void
}) {
  const steps = brief.flowSteps ?? []
  if (steps.length === 0) {
    return (
      <Card padding={4} tone="caution" radius={2} shadow={1}>
        <Text>No flow steps defined on this brief.</Text>
      </Card>
    )
  }
  return (
    <Stack space={5}>
      {steps.map((step, index) => (
        <Card key={step.stepKey} padding={4} radius={2} shadow={1} tone="transparent">
          <Stack space={4}>
            {/* Step header — index + key + delay + intent */}
            <Flex align="flex-start" justify="space-between" gap={3} wrap="wrap">
              <Stack space={2}>
                <Inline space={2}>
                  <Badge tone="primary" mode="outline">
                    Step {index + 1}
                  </Badge>
                  <Text size={1} weight="semibold" style={{color: ATT_BLUE}}>
                    {step.stepKey.toUpperCase()}
                  </Text>
                  {step.delayLabel ? (
                    <Badge mode="outline" tone="default">
                      {step.delayLabel}
                    </Badge>
                  ) : null}
                </Inline>
                {step.intent ? (
                  <Heading size={2} style={{maxWidth: 720}}>
                    {step.intent}
                  </Heading>
                ) : null}
              </Stack>
            </Flex>

            <MatrixGrid
              brief={briefForTokens}
              briefRev={brief._rev}
              channels={step.channels ?? []}
              segments={brief.targetSegments ?? []}
              variations={variations}
              mergeFields={mergeFields}
              tokenMode={tokenMode}
              flowStep={step.stepKey}
              stepIntent={step.intent}
              onView={onView}
            />
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}
