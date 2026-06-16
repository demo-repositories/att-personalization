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
  withImage: boolean                                // true only for the 'web' channel
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
    withImage,
  }: GenerateVariationArgs,
): Promise<unknown> {
  const agent = client.withConfig({apiVersion: AGENT_ACTION_API_VERSION})

  // `target` scopes WHICH paths Generate may write — this is what keeps a
  // variation single-channel and lets web (and only web) receive a hero image.
  //
  //   without image →  {path: ['web']}              (writes only the channel object)
  //   with image    →  [{path: ['web']},            (channel object …)
  //                     {path: ['web','heroImage','asset']}]   (… and the generated asset)
  const target = withImage
    ? [{path: [channel]}, {path: [channel, 'heroImage', 'asset']}]
    : {path: [channel]}

  // `agent.action.generate` is @beta. Returned shape is the updated document;
  // when withImage=true, the asset is *async* — `heroImage.asset` may resolve
  // after the call returns (preview UIs must null-guard).
  //
  // PRD spec'd operation:'create', but in practice Generate validates against
  // existing dataset state and refuses if the _id exists. Use createOrReplace
  // — the server error message itself recommends it. Caught via pass-3 live
  // smoke.
  //
  // `initialValues` is critical: the contentVariation schema hides the channel
  // objects (web/email/sms) via `hidden: ({parent}) => parent?.channel !== '<key>'`.
  // Without seeding `channel`, `segment`, `flowStep`, refs, and `status` here,
  // createOrReplace wipes the placeholder doc → `parent.channel` becomes undefined
  // → Generate refuses to write to target with "path 'web' is hidden from the
  // instruction." Pre-seeding via initialValues unlocks the conditional path.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (agent as any).agent.action.generate({
    schemaId: AGENT_SCHEMA_ID,
    // forcePublishedWrite: by default Generate creates a `drafts.<id>` even when
    // we ask for the published id, then leaves the published doc untouched. The
    // PRD relies on a deterministic PUBLISHED id (no perspective dance) — for
    // the matrix query, for the App SDK reads, for the Studio doc view. Force
    // Generate to write directly to the published id. Caught via pass-3 smoke.
    forcePublishedWrite: true,
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
        // status is intentionally NOT seeded here — orchestrate.ts patches it
        // to 'generated' / 'error' after this call returns.
      },
    },
    instruction,
    instructionParams,
    target,
  })
}
