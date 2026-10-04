import { test, expect } from '@playwright/test';
import { openApp, readSave, enterName, SAVE_KEY } from './helpers';

test('an old version-1 save is migrated and keeps progress', async ({ page }) => {
  const v1 = {
    version: 1,
    state: { userName: 'Mia', xp: 777, userCurrency: 42, highScores: { paper_clash: 123 }, inventory: ['rare_star'] },
  };
  await openApp(page, '/', { seed: { [SAVE_KEY]: JSON.stringify(v1) } });

  // The name comes back on the Welcome screen.
  await expect(page.locator('#player-name')).toHaveValue('Mia');

  // Zustand writes the migrated state back after hydration.
  await expect.poll(async () => (await readSave(page))?.version ?? 0).toBeGreaterThanOrEqual(3);
  await page.reload();
  await expect(page.locator('#player-name')).toHaveValue('Mia');

  const save = (await readSave(page))!;
  expect(save.version).toBeGreaterThanOrEqual(3);
  expect(save.state.userName).toBe('Mia');
  expect(save.state.xp).toBe(777);
  expect(save.state.userCurrency).toBe(42);
  expect(save.state.highScores).toMatchObject({ paper_clash: 123 });
  expect(save.state.inventory).toContain('rare_star');

  // And the grid shows the kept best score.
  await enterName(page, 'Mia');
  const tile = page.locator('section button').filter({ has: page.locator('h3', { hasText: /^Paper Clash$/ }) });
  await expect(tile).toContainText('Best: 123');
});

test('old scattered localStorage keys are imported once, then removed', async ({ page }) => {
  await openApp(page, '/', { seed: { kpop_xp: '321', ninja_best: '77' } });

  // Legacy keys are deleted as soon as the store hydrates.
  await expect.poll(() => page.evaluate(() => [localStorage.getItem('kpop_xp'), localStorage.getItem('ninja_best')]))
    .toEqual([null, null]);

  // The store only writes on the first change, so enter a name to save.
  await enterName(page, 'Legacy');
  await expect.poll(async () => (await readSave(page))?.state.userName).toBe('Legacy');
  const save = (await readSave(page))!;
  expect(save.state.highScores?.ninja_slice).toBe(77);
  expect(save.state.xp).toBe(321);

  // Still there after a reload, and the legacy keys don't come back.
  await page.reload();
  const again = (await readSave(page))!;
  expect(again.state.highScores?.ninja_slice).toBe(77);
  expect(again.state.xp).toBe(321);
  expect(await page.evaluate(() => localStorage.getItem('kpop_xp'))).toBeNull();
});
