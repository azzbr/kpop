// Renders the install images: the Android "maskable" icons (from public/icons/icon-maskable.svg)
// and the screenshots that Android/Chrome show in the install sheet (public/screenshots/).
// Run after `npm run build`:  node scripts/makeAppImages.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const PORT = 4179;

// PW_CHROMIUM: a Chromium to use when the installed Playwright's own browser is missing.
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

// Icons.
const svg = readFileSync(`${root}public/icons/icon-maskable.svg`, 'utf8');
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `${root}public/icons/icon-maskable-${size}.png` });
  await page.close();
}

// Screenshots of the game grid, from the production build.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 500));
  }
  mkdirSync(`${root}public/screenshots`, { recursive: true });
  const shots = [
    { file: 'grid-narrow.jpg', viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true },
    { file: 'grid-wide.jpg', viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true },
  ];
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: s.viewport, deviceScaleFactor: 2, isMobile: s.isMobile, hasTouch: s.hasTouch });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/?nosw`);
    await page.locator('#player-name').fill('Mia');
    await page.locator('button[type="submit"]').click();
    await page.getByText('Pick a game.').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${root}public/screenshots/${s.file}`, type: 'jpeg', quality: 82 });
    await ctx.close();
  }
} finally {
  server.kill();
  await browser.close();
}
console.log('Made icons and screenshots.');
