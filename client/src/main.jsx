import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// CSS and vendor styles are loaded from `public/assets` via `index.html`.
// Avoid importing from `../assets` so the app uses the public `assets` copy.
const root = createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
