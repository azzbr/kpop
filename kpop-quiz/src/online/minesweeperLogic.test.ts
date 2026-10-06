import { describe, expect, it } from 'vitest';
import { createRng } from '../games/engine/rng';
import { MW_DIFF, clues, mwCheck, mwDig, mwFailed, mwGenerate, mwInit, mwLives, mwProgress, mwSolved, mwToggleFlag } from './minesweeperLogic';

describe('Minesweeper', () => {
  it('the opening cell is always safe and opens an area', () => {
    for (const d of Object.keys(MW_DIFF)) {
      const spec = MW_DIFF[d];
      for (let seed = 1; seed <= 100; seed++) {
        const p = mwGenerate(d, createRng(seed));
        expect(p.mines).toHaveLength(spec.mines);
        expect(new Set(p.mines).size).toBe(spec.mines);
        expect(p.mines).not.toContain(p.start);
        expect(clues(p)[p.start]).toBe(0);
        const s = mwInit(p);
        expect(s.open.length).toBeGreaterThan(1);
        expect(s.open.some(i => p.mines.includes(i))).toBe(false);
      }
    }
  });

  it('digging everything safe solves it; mines cost lives', () => {
    const p = mwGenerate('easy', createRng(3));
    const cl = clues(p);
    let s = mwInit(p);
    s = mwToggleFlag(s, p.mines[0]);
    expect(s.flags).toContain(p.mines[0]);
    s = mwDig(p, s, p.mines[0], cl); // flagged: ignored
    expect(mwLives(s)).toBe(3);
    s = mwToggleFlag(s, p.mines[0]);
    s = mwDig(p, s, p.mines[0], cl);
    expect(mwLives(s)).toBe(2);
    for (let i = 0; i < cl.length; i++) if (cl[i] !== -1) s = mwDig(p, s, i, cl);
    expect(mwSolved(p, s)).toBe(true);
    expect(mwProgress(p, s)).toBe(1);
    expect(mwCheck(p, s.open)).toBe(true);
    expect(mwCheck(p, s.open.slice(1))).toBe(false);
    expect(mwCheck(p, [...s.open.slice(1), p.mines[0]])).toBe(false);
  });

  it('three mines and you are out', () => {
    const p = mwGenerate('medium', createRng(9));
    let s = mwInit(p);
    for (const m of p.mines.slice(0, 3)) s = mwDig(p, s, m);
    expect(mwFailed(p, s)).toBe(true);
  });
});
