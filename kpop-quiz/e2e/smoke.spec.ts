import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openApp, watchErrors, enterName, grid } from './helpers';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, innerWidth: window.innerWidth };
  });
}

/**
 * Some screens open with a full-screen intro card (e.g. the teacher's Pact) covering Back.
 * If the click is blocked, tap the overlay's own button to dismiss it and try again.
 */
async function clickPastIntroOverlays(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await target.click({ timeout: 2_000 });
      return;
    } catch {
      const overlayButton = page.locator('div.fixed.inset-0 button:visible').last();
      if (await overlayButton.count()) await overlayButton.click({ timeout: 2_000 }).catch(() => {});
    }
  }
  await target.click();
}

test('every game tile opens cleanly and Back returns to the grid', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  // Teacher tiles only show in Jarvis mode, so turn it on to cover them too.
  await openApp(page, '/', { seed: { jarvis_mode: '1' } });
  await enterName(page, 'Smoke');

  const titles = (await page.locator('section button h3').allTextContents()).map(t => t.trim());
  expect(titles.length).toBeGreaterThan(30);
  expect(titles).toContain("Mr. Jarvis's Lounge");

  const wentElsewhere: string[] = [];

  for (const title of titles) {
    await test.step(title, async () => {
      errors.length = 0;
      const tile = page.locator('section button').filter({ has: page.locator('h3', { hasText: new RegExp(`^${escape(title)}$`) }) }).first();
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      await expect(grid(page)).toBeHidden();

      const back = page.getByRole('button', { name: /←|Back/ }).first();
      await expect(back, `${title}: Back button`).toBeVisible();

      const { scrollWidth, innerWidth } = await horizontalOverflow(page);
      expect.soft(scrollWidth, `${title}: no horizontal overflow`).toBeLessThanOrEqual(innerWidth + 2);

      await clickPastIntroOverlays(page, back);
      try {
        await expect(grid(page)).toBeVisible({ timeout: 5_000 });
      } catch {
        // Back went somewhere other than the grid — record it and get home the long way.
        wentElsewhere.push(title);
        await page.reload();
        await enterName(page, 'Smoke');
      }
      expect.soft(errors, `${title}: no page or console errors`).toEqual([]);
    });
  }

  if (wentElsewhere.length) {
    test.info().annotations.push({ type: 'back-not-to-grid', description: wentElsewhere.join(', ') });
  }
  expect.soft(wentElsewhere, 'screens whose Back did not return to the grid').toEqual([]);
});
