import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { ZIP_LEVELS, generateZip, randomHamiltonianPath, applyStep, isSolution, isAdjacent, maxNumber, zipScore } from './zipLogic';
import type { ZipPuzzle } from './zipLogic';

/** Independent depth-first solver: finds any path that solves the puzzle by the game's rules. */
function solve(p: ZipPuzzle): number[] | null {
  const total = p.size * p.size;
  const start = Number(Object.keys(p.numbered).find(k => p.numbered[Number(k)] === 1));
  const seen = new Set([start]);
  const path = [start];
  const dfs = (next: number): boolean => {
    if (path.length === total) return next === maxNumber(p) + 1;
    const head = path[path.length - 1];
    for (const d of [-p.size, p.size, -1, 1]) {
      const c = head + d;
      if (c < 0 || c >= total || seen.has(c) || !isAdjacent(p.size, head, c)) continue;
      const n = p.numbered[c];
      if (n !== undefined && n !== next) continue;
      seen.add(c); path.push(c);
      if (dfs(n !== undefined ? next + 1 : next)) return true;
      seen.delete(c); path.pop();
    }
    return false;
  };
  return dfs(2) ? path : null;
}

describe('zip generator', () => {
  it('makes a path through every cell, one step at a time', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const size = 3 + (seed % 5);
      const path = randomHamiltonianPath(size, createRng(seed));
      expect(new Set(path).size).toBe(size * size);
      for (let i = 1; i < path.length; i++) expect(isAdjacent(size, path[i - 1], path[i])).toBe(true);
    }
  });

  it('is random: different seeds give different paths', () => {
    const a = randomHamiltonianPath(6, createRng(1)).join();
    const b = randomHamiltonianPath(6, createRng(2)).join();
    expect(a).not.toBe(b);
  });

  it.each(ZIP_LEVELS.map(l => [l.name, l] as const))('%s: 300 generated puzzles are all solvable', (_, level) => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = generateZip(level, createRng(seed * 7919 + level.size));
      expect(p.size).toBe(level.size);
      expect(Object.keys(p.numbered).length).toBe(level.numbers);
      expect(maxNumber(p)).toBe(level.numbers);
      // the stored solution follows the rules
      expect(isSolution(p, p.solution), `seed ${seed}`).toBe(true);
      // and playing it step by step through the game's own move rule completes the board
      let path: number[] = [];
      for (const cell of p.solution) {
        const r = applyStep(p, path, cell);
        expect(['start', 'extend']).toContain(r.result);
        path = r.path;
      }
      expect(path.length).toBe(level.size * level.size);
    }
  });

  it('an independent solver also solves generated Easy, Medium and Tricky puzzles', () => {
    for (const level of ZIP_LEVELS.slice(0, 3)) {
      for (let seed = 1; seed <= 40; seed++) {
        const p = generateZip(level, createRng(seed));
        const found = solve(p);
        expect(found, `${level.name} seed ${seed}`).not.toBeNull();
        expect(isSolution(p, found!)).toBe(true);
      }
    }
  });
});

describe('zip moves', () => {
  const p: ZipPuzzle = { size: 3, numbered: { 0: 1, 4: 2, 8: 3 }, solution: [0, 1, 2, 5, 4, 3, 6, 7, 8] };

  it('must start on 1', () => {
    expect(applyStep(p, [], 1).result).toBe('bad');
    expect(applyStep(p, [], 0)).toEqual({ path: [0], result: 'start' });
  });

  it('only steps to neighbours, and numbers must come in order', () => {
    expect(applyStep(p, [0], 2).result).toBe('bad'); // not next to 0
    expect(applyStep(p, [0, 1, 2, 5], 8).result).toBe('bad'); // 3 before 2
    expect(applyStep(p, [0, 1, 2, 5], 4)).toEqual({ path: [0, 1, 2, 5, 4], result: 'extend' });
  });

  it('touching a cell on the path cuts the path back to it (drag backwards / tap to undo)', () => {
    expect(applyStep(p, [0, 1, 2, 5], 2)).toEqual({ path: [0, 1, 2], result: 'back' });
    expect(applyStep(p, [0, 1, 2, 5], 0)).toEqual({ path: [0], result: 'back' });
    expect(applyStep(p, [0, 1, 2, 5], 5).result).toBe('same');
  });

  it('checks full solutions', () => {
    expect(isSolution(p, p.solution)).toBe(true);
    expect(isSolution(p, [0, 3, 6, 7, 4, 1, 2, 5, 8])).toBe(true);
    expect(isSolution(p, [0, 1, 2, 5, 4, 3, 6, 7])).toBe(false);
  });
});

describe('zip score', () => {
  it('rewards speed and never drops below 30 %', () => {
    const med = ZIP_LEVELS[1];
    expect(zipScore(med, 0)).toBe(500);
    expect(zipScore(med, 60)).toBe(250);
    expect(zipScore(med, 9999)).toBe(150);
    // harder levels are worth more for the same time
    expect(zipScore(ZIP_LEVELS[3], 60)).toBeGreaterThan(zipScore(ZIP_LEVELS[0], 60));
  });
});
