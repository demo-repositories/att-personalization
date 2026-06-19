import {defineType, defineField} from 'sanity'

export const webContent = defineType({
  name: 'webContent',
  title: 'Web / landing page',
  type: 'object',
  fields: [
    defineField({
      name: 'headline',
      type: 'string',
      validation: (rule) => rule.max(80).warning('Keep web headlines punchy.'),
    }),
    defineField({name: 'subheadline', type: 'string'}),
    defineField({
      name: 'body',
      type: 'array',
      of: [{type: 'block'}],
    }),
    defineField({name: 'ctaLabel', title: 'CTA label', type: 'string'}),
    defineField({name: 'ctaUrl', title: 'CTA URL', type: 'url'}),
    defineField({
      name: 'heroImage',
      title: 'Hero image',
      type: 'image',
      options: {hotspot: true},
      description: 'Set from the brief’s allowed media during Generate. Either a project asset ref or a Media Library URL.',
      fields: [
        defineField({name: 'alt', type: 'string', title: 'Alt text'}),
        // Direct CDN URL when the hero comes from the Sanity Media Library
        // (those assets have no project-dataset asset ref).
        defineField({name: 'url', title: 'Media Library URL', type: 'url', readOnly: true}),
      ],
    }),
  ],
})
