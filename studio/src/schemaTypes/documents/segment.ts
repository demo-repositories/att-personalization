import {defineType, defineField} from 'sanity'

/**
 * segment — config document. Carries the brand mapping, audience profile and tone
 * that personalize each variation. Keys must be exactly 'new' | 'loyal' | 'business' | 'value'.
 */
export const segment = defineType({
  name: 'segment',
  title: 'Segment',
  type: 'document',
  fields: [
    defineField({
      name: 'key',
      type: 'string',
      title: 'Key',
      description: 'Discriminator key used in code & ids.',
      options: {
        list: [
          {title: 'New / prospective', value: 'new'},
          {title: 'Existing / loyal', value: 'loyal'},
          {title: 'Business / FirstNet', value: 'business'},
          {title: 'Value / prepaid (Cricket)', value: 'value'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      type: 'string',
      title: 'Display title',
    }),
    defineField({
      name: 'brand',
      type: 'string',
      options: {
        list: [
          {title: 'AT&T', value: 'att'},
          {title: 'FirstNet', value: 'firstnet'},
          {title: 'Cricket', value: 'cricket'},
        ],
      },
    }),
    defineField({
      name: 'brandVoice',
      title: 'Brand voice',
      type: 'text',
      rows: 4,
      description:
        'Voice/tone guide (e.g. Cricket = playful/value; FirstNet = mission-critical/reliability; AT&T loyal = appreciative/premium).',
    }),
    defineField({
      name: 'audienceProfile',
      title: 'Audience profile',
      type: 'text',
      rows: 4,
      description: 'Who they are, their motivations, objections.',
    }),
    defineField({
      name: 'tone',
      type: 'string',
      description: 'Short tone descriptor.',
    }),
    defineField({
      name: 'brandDisclaimers',
      title: 'Brand disclaimers',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Brand-level legal lines appended on top of brief disclaimers.',
    }),
    defineField({
      name: 'brandColor',
      title: 'Brand color',
      type: 'string',
      description: 'Hex color for preview chrome (e.g. "#00A8E0").',
    }),
    defineField({
      name: 'logo',
      type: 'image',
      options: {hotspot: true},
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'brand'},
  },
})
