// studio/src/ui/campaign/VariationMatrixView.tsx
//
// Document view on campaignBrief — fetches contentVariation docs and renders
// them as a (segment × channel) matrix for promotional campaigns, or a per-step
// grid for abandoned-cart flows.
//
// Each cell shows: status chip + "out of date" badge + the right channel preview
// (WebHeroCard / EmailClientMock / PhoneSmsBubble) with a raw/merged token toggle.

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
  Tab,
  TabList,
  TabPanel,
  Text,
} from '@sanity/ui'
import {useEffect, useMemo, useState} from 'react'
import {useClient} from 'sanity'
import type {UserViewComponent} from 'sanity/structure'
import {WebHeroCard} from './previews/WebHeroCard'
import {EmailClientMock} from './previews/EmailClientMock'
import {PhoneSmsBubble} from './previews/PhoneSmsBubble'
import {TokenLegend, type TokenMode} from './previews/TokenText'
import type {MergeField, MinimalBrief} from '../../personalization/generate/tokens'

const API_VERSION = '2024-10-01'

// Live-fetched brief shape — enough to drive the matrix.
interface FetchedBrief {
  _id: string
  _rev?: string
  title?: string
  campaignType?: 'promotional' | 'abandoned-cart' | string
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
  _id, _rev, title, campaignType, offer, featuredProduct,
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
    // Prefer the drafts version if we already have published, or keep whichever is non-empty.
    const isDraft = v._id.startsWith('drafts.')
    if (isDraft) byKey.set(key, v)
  }
  return Array.from(byKey.values())
}

