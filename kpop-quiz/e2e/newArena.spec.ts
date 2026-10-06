import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, enterName, openTile, watchErrors } from './helpers';

// A new Friends Arena game end to end over ?localroom: host + 2 players play RPS Showdown.
async function arena(page: Page, name: string, clear: boolean) {
  await openApp(page, '/?localroom', { clear });
  await enterName(page, name);
  await openTile(page, 'Friends Arena');
}

test('RPS Showdown: 3 players play 5 rounds, everyone gets a reward', async ({ context, page: host }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(host);
  await arena(host, 'Host', true);
  await host.getByRole('button', { name: /Create a Room/ }).click();
  await host.getByPlaceholder('Superstar name...').fill('Hana');
  await host.getByRole('button', { name: '👑 Create Room!' }).click();
  const codeEl = host.locator('.tracking-\\[0\\.35em\\]');
  await expect(codeEl).toHaveText(/^[A-Z]{4}$/);
  const code = (await codeEl.innerText()).trim();
  const players: Page[] = [];
  for (const name of ['Mia', 'Leo']) {
    const p = await context.newPage();
    watchErrors(p);
    await arena(p, name, false);
    await p.getByRole('button', { name: /Join a Room/ }).click();
    await p.getByPlaceholder('ABCD').fill(code);
    await p.getByPlaceholder('Superstar name...').fill(name);
    await p.getByRole('button', { name: '🚀 Join Room!' }).click();
    players.push(p);
  }
  await expect(host.getByText('Players in the room (3)')).toBeVisible();
  await host.locator('button').filter({ hasText: /Rock Paper Scissors Showdown/ }).first().click();
  await host.getByRole('button', { name: /START/ }).last().click();

  const all = [host, ...players];
  for (let r = 0; r < 5; r++) {
    for (const [i, p] of all.entries()) {
      const b = p.getByRole('button', { name: ['Rock', 'Paper', 'Scissors'][(i * 2 + r) % 3] });
      await expect(b).toBeVisible({ timeout: 20_000 });
      await b.dispatchEvent('pointerdown');
    }
    await expect(host.getByLabel('Counts')).toBeVisible({ timeout: 15_000 });
  }
  for (const p of all) await expect(p.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
