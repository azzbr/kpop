// Round builders for the race games merged onto the engines (Memory Digits → GuessRace,
// Colour Clash and What's Missing → TapRace). Pure — tested in raceRounds.test.ts.
// The difficulty keys match the choices in OnlineHub's GAME_OPTIONS.

import type { GuessRound } from './GuessRace';
import type { TapOption, TapRound } from './TapRace';

type Rand = () => number;
const shuffle = <T,>(a: T[], rand: Rand) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const randInt = (lo: number, hi: number, rand: Rand) => Math.floor(rand() * (hi - lo + 1)) + lo;

// ---------- Memory Digits ----------

export const MEMORY_DIFF: Record<string, { start: number; perMs: number }> = {
  easy: { start: 3, perMs: 950 },
  medium: { start: 4, perMs: 800 },
  hard: { start: 5, perMs: 650 },
  expert: { start: 6, perMs: 520 },
  master: { start: 7, perMs: 430 },
  legend: { start: 8, perMs: 360 },
};
export const MEMORY_ROUNDS = 6;

/** One number per round, one digit longer each time; shown for len × perMs, then typed back. */
export function makeMemoryRounds(difficulty: string, total = MEMORY_ROUNDS, rand: Rand = Math.random): GuessRound<{ len: number }, number[]>[] {
  const diff = MEMORY_DIFF[difficulty] || MEMORY_DIFF.medium;
  return Array.from({ length: total }, (_, i) => {
    const len = diff.start + i;
    const seq = Array.from({ length: len }, () => Math.floor(rand() * 10));
    return { prompt: { len }, answer: seq.join(''), show: seq, showMs: len * diff.perMs, ms: 8000 + len * 900 };
  });
}

/** Remembering more digits is harder, so longer numbers score more. */
export const memoryPoints = (answer: string) => 100 + answer.length * 15;

// ---------- Colour Clash (Stroop) ----------

export interface Swatch { name: string; hex: string }
export const PALETTE: Swatch[] = [
  { name: 'RED', hex: '#ef4444' },
  { name: 'BLUE', hex: '#3b82f6' },
  { name: 'GREEN', hex: '#22c55e' },
  { name: 'YELLOW', hex: '#eab308' },
  { name: 'PURPLE', hex: '#a855f7' },
  { name: 'ORANGE', hex: '#f97316' },
  { name: 'PINK', hex: '#ec4899' },
  { name: 'CYAN', hex: '#06b6d4' },
];
export const COLOUR_DIFF: Record<string, { colors: number; ms: number; tricky: boolean }> = {
  easy: { colors: 4, ms: 5500, tricky: false },
  medium: { colors: 5, ms: 5000, tricky: false },
  hard: { colors: 6, ms: 4300, tricky: false },
  expert: { colors: 6, ms: 3600, tricky: true },
  master: { colors: 7, ms: 3000, tricky: true },
  legend: { colors: 8, ms: 2500, tricky: true },
};
export const COLOUR_ROUNDS = 14;

export interface ColourPrompt { word: string; inkHex: string }

/** A colour WORD printed in an ink colour; the right option is the INK. Tricky tiers sometimes match. */
export function makeColourRounds(difficulty: string, total = COLOUR_ROUNDS, rand: Rand = Math.random): TapRound<ColourPrompt>[] {
  const spec = COLOUR_DIFF[difficulty] || COLOUR_DIFF.medium;
  const palette = PALETTE.slice(0, spec.colors);
  return Array.from({ length: total }, () => {
    const opts = shuffle(palette, rand);
    const word = opts[randInt(0, opts.length - 1, rand)];
    let ink = opts[randInt(0, opts.length - 1, rand)];
    let guard = 0;
    while (ink.name === word.name && !(spec.tricky && rand() < 0.2) && guard < 20) {
      ink = opts[randInt(0, opts.length - 1, rand)];
      guard++;
    }
    const options: TapOption[] = opts.map(o => ({ label: o.name, hex: o.hex }));
    return { prompt: { word: word.name, inkHex: ink.hex }, options, correctIndex: opts.indexOf(ink) };
  });
}

// ---------- What's Missing? ----------

