# PRD — AT&T Multi-channel Personalization POC

> A self-contained, build-ready Product Requirements Document for AI agents to implement a Sanity-powered demo. Everything needed — scope, decisions, content model, AI pipeline, conventions, and an incremental build plan — is specified inline. No external reference projects are required.

## Context

**The opportunity.** AT&T wants to personalize the customer experience across every channel. Today, producing on-brand, on-message copy for each channel × audience combination is manual, slow, and inconsistent. This POC demonstrates how **Sanity's AI (Agent Actions)** turns a single marketer-authored *campaign brief* into a full matrix of channel- and segment-specific content variations — generated, previewable, and editable entirely inside Sanity.

**The "wow" moment.** A marketer writes one brief in an **App SDK app**, clicks *Generate variations*, and Sanity AI produces **12 personalized variations** (3 channels × 4 segments) — each shaped to the channel's format and the segment's brand voice. All 12 are previewable as a live channel × segment matrix inside Sanity Studio with channel-accurate mockups.

**What this is.** A POC/demo, not production. Optimize for a reliable, visually compelling demo path over completeness.

### Decisions locked with stakeholder (2026-06-16)
| Decision | Choice |
|---|---|
| AI engine | **Agent Actions Generate** (`client.agent.action.generate`). Content Agent API noted as an optional future chat-based brief assistant — out of scope for v1. |
| Surfaces | **App SDK app** (brief management + trigger generation) **+ Sanity Studio preview matrix**. No public-facing frontend. |
| Channels (3) | Web / landing page, Email, SMS / push |
| Segments (4) | New / prospective, Existing / loyal, Business / FirstNet, Value / prepaid (Cricket) |
| Campaign types (2) | **Promotional** (one-shot, the base matrix) and **Abandoned-cart flow** (triggered, multi-step lifecycle sequence) |
| Matrix | Promotional: 3 × 4 = **12 variations**. Abandoned-cart: per **flow step** × channel × segment. |
| Brand → segment map | AT&T (new, loyal), FirstNet (business), Cricket (value) |
| Placeholders | Generated copy uses **merge-field tokens** (`{{product.name}}`, `{{cart.recoveryUrl}}`, …) for data that lives **outside Sanity**; tokens resolve at preview/delivery from an **external source** or, when the data lives in Sanity, from **Sanity content**. |

---

## Tech stack

A single npm-workspaces monorepo. Use these package versions (all current as of mid-2026):

| Package | Version | Used by | Notes |
|---|---|---|---|
| `sanity` | `^5.30` | studio | Studio v5 (`defineConfig`, `defineType`, `defineField`, structure & document-action APIs). |
| `react` / `react-dom` | `^19.2` | studio, app | |
| `@sanity/client` | `^7.20` | studio, app, core | Must be **≥7.1** for Agent Actions. Used with `apiVersion: 'vX'` for `agent.action.*`. |
| `@sanity/sdk-react` | `^2.12` | app | The **App SDK** (pulls in `@sanity/sdk`). Provides `SanityApp`, `useClient`, `useCurrentUser`, `useNavigateToStudioDocument`, `useStudioWorkspacesByProjectIdDataset`. |
| `@sanity/ui` | `^3` | studio, app | UI primitives (`Box`, `Card`, `Flex`, `Stack`, `Grid`, `Dialog`, `Text`, `Heading`, `ThemeProvider`, `ToastProvider`, `buildTheme`). |
| `@sanity/assist` | `^6` | studio | AI Assist plugin — required for in-Studio AI **presence** during Agent Actions and for image-generation field config. |
| `@sanity/image-url` | `^2` | studio, app | Build image URLs for preview rendering. |
| `groq` | `^5` | studio, app | `defineQuery` for typed GROQ. |
| `styled-components` | `^6` | studio, app | Peer dependency of `@sanity/ui`. |
| `typescript` | `^5` | all | |
| `vitest` | `^2` | core | Unit tests for the pure generation modules. |
| `@sanity/functions`, `@sanity/blueprints` | latest | functions (optional) | Only for the **deferred** event-driven auto-generate trigger. Not required for v1. |

> The implementing agent can confirm current API shapes using the Sanity docs MCP (`search_docs` / `read_docs`) — especially for the App SDK (`@sanity/sdk-react`) and Agent Actions Generate, both of which are evolving. Quick-start paths: `/docs/agent-actions/generate-quickstart`, `/docs/agent-actions/agent-actions-image-generation`, App SDK under `/docs`.

### Project layout
```
/  (workspaces root: package.json with "workspaces": ["studio","apps/*","functions/*"])
├── studio/
│   ├── sanity.config.ts            # single workspace
│   ├── sanity.cli.ts
│   ├── src/
│   │   ├── schemaTypes/            # campaignBrief, channel, segment, mergeField, product,
│   │   │                          #   contentVariation + webContent/emailContent/smsContent
│   │   ├── structure/              # desk structure + defaultDocumentNode (adds "Variations" view)
│   │   ├── actions/                # GenerateVariationsAction (document action)
│   │   ├── personalization/
│   │   │   └── generate/           # PURE core (see AI pipeline): agentGenerate, orchestrate,
│   │   │                          #   promptAssembly, tokens, ids + *.test.ts
│   │   └── ui/campaign/            # SHARED React UI: matrix, preview components, brief editor
│   │       └── previews/           # WebHeroCard, EmailClientMock, PhoneSmsBubble, TokenText
│   └── package.json
├── apps/campaign-studio/           # App SDK app (thin shell; imports studio's generate/ + ui/campaign/)
│   ├── src/App.tsx
│   └── package.json
├── functions/ (optional, deferred)
├── sanity.blueprint.ts (optional, deferred)
└── package.json
```
The App SDK app imports the **same** pure `generate/` core and `ui/campaign/` components from the `studio` workspace via a TS path alias / workspace import, so generation logic and previews are written once and reused in both surfaces.

