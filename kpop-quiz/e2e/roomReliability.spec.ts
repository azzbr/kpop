import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openApp, enterName, openTile, watchErrors } from './helpers';

// Friends Arena must survive real life on iPads: a host whose tab refreshes (or that iPad
// Safari reloads after sleep), a player refreshing, and a host leaving for good.
// Uses `?localroom` (BroadcastChannel between pages of one browser context).

test.setTimeout(150_000);

async function arena(page: Page, name: string, clear: boolean) {
  await openApp(page, '/?localroom', { clear });
  await enterName(page, name);
  await openTile(page, 'Friends Arena');
}

const nextBtn = (p: Page) => p.getByRole('button', { name: /Next ▶/ });

test('rooms survive a host refresh, a player refresh and the host leaving', async ({ context, page: host }) => {
  const errors = watchErrors(host);
  await arena(host, 'Host', true);
  await host.getByRole('button', { name: /Create a Room/ }).click();
  await host.getByPlaceholder('Superstar name...').fill('Host');
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

  // Start a Classic Quiz Party (big-screen host) and answer question 1.
  await host.getByRole('button', { name: /START QUIZ PARTY/ }).click();
  await host.getByRole('button', { name: '▶ Start', exact: false }).click();
  for (const p of players) {
    await expect(p.getByText(/Q 1\//)).toBeVisible({ timeout: 15_000 });
    const tile = p.locator('button.min-h-\\[88px\\]').first();
    if (await tile.isVisible({ timeout: 8_000 }).catch(() => false)) await tile.click();
  }
  await expect(nextBtn(host)).toBeVisible({ timeout: 30_000 });

  // 1) The host refreshes during the reveal → back on the same reveal, still the host.
  await host.reload();
  await expect(nextBtn(host)).toBeVisible({ timeout: 20_000 });
  await nextBtn(host).click();
  for (const p of players) await expect(p.getByText(/Q 2\//)).toBeVisible({ timeout: 20_000 });

  // 2) A player refreshes mid-question → back in the game.
  await players[1].reload();
  await expect(players[1].getByText(/Q 2\/|Answer locked|Correct|Not this time/).first()).toBeVisible({ timeout: 20_000 });

  // 3) The host leaves for good → "reconnecting", then the next player takes over and the
  //    game ends with the standings on every device, then everyone can go back to the lobby.
  await host.close();
  await expect(players[0].getByText(/host is reconnecting/i)).toBeVisible({ timeout: 15_000 });
  await expect(players[0].getByText('Final results')).toBeVisible({ timeout: 45_000 });
  await expect(players[1].getByText('Final results')).toBeVisible({ timeout: 15_000 });
  await players[0].getByRole('button', { name: /Back to lobby/ }).click();
  await expect(players[1].getByText(/Players in the room/)).toBeVisible({ timeout: 15_000 });
  await expect(players[0].getByRole('button', { name: /START/ })).toBeVisible();

  expect(errors).toEqual([]);
});
