import { test, expect } from '@playwright/test';
import { openApp, enterName, grid, openTile, readSave, watchErrors, SAVE_KEY } from './helpers';

// Home Screen 2.0: favourites, Jump back in, mastery stars, game of the week, music button, pausing.

const v5 = (state: Record<string, unknown>) => JSON.stringify({ state: { userName: 'Mia', ...state }, version: 5 });
const section = (page: import('@playwright/test').Page, name: string) => page.getByRole('region', { name });

test('a favourite stays at the top after a reload, and can be removed', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, '/?nosw');
  await enterName(page, 'Mia');
  await expect(section(page, 'My favourites')).toHaveCount(0);
  await expect(page.getByText('Tap ☆ on a game to keep it at the top.')).toBeVisible();

  await section(page, '🕹️ Arcade').getByRole('button', { name: 'Add Snake Arena to favourites' }).click();
  await expect(section(page, 'My favourites').locator('h3', { hasText: 'Snake Arena' })).toBeVisible();
  expect((await readSave(page))?.state.favourites).toEqual(['snake_arena']);

  await page.reload();
  await enterName(page, 'Mia');
  const favs = section(page, 'My favourites');
  await expect(favs.locator('h3', { hasText: 'Snake Arena' })).toBeVisible();
  await favs.getByRole('button', { name: 'Remove Snake Arena from favourites' }).click();
  await expect(section(page, 'My favourites')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('games she opens show up in Jump back in, newest first', async ({ page }) => {
  await openApp(page, '/?nosw');
  await enterName(page, 'Mia');
  await expect(section(page, 'Jump back in')).toHaveCount(0);
  for (const title of [/^2048$/, /^Block Blast$/]) {
    await openTile(page, title);
    await page.getByRole('button', { name: '← Back' }).first().click();
    await expect(grid(page)).toBeVisible();
  }
  const titles = await section(page, 'Jump back in').locator('h3').allTextContents();
  expect(titles).toEqual(['Block Blast', '2048']);
  // My Stuff screens are not games, so they stay out.
  await openTile(page, /^Locker$/);
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(section(page, 'Jump back in').locator('h3')).toHaveText(['Block Blast', '2048']);
});

test('best scores from an older save light up mastery stars and the star total', async ({ page }) => {
  await openApp(page, '/?nosw', { seed: { [SAVE_KEY]: v5({ highScores: { game_2048: 6000, paper_clash: 60 } }) } });
  await enterName(page, 'Mia');
  const puzzles = section(page, '🧩 Puzzles & Brain');
  const tile2048 = puzzles.locator('[data-mastered="true"]').filter({ has: page.locator('h3', { hasText: /^2048$/ }) });
  await expect(tile2048).toHaveCount(1);
  const clash = section(page, '🕹️ Arcade').locator('div', { has: page.locator('h3', { hasText: /^Paper Clash$/ }) }).last();
  await expect(clash.getByLabel('1 of 3 stars')).toBeVisible();
  await expect(clash).toContainText('Best: 60');
  await expect(page.getByTestId('today-strip')).toContainText('4 / 87 stars');
  // The save is upgraded to v6 with the new fields.
  await expect.poll(async () => (await readSave(page))?.version).toBe(6);
});

test('the game of the week card opens that game, which shows the 2× XP chip', async ({ page }) => {
  await openApp(page, '/?nosw');
  await enterName(page, 'Mia');
  const card = page.getByTestId('weekly-card');
  await expect(card).toContainText('2× XP and coins until Sunday');
  const title = (await card.locator('span.text-xl').textContent())!.trim();
  await expect(page.locator('[data-mastered], div.relative').filter({ has: page.locator('h3', { hasText: new RegExp(`^${title}$`) }) }).getByText('🌟 2× XP').first()).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
});

test('in a game: the music button moves into the header, and hiding the app pauses the round', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, '/?nosw');
  await enterName(page, 'Mia');
  await expect(page.getByRole('button', { name: /^Music: / })).toBeVisible();
  await openTile(page, /^2048$/);
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  // The floating player button is gone during the game.
  await expect(page.getByRole('button', { name: /^Music: / })).toHaveCount(0);

  // Switching apps pauses the round.
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

  // 🎵 pauses the round and opens the player under the header.
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Minimise player' })).toBeVisible();
  await page.getByRole('button', { name: 'Minimise player' }).click();
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Music: / })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the game-over card shows the stars and how far it is to the next one', async ({ page }) => {
  interface Hook { start: () => void; hold: (on?: boolean) => void; step: () => void; steerAngle: (r: number) => void; status: string; world: { players: { heading: number }[] } }
  await openApp(page, '/?debug&seed=42&nosw');
  await enterName(page, 'Mia');
  await openTile(page, /^Paper Clash$/);
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __game?: Hook }).__game?.steerAngle)).toBe(true);
  // Turn as hard as possible straight away: the snake-like trail crosses itself and the round ends.
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Hook }).__game;
    g.start(); g.hold(true);
    for (let i = 0; i < 30; i++) { g.steerAngle(g.world.players[0].heading + Math.PI); g.step(); }
    for (let i = 0; i < 200 && g.status === 'playing'; i++) { g.steerAngle(g.world.players[0].heading + 1); g.step(); }
  });
  const stars = page.getByTestId('round-stars');
  await expect(stars).toBeVisible({ timeout: 15_000 });
  await expect(stars.getByRole('img')).toHaveAttribute('aria-label', /^[0-3] of 3 stars$/);
  await expect(stars).toContainText(/Next star at|So close|New star/);
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
});
