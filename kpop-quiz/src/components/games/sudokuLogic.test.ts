import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { N, SUDOKU_LEVELS, generateSolution, countSolutions, makePuzzle, findConflicts, isSolvedGrid, sudokuScore } from './sudokuLogic';
import type { Grid } from './sudokuLogic';

describe('sudoku solver', () => {
  it('a full valid grid has exactly one solution (itself)', () => {
    const g = generateSolution(createRng(3));
    expect(isSolvedGrid(g)).toBe(true);
    expect(countSolutions(g)).toBe(1);
  });

  it('an empty grid has many solutions', () => {
    const empty: Grid = Array.from({ length: N }, () => Array(N).fill(0));
    expect(countSolutions(empty, 2)).toBe(2);
    expect(countSolutions(empty, 50)).toBe(50);
  });

  it('spots a non-unique puzzle (a swappable rectangle left empty)', () => {
    // Full grid, then blank a 2×2 "deadly pattern": two rows in the same band, two columns in different boxes,
    // where the values form a b / b a — swapping them gives a second valid answer.
    const g = generateSolution(createRng(11));
    let found = false;
    outer: for (const r1 of [0, 2, 4]) {
      const r2 = r1 + 1;
      for (let c1 = 0; c1 < 3; c1++) {
        for (let c2 = 3; c2 < 6; c2++) {
          if (g[r1][c1] === g[r2][c2] && g[r1][c2] === g[r2][c1]) {
            const p = g.map(row => [...row]);
            p[r1][c1] = p[r1][c2] = p[r2][c1] = p[r2][c2] = 0;
            expect(countSolutions(p)).toBe(2);
            found = true;
            break outer;
          }
        }
      }
    }
    // the base pattern always contains such rectangles, but guard the test anyway
    expect(found).toBe(true);
  });

  it('a grid with a clash has no solutions', () => {
    const g = generateSolution(createRng(5)).map(row => [...row]);
    g[0][0] = g[0][1];
    g[5][5] = 0;
    expect(findConflicts(g).size).toBeGreaterThan(0);
    expect(countSolutions(g)).toBe(0);
  });
});

describe('sudoku puzzles', () => {
  it.each(SUDOKU_LEVELS.map(l => [l.name, l] as const))('%s: 60 generated puzzles each have exactly one solution', (_, level) => {
    for (let seed = 1; seed <= 60; seed++) {
      const { puzzle, solution } = makePuzzle(level, createRng(seed * 31 + level.givens));
      expect(isSolvedGrid(solution)).toBe(true);
      expect(countSolutions(puzzle, 2), `seed ${seed}`).toBe(1);
      const givens = puzzle.flat().filter(Boolean).length;
      expect(givens).toBeGreaterThanOrEqual(level.givens);
      expect(givens).toBeLessThanOrEqual(level.givens + 4); // reaches (or comes close to) the target
      // every given agrees with the solution
      puzzle.forEach((row, r) => row.forEach((v, c) => { if (v) expect(v).toBe(solution[r][c]); }));
    }
  });

  it('harder levels leave fewer numbers', () => {
    const avg = (i: number) => {
      let t = 0;
      for (let s = 1; s <= 10; s++) t += makePuzzle(SUDOKU_LEVELS[i], createRng(s)).puzzle.flat().filter(Boolean).length;
      return t / 10;
    };
    expect(avg(0)).toBeGreaterThan(avg(1));
    expect(avg(1)).toBeGreaterThan(avg(2));
  });

  it('score rewards speed, harder levels are worth more, never below 25 %', () => {
    const [easy, medium, hard] = SUDOKU_LEVELS;
    expect(sudokuScore(medium, 0)).toBe(500);
    expect(sudokuScore(medium, 180)).toBe(350);
    expect(sudokuScore(medium, 99999)).toBe(125);
    expect(sudokuScore(hard, 300)).toBeGreaterThan(sudokuScore(easy, 300));
  });
});
