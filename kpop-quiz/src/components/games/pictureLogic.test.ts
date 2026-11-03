import { describe, it, expect } from 'vitest';
import {
  EMPTY, FILLED, MARKED, PICTURE_LEVELS,
  cluesOf, solutionFromRows, rowCluesOf, colCluesOf, column, emptyBoard, boardFromSolution,
  setCell, fillCell, markCell, clearCell, paintTarget, paintCells, dragAxis, dragRun,
  lineDone, rowsDone, colsDone, isSolved, solveLine, propagate, solveByLines,
  knownFromBoard, hintCell, wrongCell, pictureScore, nextPicture, article,
} from './pictureLogic';
import type { Board, Clue, Known, Solution } from './pictureLogic';

const grid = (rows: string[]): Solution => solutionFromRows(rows);
const sameClue = (a: Clue, b: Clue) => a.length === b.length && a.every((n, i) => n === b[i]);

/** Independent brute force: how many grids (up to `limit`) match the clues. Rows are tried from every bit pattern. */
function countSolutions(rowClues: Clue[], colClues: Clue[], limit = 2): number {
  const n = colClues.length;
  const lines = Array.from({ length: 1 << n }, (_, m) => Array.from({ length: n }, (_, i) => !!(m & (1 << i))));
  const rows: boolean[][] = [];
  let found = 0;
  const rec = (r: number) => {
    if (found >= limit) return;
    if (r === rowClues.length) {
      if (colClues.every((clue, c) => sameClue(cluesOf(column(rows, c)), clue))) found++;
      return;
    }
    for (const line of lines) {
      if (!sameClue(cluesOf(line), rowClues[r])) continue;
      rows.push(line); rec(r + 1); rows.pop();
    }
  };
  rec(0);
  return found;
}

describe('clues', () => {
  it('counts runs of filled squares in order', () => {
    const line = (s: string) => [...s].map(ch => ch === '#');
    expect(cluesOf(line('#####'))).toEqual([5]);
    expect(cluesOf(line('##.#.'))).toEqual([2, 1]);
    expect(cluesOf(line('.#.#.#'))).toEqual([1, 1, 1]);
    expect(cluesOf(line('..##'))).toEqual([2]);
    expect(cluesOf(line('.....'))).toEqual([]);
    expect(cluesOf([])).toEqual([]);
  });

  it('reads a picture: any letter is filled, dots are empty', () => {
    const sol = grid(['r.r', '.k.', 'yyy']);
    expect(sol).toEqual([[true, false, true], [false, true, false], [true, true, true]]);
    expect(rowCluesOf(sol)).toEqual([[1, 1], [1], [3]]);
    expect(colCluesOf(sol)).toEqual([[1, 1], [2], [1, 1]]);
  });
});

