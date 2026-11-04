import { test, expect } from '@playwright/test';
import { openApp, enterName, grid, openTile, watchErrors, readSave } from './helpers';

// 🏗️ Stack Lab: the round is driven through ?debug's window.__stack (hold the clock, step ticks,
// drop at a chosen x), with one real tap and one real Turn press.

interface StackHook {
  hold: (on?: boolean) => void;
  step: (n?: number) => void;
  dropAt: (x: number) => void;
  bestCm: () => number;
  world: { dropped: number; hearts: number; hanging: { angle: number } | null; status: string };
}
declare global { interface Window { __stack?: StackHook } }

test('Stack Lab: tap to drop, Turn, a still tower scores, and three tumbles end the round with stars', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, '/?debug&seed=7&nosw');
  await enterName(page, 'Mia');
  await openTile(page, /^Stack Lab$/);
  await page.getByRole('button', { name: '▶ Start building' }).click();
  await expect.poll(() => page.evaluate(() => !!window.__stack?.world)).toBe(true);
  await page.evaluate(() => window.__stack!.hold(true));

  // Turn spins the hanging piece; a tap on the play area drops it.
  await page.getByRole('button', { name: 'Turn the piece' }).click();
  expect(await page.evaluate(() => window.__stack!.world.hanging!.angle)).toBeCloseTo(Math.PI / 2);
  await page.getByTestId('stack-area').click({ position: { x: 200, y: 400 } });
  expect(await page.evaluate(() => window.__stack!.world.dropped)).toBe(1);

  // Build: let it land, then two more pieces in the middle. Height only counts when it's still.
  await page.evaluate(() => { const s = window.__stack!; s.step(240); s.dropAt(0); s.step(240); s.dropAt(0); s.step(300); });
  const best = await page.evaluate(() => window.__stack!.bestCm());
  expect(best).toBeGreaterThanOrEqual(15);
  await expect(page.getByTestId('stack-best')).toHaveText(`📏 ${best} cm`);

  // Three pieces dropped well past the table, far apart: three tumbles, the round ends.
  await page.evaluate(() => {
    const s = window.__stack!;
    for (let i = 0; i < 3; i++) { s.step(200); s.dropAt(250); s.step(200); }
  });
  await expect(page.getByRole('heading', { name: /New best!|The tower tumbled!/ })).toBeVisible();
  await expect(page.getByTestId('round-stars')).toBeVisible();
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
  await expect(page.getByText(`${best} cm`).first()).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.state.highScores?.stack_lab).toBe(best);

  await page.getByRole('button', { name: 'Pick another game' }).click();
  await expect(grid(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Stack Lab pauses when the app is hidden', async ({ page }) => {
  await openApp(page, '/?nosw');
  await enterName(page, 'Mia');
  await openTile(page, /^Stack Lab$/);
  await page.getByRole('button', { name: '▶ Start building' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: '▶ Keep playing' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});
