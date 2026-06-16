// studio/src/personalization/generate/orchestrate.ts
//
// The serial loop. For each (step × channel × segment) cell:
//   1. createOrReplace a placeholder {status:'generating'}  (idempotent target id)
//   2. agentGenerateVariation(...)                          (the @beta vX call)
//   3. patch {status:'generated', generatedAt, generatedFromBriefRev}
//   4. On throw: patch {status:'error'} — DO NOT delete, DO NOT re-throw.
//
// Why serial: Agent Actions are @beta and credit/rate-sensitive. Parallel calls
// trip rate limits + multiply spend; the demo is small enough that 12 serial
// calls are fine.
//
// Idempotency contract: variationId() returns the same id for the same inputs,
// so re-runs overwrite the existing placeholder rather than accumulating
// duplicate docs. `agentGenerateVariation` uses `operation:'createOrReplace'`
// so Generate cleanly overwrites whatever placeholder/error doc is at that id
// (and the PRD's `create` recipe was confirmed broken against the live API in
// the pass-3 smoke).

import type {SanityClient} from '@sanity/client'
import {agentGenerateVariation} from './agentGenerate'
import type {ChannelKey} from './agentGenerate'
import {variationId} from './ids'
import {buildPrompt} from './promptAssembly'
import type {
  PromptBrief,
  PromptChannel,
  PromptMergeField,
  PromptSegment,
  PromptStep,
} from './promptAssembly'

export type {ChannelKey} from './agentGenerate'

export type CellStatus = 'generating' | 'generated' | 'error'

export interface Cell {
  id: string
  flowStep: string             // 'default' for promotional, stepKey for abandoned-cart
  channel: ChannelKey
  segment: string
  status: CellStatus
  error?: string
}

export interface ProgressEvent {
  done: number
  total: number
  current: {channel: ChannelKey; segment: string; step?: string}
}

export interface GenerateMatrixArgs {
  briefId: string
  /** Filter the cell set to only these channel keys. Defaults to all targeted channels. */
  channels?: ChannelKey[]
  /** Filter the cell set to only these segment keys. Defaults to all targeted segments. */
  segments?: string[]
  /** Abandoned-cart only — filter to these flowStep stepKeys. */
  steps?: string[]
  onProgress?: (p: ProgressEvent) => void
}

/** GROQ projection used by generateMatrix; kept here so tests can read it. */
export const BRIEF_QUERY = `*[_id == $id || _id == "drafts." + $id][0]{
  _id, _rev, _type, campaignType, summary, offer, keyMessages, mandatoryDisclaimers,
  featuredProduct,
  "targetChannels": targetChannels[]->{_id, key, title, constraints, maxLength},
  "targetSegments": targetSegments[]->{_id, key, title, brand, brandVoice, audienceProfile, brandDisclaimers},
  "flowSteps": flowSteps[]{
    stepKey, delayLabel, intent,
    "channels": channels[]->{_id, key, title, constraints, maxLength}
  },
  "mergeFields": *[_type == "mergeField"]{key, source, sampleValue, sanityResolver, description, label}
}`

interface FetchedBrief {
  _id: string
  _rev?: string
  _type?: string
  campaignType: 'promotional' | 'abandoned-cart' | string
  summary?: string
  offer?: string
  keyMessages?: string[]
  mandatoryDisclaimers?: string[]
  featuredProduct?: unknown
  targetChannels?: Array<PromptChannel & {_id?: string}>
  targetSegments?: Array<PromptSegment & {_id?: string}>
  flowSteps?: Array<PromptStep & {channels?: Array<PromptChannel & {_id?: string}>}>
  mergeFields?: PromptMergeField[]
}

interface PlannedCell {
  channel: PromptChannel & {_id?: string}
  segment: PromptSegment & {_id?: string}
  step?: PromptStep
  stepKey: string
}

function planCells(brief: FetchedBrief, args: GenerateMatrixArgs): PlannedCell[] {
  const channelFilter = args.channels ? new Set(args.channels) : null
  const segmentFilter = args.segments ? new Set(args.segments) : null
  const stepFilter = args.steps ? new Set(args.steps) : null

  const segments = (brief.targetSegments ?? []).filter(
    (s) => !segmentFilter || segmentFilter.has(s.key),
  )

  const out: PlannedCell[] = []

  if (brief.campaignType === 'abandoned-cart') {
    for (const step of brief.flowSteps ?? []) {
      if (stepFilter && !stepFilter.has(step.stepKey)) continue
      const stepChannels = (step.channels ?? []).filter(
        (c) => !channelFilter || channelFilter.has(c.key),
      )
      for (const channel of stepChannels) {
        for (const segment of segments) {
          out.push({channel, segment, step, stepKey: step.stepKey})
        }
      }
    }
  } else {
    // promotional (or any non-abandoned-cart campaignType)
    const channels = (brief.targetChannels ?? []).filter(
      (c) => !channelFilter || channelFilter.has(c.key),
    )
    for (const channel of channels) {
      for (const segment of segments) {
        out.push({channel, segment, stepKey: 'default'})
      }
    }
  }
  return out
}