describe('board', () => {
  it('fills, marks and clears without changing the old board', () => {
    const b0 = emptyBoard(3);
    const b1 = fillCell(b0, 1, 2);
    expect(b0[1][2]).toBe(EMPTY);
    expect(b1[1][2]).toBe(FILLED);
    expect(markCell(b1, 0, 0)[0][0]).toBe(MARKED);
    expect(clearCell(b1, 1, 2)[1][2]).toBe(EMPTY);
    // no change → same board back (cheap for undo checks); off the board → ignored
    expect(setCell(b1, 1, 2, FILLED)).toBe(b1);
    expect(setCell(b1, 5, 5, FILLED)).toBe(b1);
  });

  it('the first square of a touch decides what the drag paints', () => {
    expect(paintTarget('fill', EMPTY)).toBe(FILLED);
    expect(paintTarget('fill', MARKED)).toBe(FILLED);
    expect(paintTarget('fill', FILLED)).toBe(EMPTY);
    expect(paintTarget('mark', EMPTY)).toBe(MARKED);
    expect(paintTarget('mark', FILLED)).toBe(MARKED);
    expect(paintTarget('mark', MARKED)).toBe(EMPTY);
  });

  it('a drag only changes squares that match the first one (marks stay when filling from an empty square)', () => {
    let b: Board = emptyBoard(4);
    b = markCell(b, 0, 2);
    b = fillCell(b, 0, 3);
    const run = dragRun({ r: 0, c: 0 }, { r: 0, c: 3 }, 'row');
    const out = paintCells(b, run, EMPTY, FILLED);
    expect(out[0]).toEqual([FILLED, FILLED, MARKED, FILLED]);
    // clearing from a filled square clears filled squares only
    expect(paintCells(out, run, FILLED, EMPTY)[0]).toEqual([EMPTY, EMPTY, MARKED, EMPTY]);
  });

  it('a drag runs in a straight line along the row or down the column', () => {
    const start = { r: 2, c: 2 };
    expect(dragRun(start, { r: 4, c: 4 }, null)).toEqual([start]);
    expect(dragAxis(start, { r: 2, c: 5 })).toBe('row');
    expect(dragAxis(start, { r: 0, c: 3 })).toBe('col');
    expect(dragRun(start, { r: 3, c: 5 }, 'row')).toEqual([{ r: 2, c: 2 }, { r: 2, c: 3 }, { r: 2, c: 4 }, { r: 2, c: 5 }]);
    expect(dragRun(start, { r: 0, c: 1 }, 'col')).toEqual([{ r: 2, c: 2 }, { r: 1, c: 2 }, { r: 0, c: 2 }]);
    expect(dragRun(start, { r: 2, c: 0 }, 'row')).toEqual([{ r: 2, c: 2 }, { r: 2, c: 1 }, { r: 2, c: 0 }]);
  });

  it('a line is done when its filled squares match the clue (marks ignored)', () => {
    expect(lineDone([FILLED, FILLED, EMPTY, FILLED], [2, 1])).toBe(true);
    expect(lineDone([FILLED, FILLED, MARKED, FILLED], [2, 1])).toBe(true);
    expect(lineDone([FILLED, FILLED, FILLED, EMPTY], [2, 1])).toBe(false);
    expect(lineDone([EMPTY, MARKED, EMPTY], [])).toBe(true);
    expect(lineDone([EMPTY, FILLED, EMPTY], [])).toBe(false);
    const sol = grid(['##.', '..#', '###']);
    const b = boardFromSolution(sol);
    expect(rowsDone(b, rowCluesOf(sol))).toEqual([true, true, true]);
    expect(colsDone(emptyBoard(3), colCluesOf(sol))).toEqual([false, false, false]);
  });
});

describe('isSolved', () => {
  const sol = grid(['#.#', '.#.', '#.#']);

  it('is true only when the filled squares are exactly the picture', () => {
    expect(isSolved(boardFromSolution(sol), sol)).toBe(true);
    expect(isSolved(emptyBoard(3), sol)).toBe(false);
    expect(isSolved(clearCell(boardFromSolution(sol), 1, 1), sol)).toBe(false);
    expect(isSolved(fillCell(boardFromSolution(sol), 0, 1), sol)).toBe(false);
  });

  it('ignores marks', () => {
    let b = boardFromSolution(sol);
    b = markCell(b, 0, 1);
    b = markCell(b, 2, 1);
    expect(isSolved(b, sol)).toBe(true);
    // a mark where a filled square belongs is not a fill
    expect(isSolved(markCell(b, 1, 1), sol)).toBe(false);
  });

  it('does not count a board of the wrong size', () => {
    expect(isSolved(emptyBoard(2), grid(['..', '..']))).toBe(true);
    expect(isSolved(emptyBoard(3), grid(['..', '..']))).toBe(false);
  });
});

