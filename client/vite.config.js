import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    host: true, // Listen on all network interfaces
    // 4500 is taken by nginx serving the production build; dev runs alongside it
    port: 5173,
    // Proxy the API in development so relative paths behave exactly as they do
    // in production behind nginx. Without this, dev has to call the backend
    // cross-origin, which production never does.
    proxy: {
      '/admin': {
        target: `http://localhost:${process.env.API_PORT || 4801}`,
        changeOrigin: true,
      },
      '/file-content': {
        target: `http://localhost:${process.env.API_PORT || 4801}`,
        changeOrigin: true,
      },
      '/profile-pictures': {
        target: `http://localhost:${process.env.API_PORT || 4801}`,
        changeOrigin: true,
      },
    },
  }
})
