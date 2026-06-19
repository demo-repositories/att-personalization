export const PROJECT_ID = (import.meta.env.VITE_SANITY_PROJECT_ID as string) || 'z6s0fz61'
export const DATASET = (import.meta.env.VITE_SANITY_DATASET as string) || 'production'

/**
 * Sanity Media Library for the org. Browsed via the App SDK `useQuery` with an
 * explicit `resource: {mediaLibraryId}` (see useMediaLibraryAssets) — without
 * that, queries hit the project dataset and the library reads as empty.
 */
export const MEDIA_LIBRARY_ID =
  (import.meta.env.VITE_SANITY_MEDIA_LIBRARY_ID as string) || 'mlZKouJfXE8F'

/** AT&T brand colors (used for accent only — preview mocks pull from segment.brandColor). */
export const ATT_BLUE = '#00A8E0'
