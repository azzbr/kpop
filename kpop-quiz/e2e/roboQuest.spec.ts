import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, enterName, grid, openTile, watchErrors, readSave } from './helpers';

// 🤖 Robo Quest: blocks are added by tapping them in the Blockly flyout (like on the iPad);
// ?debug's window.__robo opens any level and loads or solves programs.

interface RoboHook { open: (id: string) => void; load: (p: unknown[]) => void; solve: () => void; run: () => string | null; blocks: () => number; program: () => unknown[]; levelId: string }
declare global { interface Window { __robo?: RoboHook } }

/** Taps a block in the flyout by its label (the label text, not the middle of a C-shaped block).
 *  Blockly draws spaces as non-breaking spaces, so match them with \s. */
const tapBlock = (page: Page, label: RegExp) => page.locator('.blocklyFlyout .blocklyText').filter({ hasText: label }).first().click();
const counter = (page: Page) => page.getByTestId('robo-blocks');
const message = (page: Page) => page.getByTestId('robo-message');

async function openRobo(page: Page, path = '/?debug&nosw') {
  await openApp(page, path);
  await enterName(page, 'Mia');
  await openTile(page, /^Robo Quest$/);
  await expect(page.getByRole('button', { name: /^▶ Play:/ })).toBeVisible();
}

test('level 1 by tapping blocks: run, dock, stars and rewards; the next level unlocks', async ({ page }) => {
  const errors = watchErrors(page);
  const outside: string[] = [];
  page.on('request', r => { if (!r.url().startsWith('http://localhost')) outside.push(r.url()); });
  await openRobo(page);
  // Only level 1 is open on a fresh map.
  await expect(page.getByRole('button', { name: /Level 1-2 Round the corner \(locked\)/ })).toBeDisabled();
  await page.getByRole('button', { name: '▶ Play: 🌻 Hello, Robo!' }).click();

  for (let i = 0; i < 3; i++) await tapBlock(page, /forward/);
  await expect(counter(page)).toHaveText('🧩 3 · ⭐⭐⭐ with 3');
  expect(await page.evaluate(() => window.__robo!.program())).toEqual([{ t: 'forward' }, { t: 'forward' }, { t: 'forward' }]);

  await page.getByRole('button', { name: '▶ Run' }).click();
  await expect(page.getByTestId('round-stars')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.state.highScores?.robo_quest).toBe(300);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('robo_stars') ?? '{}'))).toEqual({ g01: 3 });

  await page.getByRole('button', { name: '▶ Next level' }).click();
  await expect(page.getByText('1-2 · Round the corner')).toBeVisible();
  expect(outside, 'no requests to other sites (Blockly media is local)').toEqual([]);
  expect(errors).toEqual([]);
});

test('kind feedback: a bump stops at the wall until an edit; an empty loop says what to do', async ({ page }) => {
  await openRobo(page);
  await page.getByRole('button', { name: /^▶ Play:/ }).click();
  await tapBlock(page, /turn\sleft/);
  await tapBlock(page, /forward/);
  await page.getByRole('button', { name: '▶ Run' }).click();
  await expect(message(page)).toContainText('Bonk!', { timeout: 10_000 });
  // It stays there (robot, trail and message) until she changes something.
  await page.waitForTimeout(600);
  await expect(message(page)).toContainText('Bonk!');
  await tapBlock(page, /forward/);
  await expect(message(page)).not.toContainText('Bonk!');

  // Factory: tapping repeat then forward puts forward INSIDE the empty loop.
  await page.evaluate(() => window.__robo!.open('f11'));
  await page.evaluate(() => window.__robo!.load([]));
  await tapBlock(page, /repeat/);
  await page.getByRole('button', { name: '▶ Run' }).click();
  await expect(message(page)).toContainText('Put some blocks inside the loop');
  await tapBlock(page, /forward/);
  expect(await page.evaluate(() => window.__robo!.program())).toEqual([{ t: 'repeat', n: 2, body: [{ t: 'forward' }] }]);
  await expect(counter(page)).toHaveText('🧩 2 · ⭐⭐⭐ with 2');
});

