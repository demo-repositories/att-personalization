import type {DefaultDocumentNodeResolver} from 'sanity/structure'
import {VariationMatrixView} from '../ui/campaign/VariationMatrixView'

/**
 * defaultDocumentNode — adds a "Variations" view to campaignBrief documents
 * alongside the default form view. The matrix is *about one brief*, so a
 * document view is the right surface (not a top-nav tool).
 */
export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, {schemaType}) => {
  if (schemaType === 'campaignBrief') {
    return S.document().views([
      S.view.form(),
      S.view.component(VariationMatrixView).title('Variations').id('variations'),
    ])
  }
  return S.document().views([S.view.form()])
}
