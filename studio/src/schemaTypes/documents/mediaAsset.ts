import {defineType, defineField} from 'sanity'

/**
 * mediaAsset — curated image in the Sanity media library.
 * Campaign briefs attach allowed media; generation may only reference these assets.
 */
export const mediaAsset = defineType({
  name: 'mediaAsset',
  title: 'Media asset',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 3,
      description: 'How/when to use this asset — shown to Generate when picking hero images.',
    }),
    defineField({
      name: 'image',
      type: 'image',
      options: {hotspot: true},
      validation: (rule) => rule.required(),
      fields: [defineField({name: 'alt', type: 'string', title: 'Alt text'})],
    }),
    defineField({
      name: 'tags',
      type: 'array',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'description', media: 'image'},
  },
})
