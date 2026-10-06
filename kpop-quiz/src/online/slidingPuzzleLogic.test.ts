import { describe, expect, it } from 'vitest';
import { createRng } from '../games/engine/rng';
import { SL_DIFF, isSolvable, isSolvedBoard, slCheck, slGenerate, slInit, slProgress, slSlide, solvedBoard } from './slidingPuzzleLogic';

describe('Sliding Puzzle', () => {
  it('generated boards are scrambled and solvable (parity)', () => {
    for (const d of Object.keys(SL_DIFF)) {
      for (let seed = 1; seed <= 100; seed++) {
        const p = slGenerate(d, createRng(seed));
        expect(p.board).toHaveLength(p.n * p.n);
        expect([...p.board].sort((a, b) => a - b)).toEqual([...Array(p.n * p.n).keys()]);
        expect(isSolvedBoard(p.board)).toBe(false);
        expect(isSolvable(p.board, p.n)).toBe(true);
      }
    }
  });

  it('knows an unsolvable board when it sees one', () => {
    const b3 = solvedBoard(3);
    [b3[0], b3[1]] = [b3[1], b3[0]];
    expect(isSolvable(b3, 3)).toBe(false);
    const b4 = solvedBoard(4);
    [b4[0], b4[1]] = [b4[1], b4[0]];
    expect(isSolvable(b4, 4)).toBe(false);
    expect(isSolvable(solvedBoard(4), 4)).toBe(true);
  });

  it('host replays the moves', () => {
    // one move away: gap in the last-but-one cell
    const p = { n: 3, board: [1, 2, 3, 4, 5, 6, 7, 0, 8] };
    let s = slInit(p);
    expect(slProgress(p, s)).toBeLessThan(1);
    s = slSlide(3, s, 8);
    expect(isSolvedBoard(s.board)).toBe(true);
    expect(slCheck(p, s.moves)).toBe(true);
    expect(slCheck(p, [])).toBe(false);
    expect(slCheck(p, [0])).toBe(false); // not next to the gap
    // sliding a whole row at once records each step
    const q = { n: 3, board: [1, 2, 3, 4, 5, 6, 0, 7, 8] };
    const t = slSlide(3, slInit(q), 8);
    expect(t.moves).toEqual([7, 8]);
    expect(slCheck(q, t.moves)).toBe(true);
  });
});
