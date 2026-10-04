import { describe, it, expect } from 'vitest';
import {
  SEASON_EVENTS, HUNT_SCREENS, SPOTS_PER_DAY, DAILY_CAP,
  activeEvent, huntScreensFor, huntItemFor, spotFor, itemId, rewardId,
  foundCount, nextReward, pendingRewards, claimRewards, eventLockerItems, isRewardOnly,
} from './events';
import type { SeasonEvent } from './events';
import { localDateKey } from '../utils/dates';
import { halloween as halloweenBank } from '../data/quiz/halloween';
import { HALLOWEEN_LOCKER_ITEMS, PUMPKIN_HUNTER_TITLE_ID } from '../data/halloweenLocker';
import { LOCKER_ITEMS } from '../data/lockerItems';

const NO_URL = '';
const hw = SEASON_EVENTS.find(e => e.id === 'halloween')!;
const winter = SEASON_EVENTS.find(e => e.id === 'winter')!;

describe('event definitions', () => {
  it('have unique keys and ids, valid dates and sorted rewards', () => {
    expect(new Set(SEASON_EVENTS.map(e => e.key)).size).toBe(SEASON_EVENTS.length);
    expect(new Set(SEASON_EVENTS.map(e => e.id)).size).toBe(SEASON_EVENTS.length);
    for (const e of SEASON_EVENTS) {
      expect(e.start, e.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.end, e.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.start < e.end, e.key).toBe(true);
      const ats = e.rewards.map(r => r.at);
      expect([...ats].sort((a, b) => a - b), e.key).toEqual(ats);
      expect(ats[ats.length - 1], e.key).toBeLessThanOrEqual(e.totalItems);
    }
  });

  it('events never overlap', () => {
    const sorted = [...SEASON_EVENTS].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].end < sorted[i].start).toBe(true);
  });

  it('Halloween 2026: 31 pumpkins, rewards at 5/10/20/31, the last unlocks the title', () => {
    expect(hw.key).toBe('halloween-2026');
    expect(hw.totalItems).toBe(31);
    expect(hw.rewards.map(r => r.at)).toEqual([5, 10, 20, 31]);
    expect(hw.rewards[3].unlocks).toBe(PUMPKIN_HUNTER_TITLE_ID);
    expect(hw.lockerItemIds).toContain(PUMPKIN_HUNTER_TITLE_ID);
  });

  it('daily cap lets her find all items within the event', () => {
    const days = (Date.parse(hw.end) - Date.parse(hw.start)) / 86_400_000 + 1;
    expect(days * DAILY_CAP).toBeGreaterThanOrEqual(hw.totalItems);
    expect(SPOTS_PER_DAY).toBeGreaterThanOrEqual(DAILY_CAP);
  });
});

describe('activeEvent', () => {
  it('start and end dates are inclusive', () => {
    expect(activeEvent('2026-09-30', NO_URL)).toBeNull();
    expect(activeEvent('2026-10-01', NO_URL)?.key).toBe('halloween-2026');
    expect(activeEvent('2026-10-31', NO_URL)?.key).toBe('halloween-2026');
    expect(activeEvent('2026-11-02', NO_URL)?.key).toBe('halloween-2026');
    expect(activeEvent('2026-11-03', NO_URL)).toBeNull();
  });

  it('winter event spans the new year', () => {
    expect(activeEvent('2026-11-30', NO_URL)).toBeNull();
    expect(activeEvent('2026-12-01', NO_URL)?.key).toBe(winter.key);
    expect(activeEvent('2026-12-31', NO_URL)?.key).toBe(winter.key);
    expect(activeEvent('2027-01-01', NO_URL)?.key).toBe(winter.key);
    expect(activeEvent('2027-01-06', NO_URL)?.key).toBe(winter.key);
    expect(activeEvent('2027-01-07', NO_URL)).toBeNull();
  });

  it('uses local dates (late evening on Nov 2 is still Halloween)', () => {
    const lateEvening = new Date(2026, 10, 2, 23, 30); // local time
    expect(activeEvent(localDateKey(lateEvening), NO_URL)?.id).toBe('halloween');
    expect(activeEvent(localDateKey(new Date(2026, 10, 3, 0, 5)), NO_URL)).toBeNull();
  });

  it('?event= override makes an event active on any date', () => {
    expect(activeEvent('2026-06-15', '?event=halloween')?.id).toBe('halloween');
    expect(activeEvent('2026-06-15', '?debug&event=Winter')?.id).toBe('winter');
    expect(activeEvent('2026-06-15', '?event=winter-2026')?.id).toBe('winter');
    expect(activeEvent('2026-10-10', '?event=winter')?.id).toBe('winter');
    // unknown override falls back to the date
    expect(activeEvent('2026-10-10', '?event=nope')?.id).toBe('halloween');
    expect(activeEvent('2026-06-15', '?event=nope')).toBeNull();
  });
});

