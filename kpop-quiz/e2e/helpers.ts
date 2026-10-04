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
