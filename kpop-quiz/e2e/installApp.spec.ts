import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, enterName, grid, openTile, readSave, SAVE_KEY } from './helpers';

/** Grid → 👪 Grown-ups (or another button that opens it) → answers the times-table check. */
async function openGrownUps(page: Page, via = '👪 Grown-ups') {
  await page.getByRole('button', { name: via }).click();
  const q = await page.getByText(/^\d+ × \d+ = \?$/).textContent();
  const [, a, b] = /(\d+) × (\d+)/.exec(q!)!;
  for (const d of String(Number(a) * Number(b))) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('heading', { name: '📲 Get the app' })).toBeVisible();
}

const save = (state: Record<string, unknown>) => JSON.stringify({ state, version: 5 });

test('iPad: "Get the app" shows the Add to Home Screen steps and the copy-progress warning', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-chromium', 'phones and tablets only');
  await openApp(page, '/?nosw');
  await enterName(page, 'Mia');
  // The grid's button lands on the Grown-ups corner, where the install part comes first.
  await openGrownUps(page, '📲 Get the app');
  const card = page.getByTestId('get-the-app');
  await expect(card).toContainText('Add to Home Screen');
  await expect(card).toContainText('Open as Web App');
  await expect(card).toContainText('keeps its own progress');
});

test('progress moves to a fresh device with a save code', async ({ browser }) => {
  const from = await browser.newPage();
  await openApp(from, '/?nosw', {
    seed: {
      [SAVE_KEY]: save({ userName: 'Mia', xp: 777, userCurrency: 42, highScores: { paper_clash: 123 }, datesPlayed: ['2026-11-01'] }),
      zip_best: '17',
    },
  });
  await enterName(from, 'Mia');
  await openGrownUps(from);
  await expect(from.getByText('777 XP').first()).toBeVisible();
  await from.getByRole('button', { name: 'Show the code' }).click();
  const code = await from.getByTestId('save-code').inputValue();
  expect(code).toMatch(/^FUNQUEST-SAVE:/);

  // A different browser profile = another device (or the iPhone/iPad Home Screen app).
  const ctx = await browser.newContext();
  const to = await ctx.newPage();
  await openApp(to, '/?nosw');
  await enterName(to, 'New');
  await openGrownUps(to);
  await to.getByLabel('Paste a save code').fill(`Here it is:\n${code}\n`);
  await to.getByRole('button', { name: 'Load', exact: true }).click();
  await expect(to.getByText('In the code:')).toContainText('Mia');
  await to.getByRole('button', { name: '✅ Use this progress here' }).click();
  await to.getByRole('button', { name: /Tap again to replace/ }).click();
  await expect(to.getByText('Progress moved!')).toBeVisible();

  // After the restart the progress is there, per-game keys included.
  await expect(to.locator('#player-name')).toHaveValue('Mia', { timeout: 15_000 });
  const moved = (await readSave(to))!;
  expect(moved.state.xp).toBe(777);
  expect(moved.state.userCurrency).toBe(42);
  expect(moved.state.highScores).toMatchObject({ paper_clash: 123 });
  expect(await to.evaluate(() => localStorage.getItem('zip_best'))).toBe('17');
  await ctx.close();
  await from.close();
});

test('installed app: the back gesture pauses a game, then leaves it, instead of closing the app', async ({ page }) => {
  // `?app` makes the page behave as the installed app (display-mode can't be emulated).
  await openApp(page, '/?app&nosw');
  await enterName(page);
  expect(await page.evaluate(() => history.state)).toBeNull();

  await openTile(page, /^2048$/);
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.fqGuard ?? false)).toBe(true);

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.goBack();
  await expect(grid(page)).toBeVisible();
  // On the grid there is no guard left, so the next back would close the app.
  await expect.poll(() => page.evaluate(() => history.state?.fqGuard ?? false)).toBe(false);

  // A screen's own Back button keeps working and also clears the guard.
  await openTile(page, /^Locker$/);
  await expect.poll(() => page.evaluate(() => history.state?.fqGuard ?? false)).toBe(true);
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(grid(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => history.state?.fqGuard ?? false)).toBe(false);
});

test('a screen whose file fails to load shows a friendly card, not a blank page', async ({ page }) => {
  await page.route(/\/assets\/Locker-[^/]+\.js$/, route => route.abort());
  await openApp(page, '/?nosw');
  // The first failure reloads once, to fetch a new version (as after a deploy).
  await page.evaluate(() => sessionStorage.setItem('funquest-chunk-reload', String(Date.now())));
  await enterName(page);
  await openTile(page, /^Locker$/);
  await expect(page.getByRole('heading', { name: 'Getting the newest version…' })).toBeVisible();
  await page.getByRole('button', { name: '🎮 Back to the games' }).click();
  await expect(grid(page)).toBeVisible();
});
