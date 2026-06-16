import {defineType, defineField} from 'sanity'

/**
 * mergeField — the token registry. Each doc defines a placeholder the AI may emit
 * (e.g. {{product.name}}) and how it resolves at preview / delivery time.
 *
 * NOTE: `key` strings are referenced verbatim in code and in generated copy.
 * Typos cascade. Use the exact PRD keys: product.name, product.price,
 * cart.recoveryUrl, cart.itemCount, customer.firstName, offer.amount.
 */
export const mergeField = defineType({
  name: 'mergeField',
  title: 'Merge field (token)',
  type: 'document',
  fields: [
    defineField({
      name: 'key',
      type: 'string',
      description:
        'Token key. Use case-sensitive dotted form (e.g. product.name, cart.recoveryUrl). Token in copy is {{key}}.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'label',
      type: 'string',
      description: 'Human label for the editor UI.',
    }),
    defineField({
      name: 'source',
      type: 'string',
      description: 'Where this token resolves from.',
      options: {
        list: [
          {title: 'External (commerce / PIM / CRM)', value: 'external'},
          {title: 'Sanity content', value: 'sanity'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'sampleValue',
      title: 'Sample value',
      type: 'string',
      description: 'Value rendered in previews (simulates the live external lookup).',
    }),
    defineField({
      name: 'sanityResolver',
      title: 'Sanity resolver',
      type: 'string',
      description:
        'GROQ or field path to pull the live value from Sanity. Only used when source = "sanity".',
      hidden: ({parent}) => parent?.source !== 'sanity',
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 3,
      description: 'Guidance the AI sees so it uses the token correctly.',
    }),
  ],
  preview: {
    select: {title: 'key', subtitle: 'label'},
  },
})
