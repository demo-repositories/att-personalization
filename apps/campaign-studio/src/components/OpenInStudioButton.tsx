import {Suspense} from 'react'
import {Button} from '@sanity/ui'
import {
  useNavigateToStudioDocument,
  useStudioWorkspacesByProjectIdDataset,
} from '@sanity/sdk-react'
import {PROJECT_ID, DATASET} from '../constants'

/**
 * Inner component that uses *suspending* hooks. MUST be wrapped in a local
 * <Suspense> boundary or the thrown promise propagates upward and crashes
 * the matrix subtree. See PRD Appendix C.
 *
 * @sanity/sdk-react 2.14 shape (verified via mcp docs MCP + dist/index.d.ts):
 *   useStudioWorkspacesByProjectIdDataset() → {workspacesByProjectIdAndDataset, error}
 *     where workspacesByProjectIdAndDataset is keyed by `${projectId}:${dataset}`
 *     and the value is DashboardResource[] (each has .url)
 *   useNavigateToStudioDocument(handle, preferredStudioUrl) → {navigateToStudioDocument}
 */
function OpenInStudioInner({documentId}: {documentId: string}) {
  // suspends on first call until the workspaces list resolves
  const {workspacesByProjectIdAndDataset, error} = useStudioWorkspacesByProjectIdDataset()
  const key = `${PROJECT_ID}:${DATASET}` as const
  const resources = workspacesByProjectIdAndDataset[key]
  const preferredStudioUrl = resources?.[0]?.url

  // suspends on first call until the navigate handle resolves
  const {navigateToStudioDocument} = useNavigateToStudioDocument(
    {documentId, documentType: 'contentVariation'},
    preferredStudioUrl,
  )

  if (error) {
    return <Button text="Open in Studio" mode="ghost" disabled title={error} />
  }
  return (
    <Button
      text="Open in Studio"
      mode="ghost"
      onClick={() => {
        try {
          navigateToStudioDocument()
        } catch (err) {
          console.error('Open in Studio failed', err)
        }
      }}
    />
  )
}

export function OpenInStudioButton({documentId}: {documentId: string}) {
  return (
    <Suspense fallback={<Button text="Open in Studio" mode="ghost" disabled loading />}>
      <OpenInStudioInner documentId={documentId} />
    </Suspense>
  )
}
