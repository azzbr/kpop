import { test, expect } from '@playwright/test';
import { openApp, enterName, openTile, readSave, typeOnScreen, watchErrors } from './helpers';
import { dailyAnswer } from '../src/components/games/wordGuessLogic';
import { localDateKey } from '../src/utils/dates';

test('Word Guess: a daily guess survives a reload', async ({ page }) => {
  const errors = watchErrors(page);
  // Any valid word that isn't today's answer (so the game doesn't end on the first guess).
  const today = localDateKey();
  const guess = ['HEART', 'PLANT', 'CRANE'].find(w => w !== dailyAnswer(today))!;

  await openApp(page);
  await enterName(page, 'Wordy');
  await openTile(page, /^Word Guess$/);
  await page.getByRole('button', { name: /📅 Daily/ }).click();
  await page.getByRole('button', { name: '▶ Play' }).click();

  await typeOnScreen(page, guess);
  await page.locator('button[aria-label="Enter"]').click();
  await expect.poll(async () => (await readSave(page))?.state.wordGuess?.daily?.guesses).toEqual([guess]);

  await page.reload();
  await enterName(page, 'Wordy');
  await openTile(page, /^Word Guess$/);
  await expect(page.getByRole('button', { name: /In progress · 1\/6/ })).toBeVisible();
  await page.getByRole('button', { name: '▶ Keep going' }).click();

  const save = (await readSave(page))!;
  expect(save.state.wordGuess?.daily?.guesses).toHaveLength(1);
  expect(save.state.wordGuess?.daily?.date).toBe(today);

  // The first board row shows the restored letters, in order.
  const firstRow = page.locator('div.flex.gap-1\\.5.justify-center').first();
  await expect(firstRow).toHaveText(guess.split('').join(''), { ignoreCase: true });
  expect(errors).toEqual([]);
});
