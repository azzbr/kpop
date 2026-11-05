// 🎄 The Winter Wonderland Advent calendar — pure rules, no React (AdventCalendar.tsx draws it).
// Door d opens on local date 2026-12-d and can still be opened (if missed) until the winter event
// ends on 6 January. Progress lives in store.events[ADVENT_KEY] as receipt ids, like the snowflake
// hunt: 'door-5' (door opened, coins paid), 'challenge-3' (its challenge done), 'snowday-<date>'
// (the golden door 24 was opened that day). Every payout checks for its receipt first, so nothing
// can be paid twice, however fast she taps. Dates are always local (utils/dates localDateKey).
import { ADVENT_DOORS, CHALLENGE_COINS } from '../data/adventDoors';
import type { AdventDoor } from '../data/adventDoors';

export const ADVENT_KEY = 'advent-2026';
export const ADVENT_START = '2026-12-01';
/** Same as the winter event's end (events.ts): missed doors can be opened until then. */
export const ADVENT_END = '2027-01-06';

export const doorDate = (day: number) => `2026-12-${String(day).padStart(2, '0')}`;
export const doorId = (day: number) => `door-${day}`;
export const challengeId = (day: number) => `challenge-${day}`;
export const snowDayId = (dateKey: string) => `snowday-${dateKey}`;
export const doorFor = (day: number): AdventDoor | undefined => ADVENT_DOORS.find(d => d.day === day);

/** Whole days from local date `from` to `to` (YYYY-MM-DD); 0 on the day itself, negative after. */
export function daysUntil(from: string, to: string): number {
  const day = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };
  return Math.round(day(to) - day(from));
}

/** Is the calendar open on this local date? */
export const adventOpen = (today: string) => today >= ADVENT_START && today <= ADVENT_END;

export type DoorState = 'locked' | 'today' | 'missed' | 'opened' | 'closed';

export function doorState(day: number, today: string, collected: readonly string[]): DoorState {
  if (collected.includes(doorId(day))) return 'opened';
  if (today > ADVENT_END) return 'closed';
  const date = doorDate(day);
  if (today < date) return 'locked';
  return today === date ? 'today' : 'missed';
}

/** Doors she can open right now, in day order. */
export const readyDoors = (today: string, collected: readonly string[]) =>
  ADVENT_DOORS.map(d => d.day).filter(day => { const s = doorState(day, today, collected); return s === 'today' || s === 'missed'; });

/** Missed (past, unopened) doors — the "Open all missed doors" button. */
export const missedDoors = (today: string, collected: readonly string[]) =>
  ADVENT_DOORS.map(d => d.day).filter(day => doorState(day, today, collected) === 'missed');

export interface AdventDeps {
  collected: () => readonly string[];
  /** store.collectEventItem — returns false if the id is already there. */
  collect: (eventKey: string, id: string) => boolean;
  addCoins: (coins: number) => void;
  unlock: (lockerItemId: string) => void;
}

/** Opens these doors (only ones that are ready); each pays once. Returns the doors really opened. */
export function openDoors(days: readonly number[], today: string, deps: AdventDeps): AdventDoor[] {
  const opened: AdventDoor[] = [];
  for (const day of days) {
    const st = doorState(day, today, deps.collected());
    const d = doorFor(day);
    if (!d || (st !== 'today' && st !== 'missed')) continue;
    if (!deps.collect(ADVENT_KEY, doorId(day))) continue;
    deps.addCoins(d.coins);
    if (d.surprise.kind === 'item') deps.unlock(d.surprise.itemId);
    if (day === 24) deps.collect(ADVENT_KEY, snowDayId(today));
    opened.push(d);
  }
  return opened;
}

/** Challenges that can still be done: door open, challenge not done yet, calendar still open. */
export function liveChallenges(today: string, collected: readonly string[]): AdventDoor[] {
  if (!adventOpen(today)) return [];
  return ADVENT_DOORS.filter(d => d.surprise.kind === 'challenge' && collected.includes(doorId(d.day)) && !collected.includes(challengeId(d.day)));
}

/**
 * After a round (store.finishRound): completes every live challenge for this game that the score
 * reaches, paying CHALLENGE_COINS each once. Returns the coins paid and the doors completed.
 */
export function checkAdventChallenges(gameId: string, score: number, today: string, deps: AdventDeps): { coins: number; days: number[] } {
  const done: number[] = [];
  for (const d of liveChallenges(today, deps.collected())) {
    const s = d.surprise;
    if (s.kind !== 'challenge' || s.gameId !== gameId || score < s.target) continue;
    if (!deps.collect(ADVENT_KEY, challengeId(d.day))) continue;
    deps.addCoins(CHALLENGE_COINS);
    done.push(d.day);
  }
  return { coins: done.length * CHALLENGE_COINS, days: done };
}

/** The golden door was opened today: a snow day (heavier, sparkly snow on the menus) until midnight. */
export const isSnowDay = (today: string, collected: readonly string[]) => collected.includes(snowDayId(today));
