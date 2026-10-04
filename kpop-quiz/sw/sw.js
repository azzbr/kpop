/* Fun Quest Arcade service worker — makes the app work offline (car trips, bad Wi-Fi).
 * Built by the `serviceWorker()` plugin in vite.config.ts, which injects the build version and
 * the list of every JS/CSS file of this build, so a new deploy installs a fresh cache.
 *
 * - App files (/assets/*, icons, manifest): cached at install, then cache-first.
 * - Pages: network-first, falling back to the cached app shell when offline.
 * - Music (/musickpop/*): cached the first time a song plays. Safari asks for audio in
 *   byte ranges, so cached songs are answered with proper 206 partial responses.
 * - Anything cross-origin (Friends Arena / Supabase, fonts) is left to the network.
 */
const VERSION = '__VERSION__';
const APP_CACHE = `app-${VERSION}`;
const MUSIC_CACHE = 'music-v1';
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png', ...__PRECACHE__];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('app-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function rangeResponse(request, full) {
  const range = request.headers.get('range');
  if (!range) return full;
  const buf = await full.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const size = buf.byteLength;
  let start = m && m[1] ? Number(m[1]) : 0;
  let end = m && m[2] ? Number(m[2]) : size - 1;
  if (m && !m[1] && m[2]) { start = size - Number(m[2]); end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'audio/mp4',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

async function music(request) {
  const cache = await caches.open(MUSIC_CACHE);
  const url = new URL(request.url).pathname;
  let full = await cache.match(url);
  if (!full) {
    // Fetch the whole file once (no Range) so it can be stored, then serve the slice asked for.
    const res = await fetch(url);
    if (!res.ok) return res;
    await cache.put(url, res.clone());
    full = res;
  }
  return rangeResponse(request, full.clone());
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/musickpop/')) {
    event.respondWith(music(req).catch(() => fetch(req)));
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(APP_CACHE).then((c) => c.put('/index.html', copy)); return res; })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
        const copy = res.clone();
        caches.open(APP_CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