describe('hunt placement', () => {
  it('is deterministic per (event, screen, date)', () => {
    expect(huntScreensFor(hw.key, '2026-10-05')).toEqual(huntScreensFor(hw.key, '2026-10-05'));
    expect(spotFor(hw.key, 'game_mode', '2026-10-05')).toEqual(spotFor(hw.key, 'game_mode', '2026-10-05'));
    expect(huntItemFor(hw, 'locker', '2026-10-05', [])).toEqual(huntItemFor(hw, 'locker', '2026-10-05', []));
  });

  it('about 1 in 3 hunt screens get an item each day, and it varies by day', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 31; d++) {
      const date = `2026-10-${String(d).padStart(2, '0')}`;
      const picks = huntScreensFor(hw.key, date);
      expect(picks.length).toBe(SPOTS_PER_DAY);
      expect(new Set(picks).size).toBe(picks.length);
      for (const s of picks) expect(HUNT_SCREENS).toContain(s);
      seen.add(picks.join(','));
      const shown = HUNT_SCREENS.filter(s => huntItemFor(hw, s, date, []) !== null);
      expect(shown.sort()).toEqual([...picks].sort());
    }
    expect(seen.size).toBeGreaterThan(10);
    // every hunt screen gets a turn during the month
    const all = new Set<string>();
    for (let d = 1; d <= 31; d++) huntScreensFor(hw.key, `2026-10-${String(d).padStart(2, '0')}`).forEach(s => all.add(s));
    expect(all.size).toBe(HUNT_SCREENS.length);
  });

  it('never appears on game screens', () => {
    for (const s of ['paper_clash', 'snake_arena', 'ninja_slice', 'quiz_arena', 'online_hub', 'block_blast']) {
      for (let d = 1; d <= 31; d++) expect(huntItemFor(hw, s, `2026-10-${String(d).padStart(2, '0')}`, [])).toBeNull();
    }
  });

  it('spots stay on the left edge (below the header) or the bottom-left', () => {
    for (const s of HUNT_SCREENS) {
      for (let d = 1; d <= 31; d++) {
        const spot = spotFor(hw.key, s, `2026-10-${String(d).padStart(2, '0')}`);
        if (spot.anchor === 'left') { expect(spot.pct).toBeGreaterThanOrEqual(30); expect(spot.pct).toBeLessThanOrEqual(70); }
        else { expect(spot.pct).toBeGreaterThanOrEqual(2); expect(spot.pct).toBeLessThanOrEqual(30); }
      }
    }
  });

  it('a found item does not come back, and item ids are screen-date', () => {
    const date = '2026-10-05';
    const screen = huntScreensFor(hw.key, date)[0];
    const item = huntItemFor(hw, screen, date, [])!;
    expect(item.id).toBe(itemId(screen, date));
    expect(item.id).toBe(`${screen}-${date}`);
    expect(huntItemFor(hw, screen, date, [item.id])).toBeNull();
  });

  it('caps new finds at 3 per day', () => {
    const date = '2026-10-07';
    const picks = huntScreensFor(hw.key, date);
    expect(picks.length).toBeGreaterThan(DAILY_CAP);
    const collected: string[] = [];
    for (const s of picks) {
      const it = huntItemFor(hw, s, date, collected);
      if (it) collected.push(it.id);
    }
    expect(collected.length).toBe(DAILY_CAP);
    // a reward receipt or yesterday's finds don't count toward today's cap
    const other = [itemId('locker', '2026-10-06'), rewardId(5)];
    const today = picks.filter(s => huntItemFor(hw, s, date, other) !== null);
    expect(today.length).toBe(picks.length);
    // the next day there are new ones again
    const tomorrow = huntScreensFor(hw.key, '2026-10-08');
    expect(huntItemFor(hw, tomorrow[0], '2026-10-08', collected)).not.toBeNull();
  });

  it('stops once every item is found', () => {
    const all = Array.from({ length: hw.totalItems }, (_, i) => `x-${i}`);
    const date = '2026-10-20';
    for (const s of HUNT_SCREENS) expect(huntItemFor(hw, s, date, all)).toBeNull();
  });
});

