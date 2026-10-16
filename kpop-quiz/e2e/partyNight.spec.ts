import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { openApp, enterName, openTile, arenaCreate, arenaJoin, typeOnScreen, teacherSeed, teacherOn, watchErrors } from './helpers';

// Friends Arena "Party Night" over ?localroom (BroadcastChannel between pages of one context):
// clubs (ask to join / invite without a code), room lock & remove, and teacher mode.

test.setTimeout(240_000);

const CLUB = 'FOX RAINBOW 27';

async function player(context: BrowserContext, name: string, opts: { first?: boolean; seed?: Record<string, string>; club?: boolean } = {}) {
  const p = opts.first ? context.pages()[0] ?? await context.newPage() : await context.newPage();
  const errors = watchErrors(p);
  await openApp(p, '/?localroom', { clear: !!opts.first, seed: opts.seed });
  await enterName(p, name);
  return { p, errors };
}

async function openArena(p: Page, club = true) {
  await openTile(p, 'Friends Arena');
  await expect(p.getByText('🌐 Friends Arena')).toBeVisible();
  if (club) {
    const join = p.getByRole('button', { name: '🔑 I have a club code' });
    if (await join.isVisible()) {
      await join.click();
      await typeOnScreen(p, CLUB);
      await p.locator('button[aria-label="Enter"]').click();
    }
    await expect(p.getByText(/Online in Rainbow Foxes/)).toBeVisible();
  }
}

test('clubs: see a room, ask to join, invite; locked rooms and removed players stay out', async ({ context }) => {
  const host = await player(context, 'Hana', { first: true });
  await openArena(host.p);
  const code = await arenaCreate(host.p);

  // Leo is in the club: he sees Hana's room and asks to join; Hana lets him in.
  const leo = await player(context, 'Leo');
  await openArena(leo.p);
  await expect(leo.p.getByText("Hana's room")).toBeVisible({ timeout: 15_000 });
  await leo.p.getByRole('button', { name: '🙋 Ask to join' }).first().click();
  await host.p.getByRole('button', { name: '✅ Let in' }).click({ timeout: 15_000 });
  await expect(leo.p.getByText('Players in the room (2)')).toBeVisible({ timeout: 15_000 });

  // Everyone sees the live count.
  await expect(host.p.getByRole('status', { name: 'Players online' })).toContainText('playing now');

  // Hana locks the room: Zoe, typing the code, is turned away kindly…
  await host.p.getByRole('button', { name: /Open — tap to lock/ }).click();
  const zoe = await player(context, 'Zoe');
  await openArena(zoe.p);
  await zoe.p.getByRole('button', { name: /Join with a code/ }).click();
  await typeOnScreen(zoe.p, code);
  await zoe.p.locator('button[aria-label="Enter"]').click();
  await expect(zoe.p.getByRole('alert').getByText(/This room is locked/)).toBeVisible({ timeout: 15_000 });
  await zoe.p.getByRole('button', { name: 'Cancel' }).click();

  // …but an invite from the club gets her in.
  await host.p.getByRole('button', { name: /Zoe/ }).filter({ hasText: 'Invite' }).click({ timeout: 15_000 });
  await zoe.p.getByRole('button', { name: '🚀 Join' }).click({ timeout: 15_000 });
  await expect(zoe.p.getByText('Players in the room (3)')).toBeVisible({ timeout: 15_000 });

  // Hana removes Leo; he gets a kind message and can't come back with the code.
  await host.p.getByRole('button', { name: /Leo/ }).first().click();
  await host.p.getByRole('button', { name: '🚪 Remove from room' }).click();
  await host.p.getByRole('button', { name: 'Tap again to remove' }).click();
  await expect(leo.p.getByText('Time for a new room!')).toBeVisible({ timeout: 15_000 });
  await expect(host.p.getByText('Players in the room (2)')).toBeVisible({ timeout: 15_000 });
  await leo.p.getByRole('button', { name: 'OK' }).click();
  await leo.p.getByRole('button', { name: /Join with a code/ }).click();
  await typeOnScreen(leo.p, code);
  await leo.p.locator('button[aria-label="Enter"]').click();
  await expect(leo.p.getByRole('alert')).toBeVisible({ timeout: 15_000 });

  // Hana passes the crown to Zoe.
  await host.p.getByRole('button', { name: /Zoe/ }).first().click();
  await host.p.getByRole('button', { name: '👑 Make host' }).click();
  await expect(zoe.p.getByText("You're the host now!")).toBeVisible({ timeout: 15_000 });

  for (const x of [host, leo, zoe]) expect(x.errors).toEqual([]);
});

