// apps/campaign-studio/src/views/MatrixView.tsx
//
// App-SDK matrix view — uses the SAME shared preview components as the Studio
// doc view (`@studio/ui/campaign/previews/*`) so the Variations surface looks
// identical between the two apps.
//
// Abandoned-cart campaigns render as stacked sections (one block per flow
// step) instead of click-through tabs. Per cell there's a "View" button that
// opens a larger <CellViewDialog> with its own raw/merged toggle + an
// "Open in Studio" footer.

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
  useToast,
} from '@sanity/ui'
import {EditIcon, EyeOpenIcon} from '@sanity/icons'
import {useClient} from '@sanity/sdk-react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import type {SanityClient} from '@sanity/client'
import {BRIEF_DETAIL_QUERY, MATRIX_QUERY} from '../queries'
import type {AppConfig} from '../CampaignStudio'
import type {CampaignBrief, ChannelKey, FlowStep, SegmentKey, VariationCell} from '../types'
import {ATT_BLUE} from '../constants'

// Shared, polished preview + dialog components — same source of truth as Studio.
import {WebHeroCard} from '@studio/ui/campaign/previews/WebHeroCard'
import {EmailClientMock} from '@studio/ui/campaign/previews/EmailClientMock'
import {PhoneSmsBubble} from '@studio/ui/campaign/previews/PhoneSmsBubble'
import {TokenLegend, type TokenMode} from '@studio/ui/campaign/previews/TokenText'
import {CellViewDialog} from '@studio/ui/campaign/CellViewDialog'
import {webHeroForCell} from '@studio/ui/campaign/previews/previewCommon'
import type {MergeField, MinimalBrief} from '@studio/personalization/generate/tokens'

import {generateMatrix, type ChannelKey as CK} from '@studio/personalization/generate/orchestrate'
import {GenerateDialog} from './GenerateDialog'
import {VariationEditor} from './VariationEditor'
import {OpenInStudioButton} from '../components/OpenInStudioButton'
import type {MediaAssetOption} from '../components/AllowedMediaPicker'

/**
 * The matrix fetch runs in the `raw` perspective so it sees freshly-edited
 * drafts. That means a cell that's been edited (but not yet approved) appears
 * twice — once as `drafts.<id>`, once as the published `<id>`. Collapse to one
 * per canonical id, preferring the draft so in-flight edits show immediately.
 */
function dedupeCells(cells: VariationCell[]): VariationCell[] {
  const byId = new Map<string, VariationCell>()
  for (const cell of cells) {
    const canonical = cell._id.replace(/^drafts\./, '')
    const existing = byId.get(canonical)
    if (!existing || cell._id.startsWith('drafts.')) byId.set(canonical, cell)
  }
  return [...byId.values()]
}

interface ResolvedSegment {
  _id: string
  key: SegmentKey
  title: string
  brand?: string
  brandColor?: string
}

interface ResolvedChannel {
  _id: string
  key: ChannelKey
  title: string
  maxLength?: number
}

interface CellOpenRequest {
  channel: ResolvedChannel
  segment: ResolvedSegment
  stepKey: string | null
  stepIntent?: string
  cell: VariationCell
  outOfDate: boolean
}

