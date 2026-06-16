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
      type: 'image',
      options: {
        hotspot: true,
        // AI Assist / Agent Actions read this field name to know which sibling
        // field holds the image-generation prompt.
        aiAssist: {imageInstructionField: 'imagePrompt'},
      },
      fields: [
        defineField({name: 'alt', type: 'string', title: 'Alt text'}),
        defineField({name: 'imagePrompt', type: 'text', title: 'Image prompt', hidden: true}),
      ],
    }),
  ],
})
