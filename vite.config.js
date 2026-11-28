import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        // stoacap.com/ : the Stoa site (the version2 design, promoted 2026-11-28)
        main: resolve(import.meta.dirname, 'index.html'),
        // stoacap.com/research, /admin, /signin, /welcome, /privacy, /unsubscribe,
        // /email-preferences (see vercel.json): the reader app
        app: resolve(import.meta.dirname, 'app.html'),
        // stoacap.com/version1 (see vercel.json)
        version1: resolve(import.meta.dirname, 'version1.html'),
        // stoacap.com/version2 (see vercel.json)
        version2: resolve(import.meta.dirname, 'version2.html'),
      },
    },
  },
})
