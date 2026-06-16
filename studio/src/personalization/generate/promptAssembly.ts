// studio/src/personalization/generate/promptAssembly.ts
//
// Pure. Builds the {instruction, instructionParams, withImage} payload for a
// single (brief × [step] × channel × segment) cell.
//
// Design rule: ALL variable content flows through `instructionParams`. The
// instruction template itself is the same string for every cell — Generate is
// in control of how `$key` substitutions are surfaced to the LLM. Don't string-
// concat values into the instruction.

import type {ChannelKey, InstructionParam} from './agentGenerate'

export type {ChannelKey, InstructionParam} from './agentGenerate'

export interface PromptBrief {
  _id: string
  _rev?: string
  offer?: string
  keyMessages?: string[]
  mandatoryDisclaimers?: string[]
}

export interface PromptChannel {
  key: ChannelKey
  title: string
  constraints?: string
}

export interface PromptSegment {
  key: string
  title: string
  brand: string
  brandVoice: string
  audienceProfile: string
  brandDisclaimers?: string[]
}

export interface PromptStep {
  stepKey: string
  delayLabel: string
  intent: string
}

export interface PromptMergeField {
  key: string
  description?: string
}

export interface BuildPromptArgs {
  brief: PromptBrief
  channel: PromptChannel
  segment: PromptSegment
  step?: PromptStep
  mergeFields: PromptMergeField[]
}

export interface BuildPromptResult {
  instruction: string
  instructionParams: Record<string, InstructionParam>
  withImage: boolean
}

const BRAND_DISPLAY: Record<string, string> = {
  att: 'AT&T',
  firstnet: 'FirstNet',
  cricket: 'Cricket',
}

function brandName(brand: string): string {
  return BRAND_DISPLAY[brand] ?? brand
}

function allDisclaimers(brief: PromptBrief, segment: PromptSegment): string[] {
  const out: string[] = []
  if (brief.mandatoryDisclaimers) out.push(...brief.mandatoryDisclaimers)
  if (segment.brandDisclaimers) out.push(...segment.brandDisclaimers)
  return out
}

/**
 * buildPrompt — produce the per-cell Generate payload.
 *
 * - `withImage = channel.key === 'web'` — only web gets a generated hero image.
 * - `flowStepLine` is empty for promotional briefs and populated for abandoned-cart.
 * - The merge-field registry is rendered into the `tokens` param as one
 *   `{{key}} — description` line per field; the AI is told to insert exact
 *   tokens for volatile values (product name, price, cart URL, etc).
 */
export function buildPrompt(args: BuildPromptArgs): BuildPromptResult {
  const {brief, channel, segment, step, mergeFields} = args
  const withImage = channel.key === 'web'

  const flowStepLine = step
    ? `This is the "${step.stepKey}" step (${step.delayLabel}). Intent: ${step.intent}`
    : ''

  const imageDirective = withImage
    ? 'Also generate a hero image matching the headline and brand.'
    : ''

  const instruction =
    `You are writing $channelTitle marketing copy for the $brand brand, targeting "$segmentTitle".\n` +
    `Campaign brief: $brief\n` +
    `$flowStepLine\n` +
    `Offer: $offer\n` +
    `Must include key messages: $keyMessages\n` +
    `Brand voice: $brandVoice\n` +
    `Audience profile: $segmentProfile\n` +
    `Channel constraints (MANDATORY): $channelConstraints\n` +
    `Include these disclaimers verbatim, unedited: $disclaimers\n` +
    `For product, pricing, cart, and customer-specific values you do NOT own, insert the exact token (e.g. {{product.name}}) — never invent these values. Available tokens: $tokens\n` +
    `Write only the $channel content fields; stay within all length limits.\n` +
    imageDirective

  const instructionParams: Record<string, InstructionParam> = {
    channelTitle: {type: 'constant', value: channel.title},
    channel: {type: 'constant', value: channel.key},
    brand: {type: 'constant', value: brandName(segment.brand)},
    segmentTitle: {type: 'constant', value: segment.title},
    brief: {type: 'document', documentId: brief._id},
    offer: {type: 'constant', value: brief.offer ?? ''},
    keyMessages: {type: 'constant', value: (brief.keyMessages ?? []).join('; ')},
    brandVoice: {type: 'constant', value: segment.brandVoice},
    segmentProfile: {type: 'constant', value: segment.audienceProfile},
    channelConstraints: {type: 'constant', value: channel.constraints ?? ''},
    disclaimers: {type: 'constant', value: allDisclaimers(brief, segment).join('\n')},
    tokens: {
      type: 'constant',
      value: mergeFields
        .map((m) => `{{${m.key}}} — ${m.description ?? ''}`.trimEnd())
        .join('\n'),
    },
    flowStepLine: {type: 'constant', value: flowStepLine},
  }

  return {instruction, instructionParams, withImage}
}
