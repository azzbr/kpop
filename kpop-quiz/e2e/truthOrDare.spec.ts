import { test, expect } from '@playwright/test';
import { openApp, enterName, openTile, readSave, watchErrors } from './helpers';

// 3 players, 2 laps: the wheel picks fairly, the card belongs to the picked player, nobody goes
// twice in a row, Chicken swaps the card, Draw-it dares open the doodle pad, and the finale pays out.
test('Truth or Dare: 3 players play 2 laps and get rewards', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await openApp(page, '/');
  await enterName(page, 'Mia');
  const coinsBefore = (await readSave(page))?.state.userCurrency ?? 0;
  await openTile(page, 'Truth or Dare');

  for (const n of ['Mia', 'Leo', 'Ava']) await page.getByRole('button', { name: `+ ${n}` }).click();
  // Draw it + Silly at Easy, 2 laps.
  await page.getByRole('button', { name: /Draw it/ }).click();
  await page.getByRole('button', { name: /^2$/ }).click();
  await page.getByRole('button', { name: /Start with 3 players/ }).click();

  const turns: string[] = [];
  let sawDoodle = false;
  let chickened = false;
  for (let t = 0; t < 6; t++) {
    await page.getByRole('button', { name: '🎡 Spin!' }).click();
    const heading = page.getByTestId('tod-turn');
    await expect(heading).toBeVisible({ timeout: 10_000 });
    const name = (await heading.innerText()).replace(/’s turn!$/, '').trim();
    turns.push(name);
    await page.getByRole('button', { name: t % 2 ? /Truth$/ : /Dare$/ }).first().click();
    const cardEl = page.getByTestId('tod-card');
    await expect(cardEl).toBeVisible();
    await expect(cardEl).toContainText(name);
    if (!chickened) {
      const before = await cardEl.innerText();
      await page.getByRole('button', { name: /Chicken/ }).click();
      await expect(page.getByRole('button', { name: /Chicken.*2 left/ })).toBeVisible();
      await expect(cardEl).not.toHaveText(before);
      chickened = true;
    }
    if (await page.getByTestId('doodle-canvas').isVisible()) {
      sawDoodle = true;
      const box = (await page.getByTestId('doodle-canvas').boundingBox())!;
      await page.mouse.move(box.x + 40, box.y + 40); await page.mouse.down();
      await page.mouse.move(box.x + 140, box.y + 90, { steps: 6 }); await page.mouse.up();
    }
    const partnerHeading = page.getByText('👯 Pick a partner:');
    if (await partnerHeading.isVisible()) await page.getByRole('button', { name: /^Partner / }).first().click();
    await page.getByRole('button', { name: '✅ Did it!' }).click();
  }

  // Each lap had all 3 players, and no player went twice in a row.
  expect(new Set(turns.slice(0, 3)).size).toBe(3);
  expect(new Set(turns.slice(3, 6)).size).toBe(3);
  for (let i = 1; i < turns.length; i++) expect(turns[i]).not.toBe(turns[i - 1]);
  test.info().annotations.push({ type: 'turns', description: turns.join(' → ') + (sawDoodle ? ' (drew on the pad)' : '') });

  await expect(page.getByText(/wins!|share the win!/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByText('Pick a game.')).toBeVisible();
  expect((await readSave(page))?.state.userCurrency ?? 0).toBeGreaterThan(coinsBefore);
  expect(errors).toEqual([]);
});
