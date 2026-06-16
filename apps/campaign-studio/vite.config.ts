import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@studio': path.resolve(__dirname, '../../studio/src'),
    },
  },
  server: {port: 3333},
})
