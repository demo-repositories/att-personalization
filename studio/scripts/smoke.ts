// studio/scripts/smoke.ts
//
// MANUAL SMOKE — live Agent Actions vX call against the seeded promotional brief.
// Not part of the test suite. Run with: SANITY_AUTH_TOKEN=... npx tsx studio/scripts/smoke.ts
// (or 'node --experimental-strip-types' on Node 22+)
//
// Verifies the wiring works end-to-end. Costs ~12 Generate calls + 4 image gens.

import {createClient} from '@sanity/client'
import {generateMatrix} from '../src/personalization/generate/orchestrate'

async function main() {
  const token = process.env.SANITY_AUTH_TOKEN
  if (!token) throw new Error('SANITY_AUTH_TOKEN env var required')

  const client = createClient({
    projectId: 'z6s0fz61',
    dataset: 'production',
    token,
    useCdn: false,
    apiVersion: '2024-10-01',
  })

  console.log('[smoke] generateMatrix(brief-spring5g) starting …')
  const cells = await generateMatrix(client, {
    briefId: 'brief-spring5g',
    onProgress: (p) => {
      console.log(`[smoke] ${p.done}/${p.total} — ${p.current.channel}/${p.current.segment}`)
    },
  })

  const generated = cells.filter((c) => c.status === 'generated').length
  const errored = cells.filter((c) => c.status === 'error').length
  console.log(`[smoke] done — generated=${generated} error=${errored} total=${cells.length}`)

  if (errored > 0) {
    console.log('[smoke] errored cells:')
    for (const c of cells.filter((c) => c.status === 'error')) {
      console.log(`  ${c.id}: ${c.error}`)
    }
  }

  // Verify the count via the client itself
  const count = await client.fetch('count(*[_type=="contentVariation"])')
  console.log(`[smoke] *[_type=="contentVariation"] count = ${count}`)

  // Spot-check one SMS cell
  const smsCell = await client.fetch(
    '*[_id == $id][0]{_id, channel, segment, status, "smsMessage": sms.message, "smsLen": length(coalesce(sms.message, ""))}',
    {id: 'variation.brief-spring5g.default.sms.value'},
  )
  console.log('[smoke] sms.value sample:', JSON.stringify(smsCell, null, 2))
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err)
  process.exit(1)
})
