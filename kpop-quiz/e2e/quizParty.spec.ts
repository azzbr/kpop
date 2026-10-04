import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { openApp, enterName, openTile, readSave, typeOnScreen, watchErrors } from './helpers';
import { quizSources } from '../src/online/quiz/sources';
import { normaliseAnswer } from '../src/online/quiz/quizLogic';
import type { QuizQuestion } from '../src/data/quiz/types';

// Friends Arena over `?localroom`: a BroadcastChannel between pages of ONE browser context
// stands in for Supabase, so a host and two players can play without the network.

const QUESTIONS = 5;

// Every question the host could pick, by text, so players can answer correctly
// (Gold Quest chests only open after a right answer).
const BANK = new Map<string, QuizQuestion>();
for (const src of quizSources()) for (const q of src.questions()) if (!BANK.has(q.text)) BANK.set(q.text, q);

interface Room { host: Page; players: Page[]; errors: string[][] }

async function joinArena(page: Page, name: string) {
  await enterName(page, name);
  await openTile(page, 'Friends Arena');
  await expect(page.getByText('🌐 Friends Arena')).toBeVisible();
}

async function setUpRoom(context: BrowserContext, hostPage: Page): Promise<Room> {
  const players = [await context.newPage(), await context.newPage()];
  const errors = [hostPage, ...players].map(watchErrors);

  await openApp(hostPage, '/?localroom');
  await joinArena(hostPage, 'Host');
  await hostPage.getByRole('button', { name: /Create a Room/ }).click();
  await hostPage.getByPlaceholder('Superstar name...').fill('Teacher');
  await hostPage.getByRole('button', { name: '👑 Create Room!' }).click();
  const codeEl = hostPage.locator('.tracking-\\[0\\.35em\\]');
  await expect(codeEl).toHaveText(/^[A-Z]{4}$/);
  const code = (await codeEl.innerText()).trim();

  for (const [i, p] of players.entries()) {
    // Same context = shared localStorage, so don't wipe the host's save.
    await openApp(p, '/?localroom', { clear: false });
    await joinArena(p, `Kid${i + 1}`);
    await p.getByRole('button', { name: /Join a Room/ }).click();
    await p.getByPlaceholder('ABCD').fill(code);
    await p.getByPlaceholder('Superstar name...').fill(`Kid${i + 1}`);
    await p.getByRole('button', { name: '🚀 Join Room!' }).click();
    await expect(p.getByText('Waiting for the host to start a game…')).toBeVisible();
  }

  await expect(hostPage.getByText('Players in the room (3)')).toBeVisible();
  await hostPage.getByRole('button', { name: /START QUIZ PARTY/ }).click();
  await expect(hostPage.getByRole('heading', { name: '🎉 Quiz Party' })).toBeVisible();
  return { host: hostPage, players, errors };
}

async function startQuiz(host: Page, mode: RegExp) {
  await host.locator('section').filter({ hasText: 'Game mode' }).getByRole('button', { name: mode }).click();
  await host.getByRole('button', { name: String(QUESTIONS), exact: true }).click();
  // "20" is both a question count and a seconds choice; the 2nd one is "Seconds each".
  // 20 s, not 10: WebKit in CI is slow to tap through a 4-item order question.
  await host.getByRole('button', { name: '20', exact: true }).nth(1).click();
  await host.getByRole('button', { name: /▶ Start \(2 players\)/ }).click();
}

