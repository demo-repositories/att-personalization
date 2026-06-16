import {defineType, defineField} from 'sanity'

/**
 * product — lightweight Sanity-side product stub. Lets the demo show the same
 * {{product.*}} token resolving from Sanity content (when a brief references a
 * product doc) vs. from the external sample.
 */
export const product = defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string'}),
    defineField({name: 'price', type: 'string'}),
    defineField({name: 'image', type: 'image', options: {hotspot: true}}),
    defineField({name: 'shortDescription', title: 'Short description', type: 'text', rows: 3}),
    defineField({name: 'productUrl', title: 'Product URL', type: 'url'}),
  ],
  preview: {
    select: {title: 'name', subtitle: 'price', media: 'image'},
  },
})