function statusTone(status: FetchedVariation['status']): 'default' | 'positive' | 'caution' | 'critical' | 'primary' {
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

// Render one cell — the channel-specific preview + the status/out-of-date chips.
function Cell({
  brief,
  briefRev,
  segment,
  channelKey,
  variation,
  mergeFields,
  tokenMode,
}: {
  brief: MinimalBrief
  briefRev?: string
  segment: NonNullable<FetchedBrief['targetSegments']>[number]
  channelKey: 'web' | 'email' | 'sms'
  variation: FetchedVariation | undefined
  mergeFields: MergeField[]
  tokenMode: TokenMode
}) {
  const client = useClient({apiVersion: API_VERSION})
  const brandColor = segment.brandColor
  const brand = segment.brand?.toUpperCase()
  const status = variation?.status ?? null
  const outOfDate =
    variation?.generatedFromBriefRev != null &&
    briefRev != null &&
    variation.generatedFromBriefRev !== briefRev

  let inner: React.ReactNode
  if (!variation) {
    inner = (
      <Card padding={4} tone="transparent" radius={2} border style={{borderStyle: 'dashed'}}>
        <Flex align="center" justify="center" style={{minHeight: 120}}>
          <Text muted size={1}>No variation generated yet</Text>
        </Flex>
      </Card>
    )
  } else if (status === 'generating') {
    inner = (
      <Card padding={4} tone="primary" radius={2} border>
        <Flex align="center" justify="center" gap={2} style={{minHeight: 120}}>
          <Spinner muted />
          <Text size={1}>Generating…</Text>
        </Flex>
      </Card>
    )
  } else if (status === 'error') {
    inner = (
      <Card padding={4} tone="critical" radius={2} border>
        <Stack space={2} style={{minHeight: 120}}>
          <Text size={1} weight="semibold">Generation failed</Text>
          <Text size={0} muted>{variation.error ?? 'Unknown error'}</Text>
        </Stack>
      </Card>
    )
  } else if (channelKey === 'web') {
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
  } else if (channelKey === 'email') {
    inner = (
      <EmailClientMock
        client={client}
        email={variation.email as never}
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

  return (
    <Stack space={2}>
      <Flex align="center" gap={2} wrap="wrap">
        <Badge tone={statusTone(status)} mode="outline">
          {statusLabel(status)}
        </Badge>
        {outOfDate ? (
          <Badge tone="caution">Out of date</Badge>
        ) : null}
      </Flex>
      {inner}
    </Stack>
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
}: MatrixGridProps) {
  const cols = channels.length || 1

  return (
    <Stack space={3}>
      {/* Channel header row */}
      <Grid
        columns={cols + 1}
        gap={3}
        style={{gridTemplateColumns: `160px repeat(${cols}, minmax(280px, 1fr))`}}
      >
        <Box />
        {channels.map((ch) => (
          <Box key={ch._id} paddingX={2}>
            <Text size={1} weight="semibold" textOverflow="ellipsis">
              {ch.title ?? ch.key}
            </Text>
          </Box>
        ))}
      </Grid>

      {segments.map((seg) => (
        <Grid
          key={seg._id}
          columns={cols + 1}
          gap={3}
          style={{gridTemplateColumns: `160px repeat(${cols}, minmax(280px, 1fr))`}}
        >
          {/* Segment label cell */}
          <Card padding={3} radius={2} tone="transparent">
            <Stack space={2}>
              <Text size={1} weight="semibold" textOverflow="ellipsis">
                {seg.title ?? seg.key}
              </Text>
              {seg.brand ? (
                <Text size={0} muted style={{textTransform: 'uppercase'}}>
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
                  <Text size={0} muted>{seg.brandColor}</Text>
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
                channelKey={ch.key}
                variation={findVariation(variations, ch.key, seg.key, flowStep)}
                mergeFields={mergeFields}
                tokenMode={tokenMode}
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
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

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
        error: () => {/* live updates are nice-to-have; ignore */},
      })
    return () => sub.unsubscribe()
  }, [client, baseId])

  // Default the active step once flowSteps load.
  useEffect(() => {
    if (!brief?.flowSteps || brief.flowSteps.length === 0) return
    if (activeStep == null && brief.flowSteps[0]) {
      setActiveStep(brief.flowSteps[0].stepKey)
    }
  }, [brief, activeStep])

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
        <Card padding={4} tone="critical" radius={2}>
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
        <Card padding={4} radius={2} tone="caution">
          <Text>Brief not found.</Text>
        </Card>
      </Box>
    )
  }

  const segments = brief.targetSegments ?? []
  const isAbandonedCart = brief.campaignType === 'abandoned-cart'

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

  return (
    <Box padding={4} style={{overflowY: 'auto', maxHeight: '100%'}}>
      <Stack space={4}>
        {/* Header — title + token toggle + summary stats */}
        <Flex align="flex-start" justify="space-between" gap={3} wrap="wrap">
          <Stack space={2}>
            <Heading size={1}>{brief.title ?? '(untitled brief)'}</Heading>
            <Inline space={2}>
              <Badge tone={isAbandonedCart ? 'primary' : 'positive'} mode="outline">
                {brief.campaignType}
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
              <Text size={1} muted>Tokens:</Text>
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
          <AbandonedCartTabs
            brief={brief}
            briefForTokens={briefForTokens}
            variations={variations}
            mergeFields={mergeFields}
            tokenMode={tokenMode}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
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
          />
        )}
      </Stack>
    </Box>
  )
}

function AbandonedCartTabs({
  brief,
  briefForTokens,
  variations,
  mergeFields,
  tokenMode,
  activeStep,
  setActiveStep,
}: {
  brief: FetchedBrief
  briefForTokens: MinimalBrief
  variations: FetchedVariation[]
  mergeFields: MergeField[]
  tokenMode: TokenMode
  activeStep: string | null
  setActiveStep: (s: string) => void
}) {
  const steps = brief.flowSteps ?? []
  const current = steps.find((s) => s.stepKey === activeStep) ?? steps[0]
  if (!current) {
    return (
      <Card padding={4} tone="caution" radius={2}>
        <Text>No flow steps defined on this brief.</Text>
      </Card>
    )
  }
  return (
    <Stack space={4}>
      <TabList space={1}>
        {steps.map((step) => (
          <Tab
            key={step.stepKey}
            id={`step-tab-${step.stepKey}`}
            aria-controls={`step-panel-${step.stepKey}`}
            label={`${step.stepKey}${step.delayLabel ? ` · ${step.delayLabel}` : ''}`}
            onClick={() => setActiveStep(step.stepKey)}
            selected={(activeStep ?? steps[0]?.stepKey) === step.stepKey}
          />
        ))}
      </TabList>
      <TabPanel
        id={`step-panel-${current.stepKey}`}
        aria-labelledby={`step-tab-${current.stepKey}`}
      >
        <Stack space={3}>
          {current.intent ? (
            <Card padding={3} tone="transparent" radius={2}>
              <Stack space={1}>
                <Text size={0} muted style={{textTransform: 'uppercase'}}>Step intent</Text>
                <Text size={1}>{current.intent}</Text>
              </Stack>
            </Card>
          ) : null}
          <MatrixGrid
            brief={briefForTokens}
            briefRev={brief._rev}
            channels={current.channels ?? []}
            segments={brief.targetSegments ?? []}
            variations={variations}
            mergeFields={mergeFields}
            tokenMode={tokenMode}
            flowStep={current.stepKey}
          />
        </Stack>
      </TabPanel>
    </Stack>
  )
}
