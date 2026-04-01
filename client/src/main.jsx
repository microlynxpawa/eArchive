import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Load optional runtime config from `public/config.json` (editable in production)
// If absent, fall back to Vite build-time env `import.meta.env.VITE_API_URL`.
async function loadRuntimeConfig() {
  try {
    const res = await fetch('/config.json', { cache: 'no-store' })
    if (res.ok) {
      const cfg = await res.json()
      window.__RUNTIME_CONFIG__ = cfg || {}
      return
    }
  } catch (e) {
    // ignore
  }
  window.__RUNTIME_CONFIG__ = {}
}

function installFetchWrapper() {
  const rc = window.__RUNTIME_CONFIG__ || {}
  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    try {
      let url
      if (typeof input === 'string') url = input
      else if (input instanceof Request) url = input.url
      else url = String(input)

      // Only handle absolute-relative paths that start with '/'
      if (url && url.startsWith('/')) {
        const adminBase = rc.ADMIN_API_URL || import.meta.env.VITE_ADMIN_API_URL || ''
        const fileContentBase = rc.FILE_CONTENT_API_URL || import.meta.env.VITE_FILE_CONTENT_API_URL || ''
        const defaultBase = rc.VITE_API_URL || import.meta.env.VITE_API_URL || ''

        let base = ''
        if (url.startsWith('/admin') && adminBase) base = adminBase
        else if (url.startsWith('/file-content') && fileContentBase) base = fileContentBase
        else base = defaultBase

        if (base) {
          const newUrl = `${base}${url}`
          if (typeof input === 'string') return nativeFetch(newUrl, init)
          const req = input instanceof Request ? new Request(newUrl, input) : new Request(newUrl, init)
          return nativeFetch(req)
        }
      }
    } catch (err) {
      // fall through to native
    }
    return nativeFetch(input, init)
  }
}

;(async () => {
  await loadRuntimeConfig()
  installFetchWrapper()

  // CSS and vendor styles are loaded from `public/assets` via `index.html`.
  // Avoid importing from `../assets` so the app uses the public `assets` copy.
  const root = createRoot(document.getElementById('root'))
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})()
