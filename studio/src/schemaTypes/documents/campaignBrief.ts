import {defineType, defineField} from 'sanity'
import {CAMPAIGN_BRIEF_FIELDS, CAMPAIGN_BRIEF_GROUPS} from '../meta/campaignBriefMeta'

const F = CAMPAIGN_BRIEF_FIELDS
const G = CAMPAIGN_BRIEF_GROUPS

/**
 * campaignBrief — the marketer's input. One brief → many variations.
 *
 * Field groups: Brief / Constraints / Targeting / Flow.
 * The flowSteps field is hidden unless `multiStep` is enabled.
 */
export const campaignBrief = defineType({
  name: 'campaignBrief',
  title: 'Campaign brief',
  type: 'document',
  groups: [
    {name: G.brief.name, title: G.brief.title, default: true},
    {name: G.constraints.name, title: G.constraints.title},
    {name: G.targeting.name, title: G.targeting.title},
    {name: G.flow.name, title: G.flow.title},
  ],
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      description: 'Internal campaign name.',
      group: 'brief',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: {source: 'title'},
      group: 'brief',
    }),
    defineField({
      name: 'multiStep',
      title: 'Multi-step flow',
      type: 'boolean',
      description:
        'Off = a single send per channel × segment. On = an ordered, timed sequence; reveals Flow steps and dimensions the matrix per step.',
      initialValue: false,
      group: 'brief',
    }),
    defineField({
      name: 'summary',
      type: 'text',
      rows: 6,
      description: 'Core brief / value proposition. Read by Generate via {type:"document"}.',
      group: 'brief',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'goal',
      type: 'string',
      options: {
        list: [
          {title: 'Awareness', value: 'awareness'},
          {title: 'Acquisition', value: 'acquisition'},
          {title: 'Retention', value: 'retention'},
          {title: 'Upsell', value: 'upsell'},
          {title: 'Cart recovery', value: 'cart-recovery'},
        ],
      },
      group: 'brief',
    }),
    defineField({
      name: 'offer',
      type: 'text',
      rows: 2,
      description: 'Specific promo, e.g. "$10/mo off for 12 months". Also exposed as the Sanity-resolved {{offer.*}} token.',
      group: 'brief',
    }),
    defineField({
      name: 'keyMessages',
      title: 'Key messages',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Must-include talking points.',
      group: 'constraints',
    }),
    defineField({
      name: 'mandatoryDisclaimers',
      title: 'Mandatory disclaimers',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Legal lines the AI MUST append verbatim.',
      group: 'constraints',
    }),
    defineField({
      name: F.allowedMedia.name,
      title: F.allowedMedia.title,
      type: 'array',
      of: [{type: 'reference', to: [{type: 'mediaAsset'}]}],
      description: F.allowedMedia.description,
      group: F.allowedMedia.group,
      validation: (rule) =>
        rule.custom(async (value, context) => {
          const doc = context.document as {targetChannels?: Array<{_ref?: string}>; flowSteps?: unknown[]}
          const channelRefs = doc?.targetChannels ?? []
          if (channelRefs.length === 0) return true
          const client = context.getClient({apiVersion: '2024-10-01'})
          const webChannel = await client.fetch(`*[_id == "channel-web"][0]._id`)
          const targetsWeb = channelRefs.some((r) => r._ref === webChannel)
          if (targetsWeb && (!value || value.length === 0)) {
            return 'Attach at least one allowed media asset when Web is a target channel.'
          }
          return true
        }),
    }),
    defineField({
      name: 'targetChannels',
      title: 'Target channels',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'channel'}]}],
      group: 'targeting',
    }),
    defineField({
      name: 'targetSegments',
      title: 'Target segments',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'segment'}]}],
      group: 'targeting',
    }),
    defineField({
      name: 'landingUrlBase',
      title: 'Landing URL base',
      type: 'url',
      description: 'Base for CTA links.',
      group: 'targeting',
    }),
    defineField({
      name: 'featuredProduct',
      title: 'Featured product',
      type: 'reference',
      to: [{type: 'product'}],
      description:
        'When set, product tokens ({{product.*}}) resolve from this Sanity product doc instead of the external sample.',
      group: 'targeting',
    }),
    defineField({
      name: 'flowSteps',
      title: 'Flow steps',
      type: 'array',
      of: [{type: 'flowStep'}],
      description: 'Ordered recovery sequence. Variations are generated per step × channel × segment.',
      group: 'flow',
      hidden: ({document}) => !document?.multiStep,
    }),
    defineField({
      name: 'archived',
      title: 'Archived',
      type: 'boolean',
      description:
        'When archived, every generated variation for this campaign is unpublished. Toggled via "Archive campaign" in the app; reversible.',
      initialValue: false,
      group: 'brief',
    }),
    defineField({
      name: 'releaseTitle',
      title: 'Release name',
      type: 'string',
      description:
        'Name for the content release that Generate stages variations into. Leave blank to use "<brief title> — generated variations".',
      group: 'brief',
    }),
    defineField({
      name: 'releaseType',
      title: 'Release type',
      type: 'string',
      options: {
        list: [
          {title: 'ASAP — publish whenever promoted', value: 'asap'},
          {title: 'Undecided — no target date', value: 'undecided'},
        ],
        layout: 'radio',
      },
      initialValue: 'asap',
      group: 'brief',
    }),
    defineField({
      name: 'generationReleaseId',
      title: 'Generation release',
      type: 'string',
      description:
        'Pointer to the ongoing content release that Generate writes variations into for review before publishing. Managed automatically.',
      readOnly: true,
      group: 'brief',
    }),
  ],
  preview: {
    select: {title: 'title', multiStep: 'multiStep'},
    prepare({title, multiStep}) {
      return {title: title ?? '(untitled)', subtitle: multiStep ? 'Multi-step' : 'Single-step'}
    },
  },
})
