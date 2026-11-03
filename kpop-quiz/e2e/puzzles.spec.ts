import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, enterName, grid, openTile, watchErrors, readSave } from './helpers';

// New puzzles (Picture Puzzles, Bridges, Light Up, Untangle), Beat Maker's melody grid and
// Rush Runner's Dino Valley. Puzzles are finished through their ?debug hook (window.__puzzle).

declare global {
  interface Window { __puzzle?: { solve: () => void } }
}

const PUZZLES = [
  { title: 'Picture Puzzles', id: 'picture_puzzle' },
  { title: 'Bridges', id: 'bridges' },
  { title: 'Light Up', id: 'light_up' },
  { title: 'Untangle', id: 'untangle' },
];

async function start(page: Page) {
  await page.getByRole('button', { name: /^▶/ }).first().click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
}

for (const p of PUZZLES) {
  test(`${p.title}: a solved puzzle pays out with stars`, async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page, '/?debug&nosw');
    await enterName(page, 'Mia');
    await openTile(page, new RegExp(`^${p.title}$`));
    await start(page);
    await expect.poll(() => page.evaluate(() => typeof window.__puzzle?.solve)).toBe('function');
    await page.evaluate(() => window.__puzzle!.solve());
    await expect(page.getByTestId('round-stars')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
    // The score went through finishRound: a best score and a first-solve badge.
    await expect.poll(async () => (await readSave(page))?.state.highScores?.[p.id] ?? 0).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pick another game' }).click();
    await expect(grid(page)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('Beat Maker: a tune on the melody grid is saved with the beat', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, '/?nosw');
  await enterName(page, 'Mia');
  await openTile(page, /^Beat Maker$/);
  const melody = page.getByRole('group', { name: 'Melody' });
  // Pop Beat starts with a tune: high Do on step 1.
  await expect(melody.getByRole('button', { name: 'Do high step 1 on', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '🧽 Clear tune' }).click();
  await expect(melody.locator('[aria-pressed="true"]')).toHaveCount(0);
  await melody.getByRole('button', { name: 'Re step 4', exact: true }).click();
  await melody.getByRole('button', { name: 'La high step 9', exact: true }).click();
  await page.getByRole('button', { name: '💾 Save this beat' }).click();
  await expect(page.getByText(/^Saved as /)).toBeVisible();

  await page.reload();
  await enterName(page, 'Mia');
  await openTile(page, /^Beat Maker$/);
  await page.getByRole('button', { name: '🧽 Clear tune' }).click();
  await page.getByRole('button', { name: '▶ Load' }).first().click();
  const pressed = await melody.locator('[aria-pressed="true"]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  expect(pressed.sort()).toEqual(['La high step 9 on', 'Re step 4 on']);
  expect(errors).toEqual([]);
});

test('Rush Runner: Dino Valley stays picked and runs', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, '/?nosw');
  await enterName(page, 'Mia');
  await openTile(page, /^Rush Runner$/);
  await page.getByRole('button', { name: '🦖 Dino Valley' }).click();
  await expect(page.getByText('JUMP over 🪨 and 🪵', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Runner 🦖' }).click();
  expect(await page.evaluate(() => localStorage.getItem('rush_world'))).toBe('valley');

  await page.reload();
  await enterName(page, 'Mia');
  await openTile(page, /^Rush Runner$/);
  await expect(page.getByRole('button', { name: '🦖 Dino Valley' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '▶ Start running!' }).click();
  await expect(page.getByRole('button', { name: /JUMP/ })).toBeEnabled();
  await page.getByRole('button', { name: /JUMP/ }).click();
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});
