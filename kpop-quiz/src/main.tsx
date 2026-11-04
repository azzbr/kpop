import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import './events/halloween.css'
import './events/winter.css'
import App from './App.tsx'
import { initAppInstall, markUpdateReady } from './utils/appInstall'

// First, so the browser's install event is never missed.
initAppInstall()

// Canvas games draw with "Fredoka", but canvas text doesn't make the browser fetch a font: ask for it.
document.fonts?.load('bold 16px Fredoka').catch(() => { /* falls back to sans-serif */ })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support (see sw/sw.js). Only in production builds — the dev server must stay live.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !new URLSearchParams(location.search).has('nosw')) {
  // Not waiting for 'load': on bad Wi-Fi a slow web font can hold it back for a long time.
  window.setTimeout(() => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // An installed app can stay open for days: look for a new version when it comes back to the front.
      let checked = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || Date.now() - checked < 30 * 60_000) return;
        checked = Date.now();
        reg.update().catch(() => { /* offline */ });
      });
    }).catch(() => { /* offline support is optional */ });
  }, 1500);
  // A new version took over this page (not the very first install): the grid offers "Tap to update".
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', markUpdateReady);
  }
}
