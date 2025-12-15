import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 5173,
    proxy: {
      '/admin': {
        target: 'http://localhost:4801',
        changeOrigin: true,
        secure: false
      },
      '/file-content': {
        target: 'http://localhost:4801',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
