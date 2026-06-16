# AT&T Multi-channel Personalization POC

A Sanity-powered demo showing how **Sanity AI (Agent Actions)** turns a single campaign brief into a full matrix of channel- and segment-specific content variations — generated, previewable, and editable inside Sanity.

> **Build-ready PRD: see [`docs/PRD.md`](./docs/PRD.md)** — self-contained, no external references required. Appendix A–E has copy-pasteable templates for every role.
>
> **Architecture overview: see [`docs/architecture.md`](./docs/architecture.md)**

## The "wow" moment

A marketer writes one brief in an **App SDK app**, clicks _Generate variations_, and Sanity AI produces **12 personalized variations** (3 channels × 4 segments) — each shaped to the channel's format and the segment's brand voice. All 12 are previewable as a live channel × segment matrix inside Sanity Studio with channel-accurate mockups.

## Prerequisites

- **Node.js** ≥ 20.19
- **npm** (workspaces monorepo)
- A Sanity account with access to project `z6s0fz61` / dataset `production`
- For **Generate variations** (Agent Actions): an editor token with read + write on the dataset
- For **App SDK deploy**: an organization-level token with **Manage SDK Apps** permission (org `oab7ManMj`)

## Getting started

```bash
git clone https://github.com/demo-repositories/att-personalization.git
cd att-personalization
npm install
```

## Run locally

The monorepo has two frontends that share code from `studio/src/`. Run them in separate terminals.

### Sanity Studio (content editors + Variations tab)

```bash
npm run studio:dev
```

Opens at **http://localhost:3333** (default Sanity dev port). Sign in with your Sanity account when prompted.

From Studio you can:

- Edit campaign briefs, channels, segments, and merge-field registry
- Click **Generate variations** on a `campaignBrief` document (calls live Agent Actions)
- Open the **Variations** tab on a brief to preview the channel × segment matrix

### Campaign Studio (App SDK — marketer-facing app)

```bash
npm run app:dev
```

Uses `sanity dev` (not raw Vite — plain Vite breaks the OAuth callback because Sanity redirects with a `url=https://…` query param that Vite 5 blocks).

When the server starts, the terminal prints a **Dashboard dev URL** like:

```
https://www.sanity.io/@oab7ManMj?dev=http%3A%2F%2Flocalhost%3A3333
```

Open that link (recommended) or go directly to **http://localhost:3333**. If Studio is already running on 3333, pass a different port:

```bash
npm run app:dev -- --port 3334
```

Sign in with your Sanity account. After login you get a brief list, brief editor, generate dialog with progress, and the same variation matrix previews as Studio.

Optional env overrides — copy the example file or use the populated defaults in `.env`:

```bash
cp apps/campaign-studio/.env.example apps/campaign-studio/.env
# already populated: VITE_SANITY_PROJECT_ID=z6s0fz61, VITE_SANITY_DATASET=production
```

### Verify the build

```bash
npm run typecheck   # studio + campaign-studio
npm run test        # vitest in studio (36 unit tests)
npm run studio:build
npm run app:build
```

## Deploy

Both apps deploy to Sanity-hosted URLs. Set `SANITY_AUTH_TOKEN` in `studio/.env` (see `studio/.env.example`) or export it in your shell.

| App | Directory | Command | Hosted URL |
|-----|-----------|---------|------------|
| **Studio** | `studio/` | `npm run deploy` | https://att-personalization.sanity.studio/ |
| **App SDK** | `apps/campaign-studio/` | `npm run deploy` | https://attcampaignstudio.sanity.studio/ |

### Deploy Studio (schema + bundle)

Studio deploy builds the bundle, deploys the schema, and publishes to Sanity hosting in one step:

```bash
cd studio
export SANITY_AUTH_TOKEN=<deploy-studio-or-editor-token>
npm run deploy
```

Schema id is captured in [`studio/SCHEMA_ID.md`](./studio/SCHEMA_ID.md) (`_.schemas.default`). Re-run deploy after any schema change — Agent Actions validates against the deployed schema.

Deploy only the schema (no Studio bundle):

```bash
npm run studio:deploy-schema
```

### Deploy Campaign Studio (App SDK)

Requires an **organization-level** token with **Manage SDK Apps** (a project deploy token is not sufficient):

```bash
cd apps/campaign-studio
export SANITY_AUTH_TOKEN=<org-token-with-manage-sdk-apps>
npm run deploy
```

App and org ids are wired in `apps/campaign-studio/sanity.cli.ts`.

### Live smoke test (Agent Actions)

