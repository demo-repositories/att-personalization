import {
  Card, Stack, Flex, Text, Heading, Button, Box, Grid, Badge, Inline, useToast, Spinner, Tab, TabList, TabPanel
} from '@sanity/ui'
import {useClient} from '@sanity/sdk-react'
import {useEffect, useState, useMemo, useCallback} from 'react'
import type {SanityClient} from '@sanity/client'
import {BRIEF_DETAIL_QUERY, MATRIX_QUERY} from '../queries'
import type {AppConfig} from '../CampaignStudio'
import type {CampaignBrief, VariationCell, ChannelKey, SegmentKey} from '../types'
import {WebHeroCard} from '../components/previews-stub/WebHeroCard'
import {EmailClientMock} from '../components/previews-stub/EmailClientMock'
import {PhoneSmsBubble} from '../components/previews-stub/PhoneSmsBubble'
import {TokenModeToggle, type TokenMode} from '../components/previews-stub/TokenText'
import {buildTokenMap} from '../tokenMap'
import {generateMatrix, type ChannelKey as CK} from '@studio/personalization/generate/orchestrate'
import {GenerateDialog} from './GenerateDialog'
import {OpenInStudioButton} from '../components/OpenInStudioButton'

export function MatrixView({
  briefId, config, onEdit, onBack,
}: {
  briefId: string
  config: AppConfig
  onEdit: (id: string) => void
  onBack: () => void
}) {
  const client = useClient({apiVersion: '2024-11-12'}) as unknown as SanityClient
  const writeClient = useClient({apiVersion: 'vX'}) as unknown as SanityClient
  const toast = useToast()
  const [brief, setBrief] = useState<CampaignBrief | null>(null)
  const [cells, setCells] = useState<VariationCell[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<TokenMode>('raw')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  // Load brief + cells
  useEffect(() => {
    let cancelled = false
    setError(null)
    Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.fetch(BRIEF_DETAIL_QUERY, {id: briefId}) as Promise<any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.withConfig({perspective: "raw"}).fetch(MATRIX_QUERY, {briefId}) as Promise<any>,
    ])
      .then(([b, c]) => {
        if (cancelled) return
        setBrief(b)
        setCells((c as VariationCell[]) || [])
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [client, briefId, refreshTick])

  const product = useMemo(() => {
    if (!brief?.featuredProduct?._ref) return undefined
    return config.products.find((p) => p._id === brief.featuredProduct?._ref)
  }, [brief, config.products])

  const tokens = useMemo(
    () =>
      buildTokenMap(config.mergeFields, {
        offer: brief?.offer,
        featuredProductRef: brief?.featuredProduct?._ref,
        product,
      }),
    [brief, config.mergeFields, product],
  )

  const isAbandoned = brief?.campaignType === 'abandoned-cart'

  // Choose channel set per step / brief
  const channelKeysForStep = useCallback(
    (stepKey: string | null): ChannelKey[] => {
      if (!brief) return []
      if (isAbandoned && stepKey) {
        const step = (brief.flowSteps || []).find((s) => s.stepKey === stepKey)
        return (step?.channels || [])
          .map((r) => config.channels.find((c) => c._id === r._ref)?.key)
          .filter((k): k is ChannelKey => !!k)
      }
      return (brief.targetChannels || [])
        .map((r) => config.channels.find((c) => c._id === r._ref)?.key)
        .filter((k): k is ChannelKey => !!k)
    },
    [brief, config.channels, isAbandoned],
  )

  const segmentKeys: SegmentKey[] = useMemo(() => {
    if (!brief) return []
    return (brief.targetSegments || [])
      .map((r) => config.segments.find((s) => s._id === r._ref)?.key)
      .filter((k): k is SegmentKey => !!k)
  }, [brief, config.segments])

  // Active flow step state (init once brief loads)
  useEffect(() => {
    if (isAbandoned && !activeStep && brief?.flowSteps?.length) {
      setActiveStep(brief.flowSteps[0]!.stepKey)
    }
  }, [isAbandoned, activeStep, brief])

  const findCell = useCallback(
    (channel: ChannelKey, segment: SegmentKey, stepKey: string | null): VariationCell | undefined => {
      const wantStep = stepKey || 'default'
      return (cells || []).find(
        (c) => c.channel === channel && c.segment === segment && (c.flowStep || 'default') === wantStep,
      )
    },
    [cells],
  )

  const needsAttentionPredicate = useCallback(
    (target: {channel: CK; segment: string; step?: string}) => {
      const cell = findCell(target.channel as ChannelKey, target.segment as SegmentKey, target.step || null)
      if (!cell) return true
      if (cell.status !== 'generated') return true
      if (brief?._rev && cell.generatedFromBriefRev && cell.generatedFromBriefRev !== brief._rev) return true
      return false
    },
    [findCell, brief?._rev],
  )

  async function regenerateCell(channel: ChannelKey, segment: SegmentKey, stepKey: string | null) {
    if (!brief) return
    const cellKey = `${stepKey || 'default'}/${channel}/${segment}`
    setRegenerating(cellKey)
    try {
      const briefIdClean = brief._id.replace(/^drafts\./, '')
      await generateMatrix(writeClient, {
        briefId: briefIdClean,
        channels: [channel as CK],
        segments: [segment],
        steps: stepKey ? [stepKey] : undefined,
      })
      toast.push({status: 'success', title: `Regenerated ${channel}/${segment}`})
      setRefreshTick((t) => t + 1)
    } catch (e) {
      toast.push({status: 'error', title: 'Regenerate failed', description: String(e)})
    } finally {
      setRegenerating(null)
    }
  }

  if (error) {
    return (
      <Card padding={4} tone="critical">
        <Stack space={3}>
          <Text>Failed to load matrix: {error}</Text>
          <Button text="Back" mode="ghost" onClick={onBack} />
        </Stack>
      </Card>
    )
  }
  if (!brief || !cells) {
    return (
      <Card padding={4}>
        <Flex align="center" gap={3}>
          <Spinner muted />
          <Text muted>Loading matrix…</Text>
        </Flex>
      </Card>
    )
  }

  const channelKeysActive = channelKeysForStep(isAbandoned ? activeStep : null)
  const totalCells = (isAbandoned
    ? (brief.flowSteps || []).reduce((a, s) => a + ((s.channels || []).length * segmentKeys.length), 0)
    : channelKeysForStep(null).length * segmentKeys.length)
  const generatedCount = cells.filter((c) => c.status === 'generated').length

  return (
    <Stack space={4}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
        <Stack space={2}>
          <Button text="← Back to briefs" mode="bleed" onClick={onBack} />
          <Flex align="center" gap={2}>
            <Heading size={3}>{brief.title || '(untitled)'}</Heading>
            <Badge tone={isAbandoned ? 'caution' : 'primary'}>
              {isAbandoned ? 'Abandoned cart' : 'Promotional'}
            </Badge>
          </Flex>
          <Text size={1} muted>{generatedCount} / {totalCells} cells generated</Text>
        </Stack>
        <Flex gap={2} align="center" wrap="wrap">
          <TokenModeToggle mode={mode} onModeChange={setMode} />
          <Button text="Edit brief" mode="ghost" onClick={() => onEdit(brief._id)} />
          <Button text="Generate" tone="primary" onClick={() => setGenerateOpen(true)} />
        </Flex>
      </Flex>

      {isAbandoned && brief.flowSteps && brief.flowSteps.length > 0 && (
        <Card padding={1} radius={2} shadow={1}>
          <TabList space={1}>
            {brief.flowSteps.map((step) => (
              <Tab
                key={step.stepKey}
                id={`step-tab-${step.stepKey}`}
                aria-controls={`step-panel-${step.stepKey}`}
                label={`${step.stepKey}${step.delayLabel ? ' · ' + step.delayLabel : ''}`}
                selected={activeStep === step.stepKey}
                onClick={() => setActiveStep(step.stepKey)}
              />
            ))}
          </TabList>
        </Card>
      )}

      {/* Grid header: columns = channels */}
      <Box>
        <Grid
          columns={[1, 1, channelKeysActive.length + 1]}
          gap={3}
          style={{minWidth: 0}}
        >
          {/* Top-left empty corner */}
          <Box>
            <Text size={0} muted weight="medium">Segment ↓ / Channel →</Text>
          </Box>
          {channelKeysActive.map((ch) => {
            const cd = config.channels.find((c) => c.key === ch)
            return (
              <Box key={ch}>
                <Flex align="center" gap={2}>
                  <Text size={1} weight="bold">{cd?.title || ch}</Text>
                  {cd?.maxLength && <Badge tone="default">≤{cd.maxLength}</Badge>}
                </Flex>
              </Box>
            )
          })}

          {/* Rows: one per segment */}
          {segmentKeys.map((seg) => {
            const segDoc = config.segments.find((s) => s.key === seg)
            return (
              <SegmentRow
                key={seg}
                segmentKey={seg}
                segmentTitle={segDoc?.title || seg}
                brand={segDoc?.brand}
                brandColor={segDoc?.brandColor}
                channelKeys={channelKeysActive}
                stepKey={isAbandoned ? activeStep : null}
                cells={cells}
                tokens={tokens}
                mode={mode}
                regenerating={regenerating}
                onRegenerate={regenerateCell}
              />
            )
          })}
        </Grid>
      </Box>

      {generateOpen && (
        <GenerateDialog
          brief={brief}
          config={config}
          needsAttentionPredicate={needsAttentionPredicate}
          onClose={() => {
            setGenerateOpen(false)
            setRefreshTick((t) => t + 1)
          }}
          onOpenMatrix={() => {
            setGenerateOpen(false)
            setRefreshTick((t) => t + 1)
          }}
        />
      )}
    </Stack>
  )
}

function SegmentRow({
  segmentKey, segmentTitle, brand, brandColor, channelKeys, stepKey, cells, tokens, mode, regenerating, onRegenerate,
}: {
  segmentKey: SegmentKey
  segmentTitle: string
  brand?: string
  brandColor?: string
  channelKeys: ChannelKey[]
  stepKey: string | null
  cells: VariationCell[]
  tokens: Record<string, {key: string; source: 'sanity' | 'external' | 'unresolved'; sampleValue?: string; label?: string}>
  mode: TokenMode
  regenerating: string | null
  onRegenerate: (channel: ChannelKey, segment: SegmentKey, stepKey: string | null) => void
}) {
  return (
    <>
      <Card padding={3} radius={2} shadow={1} style={{background: '#fff'}}>
        <Stack space={2}>
          <Flex align="center" gap={2}>
            <Box style={{width: 12, height: 12, borderRadius: 2, background: brandColor || '#94a3b8'}} />
            <Text size={1} weight="medium">{segmentTitle}</Text>
          </Flex>
          <Text size={0} muted>{brand?.toUpperCase() || 'AT&T'}</Text>
          <Badge tone="default">{segmentKey}</Badge>
        </Stack>
      </Card>
      {channelKeys.map((ch) => {
        const cell = cells.find(
          (c) => c.channel === ch && c.segment === segmentKey && (c.flowStep || 'default') === (stepKey || 'default')
        )
        const cellKey = `${stepKey || 'default'}/${ch}/${segmentKey}`
        const busy = regenerating === cellKey
        return (
          <MatrixCell
            key={ch}
            channel={ch}
            cell={cell}
            tokens={tokens}
            mode={mode}
            brandColor={brandColor}
            brand={brand}
            busy={busy}
            onRegenerate={() => onRegenerate(ch, segmentKey, stepKey)}
          />
        )
      })}
    </>
  )
}

function MatrixCell({
  channel, cell, tokens, mode, brandColor, brand, busy, onRegenerate,
}: {
  channel: ChannelKey
  cell: VariationCell | undefined
  tokens: Record<string, {key: string; source: 'sanity' | 'external' | 'unresolved'; sampleValue?: string; label?: string}>
  mode: TokenMode
  brandColor?: string
  brand?: string
  busy: boolean
  onRegenerate: () => void
}) {
  return (
    <Card padding={2} radius={2} shadow={1} style={{background: '#fff'}}>
      <Stack space={2}>
        <Flex justify="space-between" align="center" gap={2}>
          <StatusPill status={cell?.status} />
          {cell?.generatedAt && (
            <Text size={0} muted>{new Date(cell.generatedAt).toLocaleString()}</Text>
          )}
        </Flex>

        {/* Preview */}
        <Box>
          {!cell ? (
            <Card padding={4} tone="transparent" border>
              <Text size={1} muted align="center">No variation yet</Text>
            </Card>
          ) : channel === 'web' ? (
            <WebHeroCard
              headline={cell.web?.headline}
              subheadline={cell.web?.subheadline}
              ctaLabel={cell.web?.ctaLabel}
              ctaUrl={cell.web?.ctaUrl}
              brandColor={brandColor}
              mode={mode}
              tokens={tokens}
            />
          ) : channel === 'email' ? (
            <EmailClientMock
              brand={brand}
              subjectLine={cell.email?.subjectLine}
              preheader={cell.email?.preheader}
              ctaLabel={cell.email?.ctaLabel}
              ctaUrl={cell.email?.ctaUrl}
              brandColor={brandColor}
              mode={mode}
              tokens={tokens}
            />
          ) : (
            <PhoneSmsBubble
              message={cell.sms?.message}
              link={cell.sms?.link}
              brandColor={brandColor}
              mode={mode}
              tokens={tokens}
            />
          )}
        </Box>

        <Flex justify="flex-end" gap={1}>
          <Button
            text={busy ? '…' : 'Regenerate'}
            mode="bleed"
            disabled={busy}
            loading={busy}
            onClick={onRegenerate}
            fontSize={0}
          />
          {cell && <OpenInStudioButton documentId={cell._id} />}
        </Flex>
      </Stack>
    </Card>
  )
}

function StatusPill({status}: {status?: string}) {
  if (!status) return <Badge tone="default">No cell</Badge>
  if (status === 'generated') return <Badge tone="positive">Generated</Badge>
  if (status === 'generating') return <Badge tone="caution">Generating…</Badge>
  if (status === 'error') return <Badge tone="critical">Error</Badge>
  return <Badge tone="default">{status}</Badge>
}
