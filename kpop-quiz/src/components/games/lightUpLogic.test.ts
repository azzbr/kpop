import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  LIGHTUP_LEVELS, generateLightUp, litCells, clashes, wallStatus, isSolved, isWall, neighbours,
  cycleMark, levelSeed, lightUpScore, whiteCells,
} from './lightUpLogic';
import type { LightUpPuzzle } from './lightUpLogic';

/** Independent checker written straight from the rules (no shared helpers), to cross-check isSolved. */
function naiveSolved(p: LightUpPuzzle, lamps: number[]): boolean {
  const n = p.size;
  const wall = (r: number, c: number) => p.walls[r * n + c] !== undefined;
  const lamp = new Set(lamps);
  for (const l of lamp) if (l < 0 || l >= n * n || wall(Math.floor(l / n), l % n)) return false;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (wall(r, c)) {
        const want = p.walls[r * n + c];
        if (want === null) continue;
        let have = 0;
        if (r > 0 && lamp.has((r - 1) * n + c)) have++;
        if (r < n - 1 && lamp.has((r + 1) * n + c)) have++;
        if (c > 0 && lamp.has(r * n + c - 1)) have++;
        if (c < n - 1 && lamp.has(r * n + c + 1)) have++;
        if (have !== want) return false;
        continue;
      }
      // count the lamps this square can see, itself included
      let seen = lamp.has(r * n + c) ? 1 : 0;
      for (let k = r - 1; k >= 0 && !wall(k, c); k--) if (lamp.has(k * n + c)) seen++;
      for (let k = r + 1; k < n && !wall(k, c); k++) if (lamp.has(k * n + c)) seen++;
      for (let k = c - 1; k >= 0 && !wall(r, k); k--) if (lamp.has(r * n + k)) seen++;
      for (let k = c + 1; k < n && !wall(r, k); k++) if (lamp.has(r * n + k)) seen++;
      if (seen === 0) return false; // dark square
      if (lamp.has(r * n + c) && seen > 1) return false; // this lamp sees another lamp
    }
  }
  return true;
}

const SEEDS = 250;

describe('light up generator', () => {
  it.each(LIGHTUP_LEVELS.map(l => [l.name, l] as const))(`%s: ${SEEDS} generated puzzles are all solvable`, (_, level) => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateLightUp(level, createRng(seed * 7919 + level.size));
      const total = level.size * level.size;
      const label = `${level.name} seed ${seed}`;
      expect(p.size).toBe(level.size);

      // walls: about a fifth of the board, never a whole row or column
      const wallCells = Object.keys(p.walls).map(Number);
      expect(wallCells.length / total, label).toBeGreaterThanOrEqual(0.15);
      expect(wallCells.length / total, label).toBeLessThanOrEqual(0.25);
      for (let k = 0; k < level.size; k++) {
        const row = Array.from({ length: level.size }, (_, i) => k * level.size + i);
        const col = Array.from({ length: level.size }, (_, i) => i * level.size + k);
        expect(row.every(c => isWall(p, c)), `${label} row ${k}`).toBe(false);
        expect(col.every(c => isWall(p, c)), `${label} col ${k}`).toBe(false);
      }
      // no white square shut in on all four sides
      for (const c of whiteCells(p)) {
        expect(neighbours(p.size, c).some(m => !isWall(p, m)), `${label} cell ${c}`).toBe(true);
      }

      // numbers: 0–4, only on walls, about 60–70 % of the walls, matching the stored answer
      const nums = Object.entries(p.walls).filter(([, v]) => v !== null);
      expect(nums.length / wallCells.length, label).toBeGreaterThanOrEqual(0.5);
      expect(nums.length / wallCells.length, label).toBeLessThanOrEqual(0.8);
      const sol = new Set(p.solution);
      for (const [key, v] of nums) {
        const cell = Number(key);
        expect(Number.isInteger(cell) && cell >= 0 && cell < total).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(4);
        expect(neighbours(p.size, cell).filter(m => sol.has(m)).length).toBe(v);
      }

      // the stored answer: lamps on white squares only, and it solves the puzzle (both checkers agree)
      expect(p.solution.length).toBeGreaterThan(0);
      expect(p.solution.every(c => !isWall(p, c))).toBe(true);
      expect(isSolved(p, p.solution), label).toBe(true);
      expect(naiveSolved(p, p.solution), label).toBe(true);
    }
  });

  it('same seed gives the same puzzle; different seeds give different ones', () => {
    for (const level of LIGHTUP_LEVELS) {
      const a = generateLightUp(level, createRng(levelSeed(level.id, 3)));
      const b = generateLightUp(level, createRng(levelSeed(level.id, 3)));
      expect(a).toEqual(b);
      const c = generateLightUp(level, createRng(levelSeed(level.id, 4)));
      expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
    }
  });

  it('isSolved agrees with an independent checker on near-misses of generated answers', () => {
    const rng = createRng(99);
    for (let seed = 1; seed <= 60; seed++) {
      const p = generateLightUp(LIGHTUP_LEVELS[seed % 3], createRng(seed));
      const whites = whiteCells(p);
      for (let t = 0; t < 10; t++) {
        const lamps = new Set(p.solution);
        // add, remove or move one lamp
        const pick = whites[Math.floor(rng() * whites.length)];
        if (t % 3 === 0) lamps.add(pick);
        else if (t % 3 === 1) lamps.delete(p.solution[Math.floor(rng() * p.solution.length)]);
        else { lamps.delete(p.solution[Math.floor(rng() * p.solution.length)]); lamps.add(pick); }
        const list = [...lamps];
        expect(isSolved(p, list), `seed ${seed} try ${t}`).toBe(naiveSolved(p, list));
      }
    }
  });
});

