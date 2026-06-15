import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5188',
    },
  },
  build: {
    outDir: resolve(__dirname, '../wwwroot'),
    emptyOutDir: true,
  },
})