describe('rewards', () => {
  const found = (n: number) => Array.from({ length: n }, (_, i) => `screen${i}-2026-10-01`);

  function fakeStore(ev: SeasonEvent, start: string[] = []) {
    const lists: Record<string, string[]> = { [ev.key]: [...start] };
    const state = { coins: 0, unlocked: [] as string[] };
    const deps = {
      collected: () => lists[ev.key] ?? [],
      collect: (k: string, id: string) => {
        const got = lists[k] ?? [];
        if (got.includes(id)) return false;
        lists[k] = [...got, id];
        return true;
      },
      addCoins: (c: number) => { state.coins += c; },
      unlock: (id: string) => { state.unlocked.push(id); },
    };
    return { lists, state, deps };
  }

  it('counts finds but not reward receipts', () => {
    expect(foundCount([...found(4), rewardId(5)])).toBe(4);
    expect(nextReward(hw, found(4))?.at).toBe(5);
    expect(nextReward(hw, found(7))?.at).toBe(10);
    expect(nextReward(hw, found(31))).toBeNull();
  });

  it('thresholds are granted once', () => {
    const { lists, state, deps } = fakeStore(hw, found(4));
    expect(claimRewards(hw, deps)).toEqual([]);
    lists[hw.key].push('locker-2026-10-02'); // 5th pumpkin
    expect(claimRewards(hw, deps).map(r => r.at)).toEqual([5]);
    expect(state.coins).toBe(25);
    expect(claimRewards(hw, deps)).toEqual([]);
    expect(state.coins).toBe(25);
    expect(lists[hw.key]).toContain(rewardId(5));
    expect(pendingRewards(hw, lists[hw.key])).toEqual([]);
  });

  it('catches up on several thresholds at once and unlocks the title only at 31', () => {
    const { state, deps } = fakeStore(hw, found(20));
    expect(claimRewards(hw, deps).map(r => r.at)).toEqual([5, 10, 20]);
    expect(state.coins).toBe(25 + 50 + 100);
    expect(state.unlocked).toEqual([]);

    const done = fakeStore(hw, found(31));
    expect(claimRewards(hw, done.deps).map(r => r.at)).toEqual([5, 10, 20, 31]);
    expect(done.state.unlocked).toEqual([PUMPKIN_HUNTER_TITLE_ID]);
    claimRewards(hw, done.deps);
    expect(done.state.unlocked).toEqual([PUMPKIN_HUNTER_TITLE_ID]);
    expect(done.state.coins).toBe(25 + 50 + 100 + 150);
  });

  it('does not grant when the store says the reward was already claimed', () => {
    const { state, deps } = fakeStore(hw, found(10));
    const granted = claimRewards(hw, { ...deps, collect: () => false });
    expect(granted).toEqual([]);
    expect(state.coins).toBe(0);
  });
});