function refOrNull(id?: string): {_ref: string} | undefined {
  return id ? {_ref: id} : undefined
}

/**
 * generateMatrix — drive the cell loop end-to-end.
 *
 * Behavior:
 *   - Throws if the brief can't be loaded (loud failure).
 *   - Returns one Cell per attempted target. status:'error' for individual
 *     Generate failures; the loop never throws out.
 */
export async function generateMatrix(
  client: SanityClient,
  args: GenerateMatrixArgs,
): Promise<Cell[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brief = (await (client as any).withConfig({perspective: "raw"}).fetch(BRIEF_QUERY, {id: args.briefId})) as FetchedBrief | null
  if (!brief || !brief._id) {
    throw new Error(`generateMatrix: brief not found for id "${args.briefId}"`)
  }

  // brief._id can be "drafts.<id>" for unpublished briefs. All variation refs
  // and ids must use the canonical (non-drafts) id so published variations
  // don't hold draft refs (which block delete + publish of the brief).
  const briefId = brief._id.startsWith('drafts.') ? brief._id.slice(7) : brief._id

  const plan = planCells(brief, args)
  const total = plan.length
  const cells: Cell[] = []
  let done = 0

  const promptBrief: PromptBrief = {
    _id: briefId,
    _rev: brief._rev,
    offer: brief.offer,
    keyMessages: brief.keyMessages,
    mandatoryDisclaimers: brief.mandatoryDisclaimers,
  }

  for (const {channel, segment, step, stepKey} of plan) {
    const id = variationId(briefId, stepKey, channel.key, segment.key)
    const channelKey: ChannelKey = channel.key
    const segmentKey = segment.key

    args.onProgress?.({
      done,
      total,
      current: {channel: channelKey, segment: segmentKey, step: step?.stepKey},
    })

    // 1. placeholder — visible "generating" cell in the matrix UI.
    const placeholder: Record<string, unknown> = {
      _id: id,
      _type: 'contentVariation',
      brief: refOrNull(briefId),
      channelRef: refOrNull(channel._id),
      segmentRef: refOrNull(segment._id),
      channel: channelKey,
      segment: segmentKey,
      flowStep: stepKey,
      status: 'generating',
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).createOrReplace(placeholder)

    const {instruction, instructionParams, withImage} = buildPrompt({
      brief: promptBrief,
      channel,
      segment,
      step,
      mergeFields: brief.mergeFields ?? [],
    })

    let status: CellStatus = 'generating'
    let errorMessage: string | undefined

    try {
      // 2. the vX Generate call. May throw on rate-limit / vX schema mismatch /
      //    credit exhaustion — we record but never re-throw.
      // Schema deref guarantees these in practice; assert non-null to satisfy TS.
      await agentGenerateVariation(client, {
        targetId: id,
        channel: channelKey,
        segment: segment.key,
        briefId,
        flowStep: stepKey,
        channelRefId: channel._id!,
        segmentRefId: segment._id!,
        instruction,
        instructionParams,
        withImage,
      })
      // 3. mark generated. `generatedFromBriefRev` lets the UI flag stale variations.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any)
        .patch(id)
        .set({
          status: 'generated',
          generatedAt: new Date().toISOString(),
          generatedFromBriefRev: brief._rev,
        })
        .commit()
      status = 'generated'
    } catch (err) {
      // 4. error path — keep the placeholder so the matrix shows the failed cell.
      errorMessage = err instanceof Error ? err.message : String(err)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any)
          .patch(id)
          .set({status: 'error', error: errorMessage})
          .commit()
      } catch {
        // Swallow — a failed status-patch should not crash the matrix loop either.
      }
      status = 'error'
    }

    cells.push({
      id,
      flowStep: stepKey,
      channel: channelKey,
      segment: segmentKey,
      status,
      error: errorMessage,
    })
    done += 1
    args.onProgress?.({
      done,
      total,
      current: {channel: channelKey, segment: segmentKey, step: step?.stepKey},
    })
  }

  return cells
}
