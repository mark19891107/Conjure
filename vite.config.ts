import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The site is served from https://<user>.github.io/Conjure/ on GitHub Pages,
// so assets must be referenced under the "/Conjure/" base path in production.
// During local dev (`vite`) the base stays "/" so http://localhost:5173 works.
const repoName = 'Conjure'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${repoName}/` : '/',
  plugins: [react()],
}))
