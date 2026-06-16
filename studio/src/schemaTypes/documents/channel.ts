import {defineType, defineField} from 'sanity'

/**
 * channel — config document. Seeded by an admin; hidden from the "Create new" menu via
 * sanity.config.ts (schema.templates + document.newDocumentOptions filtering).
 *
 * Keys must be exactly 'web' | 'email' | 'sms' — these literals appear in code paths
 * (contentVariation.channel discriminator, Generate target.path, deterministic ids).
 */
export const channel = defineType({
  name: 'channel',
  title: 'Channel',
  type: 'document',
  fields: [
    defineField({
      name: 'key',
      type: 'string',
      title: 'Key',
      description: 'Discriminator key used in code & ids. One of web, email, sms.',
      options: {
        list: [
          {title: 'Web / landing page', value: 'web'},
          {title: 'Email', value: 'email'},
          {title: 'SMS / push', value: 'sms'},
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
      name: 'constraints',
      type: 'text',
      rows: 4,
      description:
        'Natural-language rules injected into the AI generation prompt (e.g. SMS: "≤160 chars, one link, include Txt STOP to opt out, no emojis").',
    }),
    defineField({
      name: 'maxLength',
      type: 'number',
      title: 'Max length',
      description: 'Optional hard cap (e.g. 160 for SMS).',
    }),
    defineField({
      name: 'icon',
      type: 'string',
      description: 'Optional icon name or emoji.',
    }),
    defineField({
      name: 'order',
      type: 'number',
      description: 'Sort order in the matrix.',
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'key'},
  },
})