test('teacher mode: the teacher takes host, Eyes on me, teams, a gold star and a 2-game playlist', async ({ context }) => {
  const mia = await player(context, 'Mia', { first: true });
  await openArena(mia.p, false);
  const code = await arenaCreate(mia.p);
  const leo = await player(context, 'Leo');
  await openArena(leo.p, false);
  await arenaJoin(leo.p, code);

  const t = await player(context, 'Teach', { seed: await teacherSeed('Ms Patel') });
  await teacherOn(t.p);
  await openArena(t.p, false);
  await expect(t.p.getByText('Ms Patel').first()).toBeVisible();
  await arenaJoin(t.p, code);
  await expect(t.p.getByLabel('Teacher panel')).toBeVisible({ timeout: 15_000 });
  await expect(mia.p.getByText('Ms Patel is the host now')).toBeVisible({ timeout: 15_000 });

  await t.p.getByRole('button', { name: '👀 Eyes on me' }).click();
  await expect(leo.p.getByRole('alertdialog', { name: 'Eyes on me' })).toBeVisible({ timeout: 10_000 });
  await t.p.getByRole('button', { name: /tap to release/ }).click();
  await expect(leo.p.getByRole('alertdialog', { name: 'Eyes on me' })).toBeHidden({ timeout: 10_000 });

  await t.p.getByRole('button', { name: '2 teams' }).click();
  await expect(mia.p.getByLabel('Class Cup')).toBeVisible({ timeout: 10_000 });

  await t.p.getByRole('button', { name: /Mia/ }).first().click();
  await t.p.getByRole('button', { name: /Gold star/ }).click();
  await expect(mia.p.getByText(/gave you a gold star! \+5/)).toBeVisible({ timeout: 10_000 });

  // Playlist: RPS Showdown twice, the second starts by itself.
  await t.p.locator('button').filter({ hasText: /Rock Paper Scissors Showdown/ }).first().click();
  await t.p.getByRole('button', { name: /➕ Add/ }).click();
  await t.p.getByRole('button', { name: /➕ Add/ }).click();
  await t.p.getByRole('button', { name: '▶ Start playlist' }).click();
  const all = [t.p, mia.p, leo.p];
  for (let game = 0; game < 2; game++) {
    for (let r = 0; r < 5; r++) {
      for (const [i, p] of all.entries()) {
        const b = p.getByRole('button', { name: ['Rock', 'Paper', 'Scissors'][(i + r) % 3], exact: true });
        await expect(b).toBeVisible({ timeout: 30_000 });
        await b.dispatchEvent('pointerdown');
      }
      await expect(t.p.getByLabel('Counts')).toBeVisible({ timeout: 15_000 });
    }
    await expect(mia.p.getByText(/\+\d+ XP · \+\d+ 🪙/)).toBeVisible({ timeout: 20_000 });
    if (game === 0) await expect(mia.p.getByText(/Next up: Rock Paper/)).toBeVisible({ timeout: 10_000 });
  }
  await t.p.getByRole('button', { name: 'Back to Lobby 🏠' }).click();
  await t.p.getByRole('button', { name: '🎓 End lesson' }).click();
  await expect(leo.p.getByRole('dialog', { name: 'Well done, class' })).toBeVisible({ timeout: 10_000 });

  for (const x of [mia, leo, t]) expect(x.errors).toEqual([]);
});
