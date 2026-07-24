import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev proxy target must match the port the backend actually bound. Both this
// and server/index.js read REVIEWUI_PORT, so if 41096 is taken, set the same
// REVIEWUI_PORT for `node server/index.js` and `npm run dev:web`.
const apiPort = process.env.REVIEWUI_PORT || 41096

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist' },
  server: { proxy: { '/api': `http://localhost:${apiPort}` } }
})
