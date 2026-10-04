import { describe, it, expect } from 'vitest';
import { PUZZLES, VALID_WORDS, differsBy1, ladderHint } from './wordLadder';

/** Shortest number of one-letter changes from start to end using only dictionary words, or -1. */
function shortestLadder(start: string, end: string): number {
  const words = [...VALID_WORDS].filter(w => w.length === start.length);
  const dist = new Map<string, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const w = queue.shift()!;
    if (w === end) return dist.get(w)!;
    for (const next of words) {
      if (!dist.has(next) && differsBy1(w, next)) {
        dist.set(next, dist.get(w)! + 1);
        queue.push(next);
      }
    }
  }
  return -1;
}

describe('word ladder dictionary', () => {
  it('only has lowercase 3- or 4-letter words', () => {
    for (const w of VALID_WORDS) {
      expect(w, `"${w}"`).toMatch(/^[a-z]+$/);
      expect([3, 4], `"${w}" has ${w.length} letters`).toContain(w.length);
    }
  });
});

describe('word ladder puzzles', () => {
  it.each(PUZZLES.map(p => [`${p.start} → ${p.end}`, p] as const))('%s is solvable in its listed steps', (_, p) => {
    expect(p.start.length).toBe(p.end.length);
    expect(VALID_WORDS.has(p.start), `start "${p.start}" in dictionary`).toBe(true);
    expect(VALID_WORDS.has(p.end), `end "${p.end}" in dictionary`).toBe(true);
    const best = shortestLadder(p.start, p.end);
    expect(best, 'puzzle must be solvable').toBeGreaterThan(0);
    expect(p.steps).toBeGreaterThanOrEqual(best);
    // The hint shows one "?" per in-between word
    expect(ladderHint(p).split('?').length - 1).toBe(p.steps - 1);
  });
});
