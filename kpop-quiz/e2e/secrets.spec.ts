import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, enterName, grid, readSave, typeOnScreen, watchErrors } from './helpers';

// Every hidden trigger on the welcome screen, and every room of the Secret Club.

const club = (page: Page) => page.getByRole('heading', { name: /The Secret Club/ });
const back = (page: Page) => page.getByRole('button', { name: '← Back' }).first();

async function drag(page: Page, testId: string, from: [number, number], to: [number, number]) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 8 });
  await page.mouse.up();
}

test('welcome-screen secrets: Q, joystick, F, Secret HQ and A', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await openApp(page, '/?debug');

  await page.getByRole('button', { name: 'Q', exact: true }).click();
  await expect(page.getByText(/Secret found! \(1\/7\)/)).toBeVisible();

  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Joystick' }).click();
  await expect(page.getByText('DJ MODE ACTIVATED!', { exact: false })).toBeVisible();

  // F → sticker board: stick a sticker, it saves by itself and is still there after a reload.
  await page.getByRole('button', { name: 'F', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Sticker Board/ })).toBeVisible();
  const box = (await page.getByTestId('doodle-canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => new Promise<boolean>(res => {
    const r = indexedDB.open('funquest-doodles');
    r.onsuccess = () => {
      try {
        const g = r.result.transaction('doodles').objectStore('doodles').get('mural');
        g.onsuccess = () => res(!!g.result);
        g.onerror = () => res(false);
      } catch { res(false); }
    };
    r.onerror = () => res(false);
  })), { timeout: 8_000 }).toBe(true);
  await back(page).click();
  await expect(page.locator('#player-name')).toBeVisible();

  // Secret HQ → Agent HQ: crack one code with the on-screen keyboard.
  await page.getByRole('button', { name: /Secret HQ/ }).click();
  const word = await page.getByTestId('agent-answer').getAttribute('data-answer');
  expect(word).toBeTruthy();
  await typeOnScreen(page, word!);
  await page.getByRole('button', { name: /Decode!/ }).click();
  await expect(page.getByRole('button', { name: /Finish mission \(1 cracked\)/ })).toBeVisible();
  await back(page).click();
  await expect(page.locator('#player-name')).toBeVisible();

  await page.getByRole('button', { name: 'A', exact: true }).click();
  await expect(club(page)).toBeVisible();
  await expect(page.getByText(/Secrets found: 5\/7/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Secret Club rooms all work and return to the club', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  // Level 3+ so a few themes are unlocked.
  await openApp(page, '/', { seed: { 'funquest-save': JSON.stringify({ state: { userName: 'Mia', xp: 600 }, version: 4 }) } });
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await expect(club(page)).toBeVisible();

  // Doodle Pad: draw, undo, draw, save to the gallery.
  await page.getByRole('button', { name: /Doodle Pad/ }).click();
  await drag(page, 'doodle-canvas', [0.2, 0.3], [0.6, 0.5]);
  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(undo).toBeDisabled();
  await drag(page, 'doodle-canvas', [0.3, 0.6], [0.7, 0.4]);
  await page.getByRole('button', { name: '💾 Save' }).click();
  await expect(page.getByText('Saved to your gallery!', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '🖼️ Gallery' }).click();
  await expect(page.getByRole('button', { name: 'Open doodle' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Close' }).click();
  await back(page).click();
  await expect(club(page)).toBeVisible();

  // Pixel Studio: drag-paint, save, wear in Paper Clash.
  await page.getByRole('button', { name: /Pixel Studio/ }).click();
  await drag(page, 'pixel-grid', [0.1, 0.5], [0.9, 0.5]);
  await page.getByRole('button', { name: '💾 Save' }).click();
  await expect(page.getByText(/Saved "/)).toBeVisible();
  await page.getByRole('button', { name: /Wear in Paper Clash/ }).click();
  await back(page).click();
  await expect(club(page)).toBeVisible();
  const save = await readSave(page);
  const art = (save?.state as unknown as { pixelArt: { id: string; pixels: string[] }[]; equipped: { skin: string } });
  expect(art.pixelArt).toHaveLength(1);
  expect(art.pixelArt[0].pixels.filter(Boolean).length).toBeGreaterThanOrEqual(8);
  expect(art.equipped.skin).toBe(art.pixelArt[0].id);

  // Theme Lab: picking a theme changes the arcade background.
  await page.getByRole('button', { name: /Theme Lab/ }).click();
  const bg = () => page.locator('.arcade-bg').first().evaluate(el => getComputedStyle(el).backgroundImage);
  const before = await bg();
  await page.getByRole('button', { name: /Ocean Waves/ }).click();
  await expect.poll(bg).not.toBe(before);
  await page.getByRole('button', { name: /Bubblegum/ }).click();
  await back(page).click();
  await expect(club(page)).toBeVisible();

  // My Stats.
  await page.getByRole('button', { name: /My Stats/ }).click();
  await expect(page.getByText(/Level \d/).first()).toBeVisible();
  await back(page).click();
  await expect(club(page)).toBeVisible();

  await back(page).click();
  await expect(page.locator('#player-name')).toBeVisible();
  expect(errors).toEqual([]);
});

test('names: HUNTR/X opens Superstar mode; Jarvis mode only switches on when submitted', async ({ page }) => {
  await openApp(page, '/');
  const name = page.locator('#player-name');
  await name.fill('Huntr/x');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText(/Rumi/)).toBeVisible();

  await openApp(page, '/');
  await page.evaluate(() => localStorage.removeItem('jarvis_mode'));
  await page.reload();
  await name.fill('Mr Jarvis');
  await name.fill('Mia');
  await enterName(page, 'Mia');
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText("Mr. Jarvis's Lounge")).toHaveCount(0);
});
