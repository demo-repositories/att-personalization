import {defineType, defineField} from 'sanity'

export const smsContent = defineType({
  name: 'smsContent',
  title: 'SMS',
  type: 'object',
  fields: [
    defineField({
      name: 'message',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required().max(160).error('SMS must be ≤160 characters.'),
    }),
    defineField({name: 'link', type: 'url'}),
  ],
})
