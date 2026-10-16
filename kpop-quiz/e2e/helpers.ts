import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const SAVE_KEY = 'funquest-save';

/**
 * Opens the app with a clean localStorage (plus optional seeded keys). The reset runs before any
 * app script, only on the tab's first load — later reloads keep what the app saved.
 * Pass `clear: false` for extra pages in the same browser context (they share localStorage).
 */
export async function openApp(page: Page, path = '/', opts: { seed?: Record<string, string>; clear?: boolean } = {}) {
  const { seed = {}, clear = true } = opts;
  await page.addInitScript(({ seed, clear }) => {
    try {
      if (sessionStorage.getItem('__e2e_init')) return;
      sessionStorage.setItem('__e2e_init', '1');
      if (clear) localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    } catch { /* storage blocked */ }
  }, { seed, clear });
  await page.goto(path);
}

/** Collects uncaught page errors and console errors, ignoring offline noise (fonts, certs, network). */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  const ignore = /font|fonts\.(googleapis|gstatic)|CERT|net::ERR|Failed to load resource|ERR_INTERNET|ERR_NAME|ERR_PROXY|ERR_TUNNEL|supabase|websocket/i;
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const url = m.location()?.url ?? '';
    if (ignore.test(text) || ignore.test(url)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

export const grid = (page: Page) => page.getByText('Pick a game.');

/** Types a name on the Welcome screen and goes to the game grid. */
export async function enterName(page: Page, name = 'Tester') {
  const input = page.locator('#player-name');
  await expect(input).toBeVisible();
  await input.fill(name);
  await page.locator('button[type="submit"]').click();
  await expect(grid(page)).toBeVisible();
}

/** Clicks a game tile on the grid by its title. */
export async function openTile(page: Page, title: string | RegExp) {
  const tile = page.locator('section button').filter({ has: page.locator('h3', { hasText: title }) }).first();
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
}

export interface SaveState {
  userName?: string;
  xp?: number;
  userCurrency?: number;
  highScores?: Record<string, number>;
  inventory?: string[];
  wordGuess?: { daily: { date: string; guesses: string[]; done: boolean } | null };
  [key: string]: unknown;
}

/** Parsed persisted store state (`funquest-save`), or null. */
export async function readSave(page: Page): Promise<{ version: number; state: SaveState } | null> {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, SAVE_KEY);
}

/** Taps the app's on-screen keyboard keys for a word (letters, digits, spaces). */
export async function typeOnScreen(page: Page, text: string) {
  for (const ch of text.toUpperCase()) {
    const label = ch === ' ' ? 'space' : ch;
    if (!/^[A-Z0-9 ]$/.test(ch)) continue;
    await page.locator(`button[aria-label="${label}"]`).first().click();
  }
}

/** Friends Arena: creates a room (as the name entered on the Welcome screen) and returns its code. */
export async function arenaCreate(page: Page): Promise<string> {
  await page.getByRole('button', { name: /Create a Room/ }).click();
  const codeEl = page.locator('.tracking-\\[0\\.35em\\]');
  await expect(codeEl).toHaveText(/^[A-Z]{4}$/, { timeout: 15_000 });
  return (await codeEl.innerText()).trim();
}

/** Friends Arena: joins a room by typing its code on the on-screen keyboard. */
export async function arenaJoin(page: Page, code: string) {
  await page.getByRole('button', { name: /Join with a code/ }).click();
  await typeOnScreen(page, code);
  await page.locator('button[aria-label="Enter"]').click();
  await expect(page.locator('.tracking-\\[0\\.35em\\]')).toHaveText(code, { timeout: 15_000 });
}

export const TEACHER_PIN = '1234';
/** A save with a teacher set up (Grown-ups corner → Teacher setup), PIN TEACHER_PIN. */
export async function teacherSeed(name = 'Ms Patel'): Promise<Record<string, string>> {
  const { hashPin } = await import('../src/utils/pin');
  return { [SAVE_KEY]: JSON.stringify({ state: { teacher: { name, pinHash: await hashPin(TEACHER_PIN) } }, version: 5 }) };
}

/** On the game grid: 🍎 Teacher → PIN → teacher mode on (skips the splash). */
export async function teacherOn(page: Page) {
  await page.getByRole('button', { name: '🍎 Teacher' }).click();
  for (const d of TEACHER_PIN) await page.getByRole('button', { name: `Digit ${d}` }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('dialog', { name: 'Teacher mode' }).click();
  await expect(page.getByRole('button', { name: '🍎 End lesson' })).toBeVisible();
}
