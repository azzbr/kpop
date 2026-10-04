import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './events/halloween.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support (see sw/sw.js). Only in production builds — the dev server must stay live.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !new URLSearchParams(location.search).has('nosw')) {
  // Not waiting for 'load': on bad Wi-Fi a slow web font can hold it back for a long time.
  window.setTimeout(() => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is optional */ });
  }, 1500);
}
