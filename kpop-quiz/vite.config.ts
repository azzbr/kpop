/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync } from 'node:fs'
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
      // Fonts too, so they are stored at install and after every update (the app works offline).
      // Plus Blockly's few media files (Robo Quest), which it would otherwise fetch from blockly.com.
      const blocklyMedia = readdirSync(new URL('./public/blockly-media', import.meta.url)).map(f => `/blockly-media/${f}`);
      const files = [...Object.keys(bundle).filter(f => /\.(js|css|woff2)$/.test(f)).map(f => `/${f}`), ...blocklyMedia].sort();
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
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
