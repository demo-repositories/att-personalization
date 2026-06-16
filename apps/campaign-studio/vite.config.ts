import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const monorepoRoot = path.resolve(__dirname, '../..')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@studio': path.resolve(__dirname, '../../studio/src'),
    },
  },
  server: {
    port: 3333,
    // App imports from ../../studio/src via @studio — allow the monorepo root.
    fs: {allow: [monorepoRoot]},
  },
})
