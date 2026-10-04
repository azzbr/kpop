// Agent HQ code-breaking rules. Pure: no React, no DOM, no storage.
import type { Rng } from '../games/engine/rng';

/** Kid-friendly secret words: animals, space, nature, school. 4–8 letters, no J (the grid code merges I/J). */
export const AGENT_WORDS: string[] = [
  // space
  'ROCKET', 'PLANET', 'COMET', 'GALAXY', 'ORBIT', 'MOON', 'ASTEROID', 'SATURN',
  // animals
  'TIGER', 'PANDA', 'OTTER', 'KOALA', 'ZEBRA', 'RABBIT', 'DOLPHIN', 'PENGUIN',
  'TURTLE', 'PARROT', 'FALCON', 'BEAVER', 'GIRAFFE', 'OCTOPUS',
  // nature
  'FOREST', 'RIVER', 'OCEAN', 'CLOUD', 'RAINBOW', 'VOLCANO', 'ISLAND', 'DESERT',
  'FLOWER', 'MEADOW',
  // school & adventure
  'PENCIL', 'ERASER', 'LIBRARY', 'SCIENCE', 'CRAYON', 'PUZZLE', 'COMPASS', 'TREASURE',
];

export type CodeType = 'number' | 'reverse' | 'shift1' | 'caesar' | 'emoji' | 'mirror' | 'grid';

export const CODE_TYPES: CodeType[] = ['number', 'reverse', 'shift1', 'caesar', 'emoji', 'mirror', 'grid'];

export const CODE_INFO: Record<CodeType, { name: string; emoji: string; rule: string; example: string }> = {
  number:  { name: 'Number Code',  emoji: '🔢', rule: 'Each number is a letter: A=1, B=2, C=3 … Z=26.', example: '8-9 → HI' },
  reverse: { name: 'Backwards Code', emoji: '🔄', rule: 'Read the letters backwards, from right to left.', example: 'OLLEH → HELLO' },
  shift1:  { name: 'Next-Letter Code', emoji: '➡️', rule: 'Every letter was moved 1 step forward. Move each one back by 1.', example: 'IFMMP → HELLO' },
  caesar:  { name: 'Caesar Code', emoji: '🏛️', rule: 'Every letter was moved forward by the secret number. Count back that many letters.', example: 'Shift 2: JGNNQ → HELLO' },
  emoji:   { name: 'Emoji Code', emoji: '😺', rule: 'Each emoji stands for one letter. Use the key to swap them back.', example: '🐴🥚 → HE' },
  mirror:  { name: 'Mirror Code', emoji: '🪞', rule: 'The word is written in a mirror. Flip it in your head to read it.', example: 'Mirror of HELLO → HELLO' },
  grid:    { name: 'Grid Code', emoji: '🔲', rule: 'Each pair is ROW then COLUMN in the grid. I and J share a square.', example: '23-15 → HE' },
};

const A = 65;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Fixed letter → emoji key (26 different emoji). */
export const EMOJI_KEY: Record<string, string> = {
  A: '🍎', B: '🐝', C: '🐱', D: '🐶', E: '🥚', F: '🐸', G: '🍇', H: '🐴', I: '🍦',
  J: '🧃', K: '🪁', L: '🍋', M: '🐵', N: '🥜', O: '🐙', P: '🐷', Q: '👑', R: '🌈',
  S: '⭐', T: '🌳', U: '☂️', V: '🎻', W: '🐳', X: '❌', Y: '🪀', Z: '⚡',
};

/** 5×5 grid code square (I/J combined). Row r, column c (1-based) → GRID[r-1][c-1]. */
export const GRID: string[][] = ['ABCDE', 'FGHIK', 'LMNOP', 'QRSTU', 'VWXYZ'].map(r => r.split(''));

export interface Puzzle {
  id: string;
  type: CodeType;
  word: string;
  /** Caesar shift amount (only for 'caesar'). */
  param?: number;
  /** The coded pieces, one per letter (in display order). */
  tokens: string[];
  /** How the tokens are joined for display. */
  sep: string;
}

export const puzzleId = (type: CodeType, word: string) => `${type}:${word}`;

const shiftLetter = (ch: string, n: number) => String.fromCharCode(A + ((((ch.charCodeAt(0) - A) + n) % 26) + 26) % 26);

