// Minesweeper rules for the PuzzleRace engine. Each device plays its own copy of the same
// field locally (no host round trip per tap) and reports progress; the host checks the solve.
import type { Rng } from '../games/engine/rng';

export const MW_LIVES = 3;
export interface MwSpec { rows: number; cols: number; mines: number; ms: number }
export const MW_DIFF: Record<string, MwSpec> = {
  easy: { rows: 6, cols: 6, mines: 6, ms: 150000 },
  medium: { rows: 8, cols: 8, mines: 10, ms: 210000 },
  hard: { rows: 9, cols: 9, mines: 15, ms: 270000 },
  expert: { rows: 10, cols: 10, mines: 22, ms: 330000 },
  master: { rows: 11, cols: 11, mines: 30, ms: 390000 },
  legend: { rows: 12, cols: 12, mines: 40, ms: 450000 },
};
export const mwSpec = (d: string | undefined) => MW_DIFF[d || 'easy'] || MW_DIFF.easy;

export interface MwPuzzle {
  rows: number;
  cols: number;
  mines: number[];
  /** A guaranteed-safe opening (a 0 cell) that everyone starts with. */
  start: number;
}
export interface MwState {
  /** Opened safe cells. */
  open: number[];
  flags: number[];
  /** Mines this player stepped on (each cost a life). */
  booms: number[];
}

export function neighbors(i: number, rows: number, cols: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  return out;
}

/** Clue numbers per cell (-1 = mine). */
export function clues(p: Pick<MwPuzzle, 'rows' | 'cols' | 'mines'>): number[] {
  const mine = new Set(p.mines);
  return Array.from({ length: p.rows * p.cols }, (_, i) =>
    mine.has(i) ? -1 : neighbors(i, p.rows, p.cols).filter(j => mine.has(j)).length);
}

export function mwGenerate(difficulty: string | undefined, rng: Rng): MwPuzzle {
  const spec = mwSpec(difficulty);
  const total = spec.rows * spec.cols;
  for (let guard = 0; guard < 200; guard++) {
    const set = new Set<number>();
    while (set.size < spec.mines) set.add(Math.floor(rng() * total));
    const mines = [...set].sort((a, b) => a - b);
    const cl = clues({ rows: spec.rows, cols: spec.cols, mines });
    const zeros = cl.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
    if (!zeros.length) continue;
    // prefer an opening that clears a decent patch
    let best = zeros[Math.floor(rng() * zeros.length)];
    let bestSize = flood(cl, spec.rows, spec.cols, best).length;
    for (let k = 0; k < 6; k++) {
      const z = zeros[Math.floor(rng() * zeros.length)];
      const size = flood(cl, spec.rows, spec.cols, z).length;
      if (size > bestSize) { best = z; bestSize = size; }
    }
    return { rows: spec.rows, cols: spec.cols, mines, start: best };
  }
  // fallback: mines packed in the bottom rows, open top-left corner
  const mines = Array.from({ length: spec.mines }, (_, k) => total - 1 - k);
  return { rows: spec.rows, cols: spec.cols, mines, start: 0 };
}

/** Cells opened by digging `start` (a 0 opens its neighbours, recursively). */
export function flood(cl: number[], rows: number, cols: number, start: number): number[] {
  if (cl[start] === -1) return [start];
  const out = new Set<number>();
  const stack = [start];
  while (stack.length) {
    const i = stack.pop() as number;
    if (out.has(i)) continue;
    out.add(i);
    if (cl[i] === 0) for (const j of neighbors(i, rows, cols)) if (!out.has(j) && cl[j] !== -1) stack.push(j);
  }
  return [...out];
}

export const mwInit = (p: MwPuzzle): MwState => ({
  open: flood(clues(p), p.rows, p.cols, p.start).sort((a, b) => a - b),
  flags: [],
  booms: [],
});

export const mwLives = (s: MwState) => Math.max(0, MW_LIVES - s.booms.length);
export const mwSafeCount = (p: MwPuzzle) => p.rows * p.cols - p.mines.length;
export const mwSolved = (p: MwPuzzle, s: MwState) => s.open.length >= mwSafeCount(p);
export const mwFailed = (_p: MwPuzzle, s: MwState) => mwLives(s) <= 0;
export const mwProgress = (p: MwPuzzle, s: MwState) => Math.min(1, s.open.length / mwSafeCount(p));

/** Digs a cell: opens the safe region, or costs a life on a mine. */
export function mwDig(p: MwPuzzle, s: MwState, i: number, cl = clues(p)): MwState {
  if (i < 0 || i >= cl.length || s.open.includes(i) || s.booms.includes(i) || s.flags.includes(i)) return s;
  if (cl[i] === -1) return { ...s, booms: [...s.booms, i] };
  const open = new Set(s.open);
  for (const j of flood(cl, p.rows, p.cols, i)) open.add(j);
  return { ...s, open: [...open].sort((a, b) => a - b), flags: s.flags.filter(f => !open.has(f)) };
}

export function mwToggleFlag(s: MwState, i: number): MwState {
  if (s.open.includes(i) || s.booms.includes(i)) return s;
  return { ...s, flags: s.flags.includes(i) ? s.flags.filter(f => f !== i) : [...s.flags, i] };
}

/** Host check: the opened cells are exactly all the safe cells. */
export function mwCheck(p: MwPuzzle, open: unknown): boolean {
  if (!Array.isArray(open)) return false;
  const mine = new Set(p.mines);
  const set = new Set(open as number[]);
  for (const i of set) if (mine.has(i) || !Number.isInteger(i) || i < 0 || i >= p.rows * p.cols) return false;
  return set.size === mwSafeCount(p);
}
