import { describe, it, expect } from 'vitest';
import {
  ADVENT_KEY, ADVENT_END, doorState, doorDate, doorId, challengeId, readyDoors, missedDoors, openDoors,
  liveChallenges, checkAdventChallenges, isSnowDay, adventOpen,
} from './advent';
import type { AdventDeps } from './advent';
import { ADVENT_DOORS, DOOR_ORDER, DOOR_COINS, GOLDEN_DOOR_COINS, CHALLENGE_COINS } from '../data/adventDoors';
import { WINTER_LOCKER_ITEMS, WINTER_STAR_TITLE_ID } from '../data/winterLocker';
import { MASTERY } from '../data/mastery';
import { localDateKey } from '../utils/dates';
import { SEASON_EVENTS } from './events';

/** A pretend store: the receipts list, coins and inventory. */
function fakeStore(start: string[] = []) {
  const list = [...start];
  const s = { list, coins: 0, items: [] as string[] };
  const deps: AdventDeps = {
    collected: () => list,
    collect: (key, id) => { expect(key).toBe(ADVENT_KEY); if (list.includes(id)) return false; list.push(id); return true; },
    addCoins: c => { s.coins += c; },
    unlock: id => { s.items.push(id); },
  };
  return { s, deps };
}

describe('Advent door states', () => {
  it('locked before its day, today on its day, missed after, closed after the event', () => {
    expect(doorState(5, '2026-12-04', [])).toBe('locked');
    expect(doorState(5, '2026-12-05', [])).toBe('today');
    expect(doorState(5, '2026-12-09', [])).toBe('missed');
    expect(doorState(5, '2027-01-02', [])).toBe('missed'); // across the new year
    expect(doorState(5, ADVENT_END, [])).toBe('missed');
    expect(doorState(5, '2027-01-07', [])).toBe('closed');
    expect(doorState(5, '2026-12-09', [doorId(5)])).toBe('opened');
    expect(doorState(24, '2026-12-01', [])).toBe('locked');
  });

  it('uses the local date: at 23:30 on 5 December it is still door 5 (not 6)', () => {
    const lateEvening = new Date(2026, 11, 5, 23, 30); // local time
    const today = localDateKey(lateEvening);
    expect(today).toBe('2026-12-05');
    expect(doorState(5, today, [])).toBe('today');
    expect(doorState(6, today, [])).toBe('locked');
    expect(localDateKey(new Date(2026, 11, 6, 0, 5))).toBe('2026-12-06');
  });

  it('the calendar is open from 1 December to the end of the winter event', () => {
    const winter = SEASON_EVENTS.find(e => e.id === 'winter')!;
    expect(ADVENT_END).toBe(winter.end);
    expect(adventOpen('2026-11-30')).toBe(false);
    expect(adventOpen('2026-12-01')).toBe(true);
    expect(adventOpen(ADVENT_END)).toBe(true);
    expect(adventOpen('2027-01-07')).toBe(false);
  });

  it('ready and missed doors', () => {
    expect(readyDoors('2026-12-03', [])).toEqual([1, 2, 3]);
    expect(missedDoors('2026-12-03', [])).toEqual([1, 2]);
    expect(readyDoors('2026-12-03', [doorId(1), doorId(3)])).toEqual([2]);
    expect(readyDoors('2026-11-20', [])).toEqual([]);
  });
});

