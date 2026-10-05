// Mini Sudoku (6×6, boxes 2 rows × 3 columns, numbers 1–6).
// Puzzles are made by removing numbers from a full grid only while exactly one solution remains.
import type { Rng } from '../../games/engine/rng';

export const N = 6;
export const BOX_H = 2;
export const BOX_W = 3;
export type Grid = number[][]; // 0 = empty

export interface SudokuLevel {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  /** Numbers left on the board (fewer = harder). Removal stops early if uniqueness would break. */
  givens: number;
  base: number;
  par: number;
}

export const SUDOKU_LEVELS: SudokuLevel[] = [
  { id: 'easy', name: 'Easy', givens: 22, base: 300, par: 400 },
  { id: 'medium', name: 'Medium', givens: 17, base: 500, par: 600 },
  { id: 'hard', name: 'Hard', givens: 13, base: 700, par: 900 },
];

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const basePattern = (r: number, c: number) => (BOX_W * (r % BOX_H) + Math.floor(r / BOX_H) + c) % N;

/** A random full grid: a valid pattern with digits, bands, rows-in-bands, stacks and columns shuffled. */
export function generateSolution(rng: Rng): Grid {
  const digits = shuffle([1, 2, 3, 4, 5, 6], rng);
  const rowOrder = shuffle([0, 1, 2], rng).flatMap(b => shuffle([b * 2, b * 2 + 1], rng));
  const colOrder = shuffle([0, 1], rng).flatMap(s => shuffle([s * 3, s * 3 + 1, s * 3 + 2], rng));
  return rowOrder.map(r => colOrder.map(c => digits[basePattern(r, c)]));
}

export function canPlace(g: Grid, r: number, c: number, v: number): boolean {
  for (let i = 0; i < N; i++) if (g[r][i] === v || g[i][c] === v) return false;
  const br = r - (r % BOX_H), bc = c - (c % BOX_W);
  for (let i = 0; i < BOX_H; i++) for (let j = 0; j < BOX_W; j++) if (g[br + i][bc + j] === v) return false;
  return true;
}

/** Counts solutions by backtracking, stopping at `limit` (2 is enough to know "not unique"). */
export function countSolutions(grid: Grid, limit = 2): number {
  if (findConflicts(grid).size) return 0;
  const g = grid.map(row => [...row]);
  let count = 0;
  const rec = (): void => {
    // the empty cell with the fewest options first — keeps it fast
    let bestR = -1, bestC = -1, bestOpts: number[] = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (g[r][c]) continue;
        const opts = [1, 2, 3, 4, 5, 6].filter(v => canPlace(g, r, c, v));
        if (bestR < 0 || opts.length < bestOpts.length) { bestR = r; bestC = c; bestOpts = opts; }
        if (opts.length === 0) return;
      }
    }
    if (bestR < 0) { count++; return; }
    for (const v of bestOpts) {
      g[bestR][bestC] = v;
      rec();
      g[bestR][bestC] = 0;
      if (count >= limit) return;
    }
  };
  rec();
  return count;
}

export function makePuzzle(level: Pick<SudokuLevel, 'givens'>, rng: Rng): { puzzle: Grid; solution: Grid } {
  const solution = generateSolution(rng);
  const puzzle = solution.map(row => [...row]);
  let left = N * N;
  for (const k of shuffle(Array.from({ length: N * N }, (_, i) => i), rng)) {
    if (left <= level.givens) break;
    const r = Math.floor(k / N), c = k % N;
    const keep = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[r][c] = keep;
    else left--;
  }
  return { puzzle, solution };
}

/** "r-c" keys of numbers that clash with another in the same row, column or box. */
export function findConflicts(grid: Grid): Set<string> {
  const bad = new Set<string>();
  const mark = (cells: [number, number][]) => {
    const seen: Record<number, [number, number][]> = {};
    for (const [r, c] of cells) {
      const v = grid[r][c];
      if (v) (seen[v] ||= []).push([r, c]);
    }
    for (const group of Object.values(seen)) if (group.length > 1) group.forEach(([r, c]) => bad.add(`${r}-${c}`));
  };
  for (let r = 0; r < N; r++) mark(Array.from({ length: N }, (_, c) => [r, c] as [number, number]));
  for (let c = 0; c < N; c++) mark(Array.from({ length: N }, (_, r) => [r, c] as [number, number]));
  for (let br = 0; br < N; br += BOX_H) {
    for (let bc = 0; bc < N; bc += BOX_W) {
      const cells: [number, number][] = [];
      for (let r = 0; r < BOX_H; r++) for (let c = 0; c < BOX_W; c++) cells.push([br + r, bc + c]);
      mark(cells);
    }
  }
  return bad;
}

export const isSolvedGrid = (g: Grid) => g.every(row => row.every(v => v !== 0)) && findConflicts(g).size === 0;

/** Points for a solve: base, falling to 25 % of base at `par` seconds (never lower). */
export function sudokuScore(level: SudokuLevel, seconds: number): number {
  return Math.round(level.base * Math.max(0.25, 1 - seconds / level.par));
}