/** Answers the current question on a player's page — correctly when the question is known. */
async function answer(page: Page, n: number) {
  await expect(page.getByText(`Q ${n}/${QUESTIONS}`, { exact: true })).toBeVisible({ timeout: 20_000 });
  const tiles = page.locator('button.min-h-\\[88px\\]');
  const keyboard = page.getByRole('group', { name: 'Keyboard' });
  const lockIn = page.getByRole('button', { name: /Lock it in/ });
  await expect(tiles.first().or(keyboard).or(lockIn)).toBeVisible({ timeout: 20_000 });

  const text = (await page.locator('.bg-white.text-slate-900 h2').innerText()).trim();
  const q = BANK.get(text);

  if (await keyboard.isVisible()) {
    const want = q?.answers?.[0] ? normaliseAnswer(q.answers[0]) : 'abc';
    await typeOnScreen(page, want || 'abc');
    await page.locator('button[aria-label="Enter"]').click();
  } else if (await lockIn.isVisible()) {
    const items = page.locator('.grid.gap-2 > button');
    const labels = await items.evaluateAll(bs => bs.map(b => (b.childNodes[1]?.textContent ?? '').trim()));
    const wanted = [...(q?.options ?? []).filter(l => labels.includes(l)), ...labels];
    // Tap by label (not position) and only items not yet picked, so a re-render can't misdirect a tap.
    for (const label of wanted) {
      const item = items.filter({ hasText: label }).first();
      if (await item.isEnabled().catch(() => false)) await item.click({ timeout: 5_000 }).catch(() => {});
    }
    await lockIn.click();
  } else {
    const labels = (await tiles.locator('span.font-fredoka').allInnerTexts()).map(s => s.trim());
    const right = q && q.correct !== undefined && q.options ? labels.indexOf(q.options[q.correct]) : -1;
    await tiles.nth(right >= 0 ? right : 0).click();
  }
  // The last player's answer triggers the reveal at once, so either screen counts.
  await expect(page.getByText(/Answer locked in!|Correct!|Not this time!|Thanks for voting!/)).toBeVisible();
}

const nextButton = (host: Page) => host.getByRole('button', { name: /Next ▶|🏁 Results/ });

async function playAllQuestions(room: Room, onReveal?: (p: Page) => Promise<void>) {
  for (let n = 1; n <= QUESTIONS; n++) {
    for (const p of room.players) await answer(p, n);
    // Everyone answered, so the host reveals straight away.
    await expect(nextButton(room.host)).toBeVisible({ timeout: 15_000 });
    for (const p of room.players) {
      await expect(p.getByText(/Correct!|Not this time!|Thanks for voting!/)).toBeVisible();
      if (onReveal) await onReveal(p);
    }
    await nextButton(room.host).click();
  }
  for (const p of [room.host, ...room.players]) {
    await expect(p.getByText('🏆 Final results')).toBeVisible({ timeout: 15_000 });
  }
}

/** Saves this page's store (by navigating back to the grid) once the others are closed, then reads coins. */
async function coinsAfterLeaving(room: Room) {
  const [p1, p2] = room.players;
  await room.host.close();
  await p2.close();
  await p1.getByRole('button', { name: '✖ Leave room' }).click();
  await p1.getByRole('button', { name: /← Back/ }).click();
  await expect(p1.getByText('Pick a game.')).toBeVisible();
  return (await readSave(p1))?.state.userCurrency ?? 0;
}

test.describe('Quiz Party (local rooms)', () => {
  test.setTimeout(150_000);

  test('Classic: host + 2 players play 5 questions and get rewards', async ({ context, page }) => {
    const room = await setUpRoom(context, page);
    const coinsBefore = (await readSave(room.players[0]))?.state.userCurrency ?? 0;
    await startQuiz(room.host, /Classic/);
    await playAllQuestions(room);

    await expect(room.players[0].getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
    for (const errs of room.errors) expect(errs).toEqual([]);
    expect(await coinsAfterLeaving(room)).toBeGreaterThan(coinsBefore);
  });

  test('Gold Quest: right answers open chests', async ({ context, page }) => {
    const room = await setUpRoom(context, page);
    await startQuiz(room.host, /Gold Quest/);
    let chestsOpened = 0;
    let targetsPicked = 0;

    await playAllQuestions(room, async p => {
      const chest = p.locator('button[aria-label^="Chest"]');
      if (!(await chest.first().isVisible())) return; // wrong answer (or a poll) — no chest
      await chest.first().click();
      await expect(chest).toHaveCount(0);
      chestsOpened++;
      const who = p.getByText('Who do you pick?');
      if (await who.isVisible()) {
        await who.locator('xpath=following-sibling::div[1]').getByRole('button').first().click();
        await expect(who).toBeHidden();
        targetsPicked++;
      }
    });

    test.info().annotations.push({ type: 'gold-quest', description: `${chestsOpened} chests opened, ${targetsPicked} steal/swap targets picked` });
    expect(chestsOpened).toBeGreaterThan(0);
    for (const errs of room.errors) expect(errs).toEqual([]);
  });
});
