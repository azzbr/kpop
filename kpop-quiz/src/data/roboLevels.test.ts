import { describe, it, expect } from 'vitest';
import { ROBO_LEVELS, WORLDS } from './roboLevels';
import { parseLevel, runProgram, blockCount, kindsUsed, shortestMoves, searchShortest } from '../components/games/roboLogic';

// "Puzzles need a test proving they're solvable" (CLAUDE.md content rule 8) — and fair stars:
// the ⭐⭐⭐ target is the reference solution's size, and the exhaustive search shows no shorter
// program works wherever it can look in reasonable time (bigger sizes were checked once by hand
// with the same search: f15 has nothing in 6 blocks).

describe('Robo Quest levels', () => {
  it('has 3 worlds × 10 levels, numbered 1–10, with unique ids and kind hints', () => {
    expect(ROBO_LEVELS).toHaveLength(30);
    expect(new Set(ROBO_LEVELS.map(l => l.id)).size).toBe(30);
    for (const w of WORLDS) {
      const ls = ROBO_LEVELS.filter(l => l.world === w.world);
      expect(ls.map(l => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
    for (const l of ROBO_LEVELS) {
      expect(l.hint.length, l.id).toBeGreaterThan(10);
      expect(l.title.length, l.id).toBeLessThanOrEqual(20);
    }
  });

  it('every grid has one start, one dock, fits on a phone, and is walled in', () => {
    for (const l of ROBO_LEVELS) {
      const all = l.grid.join('\n');
      expect(all.split('S').length - 1, l.id).toBe(1);
      expect(all.split('G').length - 1, l.id).toBe(1);
      expect(all, l.id).toMatch(/^[#. SG*\n]+$/);
      const b = parseLevel(l);
      expect(b.w, l.id).toBeLessThanOrEqual(12);
      expect(b.h, l.id).toBeLessThanOrEqual(12);
      // Every path cell on the edge would let the robot "leave" the board: the edge is wall or nothing.
      for (let x = 0; x < b.w; x++) for (const y of [0, b.h - 1]) expect(b.cells[y][x], `${l.id} edge`).not.toBe('.');
      for (let y = 0; y < b.h; y++) for (const x of [0, b.w - 1]) expect(b.cells[y][x], `${l.id} edge`).not.toBe('.');
    }
  });

  it('every reference solution docks, uses exactly the target number of blocks, and only allowed blocks', () => {
    for (const l of ROBO_LEVELS) {
      const run = runProgram(parseLevel(l), l.solution);
      expect(run.result, `${l.id} ${l.title}`).toBe('dock');
      expect(blockCount(l.solution), l.id).toBe(l.target);
      for (const k of kindsUsed(l.solution)) expect(l.blocks, `${l.id} uses ${k}`).toContain(k);
    }
  });

  it('each world teaches its idea: Garden = moves, Factory = + repeat, Space = + sensors', () => {
    for (const l of ROBO_LEVELS) {
      if (l.world === 1) expect(l.blocks).toEqual(['forward', 'left', 'right']);
      if (l.world === 2) expect(l.blocks).toEqual(['forward', 'left', 'right', 'repeat']);
      if (l.world === 3) expect(l.blocks.some(k => k === 'until' || k === 'if' || k === 'ifelse'), l.id).toBe(true);
    }
  });

  it('Garden targets are the fewest moves possible (breadth-first search)', () => {
    for (const l of ROBO_LEVELS.filter(x => x.world === 1)) expect(shortestMoves(parseLevel(l)), l.id).toBe(l.target);
  });

  it('Factory and Space: no program shorter than the target works (searched up to 5 / 4 blocks)', () => {
    for (const l of ROBO_LEVELS.filter(x => x.world > 1)) {
      const limit = Math.min(l.target - 1, l.world === 2 ? 5 : 4);
      expect(searchShortest(parseLevel(l), l.blocks, limit), `${l.id} has a shorter solution`).toBeNull();
    }
  }, 120_000);

  it('Space levels with sensors really need them: without if / until it takes more blocks than the target', () => {
    for (const l of ROBO_LEVELS.filter(x => x.world === 3 && [...kindsUsed(x.solution)].some(k => k === 'if' || k === 'ifelse'))) {
      expect(searchShortest(parseLevel(l), ['forward', 'left', 'right', 'repeat'], Math.min(l.target, 5)), l.id).toBeNull();
    }
  }, 120_000);

  it('the robot always starts on the path and every battery and the dock can be reached', () => {
    for (const l of ROBO_LEVELS) expect(shortestMoves(parseLevel(l)), l.id).not.toBeNull();
  });
});