---

## Architecture overview

```
campaignBrief (marketer authors)  ──┐
  type: promotional | abandoned-cart │  Agent Actions Generate (vX), per cell
channel × segment (× flow step) ─────┼─────────────────────────►  contentVariation (copy w/ {{tokens}})
brand voice / disclaimers           │   instruction + instructionParams + token list       │
mergeField token registry ─────────┘                                                       │
                                                                                            ▼
   App SDK app  ◄── shared orchestrate.ts ──►  Studio "Variations" doc view (matrix + token toggle)
   (brief CRUD, Generate w/ progress, matrix)        │
                                                      ▼  resolveTokens at preview/delivery
                              ┌───────────────────────┴───────────────────────┐
                  external system (commerce/PIM/CRM)              Sanity content (offer, product doc)
                  {{product.name}}, {{cart.recoveryUrl}}          {{offer.amount}}, {{product.*}} when in Sanity
```

One pure module (`orchestrate.ts`) is the single source of generation logic, consumed by the App SDK app and an in-Studio document action. Generated copy carries **merge-field tokens** for data Sanity may not own; `resolveTokens` fills them at preview/delivery from an external source or from Sanity content.

---

## Content model

Single Studio workspace, single project/dataset. All types use `defineType`/`defineField`.

**Schema authoring convention** (apply to every type below):
```ts
import {defineType, defineField} from 'sanity'

export const smsContent = defineType({
  name: 'smsContent',
  title: 'SMS content',
  type: 'object',
  fields: [
    defineField({
      name: 'message',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required().max(160).error('SMS must be ≤160 characters.'),
    }),
    defineField({name: 'link', type: 'url'}),
  ],
})
```
Use `validation: (rule) => …` with `.error()` for hard limits and `.warning()` for soft ones. Group long document forms with `groups: [...]` + `fieldset`/`group` on fields.

### `campaignBrief` (document) — the marketer's input
- `title` (string, required) — internal campaign name; `slug` (slug, source title).
- `campaignType` (string, required, list: `promotional` | `abandoned-cart`) — drives which fields show and how the matrix is dimensioned. Default `promotional`.
- `summary` (text, required) — core brief / value proposition. Read by Generate via `{type:'document', documentId}`.
- `goal` (string, list: awareness / acquisition / retention / upsell / cart-recovery).
- `offer` (text) — specific promo, e.g. "$10/mo off for 12 months". Also exposed as the Sanity-resolved `{{offer.*}}` token (see Placeholders).
- `keyMessages` (array<string>) — must-include talking points.
- `mandatoryDisclaimers` (array<string>) — legal lines the AI MUST append verbatim.
- `targetChannels` (array<reference→`channel`>) — default all 3.
- `targetSegments` (array<reference→`segment`>) — default all 4.
- `landingUrlBase` (url) — base for CTA links.
- `flowSteps` (array<object `flowStep`>, **shown only when `campaignType==='abandoned-cart'`** via a `hidden` callback) — ordered recovery sequence. Each `flowStep`: `stepKey` (string, e.g. `reminder`/`incentive`/`urgency`), `delayLabel` (string, e.g. "1 hour after abandon", "24 hours", "48 hours"), `intent` (text — what this step should accomplish), `channels` (array<reference→`channel`>, e.g. email then SMS/push). Variations are generated per **step × channel × segment**.
- `featuredProduct` (reference→`product`, optional) — when set, product tokens (`{{product.*}}`) resolve from **Sanity content** instead of the external sample (see Placeholders). Demonstrates Sanity as the orchestration layer regardless of where data lives.
- Field groups: **Brief / Constraints / Targeting / Flow**.

### `channel` (document, config — seeded; admin-edit-only, no create)
- `key` (string, required, unique: `web` | `email` | `sms`) — the discriminator used in code + ids.
- `title` (string) — display label.
- `constraints` (text) — natural-language rules injected into the prompt (SMS: "≤160 chars, one link, include 'Txt STOP to opt out', no emojis").
- `maxLength` (number, optional) — hard cap (160 for SMS).
- `icon`, `order`.
- Lock down via the schema's document actions / a custom desk: hide "create" and make fields read-only outside an admin role. (Simplest for the demo: set `readOnly: true` on fields and omit the type from the global "create new" menu in `structure`.)

### `segment` (document, config — seeded; admin-edit-only, no create)
Carries the brand mapping + audience profile + tone that personalize each variation.
- `key` (string, required, unique: `new` | `loyal` | `business` | `value`).
- `title` (string).
- `brand` (string, list: `att` | `firstnet` | `cricket`).
- `brandVoice` (text) — voice/tone guide (Cricket = playful/value; FirstNet = mission-critical/reliability; AT&T loyal = appreciative/premium).
- `audienceProfile` (text) — who they are, motivations, objections.
- `tone` (string) — short descriptor.
- `brandDisclaimers` (array<string>) — brand-level legal appended on top of brief disclaimers.
- `brandColor` (string — hex), `logo` (image) — used by preview renderers for brand-accurate mocks.

