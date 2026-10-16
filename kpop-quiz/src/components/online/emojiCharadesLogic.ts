// Emoji Charades rules (pure). A teller "says" a phrase with emoji only; everyone else types
// guesses. Correct guessers score by speed, the teller scores for every friend who got it.
import { levenshtein, matchTyped, normaliseAnswer } from '../../online/quiz/quizLogic';
import { isRude } from '../../online/rudeWords';
import { CHARADE_CATS, CHARADE_PHRASES, EMOJI_GROUPS } from '../../online/charadePhrases';
import type { CharadePhrase } from '../../online/charadePhrases';

export const TURN_MS = 60_000;
export const HINT_WORDS_MS = 20_000;
export const HINT_LETTER_MS = 40_000;
export const REVEAL_MS = 6500;
export const MAX_EMOJI = 8;
export const MAX_GUESS = 24;
export const TELLER_POINTS = 30;

type Rng = () => number;

export const ALL_EMOJI: ReadonlySet<string> = new Set(EMOJI_GROUPS.flatMap(g => g.emoji));

/** A teller's emoji line as sent by a device: only picker emoji, at most MAX_EMOJI. */
export function cleanEmojiList(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > MAX_EMOJI) return null;
  return v.every(e => typeof e === 'string' && ALL_EMOJI.has(e)) ? (v as string[]) : null;
}

export const accepted = (p: CharadePhrase) => [p.text, ...(p.alt ?? [])];

export type GuessResult = 'right' | 'close' | 'part' | 'wrong';
const SMALL = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'and', 'for', 'to', 'at']);

/** right (forgiving typo match), close (a letter or so off), part (a real word of a longer answer), or wrong. */
export function judgeGuess(guess: string, p: CharadePhrase): GuessResult {
  const g = normaliseAnswer(guess);
  if (!g) return 'wrong';
  const all = accepted(p);
  if (matchTyped(g, all)) return 'right';
  const gs = g.replace(/ /g, '');
  for (const raw of all) {
    const want = normaliseAnswer(raw).replace(/ /g, '');
    const allowed = want.length >= 9 ? 3 : want.length >= 5 ? 2 : 1;
    if (levenshtein(gs, want) <= allowed) return 'close';
  }
  const words = new Set(normaliseAnswer(p.text).split(' ').filter(x => x.length >= 3 && !SMALL.has(x)));
  if (words.size >= 2 && g.split(' ').some(x => words.has(x))) return 'part';
  return 'wrong';
}

/** 50–100 points: faster is more. */
export const guessPoints = (msLeft: number, total = TURN_MS) => 50 + Math.round(50 * Math.max(0, Math.min(1, msLeft / total)));

export interface Hint { cat: string; catEmoji: string; words?: number; first?: string }

/** Hint level 0: category; 1: + word count; 2: + first letter. */
export function hintFor(p: CharadePhrase, level: number): Hint {
  const c = CHARADE_CATS[p.cat];
  const h: Hint = { cat: c.name, catEmoji: c.emoji };
  if (level >= 1) h.words = p.text.trim().split(/\s+/).length;
  if (level >= 2) h.first = p.text.trim()[0].toUpperCase();
  return h;
}

/** Hint level after `elapsed` ms of a turn. */
export const hintLevel = (elapsed: number) => (elapsed >= HINT_LETTER_MS ? 2 : elapsed >= HINT_WORDS_MS ? 1 : 0);

function shuffle<T>(a: T[], rng: Rng): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How many tellers: every player once, capped by the host's `rounds` option ('all' = no cap). */
export function turnCount(players: number, option: string | undefined): number {
  const cap = option === 'all' ? players : Number(option) || 5;
  return Math.max(1, Math.min(players, cap));
}

/** Who tells, in order (each player at most once). */
export const tellerOrder = (ids: string[], turns: number, rng: Rng = Math.random) => shuffle(ids, rng).slice(0, turns);

/** `n` different phrases for a difficulty option: 'easy' = level 1, 'tricky' = levels 2–3, else all. */
export function pickPhrases(n: number, difficulty: string | undefined, rng: Rng = Math.random, pool: CharadePhrase[] = CHARADE_PHRASES): CharadePhrase[] {
  const fit = pool.filter(p => (difficulty === 'easy' ? p.level === 1 : difficulty === 'tricky' ? p.level >= 2 : true));
  const list = shuffle(fit.length >= n ? fit : pool, rng);
  return list.slice(0, n);
}

/** A guess may be shown back to its writer; rude ones are refused on the device. */
export const tidyGuess = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, MAX_GUESS);
export const guessOk = (s: string) => /[a-z]/i.test(s) && !isRude(s);