describe('opening doors', () => {
  it('pays each door once, however many times it is tapped, and never a future door', () => {
    const { s, deps } = fakeStore();
    expect(openDoors([5], '2026-12-05', deps).map(d => d.day)).toEqual([5]);
    expect(openDoors([5], '2026-12-05', deps)).toEqual([]);
    expect(openDoors([5, 5, 5], '2026-12-05', deps)).toEqual([]);
    expect(openDoors([6], '2026-12-05', deps)).toEqual([]);
    expect(s.coins).toBe(DOOR_COINS);
    expect(s.list).toEqual([doorId(5)]);
  });

  it('opens all missed doors in one go', () => {
    const { s, deps } = fakeStore();
    const opened = openDoors(missedDoors('2026-12-08', []), '2026-12-08', deps);
    expect(opened.map(d => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.coins).toBe(7 * DOOR_COINS);
    expect(s.items).toEqual([WINTER_LOCKER_ITEMS.find(i => i.name === 'Snow Buddy')!.id]); // door 6's gift
    expect(readyDoors('2026-12-08', s.list)).toEqual([8]);
  });

  it('the golden door 24 pays 50 coins, gives the Winter Star title and makes it a snow day', () => {
    const { s, deps } = fakeStore();
    openDoors([24], '2026-12-24', deps);
    expect(s.coins).toBe(GOLDEN_DOOR_COINS);
    expect(s.items).toEqual([WINTER_STAR_TITLE_ID]);
    expect(isSnowDay('2026-12-24', s.list)).toBe(true);
    expect(isSnowDay('2026-12-25', s.list)).toBe(false);
  });
});

describe('Advent challenges', () => {
  const stackDay = ADVENT_DOORS.find(d => d.surprise.kind === 'challenge' && d.surprise.gameId === 'stack_lab')!.day; // 3

  it('nothing counts before the door is open', () => {
    const { s, deps } = fakeStore();
    expect(checkAdventChallenges('stack_lab', 999, '2026-12-05', deps)).toEqual({ coins: 0, days: [] });
    expect(s.coins).toBe(0);
  });

  it('a qualifying round pays once; a low score or another game does not', () => {
    const { s, deps } = fakeStore([doorId(stackDay)]);
    expect(liveChallenges('2026-12-05', s.list).map(d => d.day)).toEqual([stackDay]);
    expect(checkAdventChallenges('stack_lab', 49, '2026-12-05', deps).coins).toBe(0);
    expect(checkAdventChallenges('robo_quest', 900, '2026-12-05', deps).coins).toBe(0);
    expect(checkAdventChallenges('stack_lab', 50, '2026-12-05', deps)).toEqual({ coins: CHALLENGE_COINS, days: [stackDay] });
    expect(checkAdventChallenges('stack_lab', 80, '2026-12-05', deps).coins).toBe(0);
    expect(s.list).toContain(challengeId(stackDay));
    expect(s.coins).toBe(CHALLENGE_COINS);
  });

  it('two open challenges for the same game can both complete in one big round', () => {
    const { deps } = fakeStore([doorId(3), doorId(19)]); // 50 cm and 100 cm towers
    expect(checkAdventChallenges('stack_lab', 120, '2026-12-20', deps)).toEqual({ coins: 2 * CHALLENGE_COINS, days: [3, 19] });
  });

  it('challenges stop when the event is over', () => {
    const { deps } = fakeStore([doorId(stackDay)]);
    expect(checkAdventChallenges('stack_lab', 999, '2027-01-07', deps).coins).toBe(0);
  });
});

describe('the doors', () => {
  it('24 doors, numbered 1–24, laid out as a mix of all 24', () => {
    expect(ADVENT_DOORS.map(d => d.day)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect([...DOOR_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(DOOR_ORDER.slice(0, 6)).not.toEqual([1, 2, 3, 4, 5, 6]);
    for (const d of ADVENT_DOORS) expect(doorDate(d.day), String(d.day)).toMatch(/^2026-12-\d\d$/);
  });

  it('a fair economy: 23 × 10 + 50 coins for doors, 20 per challenge', () => {
    const total = ADVENT_DOORS.reduce((a, d) => a + d.coins, 0);
    expect(total).toBe(23 * DOOR_COINS + GOLDEN_DOOR_COINS);
    const challenges = ADVENT_DOORS.filter(d => d.surprise.kind === 'challenge').length;
    expect(challenges).toBeGreaterThanOrEqual(5);
    expect(challenges).toBeLessThanOrEqual(8);
  });

  it('gifts are winter Locker items; door 24 is the Winter Star title', () => {
    const ids = new Set(WINTER_LOCKER_ITEMS.map(i => i.id));
    for (const d of ADVENT_DOORS) if (d.surprise.kind === 'item') expect(ids.has(d.surprise.itemId), String(d.day)).toBe(true);
    const last = ADVENT_DOORS[23].surprise;
    expect(last.kind === 'item' && last.itemId).toBe(WINTER_STAR_TITLE_ID);
  });

  it('challenges point at real games with sensible targets', () => {
    for (const d of ADVENT_DOORS) {
      if (d.surprise.kind !== 'challenge') continue;
      const { gameId, target } = d.surprise;
      expect(target, `${d.day}`).toBeGreaterThan(0);
      if (MASTERY[gameId]) expect(target, `${d.day} ${gameId} is above 3★`).toBeLessThanOrEqual(MASTERY[gameId].stars[2]);
    }
  });

  it('texts are short, kind and have no links', () => {
    for (const d of ADVENT_DOORS) {
      const text = JSON.stringify(d.surprise);
      expect(text, String(d.day)).not.toMatch(/https?:|www\./i);
      expect(text.length, String(d.day)).toBeLessThan(260);
    }
  });
});