### `mergeField` (document, config — seeded; the token registry)
Defines every placeholder the AI is allowed to emit and how it resolves. This is what lets generated copy reference data that may not live in Sanity.
- `key` (string, required, unique — e.g. `product.name`, `product.price`, `cart.recoveryUrl`, `cart.itemCount`, `customer.firstName`, `offer.amount`). Token form in content is `{{key}}`.
- `label` (string) — human label for the editor.
- `source` (string, list: `external` | `sanity`) — where it resolves from. `external` = a downstream commerce/PIM/CRM system at delivery time; `sanity` = a field/doc inside Sanity.
- `sampleValue` (string) — the value used to render previews (simulates the live external lookup), e.g. `iPhone 16 Pro`, `$30`.
- `sanityResolver` (string, optional, only for `source:'sanity'`) — GROQ/path used to pull the live value from Sanity, e.g. `featuredProduct->price` or `offer`.
- `description` (text) — guidance the AI sees so it uses the token correctly.

### `product` (document, optional — a lightweight Sanity-side product stub)
Exists so the demo can show the **same** `{{product.*}}` token resolving from **Sanity** when a brief sets `featuredProduct`, vs. from the external sample when not.
- `name` (string), `price` (string), `image` (image), `shortDescription` (text), `productUrl` (url).
> In reality AT&T product data lives in a commerce/PIM system; this stub demonstrates the Sanity-resolved path without claiming Sanity owns the catalog.

### `contentVariation` (document) — one generated cell per (brief × [flow step] × channel × segment)
- `_id`: **deterministic** = `variation.${briefId}.${stepKey}.${channelKey}.${segmentKey}` (briefId stripped of `drafts.`; `stepKey` = `default` for promotional campaigns). Published id so the matrix and App SDK read the same doc with no perspective dance.
- `brief` (reference→`campaignBrief`, required).
- `flowStep` (string, optional — `default` for promotional, else the `flowStep.stepKey`).
- `channel` (string `web|email|sms`, denormalized discriminator) + `channelRef` (reference→`channel`).
- `segment` (string, denormalized) + `segmentRef` (reference→`segment`).
- `status` (string, readOnly: `pending` | `generating` | `generated` | `error`).
- `generatedAt`, `generatedFromBriefRev` (string, readOnly) — provenance; drives the "out of date" badge when `generatedFromBriefRev !== brief._rev`.
- `web` (object `webContent`), `email` (object `emailContent`), `sms` (object `smsContent`) — **only the matching channel object is populated**; others hidden via a `hidden` callback keyed off `channel`. Generate's `target.path` guarantees only one is written.

**Decision: ONE discriminated `contentVariation` type, NOT three per-channel doc types.** Rationale: one Generate call targets one schema + scopes writes via `target:{path:['web']}`; the matrix query returns all rows uniformly; one Studio preview view; deterministic ids stay simple. Channels are fixed (3) with fixed shapes, so embedding beats fragmentation. Keep each channel object a **named object type** so it's individually reusable/previewable.

### Channel content object shapes
- **`webContent`**: `headline` (string, req), `subheadline` (string), `body` (Portable Text — text-only block array: `{type:'array', of:[{type:'block'}]}`), `ctaLabel` (string), `ctaUrl` (url), `heroImage` (image with `options:{hotspot:true}`, an `alt` string subfield, plus `options.aiAssist.imageInstructionField:'imagePrompt'` and a hidden `imagePrompt` text field that drives AI image generation).
- **`emailContent`**: `subjectLine` (string, req, `rule.max(60).warning()`), `preheader` (string, `rule.max(110).warning()`), `body` (Portable Text), `ctaLabel` (string), `ctaUrl` (url).
- **`smsContent`**: `message` (text, req, `rule.max(160).error('SMS must be ≤160 characters.')`), `link` (url).

> After any schema change run `npx sanity schema deploy` and re-capture `schemaId` — Generate validates against the deployed schema. Single workspace → `schemaId = '_.schemas.default'`.

---

## Placeholders / merge-field tokens

Personalized campaigns reference data Sanity does not own — live product details, the customer's cart, their first name. Rather than have the AI invent these (and risk wrong prices/names), generated copy emits **tokens** (`{{key}}`) drawn from the `mergeField` registry. Tokens stay as literal text in the stored `contentVariation` and are **resolved later** — at preview time in the demo, at delivery time in production — either from an **external system** or, when the data lives in Sanity, from **Sanity content**.

### How the AI uses tokens
The Generate `instruction` is given the available token list (key + description) via `instructionParams` and told: *"For product, pricing, cart, and customer-specific values you do not own, insert the exact token `{{key}}` — never invent these values."* So Generate writes the marketing *frame* and drops in tokens for the volatile data.

### Resolution
A pure util `resolveTokens(text, {brief, mergeFields, client, sampleMode})` walks `{{…}}` tokens and replaces each:
- **`source: 'external'`** → the `mergeField.sampleValue` (demo) — represents a live commerce/PIM/CRM lookup at send time.
- **`source: 'sanity'`** → the live value via `mergeField.sanityResolver` against Sanity content (e.g. `offer` from the brief, or `featuredProduct->price` when the brief references a Sanity `product`).
- **Unresolved** → returned as a marker the UI renders as a highlighted chip, so it is visually obvious in preview which values are merge fields. Preview components color-code Sanity-resolved vs external-resolved tokens (a small `<TokenText>` component does the rendering).

### Worked example — abandoned-cart SMS (Value / Cricket segment)

**Stored (generated) `smsContent.message`** — tokens intact:
```
Still thinking it over? Your {{product.name}} is in your cart. Finish up and save {{offer.amount}} — {{cart.recoveryUrl}}. Txt STOP to opt out.
```

