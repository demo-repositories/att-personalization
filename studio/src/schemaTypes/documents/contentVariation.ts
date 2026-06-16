import {defineType, defineField} from 'sanity'

/**
 * contentVariation — one generated cell per (brief × [flow step] × channel × segment).
 *
 * `_id` is deterministic: `variation.${briefId}.${stepKey}.${channelKey}.${segmentKey}`
 * (briefId stripped of `drafts.`; stepKey = 'default' for promotional). Constructed in
 * personalization/generate/ids.ts.
 *
 * Three channel objects (web / email / sms) embedded; ONLY the matching one is populated.
 * The Generate target.path scopes writes to a single channel object. Hidden callbacks here
 * keep the editor view clean.
 *
 * Channel field names MUST be exactly 'web' / 'email' / 'sms' — Generate's target.path
 * uses these string literals.
 */
export const contentVariation = defineType({
  name: 'contentVariation',
  title: 'Content variation',
  type: 'document',
  fields: [
    defineField({
      name: 'brief',
      type: 'reference',
      to: [{type: 'campaignBrief'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'flowStep',
      title: 'Flow step',
      type: 'string',
      description: '"default" for promotional; otherwise the flowStep.stepKey.',
    }),
    defineField({
      name: 'channel',
      type: 'string',
      description: 'Denormalized channel discriminator. One of web | email | sms.',
      options: {
        list: [
          {title: 'Web / landing page', value: 'web'},
          {title: 'Email', value: 'email'},
          {title: 'SMS / push', value: 'sms'},
        ],
      },
    }),
    defineField({
      name: 'channelRef',
      title: 'Channel (reference)',
      type: 'reference',
      to: [{type: 'channel'}],
    }),
    defineField({
      name: 'segment',
      type: 'string',
      description: 'Denormalized segment discriminator. One of new | loyal | business | value.',
      options: {
        list: [
          {title: 'New / prospective', value: 'new'},
          {title: 'Existing / loyal', value: 'loyal'},
          {title: 'Business / FirstNet', value: 'business'},
          {title: 'Value / prepaid (Cricket)', value: 'value'},
        ],
      },
    }),
    defineField({
      name: 'segmentRef',
      title: 'Segment (reference)',
      type: 'reference',
      to: [{type: 'segment'}],
    }),
    defineField({
      name: 'status',
      type: 'string',
      readOnly: true,
      options: {
        list: [
          {title: 'Pending', value: 'pending'},
          {title: 'Generating', value: 'generating'},
          {title: 'Generated', value: 'generated'},
          {title: 'Error', value: 'error'},
        ],
      },
    }),
    defineField({
      name: 'generatedAt',
      title: 'Generated at',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'generatedFromBriefRev',
      title: 'Generated from brief rev',
      type: 'string',
      readOnly: true,
      description: 'Drives the "out of date" badge when this !== brief._rev.',
    }),

    // ---- Discriminated channel content. Only the matching one is populated ----
    defineField({
      name: 'web',
      type: 'webContent',
      hidden: ({parent}) => parent?.channel !== 'web',
    }),
    defineField({
      name: 'email',
      type: 'emailContent',
      hidden: ({parent}) => parent?.channel !== 'email',
    }),
    defineField({
      name: 'sms',
      type: 'smsContent',
      hidden: ({parent}) => parent?.channel !== 'sms',
    }),
  ],
  preview: {
    select: {
      title: 'brief.title',
      subtitle: 'channel',
      status: 'status',
      segment: 'segment',
    },
    prepare({title, subtitle, status, segment}) {
      return {
        title: title ?? 'Variation',
        subtitle: [subtitle, segment, status].filter(Boolean).join(' · '),
      }
    },
  },
})
