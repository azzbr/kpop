import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, enterName, grid, openTile, watchErrors, readSave } from './helpers';

// ✈️ Flight Compass: the family's own geography game. ?debug's window.__flight aims the dial
// (aimTrue = the exact great-circle bearing) and locks, so a route can be flown without a finger.

interface FlightHook {
  state: () => { phase: string; index?: number; score?: number; lives?: number; mode?: string; over?: boolean; targets?: number };
  aim: (deg: number) => void;
  aimTrue: () => number | null;
  lock: () => Promise<void>;
  next: () => void;
  setReduceMotion: (on: boolean) => void;
}
declare global { interface Window { __flight?: FlightHook } }

const fc = (page: Page) => page.getByTestId('flight-compass');

async function openFlight(page: Page, path = '/?debug&nosw') {
  await openApp(page, path);
  await enterName(page, 'Mia');
  await openTile(page, /^Flight Compass$/);
  await expect(fc(page).locator('#dailyBtn')).toBeVisible();
  // No flying animation in tests: the result shows straight away.
  await page.evaluate(() => window.__flight!.setReduceMotion(true));
}

/** Waits until the dial is ready for the next aim (or the run is over). */
const aiming = (page: Page) => expect.poll(() => page.evaluate(() => {
  const s = window.__flight!.state();
  return s.phase === 'aim' && !!document.querySelector('.fc-root #lockBtn') ? 'aim' : s.phase;
}), { timeout: 15_000 });

/** Flies the ten daily cities on the true heading: ten Bullseyes. `onStart` runs once the first city is up. */
async function flyDailyRoute(page: Page, onStart?: () => Promise<void>) {
  await fc(page).locator('#dailyBtn').click();
  await aiming(page).toBe('aim');
  await onStart?.();
  for (let leg = 0; leg < 10; leg++) {
    await aiming(page).toBe('aim');
    await page.evaluate(async () => { window.__flight!.aimTrue(); await window.__flight!.lock(); });
    await expect(fc(page).locator('.stamp-bullseye')).toBeVisible();
    await page.evaluate(() => window.__flight!.next());
  }
}

test('daily route: ten cities flown by the true heading pay out with stars, XP and coins', async ({ page }) => {
  const errors = watchErrors(page);
  const outside: string[] = [];
  page.on('request', r => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) outside.push(r.url());
  });
  await openFlight(page);
  await flyDailyRoute(page, async () => {
    expect(await page.evaluate(() => window.__flight!.state())).toMatchObject({ mode: 'daily', targets: 10, lives: 3 });
  });

  // Fun Quest's over card: the score, the results grid and the usual rewards line.
  await expect(page.getByText('10 of 10 cities on course')).toBeVisible();
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
  await expect(page.getByLabel('Results by city').first()).toContainText('🎯');
  const save = await readSave(page);
  expect(save?.state.highScores?.flight_compass).toBeGreaterThan(1400);

  // The game's own home: today's route is marked as flown.
  await page.getByRole('button', { name: '🧭 Flight Compass home' }).click();
  await expect(fc(page).locator('#dailyBtn')).toContainText('Flown today');
  expect(errors).toEqual([]);
  expect(outside).toEqual([]);
});

test('on a Flight Compass challenge day the grid card opens the game and a good route completes it', async ({ page }) => {
  // 26 Nov 2026 is one of the days the daily challenge picks "Score 700 in Flight Compass".
  await page.clock.install({ time: new Date(2026, 10, 26, 17, 0) });
  await openApp(page, '/?debug&nosw');
  await enterName(page, 'Mia');
  const card = page.getByRole('button', { name: /Daily challenge/ });
  await expect(card).toContainText('Score 700 in Flight Compass');
  await card.click();
  await expect(fc(page).locator('#dailyBtn')).toBeVisible();
  await page.evaluate(() => window.__flight!.setReduceMotion(true));
  await flyDailyRoute(page);
  await expect(page.getByText('10 of 10 cities on course')).toBeVisible();
  expect((await readSave(page))?.state.dailyDoneDate).toBe('2026-11-26');

  await page.getByRole('button', { name: '🧭 Flight Compass home' }).click();
  await page.locator('[data-back]').first().click();
  await expect(grid(page)).toBeVisible();
  await expect(card).toContainText('Done for today');
});

test('a miss costs a life and grades "Off course"', async ({ page }) => {
  await openFlight(page);
  await fc(page).locator('#newFlightBtn').click();
  await aiming(page).toBe('aim');
  await page.evaluate(async () => { const b = window.__flight!.aimTrue()!; window.__flight!.aim(b + 90); await window.__flight!.lock(); });
  await expect(fc(page).locator('.stamp-miss')).toBeVisible();
  expect(await page.evaluate(() => window.__flight!.state().lives)).toBe(2);
});

test('leaving a flight saves it: Back, then Continue your flight carries on at the same leg', async ({ page }) => {
  await openFlight(page);
  await fc(page).locator('#newFlightBtn').click();
  await aiming(page).toBe('aim');
  await page.evaluate(async () => { window.__flight!.aimTrue(); await window.__flight!.lock(); });
  await page.evaluate(() => window.__flight!.next());
  await aiming(page).toBe('aim');
  const before = await page.evaluate(() => window.__flight!.state());

  // Fun Quest's Back goes to the game's home (not the grid) during a flight.
  await page.locator('[data-back]').first().click();
  await expect(fc(page).locator('#continueBtn')).toBeVisible();
  await fc(page).locator('#continueBtn').click();
  await aiming(page).toBe('aim');
  expect(await page.evaluate(() => window.__flight!.state())).toMatchObject({ index: before.index, score: before.score });

  // From the game's home, Back returns to the grid.
  await page.locator('[data-back]').first().click();
  await expect(fc(page).locator('#continueBtn')).toBeVisible();
  await page.locator('[data-back]').first().click();
  await expect(grid(page)).toBeVisible();
});

test('a challenge code gives everyone the same route', async ({ page }) => {
  await openFlight(page);
  const firstTarget = async () => {
    await aiming(page).toBe('aim');
    return (await fc(page).locator('.tk-target').first().textContent())?.trim();
  };
  await fc(page).locator('#challengeBtn').click();
  await fc(page).locator('#makeBtn').click();
  const code = (await fc(page).locator('#newCode code').textContent())!.trim();
  expect(code).toMatch(/^N10-[2-9A-HJ-NP-Z]{5}$/);
  await fc(page).locator('#joinBtn').click();
  const a = await firstTarget();

  await page.locator('[data-back]').first().click();
  await fc(page).locator('#challengeBtn').click();
  await fc(page).locator('#classCode').fill(code.toLowerCase());
  await fc(page).locator('#joinBtn').click();
  expect(await firstTarget()).toBe(a);
});

test('offline: Flight Compass and its maps are stored and work with the internet off', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright drives service workers in Chromium only');
  await openApp(page, '/');
  await expect(page.locator('#player-name')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) for (const req of await (await caches.open(key)).keys()) urls.push(new URL(req.url).pathname);
    return urls.some(u => /FlightCompass-.*\.js$/.test(u)) && urls.some(u => /land50-.*\.js$/.test(u)) && urls.some(u => /oswald-latin-700.*\.woff2$/.test(u));
  }), { timeout: 20_000 }).toBe(true);

  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto('/?debug');
  await enterName(offline, 'Mia');
  await openTile(offline, /^Flight Compass$/);
  await offline.locator('.fc-root #newFlightBtn').click();
  await expect(offline.locator('.fc-root #lockBtn')).toBeVisible();
  await context.setOffline(false);
});
