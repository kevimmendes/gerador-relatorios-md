import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Caminho relativo: funciona em qualquer repositório do GitHub Pages
  base: './',
  plugins: [tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com', '.loca.lt'],
  },
})
