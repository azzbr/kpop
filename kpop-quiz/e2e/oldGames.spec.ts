import { test, expect } from '@playwright/test';
import { openApp, enterName, openTile, readSave, watchErrors } from './helpers';

// Bugs fixed in the older games (Oct 2026): each of these used to be broken on iPad.

test('Crossword Mini can be typed into with the on-screen keyboard', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, '/');
  await enterName(page, 'Mia');
  await openTile(page, 'Crossword Mini');
  await page.getByRole('button', { name: '▶ Play' }).click();
  const first = page.locator('[aria-label^="Row "]').first();
  await first.click();
  await page.getByRole('group', { name: 'Keyboard' }).getByRole('button', { name: 'S', exact: true }).click();
  await expect(page.locator('[aria-label^="Row "][aria-label$=", S"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('Rush Runner shows JUMP and DUCK buttons on iPad', async ({ page }) => {
  await openApp(page, '/');
  await enterName(page, 'Mia');
  await openTile(page, 'Rush Runner');
  await page.getByRole('button', { name: /^▶/ }).click();
  await expect(page.getByRole('button', { name: /JUMP/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /DUCK/ })).toBeVisible();
  const box = (await page.getByRole('button', { name: /JUMP/ }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(64);
});

test('Rocket Launch always ends, even after missing every shot, and pays out', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, '/?debug&seed=3');
  await enterName(page, 'Mia');
  const coins = (await readSave(page))?.state.userCurrency ?? 0;
  await openTile(page, 'Rocket Launch');
  await page.getByRole('button', { name: '🚀 Launch!' }).click();
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __game?: unknown }).__game)).toBe(true);
  // Aim straight down into the ground every time: every shot misses.
  test.setTimeout(150_000);
  for (let i = 0; i < 300; i++) {
    const phase = await page.evaluate(() => (window as unknown as { __game: { state: { phase: string } } }).__game.state.phase);
    if (phase === 'done') break;
    if (phase === 'aim') await page.evaluate(() => { const g = (window as unknown as { __game: { aim: (a: number, p: number) => void; launch: () => void } }).__game; g.aim(5, 10); g.launch(); });
    await page.waitForTimeout(250);
  }
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Pick another game' }).click();
  expect((await readSave(page))?.state.userCurrency ?? 0).toBeGreaterThan(coins);
  expect(errors).toEqual([]);
});

test('Trophy Room lists every game badge', async ({ page }) => {
  await openApp(page, '/');
  await enterName(page, 'Mia');
  await openTile(page, 'Trophy Room');
  await expect(page.getByRole('tab', { name: /Badges/ })).toBeVisible();
  await expect(page.getByText(/\d+\s*\/\s*\d{2,}/).first()).toBeVisible();
  await expect(page.getByText('Arena Winner')).toBeVisible();
  await page.getByRole('tab', { name: /Streak/ }).click();
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible();
});
