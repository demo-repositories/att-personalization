/**
 * Shared campaignBrief field metadata — single source of truth for Studio schema
 * labels/descriptions and the App SDK brief editor. When renaming a field in
 * Studio, update it here and both surfaces stay in sync.
 */
export const CAMPAIGN_BRIEF_GROUPS = {
  brief: {name: 'brief' as const, title: 'Brief'},
  constraints: {name: 'constraints' as const, title: 'Constraints'},
  targeting: {name: 'targeting' as const, title: 'Targeting'},
  flow: {name: 'flow' as const, title: 'Flow'},
} as const

export const CAMPAIGN_BRIEF_FIELDS = {
  title: {
    name: 'title' as const,
    title: 'Title',
    required: true,
    group: CAMPAIGN_BRIEF_GROUPS.brief.name,
  },
  multiStep: {
    name: 'multiStep' as const,
    title: 'Multi-step flow',
    description: 'Off = single send. On = an ordered, timed sequence (reveals Flow steps).',
    group: CAMPAIGN_BRIEF_GROUPS.brief.name,
  },
  goal: {
    name: 'goal' as const,
    title: 'Goal',
    group: CAMPAIGN_BRIEF_GROUPS.brief.name,
  },
  summary: {
    name: 'summary' as const,
    title: 'Summary',
    required: true,
    group: CAMPAIGN_BRIEF_GROUPS.brief.name,
  },
  offer: {
    name: 'offer' as const,
    title: 'Offer',
    description: 'Also exposed as the Sanity-resolved {{offer.amount}} token.',
    group: CAMPAIGN_BRIEF_GROUPS.brief.name,
  },
  landingUrlBase: {
    name: 'landingUrlBase' as const,
    title: 'Landing URL base',
    group: CAMPAIGN_BRIEF_GROUPS.brief.name,
  },
  keyMessages: {
    name: 'keyMessages' as const,
    title: 'Key messages',
    group: CAMPAIGN_BRIEF_GROUPS.constraints.name,
  },
  mandatoryDisclaimers: {
    name: 'mandatoryDisclaimers' as const,
    title: 'Mandatory disclaimers',
    group: CAMPAIGN_BRIEF_GROUPS.constraints.name,
  },
  allowedMedia: {
    name: 'allowedMedia' as const,
    title: 'Allowed media',
    description:
      'Hero images for web (and email previews) may ONLY use assets from this library. Generate will not create new images.',
    hint: 'Required when Web is a target channel. Create assets in Studio → Media library.',
    group: CAMPAIGN_BRIEF_GROUPS.constraints.name,
  },
  targetChannels: {
    name: 'targetChannels' as const,
    title: 'Target channels',
    group: CAMPAIGN_BRIEF_GROUPS.targeting.name,
  },
  targetSegments: {
    name: 'targetSegments' as const,
    title: 'Target segments',
    group: CAMPAIGN_BRIEF_GROUPS.targeting.name,
  },
  featuredProduct: {
    name: 'featuredProduct' as const,
    title: 'Featured product',
    group: CAMPAIGN_BRIEF_GROUPS.targeting.name,
  },
  flowSteps: {
    name: 'flowSteps' as const,
    title: 'Flow steps',
    group: CAMPAIGN_BRIEF_GROUPS.flow.name,
  },
} as const

export type CampaignBriefFieldName = keyof typeof CAMPAIGN_BRIEF_FIELDS
