// studio/scripts/seedBriefs.ts
//
// One-off: create the two documented campaign briefs (docs/brief-*.md) as
// PUBLISHED campaignBrief documents so they appear in the app + Studio.
// Run with the token loaded from studio/.env:
//   set -a; . studio/.env; set +a; npx tsx studio/scripts/seedBriefs.ts
//
// Idempotent — uses fixed _ids + createOrReplace.

import {createClient} from '@sanity/client'

const ref = (id: string, key: string) => ({_type: 'reference', _ref: id, _key: key})

async function main() {
  const token = process.env.SANITY_AUTH_TOKEN
  if (!token) throw new Error('SANITY_AUTH_TOKEN env var required (set -a; . studio/.env; set +a)')

  const client = createClient({
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'z6s0fz61',
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
    token,
    useCdn: false,
    apiVersion: '2024-10-01',
  })

  const iphoneTradeIn = {
    _id: 'brief-iphone17-tradein',
    _type: 'campaignBrief',
    title: 'iPhone 17 Pro Trade-In Event',
    slug: {_type: 'slug', current: 'iphone-17-pro-trade-in-event'},
    multiStep: false,
    archived: false,
    goal: 'upsell',
    summary:
      "Drive upgrades and new-line activations around AT&T's headline trade-in offer. Trade in an eligible smartphone (valued $290+ after assessment) and get up to $1,100 off iPhone 17 Pro or Pro Max as bill credits over 36 months on AT&T Premium 2.0 or higher. Position the iPhone 17 Pro's camera and Apple-silicon performance alongside AT&T's nationwide 5G. One coordinated send across web, email, and SMS, tuned per audience segment.",
    offer:
      'Up to $1,100 off iPhone 17 Pro or Pro Max with eligible trade-in on AT&T Premium 2.0 (or higher) — applied as bill credits over 36 months.',
    keyMessages: [
      'Up to $1,100 off iPhone 17 Pro / Pro Max with eligible trade-in; up to $700 off iPhone Air / 17.',
      'Credits apply over 36 months on a qualifying AT&T unlimited plan (Premium 2.0, Elite 2.0, or qualifying legacy plans).',
      'Trade-in is easy and contactless — check your device value online, keep your number, switch in minutes.',
      'Backed by AT&T nationwide 5G coverage.',
    ],
    mandatoryDisclaimers: [
      "Req's purchase of an eligible device on a qualifying installment plan and activation on a qualifying AT&T unlimited plan (AT&T Premium 2.0 or higher). Well-qualified customers. Trade-in device must be in good condition and valued at $290+ after assessment. Up to $1,100 applied as bill credits over 36 mos; credits start within 3 bills. If service is cancelled, remaining device balance is due. Limited-time offer; subject to change.",
      'AT&T 5G requires a compatible plan and device. 5G not available everywhere. Coverage and speeds may vary.',
    ],
    targetChannels: [
      ref('channel-web', 'ch-web'),
      ref('channel-email', 'ch-email'),
      ref('channel-sms', 'ch-sms'),
    ],
    targetSegments: [
      ref('segment-new', 'seg-new'),
      ref('segment-loyal', 'seg-loyal'),
      ref('segment-business', 'seg-business'),
      ref('segment-value', 'seg-value'),
    ],
    landingUrlBase: 'https://www.att.com/deals/iphone-deals/',
  }

  const fiberCartRecovery = {
    _id: 'brief-fiber-cart-recovery',
    _type: 'campaignBrief',
    title: 'AT&T Fiber Order Recovery',
    slug: {_type: 'slug', current: 'att-fiber-order-recovery'},
    multiStep: true,
    archived: false,
    goal: 'cart-recovery',
    summary:
      "Recover prospects who began an AT&T Fiber order online and dropped off before completing. Bring them back with the $200 reward-card incentive, reinforced by Fiber's equal upload/download speeds and 99% reliability. Existing AT&T wireless customers also save by bundling. A three-step email + SMS sequence that nudges, reinforces value, then creates urgency before the offer lapses.",
    offer: '$200 AT&T Visa Reward Card when you complete your AT&T Fiber order online.',
    keyMessages: [
      'Finish your order online and get a $200 AT&T Visa Reward Card.',
      'AT&T Fiber: equal upload & download speeds and 99% reliability.',
      'Already an AT&T wireless customer? Bundle Fiber and save on your internet bill.',
      "You're almost done — your plan and address are saved; pick up where you left off.",
    ],
    mandatoryDisclaimers: [
      '$200 AT&T Visa Reward Card: requires online order and installation of a qualifying AT&T Fiber plan. Reward card delivered within 8 weeks after installation; card issued by a bank under license and subject to cardholder terms. Limited availability in select areas.',
      'Prices exclude taxes & fees and are subject to change. Speeds may vary. 99% reliability based on network availability; not a guarantee of uninterrupted service.',
    ],
    targetChannels: [ref('channel-email', 'ch-email'), ref('channel-sms', 'ch-sms')],
    targetSegments: [ref('segment-new', 'seg-new'), ref('segment-loyal', 'seg-loyal')],
    landingUrlBase: 'https://www.att.com/internet/fiber/',
    flowSteps: [
      {
        _key: 'step-reminder',
        _type: 'flowStep',
        stepKey: 'reminder',
        delayLabel: '1 hour after abandon',
        intent: 'Friendly nudge — your AT&T Fiber order is saved and waiting.',
        channels: [ref('channel-email', 'ch-email')],
      },
      {
        _key: 'step-value',
        _type: 'flowStep',
        stepKey: 'value',
        delayLabel: '24 hours',
        intent:
          'Reinforce the $200 reward card plus symmetrical speeds, 99% reliability, and bundle savings.',
        channels: [ref('channel-email', 'ch-email'), ref('channel-sms', 'ch-sms')],
      },
      {
        _key: 'step-urgency',
        _type: 'flowStep',
        stepKey: 'urgency',
        delayLabel: '72 hours',
        intent: 'Last chance — your $200 reward-card offer is expiring; complete your order today.',
        channels: [ref('channel-email', 'ch-email'), ref('channel-sms', 'ch-sms')],
      },
    ],
  }

  for (const doc of [iphoneTradeIn, fiberCartRecovery]) {
    // Remove any stale draft twin, then publish.
    await client.delete(`drafts.${doc._id}`).catch(() => {})
    const res = await client.createOrReplace(doc)
    console.log(`[seedBriefs] published ${res._id} — ${doc.title}`)
  }

  console.log('[seedBriefs] done')
}

main().catch((e) => {
  console.error('[seedBriefs] failed:', e.message || e)
  process.exit(1)
})