export function MatrixView({
  briefId,
  config,
  onEdit,
  onBack,
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
  const [tokenMode, setTokenMode] = useState<TokenMode>('raw')
  const [generateOpen, setGenerateOpen] = useState(false)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  // Per-cell view dialog
  const [dialogReq, setDialogReq] = useState<CellOpenRequest | null>(null)
  const [dialogTokenMode, setDialogTokenMode] = useState<TokenMode>('raw')
  const dialogFocusReturnRef = useRef<HTMLElement | null>(null)
  // Per-cell edit dialog
  const [editReq, setEditReq] = useState<CellOpenRequest | null>(null)

  // Load brief + cells
  useEffect(() => {
    let cancelled = false
    setError(null)
    Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.fetch(BRIEF_DETAIL_QUERY, {id: briefId}) as Promise<any>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.withConfig({perspective: 'raw'}).fetch(MATRIX_QUERY, {briefId}) as Promise<any>,
    ])
      .then(([b, c]) => {
        if (cancelled) return
        setBrief(b)
        setCells(dedupeCells((c as VariationCell[]) || []))
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [client, briefId, refreshTick])

  const isAbandoned = brief?.campaignType === 'abandoned-cart'

  // Resolve channel and segment refs to full docs ahead of render — the
  // shared previews want richer metadata than the channel/segment key.
  const resolveChannel = useCallback(
    (channelRef: {_ref: string}): ResolvedChannel | null => {
      const cd = config.channels.find((c) => c._id === channelRef._ref)
      if (!cd) return null
      return {
        _id: cd._id,
        key: cd.key,
        title: cd.title || cd.key.toUpperCase(),
        maxLength: cd.maxLength,
      }
    },
    [config.channels],
  )

  const resolveSegment = useCallback(
    (segRef: {_ref: string}): ResolvedSegment | null => {
      const sd = config.segments.find((s) => s._id === segRef._ref)
      if (!sd) return null
      return {
        _id: sd._id,
        key: sd.key,
        title: sd.title || sd.key,
        brand: sd.brand,
        brandColor: sd.brandColor,
      }
    },
    [config.segments],
  )

  const channelsForStep = useCallback(
    (step: FlowStep | null): ResolvedChannel[] => {
      if (!brief) return []
      const refs = step ? step.channels || [] : brief.targetChannels || []
      return refs
        .map((r) => resolveChannel(r))
        .filter((c): c is ResolvedChannel => c !== null)
    },
    [brief, resolveChannel],
  )

  const segments: ResolvedSegment[] = useMemo(() => {
    if (!brief) return []
    return (brief.targetSegments || [])
      .map((r) => resolveSegment(r))
      .filter((s): s is ResolvedSegment => s !== null)
  }, [brief, resolveSegment])

  // Pull mergeField docs from the config — the previews resolve their own
  // tokens via `client.fetch`, but they need the full registry to do it.
  // The CONFIG_QUERY shape returns MergeFieldDoc with `_id, key, source,
  // sampleValue, sanityResolver, label` — exactly the MergeField interface.
  const mergeFields: MergeField[] = useMemo(
    () =>
      config.mergeFields.map((mf) => ({
        key: mf.key,
        source: mf.source,
        sampleValue: mf.sampleValue,
        sanityResolver: mf.sanityResolver,
        label: mf.label,
      })),
    [config.mergeFields],
  )

  // The MinimalBrief shape the previews want for tokens.
  const briefForTokens: MinimalBrief | null = useMemo(() => {
    if (!brief) return null
    return {
      _id: brief._id,
      offer: brief.offer,
      featuredProduct: brief.featuredProduct,
    }
  }, [brief])

  // Media options for the editor's hero-image picker — constrained to the
  // brief's allowed assets (brief.allowedMedia → mediaAsset docs in config).
  const allowedMediaOptions: MediaAssetOption[] = useMemo(() => {
    if (!brief) return []
    const allowed = new Set((brief.allowedMedia || []).map((r) => r._ref))
    return config.mediaAssets.filter((m) => allowed.has(m._id))
  }, [brief, config.mediaAssets])

  const findCell = useCallback(
    (
      channelKey: ChannelKey,
      segmentKey: SegmentKey,
      stepKey: string | null,
    ): VariationCell | undefined => {
      const wantStep = stepKey || 'default'
      return (cells || []).find(
        (c) =>
          c.channel === channelKey &&
          c.segment === segmentKey &&
          (c.flowStep || 'default') === wantStep,
      )
    },
    [cells],
  )

  const needsAttentionPredicate = useCallback(
    (target: {channel: CK; segment: string; step?: string}) => {
      const cell = findCell(
        target.channel as ChannelKey,
        target.segment as SegmentKey,
        target.step || null,
      )
      if (!cell) return true
      if (cell.status !== 'generated') return true
      if (brief?._rev && cell.generatedFromBriefRev && cell.generatedFromBriefRev !== brief._rev)
        return true
      return false
    },
    [findCell, brief?._rev],
  )

  async function regenerateCell(
    channel: ChannelKey,
    segment: SegmentKey,
    stepKey: string | null,
  ) {
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

  const handleOpenView = (req: CellOpenRequest, returnEl: HTMLElement | null) => {
    dialogFocusReturnRef.current = returnEl
    setDialogTokenMode(tokenMode)
    setDialogReq(req)
  }

  const handleCloseView = () => {
    setDialogReq(null)
    requestAnimationFrame(() => {
      dialogFocusReturnRef.current?.focus?.()
    })
  }

  if (error) {
    return (
      <Card padding={4} tone="critical" radius={2} shadow={1}>
        <Stack space={3}>
          <Text>Failed to load matrix: {error}</Text>
          <Button text="Back" mode="ghost" onClick={onBack} />
        </Stack>
      </Card>
    )
  }
  if (!brief || !cells || !briefForTokens) {
    return (
      <Card padding={4} radius={2} shadow={1}>
        <Flex align="center" gap={3}>
          <Spinner muted />
          <Text muted>Loading matrix…</Text>
        </Flex>
      </Card>
    )
  }

  const totalCells = isAbandoned
    ? (brief.flowSteps || []).reduce(
        (a, s) => a + (s.channels || []).length * segments.length,
        0,
      )
    : channelsForStep(null).length * segments.length
  const generatedCount = cells.filter((c) => c.status === 'generated').length

  return (
    <Stack space={5}>
      <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
        <Stack space={2}>
          <Button text="← Back to briefs" mode="bleed" onClick={onBack} fontSize={1} />
          <Flex align="center" gap={2}>
            <Heading size={3}>{brief.title || '(untitled)'}</Heading>
            <Badge tone={isAbandoned ? 'caution' : 'primary'} mode="outline">
              {isAbandoned ? 'Abandoned cart' : 'Promotional'}
            </Badge>
          </Flex>
          <Text size={1} muted>
            {generatedCount} / {totalCells} cells generated
          </Text>
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
          <Flex gap={2} align="center" justify="flex-end" wrap="wrap">
            {tokenMode === 'raw' ? <TokenLegend /> : null}
            <Button text="Edit brief" mode="ghost" onClick={() => onEdit(brief._id)} />
            <Button text="Generate" tone="primary" onClick={() => setGenerateOpen(true)} />
          </Flex>
        </Stack>
      </Flex>

      {isAbandoned && brief.flowSteps && brief.flowSteps.length > 0 ? (
        <Stack space={5}>
          {brief.flowSteps.map((step, idx) => {
            const stepChannels = channelsForStep(step)
            return (
              <Card key={step.stepKey} padding={4} radius={2} shadow={1} tone="transparent">
                <Stack space={4}>
                  <Flex align="flex-start" justify="space-between" gap={3} wrap="wrap">
                    <Stack space={2}>
                      <Inline space={2}>
                        <Badge tone="primary" mode="outline">
                          Step {idx + 1}
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
                    channels={stepChannels}
                    segments={segments}
                    cells={cells}
                    mergeFields={mergeFields}
                    tokenMode={tokenMode}
                    stepKey={step.stepKey}
                    stepIntent={step.intent}
                    regenerating={regenerating}
                    onRegenerate={regenerateCell}
                    onView={handleOpenView}
                    onEdit={setEditReq}
                  />
                </Stack>
              </Card>
            )
          })}
        </Stack>
      ) : (
        <MatrixGrid
          brief={briefForTokens}
          briefRev={brief._rev}
          channels={channelsForStep(null)}
          segments={segments}
          cells={cells}
          mergeFields={mergeFields}
          tokenMode={tokenMode}
          stepKey={null}
          regenerating={regenerating}
          onRegenerate={regenerateCell}
          onView={handleOpenView}
          onEdit={setEditReq}
        />
      )}

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

      {dialogReq ? (
        <CellViewDialog
          client={client}
          channelKey={dialogReq.channel.key}
          channelLabel={dialogReq.channel.title}
          segmentTitle={dialogReq.segment.title}
          brand={dialogReq.segment.brand?.toUpperCase()}
          brandColor={dialogReq.segment.brandColor}
          stepKey={dialogReq.stepKey ?? undefined}
          stepIntent={dialogReq.stepIntent}
          web={
            (dialogReq.cell.web ??
              cells?.find(
                (c) =>
                  c.channel === 'web' &&
                  c.segment === dialogReq.segment.key &&
                  (c.flowStep || 'default') === (dialogReq.stepKey || 'default'),
              )?.web) as never
          }
          email={dialogReq.cell.email as never}
          sms={dialogReq.cell.sms as never}
          brief={briefForTokens}
          briefRev={brief._rev}
          mergeFields={mergeFields}
          tokenMode={dialogTokenMode}
          onTokenModeChange={setDialogTokenMode}
          outOfDate={dialogReq.outOfDate}
          onRegenerate={() => {
            void regenerateCell(
              dialogReq.channel.key,
              dialogReq.segment.key,
              dialogReq.stepKey,
            )
          }}
          regenerating={
            regenerating ===
            `${dialogReq.stepKey || 'default'}/${dialogReq.channel.key}/${dialogReq.segment.key}`
          }
          extraFooter={<OpenInStudioButton documentId={dialogReq.cell._id} />}
          onClose={handleCloseView}
        />
      ) : null}

      {editReq ? (
        <VariationEditor
          documentId={editReq.cell._id.replace(/^drafts\./, '')}
          channelKey={editReq.channel.key}
          channelLabel={editReq.channel.title}
          segmentTitle={editReq.segment.title}
          brand={editReq.segment.brand?.toUpperCase()}
          brandColor={editReq.segment.brandColor}
          stepKey={editReq.stepKey ?? undefined}
          stepIntent={editReq.stepIntent}
          status={editReq.cell.status}
          client={client}
          brief={briefForTokens}
          briefRev={brief._rev}
          mergeFields={mergeFields}
          allowedMedia={allowedMediaOptions}
          initialTokenMode={tokenMode}
          onClose={() => {
            setEditReq(null)
            setRefreshTick((t) => t + 1)
          }}
          onSaved={() => setRefreshTick((t) => t + 1)}
        />
      ) : null}
    </Stack>
  )
}

interface MatrixGridProps {
  brief: MinimalBrief
  briefRev?: string
  channels: ResolvedChannel[]
  segments: ResolvedSegment[]
  cells: VariationCell[]
  mergeFields: MergeField[]
  tokenMode: TokenMode
  stepKey: string | null
  stepIntent?: string
  regenerating: string | null
  onRegenerate: (channel: ChannelKey, segment: SegmentKey, stepKey: string | null) => void
  onView: (req: CellOpenRequest, returnEl: HTMLElement | null) => void
  onEdit: (req: CellOpenRequest) => void
}

function MatrixGrid({
  brief,
  briefRev,
  channels,
  segments,
  cells,
  mergeFields,
  tokenMode,
  stepKey,
  stepIntent,
  regenerating,
  onRegenerate,
  onView,
  onEdit,
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
            <Flex align="center" gap={2}>
              <Box style={{width: 8, height: 8, borderRadius: 4, background: ATT_BLUE}} />
              <Text size={1} weight="semibold" style={{color: ATT_BLUE}}>
                {ch.title.toUpperCase()}
              </Text>
              {ch.maxLength ? (
                <Badge tone="default" mode="outline">
                  ≤{ch.maxLength}
                </Badge>
              ) : null}
            </Flex>
          </Box>
        ))}
      </Grid>

      {segments.map((seg) => (
        <Grid key={seg._id} columns={cols + 1} gap={4} style={gridStyle}>
          {/* Segment label cell */}
          <Card padding={3} radius={2} tone="transparent">
            <Stack space={2}>
              <Text size={1} weight="semibold" textOverflow="ellipsis">
                {seg.title}
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

          {channels.map((ch) => {
            const cell = cells.find(
              (c) =>
                c.channel === ch.key &&
                c.segment === seg.key &&
                (c.flowStep || 'default') === (stepKey || 'default'),
            )
            const cellKey = `${stepKey || 'default'}/${ch.key}/${seg.key}`
            const busy = regenerating === cellKey
            return (
              <Box key={ch._id}>
                <MatrixCell
                  brief={brief}
                  briefRev={briefRev}
                  channel={ch}
                  segment={seg}
                  cell={cell}
                  allCells={cells}
                  mergeFields={mergeFields}
                  tokenMode={tokenMode}
                  stepKey={stepKey}
                  stepIntent={stepIntent}
                  busy={busy}
                  onRegenerate={() => onRegenerate(ch.key, seg.key, stepKey)}
                  onView={onView}
                  onEdit={onEdit}
                />
              </Box>
            )
          })}
        </Grid>
      ))}
    </Stack>
  )
}