**Token resolution:**
| Token | Source | Resolves to |
|---|---|---|
| `{{product.name}}` | external (commerce/PIM) | `Cricket Icon 5` |
| `{{offer.amount}}` | **Sanity** (`campaignBrief.offer`) | `$30` |
| `{{cart.recoveryUrl}}` | external (cart service) | `https://cricketwireless.com/cart/abc123` |

**Rendered preview:**
```
Still thinking it over? Your Cricket Icon 5 is in your cart. Finish up and save $30 — https://cricketwireless.com/cart/abc123. Txt STOP to opt out.
```

### Worked example — the *same* placeholder resolved by Sanity content
When the brief sets `featuredProduct` (a Sanity `product` doc), the **identical** `{{product.name}}` / `{{product.price}}` tokens resolve from **Sanity** instead of the external sample — `resolveTokens` detects the brief has a `featuredProduct` and resolves product tokens via `featuredProduct->name`/`featuredProduct->price`. Same token, same generated copy, data now sourced from Sanity. This is the "placeholder replaced by Sanity content" demonstration: Sanity acts as the orchestration layer whether the data lives inside or outside it.

---

## AI generation pipeline

### Module layout (framework-agnostic core)
```
studio/src/personalization/generate/
├── agentGenerate.ts    # ONLY file touching client.agent.action.generate (@beta vX surface)
├── orchestrate.ts      # generateMatrix(client,{briefId,channels,segments,steps,onProgress})
├── promptAssembly.ts    # pure: build {instruction, instructionParams, withImage}
├── tokens.ts           # pure: resolveTokens(text,{brief,mergeFields,client,sampleMode}) + chip metadata
├── ids.ts              # variationId(briefId,step,channel,segment) + parse
└── *.test.ts           # pure unit tests (promptAssembly, tokens, ids, orchestrate w/ mock client)
```
**Design principle:** every module here is framework-agnostic — it takes a `SanityClient` as an argument and imports no Studio or React context. The App SDK app obtains the client from `useClient()` and the Studio document action obtains it from its action context, then both call the same `generateMatrix(...)`. Only `agentGenerate.ts` references the experimental `apiVersion:'vX'` surface, so a future API change touches one file.

### The isolated wrapper (`agentGenerate.ts`) — copy-pasteable
```ts
// studio/src/personalization/generate/agentGenerate.ts
import type {SanityClient} from '@sanity/client'

// The ONLY place the experimental Agent Actions surface is referenced.
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
  instruction: string
  instructionParams: Record<string, InstructionParam>
  withImage: boolean                                // true only for the 'web' channel
}

export async function agentGenerateVariation(
  client: SanityClient,
  {targetId, channel, instruction, instructionParams, withImage}: GenerateVariationArgs,
) {
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

  return agent.agent.action.generate({
    schemaId: AGENT_SCHEMA_ID,
    // explicit _id + operation:'create' → idempotent target (orchestrate.ts clears first)
    targetDocument: {operation: 'create', _id: targetId, _type: 'contentVariation'},
    instruction,
    instructionParams,
    target,
  })
}
```
**Notes on the Generate API:** `apiVersion:'vX'` is mandatory and experimental. `instructionParams` accept the typed values above — prefer them over string interpolation. `target.path` confines writes to a sub-object. Image generation is **async**: the call returns before the asset resolves, so the image field's `asset` may be temporarily undefined (preview components must null-guard — see Appendix B).

### Instruction + instructionParams (`promptAssembly.ts`, pure)
All variable content flows through `instructionParams`. Per cell:
```ts
instruction: `You are writing $channelTitle marketing copy for the $brand brand, targeting "$segmentTitle".
Campaign brief: $brief
$flowStepLine
Offer: $offer
Must include key messages: $keyMessages
Brand voice: $brandVoice
Audience profile: $segmentProfile
Channel constraints (MANDATORY): $channelConstraints
Include these disclaimers verbatim, unedited: $disclaimers
For product, pricing, cart, and customer-specific values you do NOT own, insert the exact token (e.g. {{product.name}}) — never invent these values. Available tokens: $tokens
Write only the $channel content fields; stay within all length limits.
${withImage ? 'Also generate a hero image matching the headline and brand.' : ''}`
instructionParams: {
  channelTitle:{type:'constant',value:channel.title}, channel:{type:'constant',value:channel.key},
  brand:{type:'constant',value:brandName(segment.brand)}, segmentTitle:{type:'constant',value:segment.title},
  brief:{type:'document',documentId:briefId}, offer:{type:'constant',value:brief.offer??''},
  keyMessages:{type:'constant',value:(brief.keyMessages||[]).join('; ')},
  brandVoice:{type:'constant',value:segment.brandVoice}, segmentProfile:{type:'constant',value:segment.audienceProfile},
  channelConstraints:{type:'constant',value:channel.constraints},
  disclaimers:{type:'constant',value:allDisclaimers(brief,segment).join('\n')},
  // tokens: the merge-field registry rendered as "key — description" lines
  tokens:{type:'constant',value:mergeFields.map(m=>`{{${m.key}}} — ${m.description}`).join('\n')},
  // flow step intent, only for abandoned-cart campaigns (empty string otherwise)
  flowStepLine:{type:'constant',value:step ? `This is the "${step.stepKey}" step (${step.delayLabel}). Intent: ${step.intent}` : ''},
}
```
`withImage = channel.key === 'web'`. The AI inserts tokens like `{{product.name}}`; resolution happens later via `resolveTokens`.

