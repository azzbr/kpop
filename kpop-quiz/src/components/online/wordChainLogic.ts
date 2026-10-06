// Word Chain rules (pure). Players take turns; each word must start with the last letter of the
// one before and can't be used twice. Running out of time — or a made-up word the others vote
// down — costs a heart. Lose all 3 and you're out; the last player in wins. A safety cap of
// WORD_CAP words keeps a game near 5 minutes (then the players still in are ranked by hearts).
import { CHAIN_WORDS } from '../../online/wordChainWords';

export const HEARTS = 3;
export const TURN_MS = 15_000;
export const VOTE_MS = 8000;
export const WORD_CAP = 40;
export const MIN_LEN = 3;
export const MAX_LEN = 15;

export type WordCheck = 'short' | 'letter' | 'used' | 'ok';

export const cleanWord = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '').slice(0, MAX_LEN);

export const lastLetter = (w: string) => w[w.length - 1] ?? '';

export function checkWord(word: string, prev: string, used: Iterable<string>): WordCheck {
  const w = cleanWord(word);
  if (w.length < MIN_LEN) return 'short';
  if (prev && w[0] !== lastLetter(prev)) return 'letter';
  for (const u of used) if (u === w) return 'used';
  return 'ok';
}

export const inDictionary = (w: string) => CHAIN_WORDS.has(cleanWord(w));

/** The next player still in after `cur` (in seat order), or null if nobody else is. */
export function nextAlive(order: string[], alive: string[], cur: string): string | null {
  const i = order.indexOf(cur);
  for (let k = 1; k <= order.length; k++) {
    const id = order[(i + k + order.length) % order.length];
    if (alive.includes(id) && id !== cur) return id;
  }
  return null;
}

export interface HeartState { hearts: Record<string, number>; alive: string[]; outAt: Record<string, number> }

/** Take a heart; at 0 the player is out (`outAt` = this event's number). */
export function loseHeart<S extends HeartState>(s: S, id: string, eventNo: number): S {
  const h = Math.max(0, (s.hearts[id] ?? 0) - 1);
  const out = h === 0;
  return {
    ...s,
    hearts: { ...s.hearts, [id]: h },
    alive: out ? s.alive.filter(x => x !== id) : s.alive,
    outAt: out ? { ...s.outAt, [id]: eventNo } : s.outAt,
  };
}

/** Knock a player out straight away (they left the room). */
export function knockOut<S extends HeartState>(s: S, id: string, eventNo: number): S {
  if (!s.alive.includes(id)) return s;
  return { ...s, hearts: { ...s.hearts, [id]: 0 }, alive: s.alive.filter(x => x !== id), outAt: { ...s.outAt, [id]: eventNo } };
}

/** A made-up word is accepted when more friends say 👍 than 👎 (no votes = not accepted). */
export const resolveVote = (yes: number, no: number) => yes > no;

/** Group ids into rungs by a value, best (highest) first. */
function rungsBy(ids: string[], val: (id: string) => number): (string | string[])[] {
  const sorted = [...ids].sort((a, b) => val(b) - val(a));
  const out: (string | string[])[] = [];
  let prev: number | null = null;
  for (const id of sorted) {
    const v = val(id);
    if (prev !== null && v === prev) {
      const last = out[out.length - 1];
      out[out.length - 1] = Array.isArray(last) ? [...last, id] : [last, id];
    } else out.push(id);
    prev = v;
  }
  return out;
}

/**
 * Final ranking: players still in first (one survivor alone; after the cap, by hearts with ties
 * sharing a rung), then the others — the later they went out, the higher.
 */
export function chainRanking(s: HeartState, everyone: string[]): (string | string[])[] {
  const alive = everyone.filter(id => s.alive.includes(id));
  const out = everyone.filter(id => !s.alive.includes(id));
  return [...rungsBy(alive, id => s.hearts[id] ?? 0), ...rungsBy(out, id => s.outAt[id] ?? 0)];
}
