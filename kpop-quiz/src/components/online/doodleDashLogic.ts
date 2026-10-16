// Doodle Dash rules (pure — no React, no canvas).
import { rankByScore } from '../../online/helloGate';
import { DOODLE_CATEGORIES } from '../../online/doodleWords';

export const ROUND_MS = 80_000;
export const PICK_MS = 12_000;
export const REVEAL_MS = 8_000;
/** Ms into the round when one more letter is shown to guessers. */
export const HINT_TIMES = [30_000, 50_000];
export const MAX_GUESS = 24;
export const DRAWER_PER_GUESS = 50;
export const DRAWER_MAX = 250;
export const FIRST_BONUS = 20;

export type Level = 'easy' | 'medium' | 'hard';
export type Difficulty = 'mixed' | Level;

export interface DdConfig { category: string; difficulty: Difficulty; laps: number; board: boolean }

/** Host options from the lobby (strings) → settings, with safe defaults. */
export function parseConfig(config: Record<string, string> = {}): DdConfig {
  const cat = DOODLE_CATEGORIES.some(c => c.category === config.category) ? config.category : 'mixed';
  const d = config.difficulty;
  const difficulty: Difficulty = d === 'easy' || d === 'medium' || d === 'hard' ? d : 'mixed';
  const laps = Math.min(3, Math.max(1, parseInt(config.laps ?? '1', 10) || 1));
  return { category: cat, difficulty, laps, board: config.board === '1' };
}

/** Letters only, lower case: "Ice Cream!" and "icecream" match. */
export const normalizeGuess = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export const isRightGuess = (guess: string, word: string) => {
  const g = normalizeGuess(guess);
  return g.length > 0 && g === normalizeGuess(word);
};

/** Edit distance (insert / delete / swap one letter = 1). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** "So close!": one letter off, or the plural / singular of the word (never the word itself). */
export function isCloseGuess(guess: string, word: string): boolean {
  const g = normalizeGuess(guess), w = normalizeGuess(word);
  if (!g || g === w) return false;
  if (g === `${w}s` || g === `${w}es` || w === `${g}s` || w === `${g}es`) return true;
  if (w.endsWith('y') && g === `${w.slice(0, -1)}ies`) return true;
  return w.length >= 3 && editDistance(g, w) === 1;
}

/** Shows how hard a word is to draw/guess: short words are easy, long or two-word ones hard. */
export function wordLevel(word: string): Level {
  const n = normalizeGuess(word).length;
  return n <= 5 ? 'easy' : n <= 8 ? 'medium' : 'hard';
}

export interface PoolWord { word: string; category: string }

/** The words a game can use: one category, or every category ('mixed'). */
export function wordPool(category: string): PoolWord[] {
  const cats = DOODLE_CATEGORIES.filter(c => category === 'mixed' || c.category === category);
  return (cats.length ? cats : DOODLE_CATEGORIES).flatMap(c => c.words.map(word => ({ word, category: c.category })));
}

const shuffle = <T>(a: T[], rand: () => number): T[] => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Three different words for the drawer to choose from: one easy, one medium, one hard
 * ('mixed'), or three of one level. Words already used this game are avoided while possible.
 */
export function pickChoices(pool: PoolWord[], used: string[], difficulty: Difficulty, rand: () => number = Math.random): PoolWord[] {
  const usedSet = new Set(used);
  const fresh = pool.filter(p => !usedSet.has(p.word));
  const src = shuffle(fresh.length >= 3 ? fresh : pool, rand);
  const want: Level[] = difficulty === 'mixed' ? ['easy', 'medium', 'hard'] : [difficulty, difficulty, difficulty];
  const out: PoolWord[] = [];
  for (const lv of want) {
    const w = src.find(p => wordLevel(p.word) === lv && !out.includes(p));
    if (w) out.push(w);
  }
  // Not enough of a level in this category: top up with the closest other words.
  for (const p of src) {
    if (out.length >= 3) break;
    if (!out.includes(p)) out.push(p);
  }
  const order: Record<Level, number> = { easy: 0, medium: 1, hard: 2 };
  return out.sort((a, b) => order[wordLevel(a.word)] - order[wordLevel(b.word)]);
}

/** Letters a word may give away as hints (never all of it): 2 for most words, 1 for 3-letter words. */
export const maxHints = (word: string) => Math.max(0, Math.min(HINT_TIMES.length, normalizeGuess(word).length - 2));

/** The order letters are revealed in (indices into the word, letters only). */
export function hintOrder(word: string, rand: () => number = Math.random): number[] {
  const idx = [...word].map((ch, i) => (/[a-z]/i.test(ch) ? i : -1)).filter(i => i >= 0);
  return shuffle(idx, rand).slice(0, maxHints(word));
}

/** What guessers see: "_ _ a _ _" as characters, '_' for a hidden letter, ' ' between words. */
export function hintPattern(word: string, shown: number[]): string {
  const s = new Set(shown);
  return [...word].map((ch, i) => (ch === ' ' ? ' ' : s.has(i) ? ch : '_')).join('');
}

/** How many hints are due this far into a round. */
export const hintsDue = (msIntoRound: number) => HINT_TIMES.filter(t => msIntoRound >= t).length;

/** 100 for a right guess, up to 100 more for speed, +20 for the very first. */
export function guessPoints(msLeftInRound: number, order = 1, roundMs = ROUND_MS): number {
  const speed = Math.round((100 * Math.max(0, Math.min(roundMs, msLeftInRound))) / roundMs);
  return 100 + speed + (order === 0 ? FIRST_BONUS : 0);
}

/** The drawer's points for the n-th correct guesser this round (0-based): 50 each, at most 250. */
export const drawerGain = (n: number) => (n < DRAWER_MAX / DRAWER_PER_GUESS ? DRAWER_PER_GUESS : 0);

/** Letter counts per word, so guessers see "_ _ _   _ _ _ _ _" without the word itself. */
export const wordShape = (word: string) => word.trim().split(/\s+/).map(w => w.length);

/** Who draws, in order: everyone once per lap (shuffled each lap), never twice in a row. */
export function drawOrder(ids: string[], laps = 1, rand: () => number = Math.random): string[] {
  const out: string[] = [];
  for (let l = 0; l < laps; l++) {
    const lap = shuffle(ids, rand);
    if (lap.length > 1 && out.length && lap[0] === out[out.length - 1]) [lap[0], lap[1]] = [lap[1], lap[0]];
    out.push(...lap);
  }
  return out;
}

/** Everyone who played, best score first; equal scores share a place. */
export const doodleRanking = (scores: Record<string, number>, ids: string[]) => rankByScore(scores, ids);

/** The round ends early once every guesser (still in the room) has it. */
export const allGuessed = (guesserIds: string[], correct: Record<string, boolean> | string[]) => {
  const has = Array.isArray(correct) ? (id: string) => correct.includes(id) : (id: string) => !!correct[id];
  return guesserIds.length > 0 && guesserIds.every(has);
};
