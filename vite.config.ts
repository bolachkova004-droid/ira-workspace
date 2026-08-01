import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths keep the build working on GitHub Pages even if the
// repository name or publication path changes.
export default defineConfig({
  base: './',
  plugins: [react()]
})
