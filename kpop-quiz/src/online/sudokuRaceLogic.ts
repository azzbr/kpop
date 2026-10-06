// Sudoku Race rules for the PuzzleRace engine: 4×4 (2×2 boxes) and 6×6 (2×3 boxes).
// (components/games/sudokuLogic.ts is 6×6 only.) Numbers are removed from a full grid only
// while the puzzle still has exactly one solution.
import type { Rng } from '../games/engine/rng';

export interface SkSpec { n: number; boxR: number; boxC: number; remove: number; ms: number }
export const SK_DIFF: Record<string, SkSpec> = {
  easy: { n: 4, boxR: 2, boxC: 2, remove: 6, ms: 150000 },
  medium: { n: 4, boxR: 2, boxC: 2, remove: 9, ms: 180000 },
  hard: { n: 6, boxR: 2, boxC: 3, remove: 16, ms: 300000 },
  expert: { n: 6, boxR: 2, boxC: 3, remove: 22, ms: 360000 },
  master: { n: 6, boxR: 2, boxC: 3, remove: 26, ms: 420000 },
  legend: { n: 6, boxR: 2, boxC: 3, remove: 28, ms: 480000 },
};
export const skSpec = (d: string | undefined) => SK_DIFF[d || 'easy'] || SK_DIFF.easy;

/** Flat grids, row by row; 0 = empty. */
export interface SkPuzzle { n: number; boxR: number; boxC: number; givens: number[] }
export interface SkState { grid: number[] }
type Shape = Pick<SkPuzzle, 'n' | 'boxR' | 'boxC'>;

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A random full grid: a valid base pattern with digits, bands, rows, stacks and columns shuffled. */
export function fullGrid(sh: Shape, rng: Rng): number[] {
  const { n, boxR, boxC } = sh;
  const digits = shuffle(Array.from({ length: n }, (_, i) => i + 1), rng);
  const bands = n / boxR, stacks = n / boxC;
  const rowOrder = shuffle(Array.from({ length: bands }, (_, b) => b), rng)
    .flatMap(b => shuffle(Array.from({ length: boxR }, (_, k) => b * boxR + k), rng));
  const colOrder = shuffle(Array.from({ length: stacks }, (_, s) => s), rng)
    .flatMap(s => shuffle(Array.from({ length: boxC }, (_, k) => s * boxC + k), rng));
  const base = (r: number, c: number) => (boxC * (r % boxR) + Math.floor(r / boxR) + c) % n;
  return rowOrder.flatMap(r => colOrder.map(c => digits[base(r, c)]));
}

function canPlace(g: number[], sh: Shape, r: number, c: number, v: number): boolean {
  const { n, boxR, boxC } = sh;
  for (let i = 0; i < n; i++) if (g[r * n + i] === v || g[i * n + c] === v) return false;
  const br = r - (r % boxR), bc = c - (c % boxC);
  for (let i = 0; i < boxR; i++) for (let j = 0; j < boxC; j++) if (g[(br + i) * n + bc + j] === v) return false;
  return true;
}

/** Indices of numbers that clash with another in the same row, column or box. */
export function conflicts(g: number[], sh: Shape): Set<number> {
  const { n, boxR, boxC } = sh;
  const bad = new Set<number>();
  const groups: number[][] = [];
  for (let i = 0; i < n; i++) {
    groups.push(Array.from({ length: n }, (_, j) => i * n + j));
    groups.push(Array.from({ length: n }, (_, j) => j * n + i));
  }
  for (let br = 0; br < n; br += boxR)
    for (let bc = 0; bc < n; bc += boxC) {
      const cells: number[] = [];
      for (let i = 0; i < boxR; i++) for (let j = 0; j < boxC; j++) cells.push((br + i) * n + bc + j);
      groups.push(cells);
    }
  for (const cells of groups) {
    const seen: Record<number, number[]> = {};
    for (const i of cells) if (g[i]) (seen[g[i]] ||= []).push(i);
    for (const list of Object.values(seen)) if (list.length > 1) list.forEach(i => bad.add(i));
  }
  return bad;
}

/** Number of solutions, stopping at `limit`. */
export function countSolutions(grid: number[], sh: Shape, limit = 2): number {
  if (conflicts(grid, sh).size) return 0;
  const { n } = sh;
  const g = [...grid];
  let count = 0;
  const rec = (): void => {
    let best = -1, bestOpts: number[] = [];
    for (let i = 0; i < n * n; i++) {
      if (g[i]) continue;
      const opts: number[] = [];
      for (let v = 1; v <= n; v++) if (canPlace(g, sh, Math.floor(i / n), i % n, v)) opts.push(v);
      if (!opts.length) return;
      if (best < 0 || opts.length < bestOpts.length) { best = i; bestOpts = opts; }
    }
    if (best < 0) { count++; return; }
    for (const v of bestOpts) {
      g[best] = v;
      rec();
      g[best] = 0;
      if (count >= limit) return;
    }
  };
  rec();
  return count;
}

export function skGenerate(difficulty: string | undefined, rng: Rng): SkPuzzle {
  const spec = skSpec(difficulty);
  const sh = { n: spec.n, boxR: spec.boxR, boxC: spec.boxC };
  const givens = fullGrid(sh, rng);
  let removed = 0;
  for (const k of shuffle(Array.from({ length: givens.length }, (_, i) => i), rng)) {
    if (removed >= spec.remove) break;
    const keep = givens[k];
    givens[k] = 0;
    if (countSolutions(givens, sh, 2) !== 1) givens[k] = keep;
    else removed++;
  }
  return { ...sh, givens };
}

export const skInit = (p: SkPuzzle): SkState => ({ grid: [...p.givens] });
export const skSolved = (p: SkPuzzle, s: SkState) => s.grid.every(v => v > 0) && conflicts(s.grid, p).size === 0;

/** Host check: a full, clash-free grid that keeps every given number. */
export function skCheck(p: SkPuzzle, grid: unknown): boolean {
  if (!Array.isArray(grid) || grid.length !== p.n * p.n) return false;
  if (!grid.every(v => Number.isInteger(v) && v >= 1 && v <= p.n)) return false;
  if (!p.givens.every((v, i) => v === 0 || grid[i] === v)) return false;
  return conflicts(grid as number[], p).size === 0;
}

export function skProgress(p: SkPuzzle, s: SkState): number {
  if (skSolved(p, s)) return 1;
  const empties = p.givens.filter(v => v === 0).length || 1;
  const bad = conflicts(s.grid, p);
  const good = s.grid.filter((v, i) => p.givens[i] === 0 && v > 0 && !bad.has(i)).length;
  return Math.min(0.95, good / empties);
}
