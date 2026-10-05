import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { MEMORY_LEVELS, MEMORY_EMOJIS, makeDeck, memoryScore } from './memoryLogic';

describe('speed memory', () => {
  it('has enough different pictures for the biggest board', () => {
    expect(new Set(MEMORY_EMOJIS).size).toBe(MEMORY_EMOJIS.length);
    expect(MEMORY_EMOJIS.length).toBeGreaterThanOrEqual(Math.max(...MEMORY_LEVELS.map(l => l.pairs)));
  });

  it.each(MEMORY_LEVELS.map(l => [l.name, l] as const))('%s: deck has every picture exactly twice and fills the grid', (_, level) => {
    expect(level.pairs * 2 % level.cols).toBe(0);
    for (let seed = 1; seed <= 20; seed++) {
      const deck = makeDeck(level.pairs, createRng(seed));
      expect(deck.length).toBe(level.pairs * 2);
      expect(new Set(deck.map(c => c.id)).size).toBe(deck.length);
      const counts = new Map<string, number>();
      deck.forEach(c => counts.set(c.emoji, (counts.get(c.emoji) ?? 0) + 1));
      expect(counts.size).toBe(level.pairs);
      for (const n of counts.values()) expect(n).toBe(2);
    }
  });

  it('shuffles differently with different seeds', () => {
    expect(makeDeck(8, createRng(1)).map(c => c.emoji).join()).not.toBe(makeDeck(8, createRng(2)).map(c => c.emoji).join());
  });

  it('score: points per pair, plus time and sharp-memory bonuses only for a cleared board', () => {
    const [small, , big] = MEMORY_LEVELS;
    expect(memoryScore(small, 5, 30, 10)).toBe(100); // not finished: pairs only
    expect(memoryScore(small, 8, 20, 16)).toBe(160 + 100); // finished, no tries saved
    expect(memoryScore(small, 8, 20, 12)).toBe(160 + 100 + 40);
    expect(memoryScore(big, 18, 40, 30)).toBeGreaterThan(memoryScore(small, 8, 40, 30));
  });
});