describe('line solver', () => {
  const U: Known = -1;

  it('finds the overlap of a long run', () => {
    // a 4 in 5 squares must cover the middle three
    expect(solveLine([4], [U, U, U, U, U])).toEqual([U, 1, 1, 1, U]);
    expect(solveLine([5], [U, U, U, U, U])).toEqual([1, 1, 1, 1, 1]);
    expect(solveLine([2, 2], [U, U, U, U, U])).toEqual([1, 1, 0, 1, 1]);
    expect(solveLine([1], [U, U, U])).toEqual([U, U, U]);
  });

  it('an empty clue empties the line', () => {
    expect(solveLine([], [U, U, U])).toEqual([0, 0, 0]);
    expect(solveLine([0], [U, U])).toEqual([0, 0]);
    expect(solveLine([], [U, 1, U])).toBeNull();
  });

  it('uses known squares', () => {
    // a 2 touching a known filled square at the edge
    expect(solveLine([2], [1, U, U, U])).toEqual([1, 1, 0, 0]);
    // a known empty square splits the line
    expect(solveLine([3], [U, U, 0, U, U, U])).toEqual([0, 0, 0, 1, 1, 1]);
    // squares far from a known 1-run are empty
    expect(solveLine([1], [U, U, 1, U, U])).toEqual([0, 0, 1, 0, 0]);
  });

  it('spots a contradiction', () => {
    expect(solveLine([3], [U, 0, U, 0, U])).toBeNull();
    expect(solveLine([1, 1], [1, 1, U, U])).toBeNull();
    expect(solveLine([6], [U, U, U, U, U])).toBeNull();
  });

  it('solves small pictures from their clues alone', () => {
    for (const rows of [
      ['.#.#.', '#####', '#####', '.###.', '..#..'],
      ['#.#', '.#.', '#.#'],
      ['####', '#..#', '#..#', '####'],
      ['..#..', '.###.', '#####'],
    ]) {
      const sol = grid(rows);
      expect(solveByLines(rowCluesOf(sol), colCluesOf(sol)), rows.join('/')).toEqual(sol);
    }
  });

  it('returns null when two answers fit (it never guesses)', () => {
    // a diagonal: ⧄ and ⧅ both match
    const rc = [[1], [1]], cc = [[1], [1]];
    expect(countSolutions(rc, cc)).toBe(2);
    expect(solveByLines(rc, cc)).toBeNull();
  });

  it('returns null for a puzzle with one answer that needs more than line logic', () => {
    const sol = grid(['#.#.', '...#', '.##.', '...#']);
    const rc = rowCluesOf(sol), cc = colCluesOf(sol);
    expect(rc).toEqual([[1, 1], [1], [2], [1]]);
    expect(cc).toEqual([[1], [1], [1, 1], [1, 1]]);
    expect(countSolutions(rc, cc)).toBe(1);
    expect(solveByLines(rc, cc)).toBeNull();
  });

  it('returns null when the clues clash', () => {
    expect(solveByLines([[2], [0]], [[1], [0]])).toBeNull();
  });

  it('propagate keeps what is known and adds what is forced', () => {
    const sol = grid(['##', '#.']);
    const start: Known[][] = [[-1, -1], [-1, 0]];
    expect(propagate(rowCluesOf(sol), colCluesOf(sol), start)).toEqual([[1, 1], [1, 0]]);
    // the start grid is not changed
    expect(start).toEqual([[-1, -1], [-1, 0]]);
  });
});

