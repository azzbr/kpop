// Speed Memory rules: three board sizes, the deck, and the score.
import type { Rng } from '../../games/engine/rng';

export interface MemoryLevel {
  id: 'small' | 'medium' | 'big';
  name: string;
  pairs: number;
  cols: number;
  seconds: number;
}

export const MEMORY_LEVELS: MemoryLevel[] = [
  { id: 'small', name: 'Warm-up', pairs: 8, cols: 4, seconds: 60 },
  { id: 'medium', name: 'Tricky', pairs: 12, cols: 6, seconds: 90 },
  { id: 'big', name: 'Mega', pairs: 18, cols: 6, seconds: 150 },
];

/** 18 easy-to-tell-apart pictures (no two look alike). */
export const MEMORY_EMOJIS = ['🐶', '🐱', '🦊', '🐸', '🐵', '🦁', '🐼', '🐙', '🦄', '🐢', '🍉', '🍩', '🚀', '⚽', '🎸', '🌈', '🍄', '⭐'];

export interface MemoryCard { id: number; emoji: string }

export function makeDeck(pairs: number, rng: Rng): MemoryCard[] {
  const pics = [...MEMORY_EMOJIS];
  // pick `pairs` different pictures
  for (let i = pics.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pics[i], pics[j]] = [pics[j], pics[i]];
  }
  const deck = pics.slice(0, pairs).flatMap((emoji, i) => [{ id: i * 2, emoji }, { id: i * 2 + 1, emoji }]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * 20 points a pair; clearing the board adds 5 a second left plus a "sharp memory" bonus
 * of 10 for every try saved compared with 2 tries a pair.
 */
export function memoryScore(level: MemoryLevel, matched: number, secondsLeft: number, tries: number): number {
  const base = matched * 20;
  if (matched < level.pairs) return base;
  const sharp = Math.max(0, level.pairs * 2 - tries) * 10;
  return base + Math.max(0, secondsLeft) * 5 + sharp;
}
