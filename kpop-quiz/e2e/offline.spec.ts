import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp } from './helpers';

// The fonts ship with the app (src/fonts.css + src/assets/fonts), so an installed app looks the
// same offline. This runs with the service worker on (no ?nosw).

const loadedFonts = (page: Page) => page.evaluate(async () => {
  await document.fonts.ready;
  return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/['"]/g, ''));
});

test('the fonts come with the app, are stored for offline use, and still load offline', async ({ page, context, browserName }) => {
  const outside: string[] = [];
  page.on('request', r => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) outside.push(r.url()); });

  await openApp(page, '/');
  await expect(page.locator('#player-name')).toBeVisible();
  await expect.poll(() => loadedFonts(page)).toEqual(expect.arrayContaining(['Fredoka One', 'Fredoka', 'Nunito']));
  expect(outside, 'no font requests to Google').toEqual([]);

  test.skip(browserName === 'webkit', 'Playwright drives service workers in Chromium only');

  // The service worker installs (it waits 1.5 s after start-up), stores the fonts and takes over.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  const cachedFonts = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) for (const req of await (await caches.open(key)).keys()) urls.push(new URL(req.url).pathname);
    return urls.filter(u => u.endsWith('.woff2'));
  });
  expect(cachedFonts).toHaveLength(3);

  // No internet: a fresh tab still opens the app with the same fonts.
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto('/');
  await expect(offline.locator('#player-name')).toBeVisible();
  await expect.poll(() => loadedFonts(offline)).toEqual(expect.arrayContaining(['Fredoka One', 'Nunito']));
  await context.setOffline(false);
});
