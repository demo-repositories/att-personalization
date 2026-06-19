/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SANITY_PROJECT_ID: string
  readonly VITE_SANITY_DATASET: string
  readonly VITE_SANITY_MEDIA_LIBRARY_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
