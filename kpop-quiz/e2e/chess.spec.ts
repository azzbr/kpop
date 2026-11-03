import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Chess } from 'chess.js';
import { openApp, enterName, grid, openTile, watchErrors, readSave } from './helpers';

// ♟️ Chess Academy: the four rooms. Moves are made by tapping squares (data-square) like on the
// iPad; ?debug adds window.__chess (move / solve / load / peek) for set-up positions.

interface ChessHook { room: string; move: (uci: string) => void; solve: () => void; load: (fen: string) => void; peek: () => { fen: string; answer?: string } | null }
declare global { interface Window { __chess?: ChessHook } }

const sq = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);
async function tapMove(page: Page, from: string, to: string) {
  await sq(page, from).click();
  await expect(sq(page, from)).toHaveAttribute('data-selected', 'true');
  await sq(page, to).click();
}

async function openAcademy(page: Page, opts: { debug?: boolean } = {}) {
  await openApp(page, opts.debug === false ? '/?nosw' : '/?debug&nosw');
  await enterName(page, 'Mia');
  await openTile(page, /^Chess Academy$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chess Academy');
}

const room = (page: Page, name: RegExp) => page.getByRole('button', { name });
const hookReady = (page: Page, r: string) => expect.poll(() => page.evaluate(() => window.__chess?.room)).toBe(r);

test('Learn: collect the stars with the rook by tapping, then go on to the next level', async ({ page }) => {
  const errors = watchErrors(page);
  await openAcademy(page, { debug: false });
  await room(page, /Learn/).click();
  await page.getByRole('button', { name: '▶ Play: Straight lines' }).click();
  await expect(sq(page, 'a6')).toHaveAttribute('data-mark', 'star');

  await tapMove(page, 'a1', 'a6');
  await expect(page.getByText('⭐ Got one! Keep going!')).toBeVisible();
  await tapMove(page, 'a6', 'f6');

  // Two moves = the best route, so three stars.
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chess_lessons') ?? '{}'))).toEqual({ rook_1: 3 });
  await expect.poll(async () => (await readSave(page))?.state.highScores?.chess_learn).toBe(300);

  await page.getByRole('button', { name: '▶ Next level' }).click();
  await expect(page.getByText('Round the corners')).toBeVisible();
  // Back leaves the room for the Academy menu, and its Back goes to the grid.
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(room(page, /Puzzle Streak/)).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(grid(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Puzzle Streak: a wrong move gets a kind second try, a solve scores, Finish pays out with stars', async ({ page }) => {
  const errors = watchErrors(page);
  await openAcademy(page);
  await room(page, /Puzzle Streak/).click();
  await page.getByRole('button', { name: '▶ Start the streak' }).click();
  await hookReady(page, 'puzzles');
  await expect.poll(() => page.evaluate(() => !!window.__chess?.peek()?.answer)).toBe(true);

  // A legal move that isn't the answer (and isn't some other checkmate).
  const { fen, answer } = (await page.evaluate(() => window.__chess!.peek()))!;
  const game = new Chess(fen);
  const wrong = game.moves({ verbose: true }).find(m => `${m.from}${m.to}${m.promotion ?? ''}` !== answer && !m.san.includes('#'))!;
  await page.evaluate(uci => window.__chess!.move(uci), `${wrong.from}${wrong.to}${wrong.promotion ?? ''}`);
  await expect(page.getByText('Not quite — have another look! 🤔')).toBeVisible();
  await expect(page.getByText('❤️❤️❤️')).toBeVisible(); // the first miss costs no heart

  // Her first right move by tapping the squares (unless it's a promotion), the rest by the hook.
  if (answer!.length === 4) {
    await tapMove(page, answer!.slice(0, 2), answer!.slice(2, 4));
    await expect.poll(() => page.evaluate(() => window.__chess!.peek()?.fen)).not.toBe(fen);
  }
  await page.evaluate(() => window.__chess!.solve());
  await expect(page.getByText(/^✅ .*\(\+\d+\)$/)).toBeVisible();
  await expect(page.getByText(/✅ 1 · \d+ pts/)).toBeVisible();
  // The next puzzle comes up by itself.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('chess_puzzle_seen') ?? '[]').length)).toBe(2);

  await page.getByRole('button', { name: '🏁 Finish' }).click();
  await expect(page.getByTestId('round-stars')).toBeVisible();
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.state.highScores?.chess_puzzles ?? 0).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('Play a bot: Biscuit answers, a pawn promotes through the picker, and a checkmate wins', async ({ page }) => {
  const errors = watchErrors(page);
  await openAcademy(page);
  await room(page, /Play a bot/).click();
  await page.getByRole('button', { name: /Biscuit/ }).first().click();
  await page.getByRole('button', { name: '▶ Play Biscuit' }).click();
  await hookReady(page, 'bot');

  // A normal move: the bot thinks and replies, then it's her turn again.
  await tapMove(page, 'e2', 'e4');
  await expect(page.getByText('Your move!')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-square][data-piece^="b"]')).toHaveCount(16);

  // Promotion: tap the pawn, the last row, then pick a queen.
  await page.evaluate(() => window.__chess!.load('7k/P7/8/8/8/8/6PP/6K1 w - - 0 1'));
  await tapMove(page, 'a7', 'a8');
  await page.getByRole('dialog', { name: 'Pick your new piece' }).getByRole('button', { name: 'Queen' }).click();
  await expect(sq(page, 'a8')).toHaveAttribute('data-piece', 'wq');
  await expect(page.getByText('Your move!')).toBeVisible({ timeout: 10_000 });

  // A back-rank checkmate.
  await page.evaluate(() => window.__chess!.load('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'));
  await tapMove(page, 'a1', 'a8');
  await expect(page.getByRole('heading', { name: /New best!|You beat Biscuit/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('round-stars')).toBeVisible();
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
  await expect.poll(async () => (await readSave(page))?.state.highScores?.chess_bot).toBe(100);
  await expect(page.getByRole('button', { name: '🔁 Rematch' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Two players: the quickest checkmate, tapped on one board that turns round', async ({ page }) => {
  const errors = watchErrors(page);
  await openAcademy(page, { debug: false });
  await room(page, /Two players/).click();
  await page.getByRole('button', { name: '▶ Start a game' }).click();
  await expect(page.getByText('⚪ White to move')).toBeVisible();
  await tapMove(page, 'f2', 'f3');
  await expect(page.getByText('⚫ Black to move')).toBeVisible();
  await tapMove(page, 'e7', 'e5');
  await tapMove(page, 'g2', 'g4');
  await tapMove(page, 'd8', 'h4');
  await expect(page.getByRole('heading', { name: '⚫ Black wins! 🎉' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('offline: Chess Academy and the bot work with the internet off', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright drives service workers in Chromium only');
  await openApp(page, '/');
  await expect(page.locator('#player-name')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 }).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) for (const req of await (await caches.open(key)).keys()) urls.push(req.url);
    return urls.some(u => /chessBot\.worker-.*\.js$/.test(u)) && urls.some(u => /ChessAcademy-.*\.js$/.test(u));
  }), { timeout: 20_000 }).toBe(true);

  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto('/');
  await enterName(offline, 'Mia');
  await openTile(offline, /^Chess Academy$/);
  await room(offline, /Play a bot/).click();
  await offline.getByRole('button', { name: /^▶ Play/ }).click();
  await tapMove(offline, 'd2', 'd4');
  await expect(offline.getByText('Your move!')).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});
