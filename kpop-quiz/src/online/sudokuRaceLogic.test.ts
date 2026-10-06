import { describe, expect, it } from 'vitest';
import { createRng } from '../games/engine/rng';
import { SK_DIFF, conflicts, countSolutions, fullGrid, skCheck, skGenerate, skInit, skProgress, skSolved } from './sudokuRaceLogic';

describe('Sudoku Race', () => {
  it('full grids are valid for 4×4 and 6×6', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const sh of [{ n: 4, boxR: 2, boxC: 2 }, { n: 6, boxR: 2, boxC: 3 }]) {
        const g = fullGrid(sh, createRng(seed));
        expect(g.every(v => v >= 1 && v <= sh.n)).toBe(true);
        expect(conflicts(g, sh).size).toBe(0);
      }
    }
  });

  it('every generated puzzle has exactly one solution', () => {
    for (const d of Object.keys(SK_DIFF)) {
      for (let seed = 1; seed <= 40; seed++) {
        const p = skGenerate(d, createRng(seed));
        expect(p.givens).toHaveLength(p.n * p.n);
        expect(countSolutions(p.givens, p, 2)).toBe(1);
        expect(p.givens.filter(v => v === 0).length).toBeGreaterThan(0);
      }
    }
  });

  it('the host accepts the solution and rejects broken grids', () => {
    const p = skGenerate('medium', createRng(5));
    // solve it by brute force: fill each empty cell with the only value that keeps one solution
    const g = [...p.givens];
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue;
      for (let v = 1; v <= p.n; v++) {
        g[i] = v;
        if (countSolutions(g, p, 2) === 1) break;
      }
    }
    const s = { grid: g };
    expect(skSolved(p, s)).toBe(true);
    expect(skProgress(p, s)).toBe(1);
    expect(skCheck(p, g)).toBe(true);
    const bad = [...g];
    const k = p.givens.findIndex(v => v === 0);
    bad[k] = (bad[k] % p.n) + 1;
    expect(skCheck(p, bad)).toBe(false);
    expect(skCheck(p, g.slice(1))).toBe(false);
    expect(skProgress(p, skInit(p))).toBe(0);
  });
});