### Orchestration loop (`orchestrate.ts`)
`generateMatrix(client, {briefId, channels?, segments?, steps?, onProgress})`:
1. Fetch brief + targeting. **Cell set depends on `campaignType`**: promotional → channels × segments (step = `default`, 12 cells); abandoned-cart → for each `flowStep`, its `step.channels` × segments (e.g. 3 steps × ~2 channels × 4 segments).
2. **Serial** loop over selected cells (Agent Actions are `@beta`, credit/rate-sensitive): for each — `createOrReplace` a placeholder `{status:'generating'}` (so the matrix shows live progress) → `agentGenerateVariation` → patch `{status:'generated', generatedAt, generatedFromBriefRev: brief._rev}`. On throw: patch `{status:'error'}` (keep the marker — it's the visible failure path). `onProgress({done,total,current})` drives the progress UI.
3. Return `{flowStep, channel, segment, status, id}[]`.

**Idempotency:** deterministic `_id` + `createOrReplace` placeholder before each Generate → re-runs overwrite cleanly, never accumulate duplicates. Generate uses `operation:'create'` against that id.

### Caveats (carry into demo runbook)
- `apiVersion:'vX'` is experimental — contained to `agentGenerate.ts`; a signature change touches one file.
- **AI credits**: 12 Generate calls + up to 4 web image generations per full run. The app must allow selecting a channel/segment subset and per-cell regenerate to limit spend.
- **Image gen is async** — the returned variation may have an unresolved `heroImage.asset`; previews must null-guard (`heroImage?.asset`) and show a spinner/placeholder until it resolves.
- **Schema must be deployed** before any Generate call.

---

## App SDK app (`apps/campaign-studio`)

A standalone React app built on `@sanity/sdk-react`. The shell wraps `SanityApp` in the `@sanity/ui` theme/toast providers and a `<Suspense>` boundary, then renders the shared `ui/campaign/` components:
```tsx
// apps/campaign-studio/src/App.tsx
import {SanityApp} from '@sanity/sdk-react'
import {ThemeProvider, ToastProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {Suspense} from 'react'
import {CampaignStudio} from '@att/campaign-ui' // workspace import of shared UI from studio/src/ui/campaign
import './fonts.css'                            // @font-face for the AT&T brand font (self-hosted woff2)

// One entry per project/dataset this app may read or write.
const sanityConfigs = [
  {
    projectId: import.meta.env.VITE_SANITY_PROJECT_ID as string,
    dataset: import.meta.env.VITE_SANITY_DATASET as string,
  },
]

// buildTheme lets you override the font families + palette. Point families at the
// AT&T brand font loaded in fonts.css; nudge the primary toward AT&T blue.
// (Confirm the exact override keys against the installed @sanity/ui version.)
const theme = buildTheme(/* { ...font + palette overrides } */)

function AppLoading() {
  return <div style={{padding: 24}}>Loading…</div>
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <ToastProvider>
        {/* SanityApp establishes auth + the SDK store for all useClient/useCurrentUser hooks below */}
        <SanityApp config={sanityConfigs} fallback={<AppLoading />}>
          {/* REQUIRED: data hooks inside suspend on first load (see Appendix C). */}
          <Suspense fallback={<AppLoading />}>
            <CampaignStudio />
          </Suspense>
        </SanityApp>
      </ToastProvider>
    </ThemeProvider>
  )
}
```

**Views:**
1. **Brief list** — stat cards + one row per `campaignBrief` with coverage (cells generated / total), filter/sort toolbar.
2. **Brief editor (create/edit)** — full `campaignBrief` form incl. channel/segment targeting multiselect and (for abandoned-cart) the `flowSteps` editor. Write via `useClient().createOrReplace`.
3. **Generate dialog** (`<Dialog>`) — channel×segment (×step) multiselect with "All" / "Needs attention" quick-selects, a **serial** runner with live `done/total + current cell` progress, post-run "Open in matrix", clear empty/error states. Re-entrancy-guarded (ignore clicks while running).
4. **Variation matrix** — segment × channel grid (per-step for abandoned-cart); each cell = channel mock (below) + status pill + "Regenerate this cell" + "Open in Studio" deep-link.

**`@sanity/sdk-react` hooks & gotchas:**
- `useClient({apiVersion})` → full `SanityClient` for `.fetch` (matrix query), `.createOrReplace`, `.delete`, and `.withConfig({apiVersion:'vX'}).agent.action.generate`.
- `useCurrentUser()` → `.id` for `generatedBy` provenance.
- `useNavigateToStudioDocument(handle, preferredStudioUrl)` → "Open in Studio" deep-link. It needs the target Studio URL: resolve it via `useStudioWorkspacesByProjectIdDataset({projectId, dataset})` and pass as `preferredStudioUrl`. **Both hooks suspend on first load** — see **Appendix C** for the exact flow and what fails without a `<Suspense>` boundary.
- Fetch the matrix with `useClient().fetch(MATRIX_QUERY)` (queries authored with `defineQuery`), not a document hook, because the matrix needs a grouping projection.

**`@sanity/ui` rules:** see the consolidated do/don't block in **Appendix D**.

---

## Studio preview (channel × segment matrix)
**A custom document view on `campaignBrief`** (a "Variations" tab via `defaultDocumentNode` in `structure/`) — the matrix is *about one brief*, so it belongs as a document view (alongside the default form), not a top-nav tool. The view fetches `*[_type=="contentVariation" && brief._ref==$id]`. For **promotional** campaigns it renders a segment-row × channel-column grid; for **abandoned-cart** it adds a flow-step dimension (one grid per step, or step as tabs). Each cell delegates to a **shared per-channel preview component** (the same ones the App SDK matrix uses, from `studio/src/ui/campaign/previews/`) and runs `resolveTokens` so previews show merged copy:
- `WebHeroCard` — full-bleed hero mock: null-guarded `heroImage` (build URL with `@sanity/image-url`; show a placeholder while the async asset resolves), headline/subheadline overlay, rectangular CTA, brand-colored from `segment.brandColor`.
- `EmailClientMock` — inbox chrome: From (brand) / `subjectLine` / greyed `preheader` / body / CTA.
- `PhoneSmsBubble` — phone frame + SMS bubble with `message`, character counter (red if >160), `link`.
- **`<TokenText>`** renders text with a raw/merged toggle: *raw* shows tokens as highlighted chips (Sanity-resolved vs external color-coded); *merged* shows resolved values. Makes the placeholder mechanism explicit in the demo.
- Each cell: status chip + "out of date" badge when `generatedFromBriefRev !== brief._rev`.

---

## Build plan (7 incremental passes)
One commit per pass; gate each on `tsc` + build + manual smoke.

| # | Deliverable | Risk |
|---|---|---|
| 1 | Bootstrap the workspaces monorepo (fresh Sanity project + dataset; Studio + App SDK app scaffolds on the stack above). Schemas: `campaignBrief` (incl. `campaignType` + `flowSteps`), `channel`, `segment`, `mergeField`, `product`, `contentVariation` + 3 channel objects. Deploy schema; capture `schemaId`. | Low |
| 2 | Seed config via Sanity MCP: 3 channels, 4 segments (w/ brand profiles + logos), the `mergeField` token registry, 1 Sanity `product`, and 2 briefs (1 promotional + 1 abandoned-cart with flow steps). Publish config before briefs reference it. | Low (blocks everything; get `key` discriminators + token keys exact) |
| 3 | **Pure generation core**: `ids.ts`, `tokens.ts` (resolveTokens), `promptAssembly.ts` (incl. token + flow-step injection), `agentGenerate.ts`, `orchestrate.ts` (promotional + abandoned-cart cell sets) + unit tests (mock client). | **HIGH — live Agent Actions Generate wiring (vX, target scoping, image async, idempotent create)** |
| 4 | Studio document action "Generate variations" on `campaignBrief` calling `orchestrate.ts` (the guaranteed manual path). | Medium |
| 5 | Studio "Variations" document view + per-channel preview components (web/email/SMS mocks) + `<TokenText>` raw/merged toggle + flow-step dimension. | Medium |
| 6 | App SDK app: brief list, editor (promotional + abandoned-cart flow steps), generate-with-progress dialog, matrix preview w/ token toggle; reuses `orchestrate.ts` + preview components. | Medium (App SDK auth/nav/Suspense) |
| 7 | Seed pre-generated fallback variations (promotional 12-cell + abandoned-cart flow set, tokens intact) so the demo works credit-free/offline; AT&T/Cricket/FirstNet branding polish. | Low |

**De-risking pass 3 (highest risk):**
- Pure tested modules first (`promptAssembly`/`tokens`/`ids`/`orchestrate` against a mock client); only `agentGenerate.ts` touches `vX`.
- The manual Studio document action (pass 4) is the **guaranteed demo path**, proven before the app is built.
- An optional Sanity Function trigger (auto-generate on brief publish) is **deferred** — auth-gated deploy + infinite-loop care. Manual button + app are the shipped triggers.
- Seeded fallback variations (pass 7) so the matrix renders fully even without live AI credits.

---

## Seeding (via Sanity MCP)
Use `create_documents` (capture ids for refs) + `publish_documents` (publish config before briefs reference it) + `generate_image`:
- **3 `channel`** docs (`web`/`email`/`sms`) with `title`, `constraints`, SMS `maxLength:160`.
- **4 `segment`** docs with brand + profile + tone + `brandColor` + AI-generated `logo`: `new`→AT&T (aspirational), `loyal`→AT&T (appreciative/premium), `business`→FirstNet (mission-critical, eligibility disclaimer), `value`→Cricket (playful/budget).
- **`mergeField` token registry**: `product.name`, `product.price` (external; also resolvable from Sanity when a brief sets `featuredProduct`), `cart.recoveryUrl`, `cart.itemCount`, `customer.firstName`, `offer.amount` (`sanity` → `offer`) — each with `sampleValue` and `description`.
- **1 `product`** Sanity stub (e.g. "iPhone 16 Pro") so the Sanity-resolved token example works.
- **2 `campaignBrief`** docs: a **promotional** one ("Spring 5G Upgrade") and an **abandoned-cart flow** ("Cart Recovery — Phone Upgrade") with 3 `flowSteps` (reminder / incentive / urgency) across email + SMS, targeting all segments. Include `mandatoryDisclaimers`.
- **Optional fallback** `contentVariation` sets (`status:'generated'`, tokens intact, AI hero images) for both briefs so the matrix renders without live AI credits.

---

## Verification
1. **Schema/typegen**: `npx sanity schema deploy` succeeds; `schemaId` captured; `tsc` clean across studio + app.
2. **Pure core**: unit tests for `promptAssembly`, `tokens` (resolveTokens — external sample, Sanity resolver, unresolved chip), `ids`, `orchestrate` (mock client) pass — including idempotent re-run (no duplicate cells) and `error` status on thrown Generate.
3. **Live generation (Studio action)**: on the promotional brief, "Generate variations" produces 12 `contentVariation` docs; web cells get a hero image (after async resolve); SMS `message` ≤160; disclaimers verbatim; generated copy contains `{{tokens}}` for product/cart/customer data (not invented values); each cell `status:'generated'` with `generatedFromBriefRev`.
4. **Abandoned-cart flow**: on the abandoned-cart brief, generation produces variations per flow step × channel × segment; later steps escalate (reminder → incentive → urgency); cart/product tokens present.
5. **Tokens / placeholders**: matrix raw view shows tokens as chips; merged view resolves `{{offer.amount}}` from Sanity (brief) and `{{product.name}}`/`{{cart.recoveryUrl}}` from external samples; setting `featuredProduct` flips `{{product.*}}` to resolve from the Sanity `product` doc.
6. **Studio matrix**: "Variations" tab shows the grid (+ flow-step axis for abandoned-cart); each mock renders; editing the brief flips cells to "out of date".
7. **App SDK app**: create a new brief from scratch (both types, incl. flow steps) + edit an existing one; trigger generation with live progress; matrix preview + token toggle render; "Open in Studio" deep-link + per-cell regenerate work.
8. **Demo dry-run**: full flow (write brief → generate → preview matrix with token resolution) on promotional + abandoned-cart briefs across AT&T/FirstNet/Cricket; confirm fallback set renders if credits are unavailable.

## Open items / future (out of v1 scope)
- Content Agent API chat-based brief assistant (conversational brief refinement).
- Sanity Function auto-generation on brief publish.
- Public Next.js frontend rendering live personalized experiences.
- RBAC roles (marketer vs reviewer/legal approval) — kept minimal in v1.

---

# Appendix — Implementation templates (copy-pasteable)

These are the canonical patterns for each role. Match them rather than improvising; they encode the decisions above.

## A. Schema authoring template (`defineType` / `defineField`)
Worked example for `webContent` — the richest object. `emailContent`/`smsContent` follow the same shape (see Content model for their fields). Note the AI-image-generation wiring on `heroImage`.
```ts
// studio/src/schemaTypes/objects/webContent.ts
import {defineType, defineField} from 'sanity'

export const webContent = defineType({
  name: 'webContent',
  title: 'Web / landing page',
  type: 'object',
  fields: [
    defineField({
      name: 'headline',
      type: 'string',
      validation: (rule) => rule.required().max(80).warning('Keep web headlines punchy.'),
    }),
    defineField({name: 'subheadline', type: 'string'}),
    defineField({
      name: 'body',
      type: 'array',
      of: [{type: 'block'}], // text-only Portable Text (no custom blocks needed here)
    }),
    defineField({name: 'ctaLabel', title: 'CTA label', type: 'string'}),
    defineField({name: 'ctaUrl', title: 'CTA URL', type: 'url'}),
    defineField({
      name: 'heroImage',
      type: 'image',
      options: {
        hotspot: true,
        // AI Assist / Agent Actions read this field name to know which sibling
        // field holds the image-generation prompt:
        aiAssist: {imageInstructionField: 'imagePrompt'},
      },
      fields: [
        defineField({name: 'alt', type: 'string', title: 'Alt text'}),
        defineField({name: 'imagePrompt', type: 'text', title: 'Image prompt', hidden: true}),
      ],
    }),
  ],
})
```
And how the discriminated channel objects sit on `contentVariation`, hidden by channel:
```ts
// studio/src/schemaTypes/documents/contentVariation.ts (excerpt)
defineField({
  name: 'web',
  type: 'webContent',
  hidden: ({parent}) => parent?.channel !== 'web',
}),
// …same pattern for `email` (emailContent) and `sms` (smsContent)
```
Conventions: always wrap in `defineType`/`defineField`; `validation: (rule) => …` with `.error()` for hard limits, `.warning()` for soft; use `hidden`/`readOnly` callbacks for conditional fields; group long forms with `groups`.

## B. Studio "Variations" document view + a preview component
Register the view with `defaultDocumentNode` (wired into `structureTool({defaultDocumentNode})` in `sanity.config.ts`):
```ts
// studio/src/structure/defaultDocumentNode.ts
import type {DefaultDocumentNodeResolver} from 'sanity/structure'
import {VariationMatrixView} from '../ui/campaign/VariationMatrixView'

export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, {schemaType}) => {
  if (schemaType === 'campaignBrief') {
    return S.document().views([
      S.view.form(),
      S.view.component(VariationMatrixView).title('Variations').id('variations'),
    ])
  }
  return S.document().views([S.view.form()])
}
```
The view component is a `DocumentView` — it receives `{documentId, document, schemaType}` and can read content with `useClient` from `sanity`:
```tsx
// studio/src/ui/campaign/VariationMatrixView.tsx
import {useClient} from 'sanity'
import type {DocumentViewComponent} from 'sanity/structure'

export const VariationMatrixView: DocumentViewComponent = ({documentId}) => {
  const client = useClient({apiVersion: '2024-10-01'})
  // fetch *[_type=="contentVariation" && brief._ref==$id], group into segment×channel grid,
  // render <WebHeroCard|EmailClientMock|PhoneSmsBubble> per cell. Same components the App SDK uses.
  // …
}
```
Per-channel preview component — note the **null-guarded async image asset** (Agent Actions image gen returns before the asset resolves; building a URL from an undefined asset throws):
```tsx
// studio/src/ui/campaign/previews/WebHeroCard.tsx
import {Box, Card, Heading, Stack, Text} from '@sanity/ui'
import imageUrlBuilder from '@sanity/image-url'
import type {SanityClient} from '@sanity/client'

export function WebHeroCard({client, web, brandColor}: {
  client: SanityClient
  web?: {headline?: string; subheadline?: string; heroImage?: {asset?: {_ref?: string}; alt?: string}}
  brandColor?: string
}) {
  // GUARD: heroImage.asset may be undefined for a short window after generate() returns.
  const hasImage = Boolean(web?.heroImage?.asset?._ref)
  const src = hasImage ? imageUrlBuilder(client).image(web!.heroImage!).width(640).url() : undefined

  return (
    <Card radius={0} border overflow="hidden">
      <Box style={{aspectRatio: '16 / 9', background: brandColor ?? '#e5e7eb'}}>
        {src
          ? <img src={src} alt={web?.heroImage?.alt ?? ''} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          : <Box padding={4}><Text size={1} muted>Generating image…</Text></Box>}
      </Box>
      <Stack padding={3} space={2}>
        <Heading size={2}>{web?.headline}</Heading>
        <Text size={1}>{web?.subheadline}</Text>
      </Stack>
    </Card>
  )
}
```

## C. App SDK Suspense + deep-link flow
`useStudioWorkspacesByProjectIdDataset()` and `useNavigateToStudioDocument()` are **async data hooks that suspend** while resolving. If the component that calls them is not under a `<Suspense>` boundary, the thrown promise propagates to the nearest boundary above — and if there is none, the app renders blank / crashes. Always give them a *local* boundary so only the button (not the page) shows a fallback:
```tsx
import {Suspense} from 'react'
import {Button} from '@sanity/ui'
import {useNavigateToStudioDocument, useStudioWorkspacesByProjectIdDataset} from '@sanity/sdk-react'

function OpenInStudioButton({documentId, projectId, dataset}: {
  documentId: string; projectId: string; dataset: string
}) {
  const workspaces = useStudioWorkspacesByProjectIdDataset({projectId, dataset}) // suspends
  const preferredStudioUrl = workspaces[0]?.studioUrl
  const navigate = useNavigateToStudioDocument(                                  // suspends
    {documentId, documentType: 'contentVariation'},
    preferredStudioUrl,
  )
  return <Button text="Open in Studio" mode="ghost" onClick={() => navigate()} />
}

// Usage — wrap so ONLY this control shows a loading state, not the whole matrix:
<Suspense fallback={<Button text="Open in Studio" mode="ghost" disabled loading />}>
  <OpenInStudioButton documentId={cell.id} projectId={PROJECT_ID} dataset={DATASET} />
</Suspense>
```
(Confirm exact return-shape/prop names — e.g. `studioUrl`, the navigate handle — against the installed `@sanity/sdk-react` version; the **suspend-needs-a-boundary** rule is the invariant that matters.)

## D. `@sanity/ui` do / don't
**Do**
- Size text with props: `<Text size={1}>`, `<Heading size={2}>`.
- Truncate with the `textOverflow="ellipsis"` prop.
- Lay out with `Box` / `Card` / `Flex` / `Stack` / `Grid`.
- Use the numeric token scales for `padding`, `margin`, `space`, `radius`.
- Use `<Dialog>` for modals; compose custom overlays from `Layer` + `Portal` (+ focus trap).

**Don't**
- Don't inline `fontSize` / `lineHeight` / `fontFamily` in `style`.
- Don't reach for `<Drawer>` — it doesn't exist in `@sanity/ui`; compose one.
- Don't hardcode hex colors for app chrome — restrict brand hex (`segment.brandColor`) to the inside of the brand preview mocks only.
- Don't set pixel spacing via `style` when a prop (`padding`, `space`, `gap`) exists.

## E. Vitest convention for the pure generation core
The `generate/` modules import **nothing** from `sanity`/React and take a `SanityClient` as an argument, so tests run in plain Node with a hand-rolled mock client — **no real network, no jsdom**. Tests live next to the module as `*.test.ts`; `npm test` runs `vitest`.
```ts
// studio/src/personalization/generate/orchestrate.test.ts
import {describe, expect, it, vi} from 'vitest'
import {generateMatrix} from './orchestrate'

// Minimal fake SanityClient — only the methods the code under test calls.
function createMockClient(brief: any) {
  const created: any[] = []
  const client: any = {
    created,
    fetch: vi.fn(async () => brief),
    createOrReplace: vi.fn(async (doc: any) => { created.push(doc); return doc }),
    patch: () => ({set: () => ({commit: vi.fn(async () => ({}))})}),
    delete: vi.fn(async () => ({})),
    withConfig: () => client,                              // chainable, returns self
    agent: {action: {generate: vi.fn(async () => ({_id: 'x'}))}},
  }
  return client
}

describe('generateMatrix', () => {
  it('creates 12 cells for a promotional brief and is idempotent on re-run', async () => {
    const brief = {_id: 'b1', _rev: 'r1', campaignType: 'promotional' /* + targeting */}
    const client = createMockClient(brief)

    const first = await generateMatrix(client, {briefId: 'b1'})
    const second = await generateMatrix(client, {briefId: 'b1'})

    expect(first).toHaveLength(12)
    // deterministic ids → identical id set both runs, never duplicates
    expect(new Set(first.map((c) => c.id))).toEqual(new Set(second.map((c) => c.id)))
  })

  it('marks a cell status:error when generate throws (no throw out of the loop)', async () => {
    const client = createMockClient({_id: 'b1', _rev: 'r1', campaignType: 'promotional'})
    client.agent.action.generate = vi.fn(async () => { throw new Error('vX failure') })
    const result = await generateMatrix(client, {briefId: 'b1'})
    expect(result.every((c) => c.status === 'error')).toBe(true)
  })
})
```
`promptAssembly` / `tokens` / `ids` tests are even simpler — pure functions over plain objects (e.g. assert `resolveTokens` swaps `{{offer.amount}}` from the brief, `{{product.name}}` from the external `sampleValue`, and leaves an unknown token as an unresolved-chip marker).
