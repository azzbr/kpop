import { test, expect } from '@playwright/test';
import { openApp, enterName, openTile, watchErrors } from './helpers';

type Dir = 0 | 1 | 2 | 3; // up, right, down, left

// Talks to the ?debug hook that PaperClash.tsx puts on window.__game.
interface GameHook {
  start: () => void;
  hold: (on?: boolean) => void;
  step: (n?: number) => void;
  steer: (d: Dir) => void;
  percent: () => number;
  status: string;
  world: { players: { alive: boolean; dir: Dir; x: number; y: number; deathCause?: string }[] } | null;
}
declare global {
  interface Window { __game?: GameHook }
}

test('Paper Clash: claim land with a loop, then crash into your own trail', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, '/?debug&seed=42');
  await enterName(page, 'Clash');
  await openTile(page, /^Paper Clash$/);
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect.poll(() => page.evaluate(() => !!window.__game)).toBe(true);

  // Restart from the seed and stop the real-time loop so the test drives every tick.
  const start = await page.evaluate(() => {
    const g = window.__game!;
    g.start();
    g.hold(true);
    const me = g.world!.players[0];
    return { pct: g.percent(), dir: me.dir, status: g.status };
  });
  await expect.poll(() => page.evaluate(() => window.__game!.status)).toBe('playing');

  // A 6×6 square: the starting direction, then three clockwise turns, back home to claim it.
  const afterLoop = await page.evaluate((d0: number) => {
    const g = window.__game!;
    for (let leg = 0; leg < 4; leg++) {
      g.steer(((d0 + leg) % 4) as Dir);
      for (let i = 0; i < 6; i++) g.step();
    }
    const me = g.world!.players[0];
    return { pct: g.percent(), alive: me.alive, status: g.status, dir: me.dir };
  }, start.dir);
  expect(afterLoop.alive).toBe(true);
  expect(afterLoop.status).toBe('playing');
  expect(afterLoop.pct).toBeGreaterThan(start.pct);

  // Head away from the new land, leave a trail, then curl back into it.
  await page.evaluate((d: number) => {
    const g = window.__game!;
    const away = d as Dir; // still facing the last leg's direction, which points away from the square
    g.steer(away);
    for (let i = 0; i < 5; i++) g.step();
    for (let turn = 1; turn <= 3; turn++) {
      g.steer(((away + turn) % 4) as Dir);
      g.step();
    }
  }, afterLoop.dir);

  await expect.poll(() => page.evaluate(() => window.__game!.status)).toBe('over');
  const cause = await page.evaluate(() => window.__game!.world!.players[0].deathCause);
  expect(cause).toBe('own_trail');
  await expect(page.getByText('You crossed your own trail!')).toBeVisible();
  expect(errors).toEqual([]);
});
