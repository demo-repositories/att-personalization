import {
  Dialog, Stack, Flex, Text, Heading, Button, Box, Grid, Badge, Card, Checkbox, Label, Inline, useToast,
} from '@sanity/ui'
import {useClient, useCurrentUser} from '@sanity/sdk-react'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {useState, useMemo} from 'react'
import type {SanityClient} from '@sanity/client'
import {generateMatrix, type ChannelKey, type ProgressEvent} from '@studio/personalization/generate/orchestrate'
import type {AppConfig} from '../CampaignStudio'
import type {CampaignBrief} from '../types'

interface Selection {
  channelKeys: ChannelKey[]
  segmentKeys: string[]
  stepKeys: string[]
}

export function GenerateDialog({
  brief, config, needsAttentionPredicate, onClose, onOpenMatrix,
}: {
  brief: CampaignBrief
  config: AppConfig
  /** Optional: if provided, pre-select only the (channel, segment, step) cells that match. */
  needsAttentionPredicate?: (cell: {channel: ChannelKey; segment: string; step?: string}) => boolean
  onClose: () => void
  onOpenMatrix: () => void
}) {
  const writeClient = useClient({apiVersion: 'vX'}) as unknown as SanityClient
  const user = useCurrentUser()
  const toast = useToast()

  const isMultiStep = !!brief.multiStep

  // Channel keys from the brief's referenced channels (or per-step union for multi-step flows)
  const briefChannelKeys: ChannelKey[] = useMemo(() => {
    const ids = isMultiStep
      ? Array.from(new Set((brief.flowSteps || []).flatMap((s) => (s.channels || []).map((r) => r._ref))))
      : (brief.targetChannels || []).map((r) => r._ref)
    return ids
      .map((id) => config.channels.find((c) => c._id === id)?.key)
      .filter((k): k is ChannelKey => !!k)
  }, [brief, config.channels, isMultiStep])

  const briefSegmentKeys: string[] = useMemo(() => {
    return (brief.targetSegments || [])
      .map((r) => config.segments.find((s) => s._id === r._ref)?.key || '')
      .filter(Boolean)
  }, [brief.targetSegments, config.segments])

  const briefStepKeys: string[] = useMemo(() => {
    return isMultiStep ? (brief.flowSteps || []).map((s) => s.stepKey).filter(Boolean) : ['default']
  }, [brief.flowSteps, isMultiStep])

  const [sel, setSel] = useState<Selection>({
    channelKeys: briefChannelKeys,
    segmentKeys: briefSegmentKeys,
    stepKeys: briefStepKeys,
  })

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{total: number; errors: number} | null>(null)

  // Plan the cells under current selection
  const plannedCells = useMemo(() => {
    const cells: Array<{channel: ChannelKey; segment: string; step?: string}> = []
    if (isMultiStep) {
      for (const step of brief.flowSteps || []) {
        if (!sel.stepKeys.includes(step.stepKey)) continue
        const stepChannelKeys = (step.channels || [])
          .map((r) => config.channels.find((c) => c._id === r._ref)?.key)
          .filter((k): k is ChannelKey => !!k && sel.channelKeys.includes(k))
        for (const ch of stepChannelKeys) {
          for (const seg of sel.segmentKeys) cells.push({channel: ch, segment: seg, step: step.stepKey})
        }
      }
    } else {
      for (const ch of sel.channelKeys) {
        for (const seg of sel.segmentKeys) cells.push({channel: ch, segment: seg})
      }
    }
    return cells
  }, [brief, config.channels, sel, isMultiStep])

  function selectAll() {
    setSel({
      channelKeys: briefChannelKeys,
      segmentKeys: briefSegmentKeys,
      stepKeys: briefStepKeys,
    })
  }
  function selectNone() {
    setSel({channelKeys: [], segmentKeys: [], stepKeys: []})
  }
  function selectNeedsAttention() {
    if (!needsAttentionPredicate) {
      // No predicate provided — fall back to "All" (caller didn't pass a matrix snapshot)
      selectAll()
      return
    }
    const channelSet = new Set<ChannelKey>()
    const segmentSet = new Set<string>()
    const stepSet = new Set<string>()
    const allCells = isMultiStep
      ? (brief.flowSteps || []).flatMap((step) =>
          (step.channels || [])
            .map((r) => config.channels.find((c) => c._id === r._ref)?.key)
            .filter((k): k is ChannelKey => !!k)
            .flatMap((ch) => briefSegmentKeys.map((seg) => ({channel: ch, segment: seg, step: step.stepKey})))
        )
      : briefChannelKeys.flatMap((ch) => briefSegmentKeys.map((seg) => ({channel: ch, segment: seg, step: undefined as string | undefined})))
    for (const c of allCells) {
      if (needsAttentionPredicate(c)) {
        channelSet.add(c.channel)
        segmentSet.add(c.segment)
        stepSet.add(c.step || 'default')
      }
    }
    setSel({
      channelKeys: Array.from(channelSet),
      segmentKeys: Array.from(segmentSet),
      stepKeys: stepSet.size > 0 ? Array.from(stepSet) : ['default'],
    })
  }

  async function run() {
    if (running) return
    if (plannedCells.length === 0) {
      toast.push({status: 'warning', title: 'Nothing to generate', description: 'Select at least one channel and segment.'})
      return
    }
    setRunning(true)
    setError(null)
    setDone(null)
    setProgress({done: 0, total: plannedCells.length, current: plannedCells[0]!})
    try {
      const briefIdClean = brief._id.replace(/^drafts\./, '')
      const result = await generateMatrix(writeClient, {
        briefId: briefIdClean,
        channels: sel.channelKeys,
        segments: sel.segmentKeys,
        steps: isMultiStep ? sel.stepKeys : undefined,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onProgress: (p: ProgressEvent) => setProgress(p),
      })
      const errors = result.cells.filter((c) => c.status === 'error').length
      const ok = result.cells.length - errors
      setDone({total: result.cells.length, errors})
      toast.push({
        status: errors === 0 ? 'success' : 'warning',
        title:
          errors === 0
            ? `Generated ${result.cells.length} cells into a release`
            : `Completed with ${errors} errors`,
        description: `${ok} variation${ok === 1 ? '' : 's'} added to a content release — review in the matrix, then publish to promote.`,
      })
    } catch (e) {
      setError(String(e))
      toast.push({status: 'error', title: 'Generate failed', description: String(e)})
    } finally {
      setRunning(false)
    }
  }

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0

  return (
    <Dialog id="generate-dialog" header="Generate variations" onClose={running ? undefined : onClose} width={2}>
      <Box padding={4}>
        <Stack space={4}>
          <Text size={1} muted>
            Run the Sanity Agent Actions vX surface against this brief. Serial loop — one cell at a time.
          </Text>

          {!done && (
            <>
              <Stack space={2}>
                <Flex justify="space-between" align="center">
                  <Heading size={1}>Channels</Heading>
                  <Text size={0} muted>{sel.channelKeys.length} of {briefChannelKeys.length}</Text>
                </Flex>
                <Card padding={3} radius={2} border>
                  <Stack space={2}>
                    {briefChannelKeys.length === 0 && <Text muted size={1}>Brief targets no channels.</Text>}
                    {briefChannelKeys.map((ch) => (
                      <Flex key={ch} align="center" gap={2}>
                        <Checkbox
                          checked={sel.channelKeys.includes(ch)}
                          onChange={(e) =>
                            setSel((s) => ({
                              ...s,
                              channelKeys: e.currentTarget.checked
                                ? Array.from(new Set([...s.channelKeys, ch]))
                                : s.channelKeys.filter((c) => c !== ch),
                            }))
                          }
                        />
                        <Text size={1}>{config.channels.find((c) => c.key === ch)?.title || ch}</Text>
                        <Badge tone="default">{ch}</Badge>
                      </Flex>
                    ))}
                  </Stack>
                </Card>
              </Stack>

              <Stack space={2}>
                <Flex justify="space-between" align="center">
                  <Heading size={1}>Segments</Heading>
                  <Text size={0} muted>{sel.segmentKeys.length} of {briefSegmentKeys.length}</Text>
                </Flex>
                <Card padding={3} radius={2} border>
                  <Stack space={2}>
                    {briefSegmentKeys.length === 0 && <Text muted size={1}>Brief targets no segments.</Text>}
                    {briefSegmentKeys.map((sk) => (
                      <Flex key={sk} align="center" gap={2}>
                        <Checkbox
                          checked={sel.segmentKeys.includes(sk)}
                          onChange={(e) =>
                            setSel((s) => ({
                              ...s,
                              segmentKeys: e.currentTarget.checked
                                ? Array.from(new Set([...s.segmentKeys, sk]))
                                : s.segmentKeys.filter((k) => k !== sk),
                            }))
                          }
                        />
                        <Text size={1}>{config.segments.find((s) => s.key === sk)?.title || sk}</Text>
                        <Badge tone="default">{sk}</Badge>
                      </Flex>
                    ))}
                  </Stack>
                </Card>
              </Stack>

              {isMultiStep && (
                <Stack space={2}>
                  <Flex justify="space-between" align="center">
                    <Heading size={1}>Flow steps</Heading>
                    <Text size={0} muted>{sel.stepKeys.length} of {briefStepKeys.length}</Text>
                  </Flex>
                  <Card padding={3} radius={2} border>
                    <Stack space={2}>
                      {briefStepKeys.map((sk) => (
                        <Flex key={sk} align="center" gap={2}>
                          <Checkbox
                            checked={sel.stepKeys.includes(sk)}
                            onChange={(e) =>
                              setSel((s) => ({
                                ...s,
                                stepKeys: e.currentTarget.checked
                                  ? Array.from(new Set([...s.stepKeys, sk]))
                                  : s.stepKeys.filter((k) => k !== sk),
                              }))
                            }
                          />
                          <Text size={1}>{sk}</Text>
                        </Flex>
                      ))}
                    </Stack>
                  </Card>
                </Stack>
              )}

              <Flex gap={2} wrap="wrap">
                <Button text="All" mode="ghost" onClick={selectAll} disabled={running} />
                <Button text="Needs attention" mode="ghost" onClick={selectNeedsAttention} disabled={running} />
                <Button text="None" mode="bleed" tone="critical" onClick={selectNone} disabled={running} />
              </Flex>

              <Card padding={3} radius={2} tone="primary">
                <Flex justify="space-between" align="center">
                  <Text size={1}>
                    <strong>{plannedCells.length}</strong> cell{plannedCells.length === 1 ? '' : 's'} will be generated.
                  </Text>
                  <Text size={0} muted>Serial; ~1–3s per cell.</Text>
                </Flex>
              </Card>
            </>
          )}

          {progress && (
            <Stack space={3}>
              <Card padding={3} radius={2} border>
                <Stack space={3}>
                  <Flex justify="space-between" align="center">
                    <Text size={1} weight="medium">
                      {progress.done} / {progress.total} cells
                    </Text>
                    <Text size={1} muted>{pct}%</Text>
                  </Flex>
                  <Box style={{height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden'}}>
                    <Box style={{height: '100%', width: `${pct}%`, background: '#00A8E0', transition: 'width 250ms ease'}} />
                  </Box>
                  {running && progress.current && (
                    <Inline space={2}>
                      <Text size={0} muted>Now:</Text>
                      <Badge tone="primary">{progress.current.channel}</Badge>
                      <Badge tone="default">{progress.current.segment}</Badge>
                      {progress.current.step && progress.current.step !== 'default' && (
                        <Badge tone="caution">{progress.current.step}</Badge>
                      )}
                    </Inline>
                  )}
                </Stack>
              </Card>
            </Stack>
          )}

          {error && (
            <Card padding={3} radius={2} tone="critical">
              <Text size={1}>{error}</Text>
            </Card>
          )}

          {done && !error && (
            <Card padding={3} radius={2} tone={done.errors === 0 ? 'positive' : 'caution'}>
              <Stack space={2}>
                <Text size={1} weight="medium">
                  Done. {done.total - done.errors} of {done.total} cells generated.
                  {done.errors > 0 && ` (${done.errors} errored — see status pills in matrix)`}
                </Text>
              </Stack>
            </Card>
          )}

          <Flex justify="flex-end" gap={2}>
            {done ? (
              <>
                <Button text="Close" mode="ghost" onClick={onClose} />
                <Button text="Open in matrix" tone="primary" onClick={onOpenMatrix} />
              </>
            ) : (
              <>
                <Button text="Cancel" mode="ghost" onClick={onClose} disabled={running} />
                <Button
                  text={running ? 'Running…' : `Generate ${plannedCells.length} cell${plannedCells.length === 1 ? '' : 's'}`}
                  tone="primary"
                  loading={running}
                  disabled={running || plannedCells.length === 0}
                  onClick={run}
                />
              </>
            )}
          </Flex>
        </Stack>
      </Box>
    </Dialog>
  )
}
