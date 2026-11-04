import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, watchErrors, grid, readSave, openTile, enterName, SAVE_KEY } from './helpers';

// ❄️ Winter Wonderland (1 Dec – 6 Jan) + 🎄 Advent calendar + ❄️ Snow Catch.
// Playwright's clock sets the browser's date, so no debug flag is needed for the event itself.

const at = (day: number, month = 11, year = 2026) => new Date(year, month, day, 17, 0);

/** Opens the app on a given local date with a named player and some coins. */
async function openOn(page: Page, date: Date, path = '/', extra: Record<string, unknown> = {}) {
  await page.clock.install({ time: date });
  const save = { version: 6, state: { userName: 'Mia', userCurrency: 100, ...extra } };
  await openApp(page, path, { seed: { [SAVE_KEY]: JSON.stringify(save) } });
  await enterName(page, 'Mia');
}

const coins = async (page: Page) => (await readSave(page))?.state.userCurrency ?? 0;
const door = (page: Page, d: number) => page.locator(`[data-door="${d}"]`);

async function openCalendar(page: Page) {
  await page.getByTestId('event-banner').getByRole('button', { name: /Advent calendar/ }).click();
  await expect(page.getByRole('heading', { name: /Advent Calendar/ })).toBeVisible();
}

test.describe('Winter Wonderland', () => {
  test('5 December: snowy theme, banner, doors, opening a door pays once and is saved', async ({ page }) => {
    const errors = watchErrors(page);
    const outside: string[] = [];
    page.on('request', r => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('data')) outside.push(r.url()); });
    await openOn(page, at(5));

    await expect(page.locator('html')).toHaveAttribute('data-event', 'winter');
    const banner = page.getByTestId('event-banner');
    await expect(banner).toContainText('Winter Wonderland');
    await expect(banner).toContainText('0/25 found');
    await expect(banner.getByRole('button', { name: /Advent calendar · 5 doors ready/ })).toBeVisible();

    await openCalendar(page);
    await expect(door(page, 5)).toHaveAttribute('data-state', 'today');
    for (const d of [1, 2, 3, 4]) await expect(door(page, d)).toHaveAttribute('data-state', 'missed');
    await expect(door(page, 6)).toHaveAttribute('data-state', 'locked');
    await door(page, 6).click();
    await expect(page.getByRole('status')).toContainText('Door 6 opens on 6 December');

    // Fast taps on today's door: one opening, one payment.
    const before = await coins(page);
    for (let i = 0; i < 5; i++) await door(page, 5).dispatchEvent('click');
    const card = page.getByRole('dialog', { name: 'Advent surprise' });
    await expect(card).toBeVisible();
    await expect(card.getByTestId('advent-coins')).toHaveText('+10 🪙');
    await expect(card.getByTestId('surprise-5')).toContainText('snowflake');
    await card.getByRole('button', { name: /Yay/ }).click();
    await expect(card).toBeHidden();
    await expect(door(page, 5)).toHaveAttribute('data-state', 'opened');
    expect(await coins(page)).toBe(before + 10);

    // A missed door can still be opened.
    await door(page, 2).click();
    await expect(card.getByTestId('surprise-2')).toContainText('penguins');
    await card.getByRole('button', { name: /Yay/ }).click();
    expect(await coins(page)).toBe(before + 20);

    // Opening an opened door again shows the surprise but pays nothing.
    await door(page, 5).click();
    await expect(card.getByTestId('surprise-5')).toBeVisible();
    await expect(card.getByTestId('advent-coins')).toHaveCount(0);
    await card.getByRole('button', { name: /Yay/ }).click();
    expect(await coins(page)).toBe(before + 20);

    // Saved: the receipts are in the save, and the calendar still shows them after leaving and
    // coming back. (No reload here: WebKit's faked clock stops after a reload, which freezes the
    // screen transition. Reloading a save is covered by progress.spec.ts and others.)
    const saved = (await readSave(page))?.state.events as Record<string, string[]>;
    expect(saved['advent-2026']).toEqual(expect.arrayContaining(['door-5', 'door-2']));
    await page.locator('[data-back]').first().click();
    await expect(grid(page)).toBeVisible();
    await openCalendar(page);
    await expect(door(page, 5)).toHaveAttribute('data-state', 'opened');
    await expect(door(page, 2)).toHaveAttribute('data-state', 'opened');
    expect(errors).toEqual([]);
    expect(outside).toEqual([]);
  });

  test('8 December: open all missed doors in one go (one card, Snow Buddy gift)', async ({ page }) => {
    await openOn(page, at(8));
    await openCalendar(page);
    const before = await coins(page);
    await page.getByRole('button', { name: 'Open all missed doors (7)' }).click();
    const card = page.getByRole('dialog', { name: 'Advent surprise' });
    await expect(card).toContainText('7 doors opened!');
    await expect(card.getByTestId('advent-coins')).toHaveText('+70 🪙');
    await expect(card.getByTestId('surprise-6')).toContainText('Snow Buddy');
    await card.getByRole('button', { name: /Yay/ }).click();
    for (const d of [1, 2, 3, 4, 5, 6, 7]) await expect(door(page, d)).toHaveAttribute('data-state', 'opened');
    await expect(door(page, 8)).toHaveAttribute('data-state', 'today');
    await expect(page.getByRole('button', { name: /Open all missed doors/ })).toHaveCount(0);
    const save = await readSave(page);
    expect(save?.state.userCurrency).toBe(before + 70);
    expect(save?.state.inventory).toContain('wi26_av_buddy');
  });

  test('a door challenge: ▶ Play now → Snow Catch → +20 Advent bonus and the winter bonus', async ({ page }) => {
    await openOn(page, at(13), '/?debug&seed=3', { events: { 'advent-2026': ['door-1', 'door-2', 'door-3', 'door-4', 'door-5', 'door-6', 'door-7', 'door-8', 'door-9', 'door-10', 'door-11', 'door-12'] } });
    await openCalendar(page);
    await door(page, 13).click();
    const card = page.getByRole('dialog', { name: 'Advent surprise' });
    await expect(card.getByTestId('surprise-13')).toContainText('Snow Catch');
    await card.getByRole('button', { name: '▶ Play now' }).click();

    await page.getByRole('button', { name: /Let it snow/ }).click();
    await page.waitForFunction(() => (window as unknown as { __snow?: { status: string } }).__snow?.status === 'playing');
    const before = await coins(page);
    await page.evaluate(() => { const s = (window as unknown as { __snow: { hold: (on?: boolean) => void; autoplay: () => void } }).__snow; s.hold(true); s.autoplay(); });
    await expect(page.getByTestId('advent-bonus')).toHaveText(/Advent challenge complete! \+20 🪙/);
    await expect(page.getByTestId('snow-bonus')).toHaveText(/Winter bonus: \+30 🪙/);
    await expect(page.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible();
    const save = await readSave(page);
    expect(save?.state.highScores?.snow_catch).toBeGreaterThanOrEqual(20);
    // Round coins + 20 (challenge) + 30 (winter bonus) + badge coins.
    expect((save?.state.userCurrency ?? 0) - before).toBeGreaterThanOrEqual(50);
    expect((save?.state.events as Record<string, string[]>)['advent-2026']).toContain('challenge-13');

    // A second round: no second challenge payment, no more winter bonus today.
    await page.getByRole('button', { name: /Play again/ }).click();
    await page.waitForFunction(() => (window as unknown as { __snow?: { status: string } }).__snow?.status === 'playing');
    await page.evaluate(() => (window as unknown as { __snow: { autoplay: () => void } }).__snow.autoplay());
    await expect(page.getByTestId('snow-bonus')).toContainText('come back tomorrow');
    await expect(page.getByTestId('advent-bonus')).toHaveCount(0);
  });

  test('24 December: the golden door gives the Winter Star title and starts a snow day', async ({ page }) => {
    await openOn(page, at(24));
    await expect(page.locator('html')).not.toHaveAttribute('data-snowday', /.*/);
    await openCalendar(page);
    await expect(door(page, 24)).toHaveClass(/advent-golden/);
    await door(page, 24).click();
    const card = page.getByRole('dialog', { name: 'Advent surprise' });
    await expect(card.getByTestId('surprise-24')).toContainText('golden door');
    await expect(card.getByTestId('advent-coins')).toHaveText('+50 🪙');
    await card.getByRole('button', { name: /Yay/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-snowday', '');
    expect((await readSave(page))?.state.inventory).toContain('wi26_ti_star');
  });

  test('Locker shows the winter items with their hints; the Winter Quiz opens Quiz Arena', async ({ page }) => {
    await openOn(page, at(5));
    const banner = page.getByTestId('event-banner');
    await banner.getByRole('button', { name: /Winter Wonderland/ }).click();
    await expect(banner).toContainText('Snow falls softly');
    await banner.getByRole('button', { name: /Play the Winter Quiz/ }).click();
    await expect(page.getByRole('button', { name: '❄️ Winter', exact: true })).toHaveClass(/bg-fuchsia-500/);
    await page.locator('[data-back]').first().click();
    await expect(grid(page)).toBeVisible();

    await openTile(page, 'Locker');
    await expect(page.getByText('Snow Pal')).toBeVisible();
    const buddy = page.getByRole('button', { name: /Snow Buddy/ });
    await expect(buddy).toContainText('🎄 Advent door 6');
    await expect(buddy).toContainText('Limited ❄️');
  });

  test('outside the event (20 November) there is no winter theme or calendar', async ({ page }) => {
    await openOn(page, at(20, 10));
    await expect(page.locator('html')).not.toHaveAttribute('data-event', /.*/);
    await expect(page.getByTestId('event-banner')).toHaveCount(0);
  });
});
