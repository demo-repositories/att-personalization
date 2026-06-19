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
      description: 'Project-dataset asset. Optional — Media Library assets use the URL field instead.',
      fields: [defineField({name: 'alt', type: 'string', title: 'Alt text'})],
    }),
    // Media Library provenance. Assets curated from the org's Sanity Media
    // Library aren't project-dataset assets, so we store their CDN URL directly
    // (plus the library + asset ids for traceability) rather than an asset ref.
    defineField({
      name: 'url',
      title: 'Media Library URL',
      type: 'url',
      description: 'Direct CDN URL for an asset curated from the Sanity Media Library.',
      readOnly: true,
    }),
    defineField({name: 'mediaLibraryId', title: 'Media Library ID', type: 'string', readOnly: true}),
    defineField({name: 'mlAssetId', title: 'Media Library asset ID', type: 'string', readOnly: true}),
    defineField({
      name: 'tags',
      type: 'array',
      of: [{type: 'string'}],
      options: {layout: 'tags'},
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'description', media: 'image', imageUrl: 'url'},
    prepare: ({title, subtitle, media, imageUrl}) => ({
      title: title || 'Untitled asset',
      subtitle: subtitle || (imageUrl ? 'Sanity Media Library' : undefined),
      media,
    }),
  },
})
