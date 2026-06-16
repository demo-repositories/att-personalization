import {defineType, defineField} from 'sanity'

export const flowStep = defineType({
  name: 'flowStep',
  title: 'Flow step',
  type: 'object',
  fields: [
    defineField({
      name: 'stepKey',
      title: 'Step key',
      type: 'string',
      description: 'Stable key for this step (e.g. "reminder", "incentive", "urgency"). Used in deterministic variation ids.',
    }),
    defineField({
      name: 'delayLabel',
      title: 'Delay',
      type: 'string',
      description: 'Human-readable delay, e.g. "1 hour after abandon", "24 hours", "48 hours".',
    }),
    defineField({
      name: 'intent',
      type: 'text',
      rows: 2,
      description: 'What this step should accomplish.',
    }),
    defineField({
      name: 'channels',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'channel'}]}],
      description: 'Channels used at this step (e.g. email then SMS).',
    }),
  ],
  preview: {
    select: {title: 'stepKey', subtitle: 'delayLabel'},
  },
})
