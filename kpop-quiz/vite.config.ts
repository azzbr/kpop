/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/**
 * Emits /sw.js (from sw/sw.js) with this build's JS/CSS files to precache and a version
 * derived from them, so every deploy installs a fresh offline cache. See sw/sw.js.
 */
function serviceWorker(): Plugin {
  return {
    name: 'funquest-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(f => /\.(js|css)$/.test(f)).map(f => `/${f}`).sort();
      const version = createHash('sha1').update(files.join('|')).digest('hex').slice(0, 10);
      const source = readFileSync(new URL('./sw/sw.js', import.meta.url), 'utf8')
        .replaceAll('__VERSION__', version)
        .replaceAll('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: {
    // The tldraw drawing canvas (Living Mural) is ~1.6 MB on its own; it's lazy-loaded,
    // so it only downloads when that screen is opened (and is precached for offline use).
    chunkSizeWarningLimit: 1800,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
