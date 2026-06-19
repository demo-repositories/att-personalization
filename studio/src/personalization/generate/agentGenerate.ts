// studio/src/personalization/generate/agentGenerate.ts
//
// The ONLY file in this package that touches the experimental Agent Actions
// surface (`apiVersion: 'vX'` + `client.agent.action.generate`). When the API
// shape changes, exactly one file changes.

import type {SanityClient} from '@sanity/client'

export const AGENT_ACTION_API_VERSION = 'vX'
// Single-workspace project → '_.schemas.default'. Re-capture after every `sanity schema deploy`.
export const AGENT_SCHEMA_ID = '_.schemas.default'

export type ChannelKey = 'web' | 'email' | 'sms'

// instructionParams values are typed; prefer these over string interpolation.
export type InstructionParam =
  | {type: 'constant'; value: string}
  | {type: 'field'; path: string}
  | {type: 'document'; documentId: string}
  | {type: 'groq'; query: string; params?: Record<string, unknown>}

export interface GenerateVariationArgs {
  targetId: string                                  // deterministic _id, see ids.ts
  channel: ChannelKey
  segment: string
  briefId: string
  flowStep: string                                  // 'default' for promotional
  channelRefId: string                              // the seeded channel doc _id (e.g. 'channel-web')
  segmentRefId: string                              // the seeded segment doc _id (e.g. 'segment-new')
  instruction: string
  instructionParams: Record<string, InstructionParam>
}

export async function agentGenerateVariation(
  client: SanityClient,
  {
    targetId,
    channel,
    segment,
    briefId,
    flowStep,
    channelRefId,
    segmentRefId,
    instruction,
    instructionParams,
  }: GenerateVariationArgs,
): Promise<Record<string, unknown>> {
  const agent = client.withConfig({apiVersion: AGENT_ACTION_API_VERSION})

  // Text-only target — hero images come from the brief allowed media library,
  // assigned by orchestrate after Generate (never AI-generated assets). Exclude
  // `heroImage` from the agent's write scope so it can't emit an empty/AI image
  // placeholder; orchestrate sets the real asset from brief.allowedMedia after.
  const target = {path: [channel], exclude: ['heroImage']}

  // `noWrite: true` — the agent generates the document in memory and returns it
  // WITHOUT mutating the dataset. orchestrate then writes the result as a
  // *version* document into the brief's content release (so nothing lands in
  // published until the marketer promotes the release).
  //
  // `initialValues` is still critical even with noWrite: the contentVariation
  // schema hides the channel objects (web/email/sms) via
  // `hidden: ({parent}) => parent?.channel !== '<key>'`. Seeding `channel`,
  // `segment`, `flowStep`, and the refs unlocks the conditional target path so
  // Generate is allowed to write into e.g. `web`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (agent as any).agent.action.generate({
    schemaId: AGENT_SCHEMA_ID,
    noWrite: true,
    targetDocument: {
      operation: 'createOrReplace',
      _id: targetId,
      _type: 'contentVariation',
      initialValues: {
        brief: {_type: 'reference', _ref: briefId},
        channel,
        segment,
        flowStep,
        channelRef: {_type: 'reference', _ref: channelRefId},
        segmentRef: {_type: 'reference', _ref: segmentRefId},
      },
    },
    instruction,
    instructionParams,
    target,
  }) as Promise<Record<string, unknown>>
}
