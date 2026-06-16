import {defineType, defineField} from 'sanity'

export const emailContent = defineType({
  name: 'emailContent',
  title: 'Email',
  type: 'object',
  fields: [
    defineField({
      name: 'subjectLine',
      title: 'Subject line',
      type: 'string',
      validation: (rule) =>
        rule.required().max(60).warning('Email subject lines work best at 60 characters or less.'),
    }),
    defineField({
      name: 'preheader',
      type: 'string',
      validation: (rule) =>
        rule.max(110).warning('Preheaders work best at 110 characters or less.'),
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [{type: 'block'}],
    }),
    defineField({name: 'ctaLabel', title: 'CTA label', type: 'string'}),
    defineField({name: 'ctaUrl', title: 'CTA URL', type: 'url'}),
  ],
})