function MatrixCell({
  brief,
  briefRev,
  channel,
  segment,
  cell,
  allCells,
  mergeFields,
  tokenMode,
  stepKey,
  stepIntent,
  busy,
  onRegenerate,
  onView,
  onEdit,
}: {
  brief: MinimalBrief
  briefRev?: string
  channel: ResolvedChannel
  segment: ResolvedSegment
  cell: VariationCell | undefined
  allCells: VariationCell[]
  mergeFields: MergeField[]
  tokenMode: TokenMode
  stepKey: string | null
  stepIntent?: string
  busy: boolean
  onRegenerate: () => void
  onView: (req: CellOpenRequest, returnEl: HTMLElement | null) => void
  onEdit: (req: CellOpenRequest) => void
}) {
  // Read via getElementById would be fragile; use a real ref on the View button.
  const client = useClient({apiVersion: '2024-11-12'}) as unknown as SanityClient
  const viewBtnRef = useRef<HTMLButtonElement>(null)

  const status = cell?.status
  const outOfDate = !!(
    cell?.generatedFromBriefRev &&
    briefRev &&
    cell.generatedFromBriefRev !== briefRev
  )
  // An un-approved edit lives as a draft (matrix fetches the `raw` perspective
  // and dedupeCells prefers it). Surfaces the §06 "Edited · draft" chip.
  const isDraft = !!cell && cell._id.startsWith('drafts.')

  // Skeleton — reserves the cell aspect ratio so the grid doesn't reflow when
  // cells fill in. Aspect ratios match each preview component.
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
        <Button
          text={busy ? 'Generating…' : 'Generate'}
          mode="ghost"
          tone="primary"
          fontSize={1}
          loading={busy}
          disabled={busy}
          onClick={onRegenerate}
        />
      </Stack>
    </Card>
  )

  let inner: React.ReactNode
  if (!cell) {
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
        </Stack>
      </Card>
    )
  } else if (channel.key === 'web') {
    inner = (
      <WebHeroCard
        client={client}
        web={cell.web as never}
        brandColor={segment.brandColor}
        brief={brief}
        mergeFields={mergeFields}
        tokenMode={tokenMode}
      />
    )
  } else if (channel.key === 'email') {
    inner = (
      <EmailClientMock
        client={client}
        email={cell.email as never}
        heroImage={webHeroForCell(allCells, segment.key, stepKey || 'default')}
        brand={segment.brand?.toUpperCase()}
        brandColor={segment.brandColor}
        brief={brief}
        mergeFields={mergeFields}
        tokenMode={tokenMode}
      />
    )
  } else {
    inner = (
      <PhoneSmsBubble
        client={client}
        sms={cell.sms as never}
        brand={segment.brand?.toUpperCase()}
        brandColor={segment.brandColor}
        brief={brief}
        mergeFields={mergeFields}
        tokenMode={tokenMode}
      />
    )
  }

  const canView = !!cell && status !== 'generating' && status !== 'error'

  return (
    <Card radius={2} shadow={1} padding={2} tone="default">
      <Stack space={2}>
        <Flex align="center" justify="space-between" gap={2} wrap="wrap">
          <Inline space={2}>
            <StatusPill status={status} />
            {isDraft ? <Badge tone="caution">Edited · draft</Badge> : null}
            {outOfDate ? <Badge tone="caution">Out of date</Badge> : null}
          </Inline>
          {canView && cell ? (
            <Inline space={1}>
              <Button
                icon={EditIcon}
                text="Edit"
                mode="bleed"
                tone="primary"
                fontSize={1}
                padding={2}
                onClick={() =>
                  onEdit({channel, segment, stepKey, stepIntent, cell, outOfDate})
                }
              />
              <Button
                ref={viewBtnRef}
                icon={EyeOpenIcon}
                text="View"
                mode="bleed"
                fontSize={1}
                padding={2}
                onClick={() =>
                  onView(
                    {
                      channel,
                      segment,
                      stepKey,
                      stepIntent,
                      cell,
                      outOfDate,
                    },
                    viewBtnRef.current,
                  )
                }
              />
            </Inline>
          ) : null}
        </Flex>
        {inner}
        {cell ? (
          <Flex justify="flex-end" gap={1}>
            <Button
              text={busy ? '…' : 'Regenerate'}
              mode="bleed"
              disabled={busy}
              loading={busy}
              onClick={onRegenerate}
              fontSize={0}
            />
          </Flex>
        ) : null}
      </Stack>
    </Card>
  )
}

function StatusPill({status}: {status?: string}) {
  if (!status)
    return (
      <Badge tone="default" mode="outline" padding={1}>
        No cell
      </Badge>
    )
  if (status === 'generated')
    return (
      <Badge tone="positive" mode="outline" padding={1}>
        Generated
      </Badge>
    )
  if (status === 'generating')
    return (
      <Badge tone="caution" mode="outline" padding={1}>
        Generating…
      </Badge>
    )
  if (status === 'error')
    return (
      <Badge tone="critical" mode="outline" padding={1}>
        Error
      </Badge>
    )
  return (
    <Badge tone="default" mode="outline" padding={1}>
      {status}
    </Badge>
  )
}