describe('hints', () => {
  const sol = grid([
    '.#.#.',
    '#####',
    '#####',
    '.###.',
    '..#..',
  ]);

  it('gives a square that is filled in the picture and not filled yet', () => {
    const b = emptyBoard(5);
    const h = hintCell(b, sol)!;
    expect(h).not.toBeNull();
    expect(sol[h.r][h.c]).toBe(true);
    expect(b[h.r][h.c]).not.toBe(FILLED);
  });

  it('prefers a square one line can tell her now (here: the full rows)', () => {
    const h = hintCell(emptyBoard(5), sol)!;
    expect([1, 2]).toContain(h.r);
  });

  it('filling hint after hint always finishes the picture, even with wrong squares and marks around', () => {
    let b = emptyBoard(5);
    b = fillCell(b, 0, 0); // wrong fill
    b = markCell(b, 4, 2); // wrong mark
    b = markCell(b, 0, 4); // right mark
    for (let i = 0; i < 25; i++) {
      const h = hintCell(b, sol);
      if (!h) break;
      expect(sol[h.r][h.c]).toBe(true);
      expect(b[h.r][h.c]).not.toBe(FILLED);
      b = fillCell(b, h.r, h.c);
    }
    expect(hintCell(b, sol)).toBeNull();
    // only the wrong fill is left
    expect(isSolved(b, sol)).toBe(false);
    expect(wrongCell(b, sol)).toEqual({ r: 0, c: 0 });
    expect(isSolved(clearCell(b, 0, 0), sol)).toBe(true);
    expect(wrongCell(clearCell(b, 0, 0), sol)).toBeNull();
  });

  it('only trusts her correct squares', () => {
    let b = emptyBoard(5);
    b = fillCell(b, 1, 0); // right
    b = fillCell(b, 0, 0); // wrong
    b = markCell(b, 0, 2); // right mark (0,2 is empty)
    b = markCell(b, 2, 2); // wrong mark
    const k = knownFromBoard(b, sol);
    expect(k[1][0]).toBe(1);
    expect(k[0][0]).toBe(-1);
    expect(k[0][2]).toBe(0);
    expect(k[2][2]).toBe(-1);
  });
});

describe('levels and score', () => {
  it('has the three sizes', () => {
    expect(PICTURE_LEVELS.map(l => [l.id, l.size])).toEqual([['small', 5], ['medium', 8], ['big', 10]]);
  });

  it('rewards speed, never below 30 % for time', () => {
    const med = PICTURE_LEVELS[1];
    expect(pictureScore(med, 0, 0)).toBe(500);
    expect(pictureScore(med, 120, 0)).toBe(250);
    expect(pictureScore(med, 99999, 0)).toBe(150);
  });

  it('takes 10 % off per hint, never below half', () => {
    const big = PICTURE_LEVELS[2];
    expect(pictureScore(big, 0, 1)).toBe(630);
    expect(pictureScore(big, 0, 3)).toBe(490);
    expect(pictureScore(big, 0, 5)).toBe(350);
    expect(pictureScore(big, 0, 50)).toBe(350);
    // the lowest possible score is 30 % × 50 %
    expect(pictureScore(big, 99999, 99)).toBe(Math.round(700 * 0.3 * 0.5));
  });

  it('bigger pictures are worth more for the same time', () => {
    const [s, m, b] = PICTURE_LEVELS;
    expect(pictureScore(m, 60, 0)).toBeGreaterThan(pictureScore(s, 60, 0));
    expect(pictureScore(b, 60, 0)).toBeGreaterThan(pictureScore(m, 60, 0));
  });

  it('a good Medium solve is worth about 40 XP at xpScale 9', () => {
    const xp = Math.round(pictureScore(PICTURE_LEVELS[1], 75, 0) / 9);
    expect(xp).toBeGreaterThanOrEqual(35);
    expect(xp).toBeLessThanOrEqual(45);
  });
});

describe('next picture', () => {
  const ids = ['a', 'b', 'c'];
  it('picks the first unsolved one', () => {
    expect(nextPicture(ids, new Set())).toBe('a');
    expect(nextPicture(ids, new Set(['a', 'c']))).toBe('b');
  });
  it('goes round once all are solved', () => {
    const all = new Set(ids);
    expect(nextPicture(ids, all, 'a')).toBe('b');
    expect(nextPicture(ids, all, 'c')).toBe('a');
    expect(nextPicture(ids, all, undefined, () => 0.99)).toBe('c');
    expect(nextPicture(ids, all, 'gone', () => 0)).toBe('a');
  });
});

describe('article', () => {
  it('uses "an" before a vowel', () => {
    expect(article('Owl')).toBe('an');
    expect(article('Ice Cream')).toBe('an');
    expect(article('umbrella')).toBe('an');
    expect(article('Cat')).toBe('a');
    expect(article('Music Note')).toBe('a');
  });
});
