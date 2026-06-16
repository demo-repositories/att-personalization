# AT&T Multi-channel Personalization POC

A Sanity-powered demo showing how **Sanity AI (Agent Actions)** turns a single campaign brief into a full matrix of channel- and segment-specific content variations — generated, previewable, and editable inside Sanity.

> **Build-ready PRD: see [`docs/PRD.md`](./docs/PRD.md)** — self-contained, no external references required. Appendix A–E has copy-pasteable templates for every role.

## The "wow" moment

A marketer writes one brief in an **App SDK app**, clicks _Generate variations_, and Sanity AI produces **12 personalized variations** (3 channels × 4 segments) — each shaped to the channel's format and the segment's brand voice. All 12 are previewable as a live channel × segment matrix inside Sanity Studio with channel-accurate mockups.

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
│   └── PRD.md                            # The authoritative spec (Appendix A–E = templates)
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
- **GitHub:** [`shehjad-noqtaai/att-personalization`](https://github.com/shehjad-noqtaai/att-personalization)

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
