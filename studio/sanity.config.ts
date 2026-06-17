import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {assist} from '@sanity/assist'
import {schemaTypes} from './src/schemaTypes'
import {structure} from './src/structure'
import {defaultDocumentNode} from './src/structure/defaultDocumentNode'
import {generateVariationsAction} from './src/actions/generateVariations'

// Config document types that should NOT appear in the global "Create new" menu.
// These are seeded by an admin and edited in place, never created from scratch.
const HIDDEN_FROM_CREATE = new Set(['channel', 'segment', 'mergeField'])

export default defineConfig({
  name: 'default',
  title: 'AT&T Personalization Studio',
  projectId: 'z6s0fz61',
  dataset: 'production',

  plugins: [
    structureTool({structure, defaultDocumentNode}),
    assist(),
  ],

  schema: {
    types: schemaTypes,
    // Hide seeded config types from the global "Create new" menu.
    // They remain editable from the structure pane (and via direct deep-link).
    templates: (prev) => prev.filter((t) => !HIDDEN_FROM_CREATE.has(t.schemaType)),
  },

  document: {
    // Belt-and-braces: also remove them from the per-context "new document" options.
    newDocumentOptions: (prev) => prev.filter((opt) => !HIDDEN_FROM_CREATE.has(opt.templateId)),
    // Attach the "Generate variations" action to campaignBrief.
    actions: (prev, context) => {
      if (context.schemaType === 'campaignBrief') {
        return [generateVariationsAction, ...prev]
      }
      return prev
    },
  },
})