export interface TrayItem { emoji: string; label: string }
export const TRAY_POOL: TrayItem[] = [
  { emoji: '🍎', label: 'apple' }, { emoji: '🍌', label: 'banana' }, { emoji: '🍓', label: 'strawberry' },
  { emoji: '🍕', label: 'pizza' }, { emoji: '🍔', label: 'burger' }, { emoji: '🍩', label: 'donut' },
  { emoji: '🍦', label: 'ice cream' }, { emoji: '🎂', label: 'cake' }, { emoji: '🥕', label: 'carrot' },
  { emoji: '🌽', label: 'corn' }, { emoji: '🐶', label: 'dog' }, { emoji: '🐱', label: 'cat' },
  { emoji: '🦁', label: 'lion' }, { emoji: '🐯', label: 'tiger' }, { emoji: '🐸', label: 'frog' },
  { emoji: '🐢', label: 'turtle' }, { emoji: '🐧', label: 'penguin' }, { emoji: '🦋', label: 'butterfly' },
  { emoji: '🐝', label: 'bee' }, { emoji: '🐙', label: 'octopus' }, { emoji: '🦄', label: 'unicorn' },
  { emoji: '🚗', label: 'car' }, { emoji: '🚌', label: 'bus' }, { emoji: '🚀', label: 'rocket' },
  { emoji: '✈️', label: 'plane' }, { emoji: '⛵', label: 'boat' }, { emoji: '🚲', label: 'bicycle' },
  { emoji: '⚽', label: 'ball' }, { emoji: '🏀', label: 'basketball' }, { emoji: '🎸', label: 'guitar' },
  { emoji: '🥁', label: 'drum' }, { emoji: '🎹', label: 'piano' }, { emoji: '🎈', label: 'balloon' },
  { emoji: '🎁', label: 'present' }, { emoji: '👑', label: 'crown' }, { emoji: '💎', label: 'diamond' },
  { emoji: '🔑', label: 'key' }, { emoji: '🌈', label: 'rainbow' }, { emoji: '⭐', label: 'star' },
  { emoji: '🌙', label: 'moon' }, { emoji: '☀️', label: 'sun' }, { emoji: '🌳', label: 'tree' },
  { emoji: '🌸', label: 'flower' }, { emoji: '🍄', label: 'mushroom' }, { emoji: '🌵', label: 'cactus' },
  { emoji: '🔥', label: 'fire' }, { emoji: '❄️', label: 'snowflake' }, { emoji: '🏰', label: 'castle' },
  { emoji: '🤖', label: 'robot' }, { emoji: '👻', label: 'ghost' }, { emoji: '🐉', label: 'dragon' },
  { emoji: '🦖', label: 'dinosaur' }, { emoji: '🧸', label: 'teddy' }, { emoji: '👟', label: 'shoe' },
  { emoji: '👒', label: 'hat' }, { emoji: '🧦', label: 'sock' }, { emoji: '✏️', label: 'pencil' },
  { emoji: '📚', label: 'books' }, { emoji: '✂️', label: 'scissors' }, { emoji: '🕯️', label: 'candle' },
];
export const MISSING_DIFF: Record<string, { count: number; viewMs: number }> = {
  easy: { count: 5, viewMs: 5000 },
  medium: { count: 7, viewMs: 6000 },
  hard: { count: 9, viewMs: 7500 },
  expert: { count: 11, viewMs: 8000 },
  master: { count: 13, viewMs: 8500 },
  legend: { count: 15, viewMs: 9000 },
};
export const MISSING_ROUNDS = 6;
export const MISSING_ROUND_MS = 13000;

/** Study the full tray, then it comes back with one spot blank (null); pick the vanished item from 4. */
export function makeMissingRounds(difficulty: string, total = MISSING_ROUNDS, rand: Rand = Math.random): TapRound<(TrayItem | null)[], TrayItem[]>[] {
  const diff = MISSING_DIFF[difficulty] || MISSING_DIFF.medium;
  return Array.from({ length: total }, () => {
    const tray = shuffle(TRAY_POOL, rand).slice(0, diff.count);
    const removeIdx = Math.floor(rand() * tray.length);
    const missing = tray[removeIdx];
    const decoys = shuffle(TRAY_POOL.filter(x => !tray.includes(x)), rand).slice(0, 3);
    const options = shuffle([missing, ...decoys], rand);
    return {
      prompt: tray.map((t, i) => (i === removeIdx ? null : t)),
      options,
      correctIndex: options.indexOf(missing),
      study: tray,
      studyMs: diff.viewMs,
    };
  });
}