test('👣 Step walks the program one move at a time, and the program is remembered after a reload', async ({ page }) => {
  await openRobo(page);
  await page.getByRole('button', { name: /^▶ Play:/ }).click();
  await tapBlock(page, /forward/);
  await tapBlock(page, /forward/);
  const robot = page.getByTestId('robo-robot');
  const start = await robot.getAttribute('style');
  await page.getByRole('button', { name: '👣 Step' }).click();
  await expect.poll(() => robot.getAttribute('style')).not.toBe(start);
  await page.getByRole('button', { name: '👣 Step' }).click();
  await expect(message(page)).toContainText('stopped before the dock');

  // Saved (compact) and back after a reload.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('robo_code') ?? '{}').g01)).toEqual([{ t: 'forward' }, { t: 'forward' }]);
  await page.reload();
  await enterName(page, 'Mia');
  await openTile(page, /^Robo Quest$/);
  await page.getByRole('button', { name: /^▶ Play:/ }).click();
  await expect(counter(page)).toHaveText('🧩 2 · ⭐⭐⭐ with 3');
});

test('a Space level: sensors light up the board, and a perfect solution scores 900 with three stars', async ({ page }) => {
  const errors = watchErrors(page);
  await openRobo(page);
  await page.getByRole('button', { name: /^▶ Play:/ }).click();
  await page.evaluate(() => window.__robo!.open('s25'));
  await expect(page.getByText('3-5 · Battery zigzag')).toBeVisible();
  // Step through the first sensor check: the inspected square pulses.
  await page.evaluate(() => window.__robo!.load([{ t: 'until', body: [{ t: 'if', dir: 'ahead', body: [{ t: 'forward' }], else: [{ t: 'right' }] }] }]));
  await page.getByRole('button', { name: '👣 Step' }).click();
  await expect(page.getByTestId('robo-sense')).toBeVisible();

  await page.evaluate(() => window.__robo!.solve());
  await expect(page.getByTestId('round-stars')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.state.highScores?.robo_quest).toBe(900);
  await expect(page.getByRole('button', { name: /Try for ⭐⭐⭐/ })).toHaveCount(0);
  await page.getByRole('button', { name: '🗺️ Level map' }).click();
  await expect(page.getByRole('button', { name: /^▶ Play:/ })).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(grid(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('fewer than three stars offers "Try for ⭐⭐⭐"', async ({ page }) => {
  await openRobo(page);
  await page.getByRole('button', { name: /^▶ Play:/ }).click();
  await page.evaluate(() => window.__robo!.open('f11'));
  // 7 forwards instead of one loop: it docks, but ⭐ only.
  await page.evaluate(() => window.__robo!.load(Array.from({ length: 7 }, () => ({ t: 'forward' }))));
  await page.evaluate(() => window.__robo!.run());
  await expect(page.getByRole('button', { name: '🔧 Try for ⭐⭐⭐ (2 blocks)' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: '🔧 Try for ⭐⭐⭐ (2 blocks)' }).click();
  await expect(page.getByText('2-1 · Loop it!')).toBeVisible();
  await expect(counter(page)).toHaveText('🧩 7 · ⭐⭐⭐ with 2');
});

test('offline: Robo Quest and its Blockly media are stored and work with the internet off', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright drives service workers in Chromium only');
  await openApp(page, '/');
  await expect(page.locator('#player-name')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) for (const req of await (await caches.open(key)).keys()) urls.push(new URL(req.url).pathname);
    return urls.includes('/blockly-media/handopen.cur') && urls.some(u => /RoboQuest-.*\.js$/.test(u));
  }), { timeout: 20_000 }).toBe(true);

  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto('/');
  await enterName(offline, 'Mia');
  await openTile(offline, /^Robo Quest$/);
  await offline.getByRole('button', { name: /^▶ Play:/ }).click();
  await tapBlock(offline, /forward/);
  await expect(counter(offline)).toHaveText('🧩 1 · ⭐⭐⭐ with 3');
  await context.setOffline(false);
});
