import type {DefaultDocumentNodeResolver} from 'sanity/structure'

/**
 * Stub defaultDocumentNode — returns only the default form view for every type.
 * Pass 5 (@studio-ui-lead) replaces this with a campaignBrief "Variations" tab
 * that renders the segment × channel matrix.
 */
export const defaultDocumentNode: DefaultDocumentNodeResolver = (S) => {
  return S.document().views([S.view.form()])
}