describe('light up rules on a tiny board', () => {
  // 3×3, a "2" wall in the middle:
  //  .  L  .
  //  L  2  .
  //  .  .  L
  const p: LightUpPuzzle = { size: 3, walls: { 4: 2 }, solution: [1, 3, 8] };

  it('lamps light their row and column until a wall', () => {
    expect([...litCells(p, [1])].sort((a, b) => a - b)).toEqual([0, 1, 2]); // the wall stops it going down
    expect([...litCells(p, [0])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 6]);
    expect(litCells(p, [1, 3, 8]).size).toBe(8); // every white square
    expect(litCells(p, [4]).size).toBe(0); // a "lamp" on a wall does nothing
  });

  it('finds lamps that shine on each other, but not through walls', () => {
    expect(clashes(p, [1, 3, 8]).size).toBe(0);
    expect([...clashes(p, [0, 1, 3, 8])].sort((a, b) => a - b)).toEqual([0, 1, 3]);
    expect(clashes(p, [1, 7]).size).toBe(0); // same column, wall in between
    expect(clashes(p, [3, 5]).size).toBe(0); // same row, wall in between
    expect([...clashes(p, [6, 8])].sort((a, b) => a - b)).toEqual([6, 8]);
  });

  it('checks numbered walls', () => {
    expect(wallStatus(p, [1, 3])).toEqual({ 4: 'ok' });
    expect(wallStatus(p, [1])).toEqual({ 4: 'tooFew' });
    expect(wallStatus(p, [1, 3, 5])).toEqual({ 4: 'tooMany' });
    expect(wallStatus({ size: 3, walls: { 4: null }, solution: [] }, [1])).toEqual({});
  });

  it('accepts the answer and rejects an unlit square, a clash, a wrong number or a lamp on a wall', () => {
    expect(isSolved(p, [1, 3, 8])).toBe(true);
    expect(isSolved(p, [8, 3, 1, 1])).toBe(true); // order and repeats don't matter
    expect(isSolved(p, [1, 3])).toBe(false); // 5, 7 and 8 are dark
    expect(isSolved(p, [0, 1, 3, 8])).toBe(false); // 0 and 1 see each other
    expect(isSolved(p, [0, 8])).toBe(false); // everything lit, no clash, but the 2 has no lamps
    expect(isSolved(p, [1, 3, 8, 4])).toBe(false); // lamp on the wall
    expect(isSolved(p, [1, 3, 8, 9])).toBe(false); // off the board
  });

  it('accepts any valid answer, not just the stored one', () => {
    const open: LightUpPuzzle = { size: 2, walls: {}, solution: [0, 3] };
    expect(isSolved(open, [0, 3])).toBe(true);
    expect(isSolved(open, [1, 2])).toBe(true);
    expect(isSolved(open, [0, 1])).toBe(false);
    // the 3×3 "2" board has a second answer too: lamps at 0, 5 and 7
    expect(isSolved(p, [0, 5, 7])).toBe(true);
  });

  it('a tap cycles empty → lamp → dot → empty', () => {
    expect(cycleMark(undefined)).toBe('lamp');
    expect(cycleMark('lamp')).toBe('dot');
    expect(cycleMark('dot')).toBeUndefined();
  });
});

describe('light up levels and score', () => {
  it('has the three difficulties', () => {
    expect(LIGHTUP_LEVELS.map(l => [l.id, l.size])).toEqual([['easy', 6], ['medium', 8], ['hard', 10]]);
  });

  it('gives every "Level n" its own stable seed', () => {
    for (const level of LIGHTUP_LEVELS) {
      const seeds = new Set(Array.from({ length: 500 }, (_, i) => levelSeed(level.id, i + 1)));
      expect(seeds.size).toBe(500);
    }
    expect(levelSeed('easy', 1)).toBe(levelSeed('easy', 1));
    expect(levelSeed('easy', 1)).not.toBe(levelSeed('medium', 1));
    // Locked so a saved "Level 7" stays the same puzzle after updates.
    expect(levelSeed('easy', 1)).toBe(1411836463);
  });

  it('rewards speed and never drops below 30 %', () => {
    const med = LIGHTUP_LEVELS[1];
    expect(lightUpScore(med, 0)).toBe(500);
    expect(lightUpScore(med, 120)).toBe(250);
    expect(lightUpScore(med, 9999)).toBe(150);
    expect(lightUpScore(LIGHTUP_LEVELS[2], 60)).toBeGreaterThan(lightUpScore(LIGHTUP_LEVELS[0], 60));
  });
});