describe('Halloween Locker items', () => {
  it('have hw26_ ids that do not clash with the main catalogue', () => {
    const main = new Set(LOCKER_ITEMS.map(i => i.id));
    const ids = HALLOWEEN_LOCKER_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of HALLOWEEN_LOCKER_ITEMS) {
      expect(i.id.startsWith('hw26_'), i.id).toBe(true);
      expect(main.has(i.id), i.id).toBe(false);
      expect(i.price, i.id).toBeGreaterThan(0); // price 0 would make it free for everyone forever
    }
  });

  it('the Pumpkin Hunter title is reward-only', () => {
    const t = HALLOWEEN_LOCKER_ITEMS.find(i => i.id === PUMPKIN_HUNTER_TITLE_ID)!;
    expect(t.kind).toBe('title');
    expect(t.value).toBe('Pumpkin Hunter');
    expect(isRewardOnly(t.id)).toBe(true);
    expect(isRewardOnly('hw26_av_ghost')).toBe(false);
  });

  it('show during the event, and afterwards only if owned', () => {
    expect(eventLockerItems('2026-10-10', [], NO_URL).length).toBe(HALLOWEEN_LOCKER_ITEMS.length);
    expect(eventLockerItems('2026-11-20', [], NO_URL)).toEqual([]);
    expect(eventLockerItems('2026-11-20', ['hw26_av_ghost'], NO_URL).map(i => i.id)).toEqual(['hw26_av_ghost']);
  });
});

// Mirrors the rules in src/data/quiz/banks.test.ts for the Halloween bank.
describe('Halloween quiz bank', () => {
  const bank = halloweenBank;

  it('has the right id, title, emoji and at least 30 questions', () => {
    expect(bank.id).toBe('halloween');
    expect(bank.id).toBe(hw.quizBankId);
    expect(bank.title.trim()).not.toBe('');
    expect(bank.emoji.trim()).not.toBe('');
    expect(bank.questions.length).toBeGreaterThanOrEqual(30);
  });

  it('question texts are non-empty, ≤110 chars and unique', () => {
    const seen = new Set<string>();
    for (const q of bank.questions) {
      expect(q.text.trim(), q.text).not.toBe('');
      expect(q.text.length, q.text).toBeLessThanOrEqual(110);
      const key = q.text.trim().toLowerCase();
      expect(seen.has(key), `duplicate: ${q.text}`).toBe(false);
      seen.add(key);
    }
  });

  it('every question is well formed for its type', () => {
    for (const q of bank.questions) {
      const label = `${bank.id}: ${q.text}`;
      switch (q.type) {
        case 'choice': {
          const opts = q.options ?? [];
          expect(opts.length, label).toBe(4);
          expect(new Set(opts.map(o => o.trim().toLowerCase())).size, label).toBe(4);
          for (const o of opts) {
            expect(o.trim(), label).not.toBe('');
            expect(o.length, `${label} -> ${o}`).toBeLessThanOrEqual(28);
          }
          expect(q.correct, label).toBe(0);
          break;
        }
        case 'truefalse':
          expect(q.options, label).toEqual(['True', 'False']);
          expect([0, 1], label).toContain(q.correct);
          break;
        case 'type':
          expect(q.answers?.length ?? 0, label).toBeGreaterThan(0);
          for (const a of q.answers!) expect(a.trim(), label).not.toBe('');
          break;
        case 'order': {
          const items = q.options ?? [];
          expect(items.length, label).toBeGreaterThanOrEqual(3);
          expect(items.length, label).toBeLessThanOrEqual(5);
          expect(new Set(items.map(i => i.trim().toLowerCase())).size, label).toBe(items.length);
          for (const i of items) {
            expect(i.trim(), label).not.toBe('');
            expect(i.length, `${label} -> ${i}`).toBeLessThanOrEqual(28);
          }
          break;
        }
        default:
          throw new Error(`Unexpected question type in ${label}: ${q.type}`);
      }
      if (q.fact !== undefined) expect(q.fact.trim(), label).not.toBe('');
    }
  });

  it('mixes question types and has both true and false answers', () => {
    const types = new Set(bank.questions.map(q => q.type));
    for (const t of ['choice', 'truefalse', 'type', 'order']) expect(types.has(t as never), t).toBe(true);
    const tfs = bank.questions.filter(q => q.type === 'truefalse');
    expect(tfs.some(q => q.correct === 0)).toBe(true);
    expect(tfs.some(q => q.correct === 1)).toBe(true);
  });
});