/** Caesar shift chosen from the word so each puzzle always has the same shift (2–5). */
export function caesarShiftFor(word: string): number {
  let sum = 0;
  for (const ch of word) sum += ch.charCodeAt(0);
  return 2 + (sum % 4);
}

function gridPos(ch: string): string {
  const c = ch === 'J' ? 'I' : ch;
  for (let r = 0; r < 5; r++) {
    const col = GRID[r].indexOf(c);
    if (col >= 0) return `${r + 1}${col + 1}`;
  }
  throw new Error(`No grid square for ${ch}`);
}

export function encode(word: string, type: CodeType, param?: number): Puzzle {
  const w = word.toUpperCase();
  const letters = w.split('');
  const base = { id: puzzleId(type, w), type, word: w };
  switch (type) {
    case 'number':  return { ...base, tokens: letters.map(l => String(l.charCodeAt(0) - A + 1)), sep: '-' };
    case 'reverse': return { ...base, tokens: [...letters].reverse(), sep: '' };
    case 'shift1':  return { ...base, tokens: letters.map(l => shiftLetter(l, 1)), sep: '' };
    case 'caesar': {
      const n = param ?? caesarShiftFor(w);
      return { ...base, param: n, tokens: letters.map(l => shiftLetter(l, n)), sep: '' };
    }
    case 'emoji':   return { ...base, tokens: letters.map(l => EMOJI_KEY[l]), sep: ' ' };
    // Stored reversed; the screen also flips it with scaleX(-1), so it looks like the word in a mirror.
    case 'mirror':  return { ...base, tokens: [...letters].reverse(), sep: '' };
    case 'grid':    return { ...base, tokens: letters.map(gridPos), sep: '-' };
  }
}

/** Decodes a puzzle back into its word (used by tests and as the answer key). */
export function decode(p: Puzzle): string {
  switch (p.type) {
    case 'number':  return p.tokens.map(t => String.fromCharCode(A + Number(t) - 1)).join('');
    case 'reverse':
    case 'mirror':  return [...p.tokens].reverse().join('');
    case 'shift1':  return p.tokens.map(t => shiftLetter(t, -1)).join('');
    case 'caesar':  return p.tokens.map(t => shiftLetter(t, -(p.param ?? 0))).join('');
    case 'emoji': {
      const back = Object.fromEntries(Object.entries(EMOJI_KEY).map(([k, v]) => [v, k]));
      return p.tokens.map(t => back[t]).join('');
    }
    case 'grid':    return p.tokens.map(t => GRID[Number(t[0]) - 1][Number(t[1]) - 1]).join('');
  }
}

/** For a decoder key: coded letter → plain letter for a shift of n. */
export function shiftKey(n: number): { coded: string; plain: string }[] {
  return ALPHABET.split('').map(plain => ({ coded: shiftLetter(plain, n), plain }))
    .sort((a, b) => a.coded.localeCompare(b.coded));
}

export const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');

/** Case- and space-insensitive answer check. */
export function checkAnswer(input: string, word: string): boolean {
  const a = normalize(input);
  return a.length > 0 && a === normalize(word);
}

/** Every puzzle: each word in each code type. */
export function allPuzzles(): Puzzle[] {
  return AGENT_WORDS.flatMap(w => CODE_TYPES.map(t => encode(w, t)));
}

const POOL = allPuzzles();

/**
 * Picks the next puzzle: never `avoidId` (the one on screen), unsolved puzzles first,
 * and a different word than the current one when possible.
 */
export function pickNext(solvedIds: readonly string[], rng: Rng, avoidId?: string): Puzzle {
  const solved = new Set(solvedIds);
  const avoidWord = avoidId?.split(':')[1];
  const notCurrent = POOL.filter(p => p.id !== avoidId);
  const tiers = [
    notCurrent.filter(p => !solved.has(p.id) && p.word !== avoidWord),
    notCurrent.filter(p => !solved.has(p.id)),
    notCurrent.filter(p => p.word !== avoidWord),
    notCurrent,
  ];
  const list = tiers.find(t => t.length > 0) ?? POOL;
  return list[Math.floor(rng() * list.length) % list.length];
}

/** First-letters hint, e.g. "RO____". */
export function hintFor(word: string): string {
  const n = Math.min(2, word.length - 1);
  return word.slice(0, n) + '_'.repeat(word.length - n);
}
