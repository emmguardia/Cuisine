import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Dev uniquement : l'API tourne sur le backend local (en prod, nginx s'en charge).
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
})
