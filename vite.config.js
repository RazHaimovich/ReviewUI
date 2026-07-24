import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist' },
  server: { proxy: { '/api': 'http://localhost:41096' } },
});
