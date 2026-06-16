# Deployed schema reference

**Status:** ✅ Deployed

## Identifiers

| Key | Value |
|---|---|
| projectId | `z6s0fz61` |
| dataset | `production` |
| workspace name | `default` (single workspace) |
| **schemaId** | **`_.schemas.default`** |
| applicationId (Studio app) | `ws2qsxeiu36mkund9jmxyckt` |
| Studio URL | https://att-personalization.sanity.studio/ |
| Manage URL | https://www.sanity.io/@oab7ManMj/studio/ws2qsxeiu36mkund9jmxyckt/default |

## What deployed

The `sanity deploy --yes --url att-personalization` command (run from `studio/`) performed:

1. **Build** the Studio bundle
2. **Deploy the schema** to the dataset (`✔ Deployed 1/1 schemas`)
3. **Deploy the Studio bundle** to Sanity hosting at the hostname above

This is the recommended single-step path. Re-running `sanity deploy` after any schema change updates both.

## Use in code

Reference `schemaId` from `studio/src/personalization/generate/agentGenerate.ts`:

```ts
export const AGENT_SCHEMA_ID = '_.schemas.default'
```

If the schemaId ever changes (e.g. multi-workspace later), re-capture it here.

## How to re-deploy

```bash
cd studio
export SANITY_AUTH_TOKEN=<editor-or-deploy-token>
npx sanity deploy --yes
```

The `appId` is locked in `sanity.cli.ts` (`deployment.appId`), so no prompts.
