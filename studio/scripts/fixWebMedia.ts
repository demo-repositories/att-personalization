// studio/scripts/fixWebMedia.ts
//
// The iPhone trade-in brief targets the `web` channel, which can only use hero
// images from the brief's allowedMedia — and the media library was empty, so
// web generation failed. This:
//   1. creates two mediaAsset docs from existing (seeded) image assets,
//   2. attaches them to brief-iphone17-tradein.allowedMedia,
//   3. regenerates the web channel for that brief.
//
// Run: SANITY_AUTH_TOKEN=... npx tsx studio/scripts/fixWebMedia.ts

import {createClient} from '@sanity/client'
import {generateMatrix} from '../src/personalization/generate/orchestrate'

const BRIEF_ID = 'brief-iphone17-tradein'

const MEDIA = [
  {
    _id: 'media-iphone-pro-hero',
    title: 'iPhone Pro — device hero',
    description:
      'Studio product shot of a titanium iPhone Pro. Primary hero for device upgrade / trade-in campaigns.',
    assetRef: 'image-3003dc217fb2a097d14b18669eb10b98578886ca-1408x768-jpg',
    alt: 'Titanium iPhone Pro, triple-lens camera, studio product shot',
  },
  {
    _id: 'media-5g-lifestyle-hero',
    title: '5G lifestyle hero',
    description:
      'Diverse customers using 5G smartphones outdoors. Good for switch / upgrade and nationwide-5G messaging.',
    assetRef: 'image-18017d5f40f742a6f800e1f039c9238c0a6d03e0-1408x768-jpg',
    alt: 'Diverse customers outdoors in spring using 5G smartphones',
  },
]

async function main() {
  const token = process.env.SANITY_AUTH_TOKEN
  if (!token) throw new Error('SANITY_AUTH_TOKEN env var required')

  const client = createClient({
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'z6s0fz61',
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
    token,
    useCdn: false,
    apiVersion: '2024-10-01',
  })

  // 1. media library entries (published) referencing existing image assets.
  for (const m of MEDIA) {
    await client.delete(`drafts.${m._id}`).catch(() => {})
    await client.createOrReplace({
      _id: m._id,
      _type: 'mediaAsset',
      title: m.title,
      description: m.description,
      image: {
        _type: 'image',
        asset: {_type: 'reference', _ref: m.assetRef},
        alt: m.alt,
      },
    })
    console.log(`[fixWebMedia] media asset ready — ${m._id}`)
  }

  // 2. attach to the brief's allowedMedia.
  await client
    .patch(BRIEF_ID)
    .set({
      allowedMedia: MEDIA.map((m) => ({_type: 'reference', _ref: m._id, _key: m._id})),
    })
    .commit()
  console.log(`[fixWebMedia] attached ${MEDIA.length} assets to ${BRIEF_ID}.allowedMedia`)

  // 3. regenerate the web channel only.
  console.log('[fixWebMedia] regenerating web channel …')
  const cells = await generateMatrix(client, {
    briefId: BRIEF_ID,
    channels: ['web'],
    onProgress: (p) => console.log(`  ${p.done}/${p.total} — ${p.current.channel}/${p.current.segment}`),
  })
  const generated = cells.filter((c) => c.status === 'generated').length
  const errored = cells.filter((c) => c.status === 'error')
  console.log(`[fixWebMedia] web done — generated=${generated} error=${errored.length}`)
  for (const c of errored) console.log(`  ERROR ${c.id}: ${c.error}`)
}

main().catch((e) => {
  console.error('[fixWebMedia] failed:', e.message || e)
  process.exit(1)
})
