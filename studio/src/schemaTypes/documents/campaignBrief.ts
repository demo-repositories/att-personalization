import {defineType, defineField} from 'sanity'

/**
 * campaignBrief — the marketer's input. One brief → many variations.
 *
 * Field groups: Brief / Constraints / Targeting / Flow.
 * The flowSteps field is hidden unless campaignType === 'abandoned-cart'.
 */
export const campaignBrief = defineType({
  name: 'campaignBrief',
  title: 'Campaign brief',
  type: 'document',
  groups: [
    {name: 'brief', title: 'Brief', default: true},
    {name: 'constraints', title: 'Constraints'},
    {name: 'targeting', title: 'Targeting'},
    {name: 'flow', title: 'Flow'},
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
      name: 'campaignType',
      title: 'Campaign type',
      type: 'string',
      description: 'Drives which fields show and how the matrix is dimensioned.',
      initialValue: 'promotional',
      options: {
        list: [
          {title: 'Promotional (one-shot)', value: 'promotional'},
          {title: 'Abandoned cart (multi-step flow)', value: 'abandoned-cart'},
        ],
      },
      group: 'brief',
      validation: (rule) => rule.required(),
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
      hidden: ({document}) => document?.campaignType !== 'abandoned-cart',
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'campaignType'},
  },
})