After deploy, verify end-to-end generation with an **editor** token (not deploy-only):

```bash
cd studio
export SANITY_AUTH_TOKEN=<editor-token>
npx tsx scripts/smoke.ts
```

Expects seeded brief `brief-spring5g` and writes 12 `contentVariation` documents.

## Stack

Per PRD §Tech stack — implementing agents should confirm exact API shapes against installed versions via the Sanity docs MCP.

- **Studio** — `sanity ^5.30`, React 19, `@sanity/assist ^6`, `@sanity/ui ^3`, `@sanity/image-url ^2`
- **App SDK app** — `@sanity/sdk-react ^2.12`, `@sanity/ui ^3`, React 19
- **Client** — `@sanity/client ^7.20` (≥7.1 required for Agent Actions; `apiVersion: 'vX'` only inside `agentGenerate.ts`)
- **Tests** — `vitest ^2` (pure Node, no jsdom — see PRD Appendix E)

## Repo layout

```
att-personalization/                       # npm workspaces monorepo
├── docs/
│   ├── PRD.md                            # The authoritative spec (Appendix A–E = templates)
│   ├── architecture.md                   # How the system fits together
│   └── SEED.md                           # Seeded document ids
├── studio/                               # Sanity Studio
│   └── src/
│       ├── schemaTypes/                  # campaignBrief, channel, segment, mergeField, product,
│       │                                 #   contentVariation + webContent/emailContent/smsContent
│       ├── structure/                    # desk + defaultDocumentNode (adds "Variations" view)
│       ├── actions/                      # GenerateVariationsAction (document action)
│       ├── personalization/
│       │   └── generate/                 # PURE framework-agnostic core
│       │       ├── agentGenerate.ts      # ONLY file touching agent.action.generate (vX)
│       │       ├── orchestrate.ts        # generateMatrix(client, {...})
│       │       ├── promptAssembly.ts     # pure
│       │       ├── tokens.ts             # resolveTokens + chip metadata
│       │       ├── ids.ts                # deterministic variation ids
│       │       └── *.test.ts             # vitest unit tests
│       └── ui/campaign/                  # SHARED React UI (Studio doc view + App SDK app both import)
│           └── previews/                 # WebHeroCard, EmailClientMock, PhoneSmsBubble, TokenText
└── apps/
    └── campaign-studio/                  # Thin App SDK shell — imports studio's generate/ + ui/campaign/
        └── src/App.tsx
```

## Project

- **Sanity project:** `z6s0fz61` (org `oab7ManMj`) — dataset `production`
- **GitHub:** [`demo-repositories/att-personalization`](https://github.com/demo-repositories/att-personalization)
- **Seed data reference:** [`docs/SEED.md`](./docs/SEED.md)
- **Architecture:** [`docs/architecture.md`](./docs/architecture.md)

## Build plan (7 passes, one per spec/PR)

| # | Owner          | Deliverable                                                                                              |
|---|----------------|----------------------------------------------------------------------------------------------------------|
| 1 | schema-lead    | Bootstrap monorepo (workspaces) + Studio scaffold + all schemas + `sanity schema deploy` + capture `schemaId` |
| 2 | seed-lead      | Seed channels, segments, mergeField registry, sample product, 2 briefs via Sanity MCP                    |
| 3 | ai-core-lead   | `personalization/generate/`: ids, tokens, promptAssembly, agentGenerate (vX), orchestrate + vitest tests |
| 4 | studio-ui-lead | Studio "Generate variations" document action calling `orchestrate.ts`                                    |
| 5 | studio-ui-lead | Studio "Variations" document view + per-channel preview components + `<TokenText>` toggle               |
| 6 | app-lead       | App SDK app: shell, brief list/editor, Generate dialog w/ progress, matrix preview                       |
| 7 | PM             | Fallback seed (`status:'generated'`), branding polish, demo runbook                                      |

## Workflow

- Feature branch per task → PR to `main` → PM reviews (build/typecheck/test locally) → merge.
- Every scope decision recorded in the spec body with a dated citation, not just chat.

## For implementing agents

- **Read `docs/PRD.md` Appendix A–E first** — schema template, Studio view + null-guarded preview, App SDK Suspense flow, `@sanity/ui` do/don't, vitest convention.
- When a Sanity API surface is uncertain (Agent Actions, App SDK), verify against the docs MCP (`search_docs` / `read_docs`) — the PRD notes which surfaces are evolving (`vX`, `@sanity/sdk-react`).
- The `generate/` core is **framework-agnostic** — never import `sanity` or React there.
