import { test, expect } from '@playwright/test';
import { openApp, enterName, openTile, watchErrors } from './helpers';

// Talks to the ?debug hook that PaperClash.tsx puts on window.__game.
interface GameHook {
  start: () => void;
  hold: (on?: boolean) => void;
  step: (n?: number) => void;
  steerAngle?: (rad: number) => void;
  steerDir?: (d: number) => void;
  steer?: (d: number) => void; // Classic squares only
  percent: () => number;
  status: string;
  world: { players: { alive: boolean; heading: number; deathCause?: string }[] } | null;
}
declare global {
  interface Window { __game?: GameHook }
}

async function openGame(page: import('@playwright/test').Page) {
  await openApp(page, '/?debug&seed=42');
  await enterName(page, 'Clash');
  await openTile(page, /^Paper Clash$/);
}

test('Paper Clash: claim land with a loop, then crash into your own trail', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect.poll(() => page.evaluate(() => !!window.__game?.steerAngle)).toBe(true);

  // Restart from the seed and stop the real-time loop so the test drives every tick.
  const start = await page.evaluate(() => {
    const g = window.__game!;
    g.start();
    g.hold(true);
    return { pct: g.percent(), heading: g.world!.players[0].heading };
  });
  await expect.poll(() => page.evaluate(() => window.__game!.status)).toBe('playing');

  // A square loop with smooth corners: straight on, then three quarter turns, back home.
  const afterLoop = await page.evaluate((h0: number) => {
    const g = window.__game!;
    const legs = [18, 16, 17, 20];
    legs.forEach((ticks, leg) => {
      for (let i = 0; i < ticks; i++) { g.steerAngle!(h0 + (leg * Math.PI) / 2); g.step(); }
    });
    const me = g.world!.players[0];
    return { pct: g.percent(), alive: me.alive, status: g.status, heading: me.heading };
  }, start.heading);
  expect(afterLoop.alive).toBe(true);
  expect(afterLoop.status).toBe('playing');
  expect(afterLoop.pct).toBeGreaterThan(start.pct * 1.5);

  // Head straight out of the land, then turn as hard as possible: a full circle runs into the
  // older part of the trail just laid.
  await page.evaluate((h: number) => {
    const g = window.__game!;
    for (let i = 0; i < 30 && g.status === 'playing'; i++) { g.steerAngle!(h); g.step(); }
    for (let i = 0; i < 60 && g.status === 'playing'; i++) { g.steerAngle!(g.world!.players[0].heading + 1); g.step(); }
  }, afterLoop.heading + Math.PI);

  await expect.poll(() => page.evaluate(() => window.__game!.status)).toBe('over');
  const cause = await page.evaluate(() => window.__game!.world!.players[0].deathCause);
  expect(cause).toBe('own_trail');
  await expect(page.getByText('You crossed your own trail!')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Paper Clash: Classic squares can be switched on and off from the start card', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await page.getByRole('button', { name: /Play Classic squares instead/ }).click();
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect.poll(() => page.evaluate(() => !!window.__game?.steer && !window.__game?.steerAngle)).toBe(true);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Quit' }).click();
  await openTile(page, /^Paper Clash$/);
  await page.getByRole('button', { name: /Try the new smooth Paper Clash/ }).click();
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect.poll(() => page.evaluate(() => !!window.__game?.steerAngle)).toBe(true);
  expect(errors).toEqual([]);
});
