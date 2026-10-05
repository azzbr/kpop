// Zip rules: a path through every square of an N×N grid, visiting the numbers 1, 2, 3… in order.
// Puzzles are generated from a random Hamiltonian path (so they're always solvable), seeded for tests.
import type { Rng } from '../../games/engine/rng';

export interface ZipLevel {
  id: 'easy' | 'medium' | 'tricky' | 'expert';
  name: string;
  size: number;
  /** How many numbered squares (including 1 and the last). */
  numbers: number;
  /** Points for an instant solve; the score drops towards 30 % of this by `par` seconds. */
  base: number;
  par: number;
}

export const ZIP_LEVELS: ZipLevel[] = [
  { id: 'easy', name: 'Easy', size: 4, numbers: 4, base: 300, par: 60 },
  { id: 'medium', name: 'Medium', size: 5, numbers: 6, base: 500, par: 120 },
  { id: 'tricky', name: 'Tricky', size: 6, numbers: 7, base: 700, par: 200 },
  { id: 'expert', name: 'Expert', size: 7, numbers: 8, base: 900, par: 300 },
];

export interface ZipPuzzle {
  size: number;
  /** cell index → number shown on it */
  numbered: Record<number, number>;
  /** One full solution (the path the puzzle was made from). */
  solution: number[];
}

export const isAdjacent = (size: number, a: number, b: number) => {
  const ra = Math.floor(a / size), ca = a % size, rb = Math.floor(b / size), cb = b % size;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
};

function neighbours(size: number, cell: number): number[] {
  const r = Math.floor(cell / size), c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

/**
 * A random path through every cell, by the "backbite" method: start from a snake path, then many
 * times join one end to a neighbour and reverse the loose part. Every step keeps a valid path.
 */
export function randomHamiltonianPath(size: number, rng: Rng): number[] {
  let path: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let k = 0; k < size; k++) path.push(r * size + (r % 2 === 0 ? k : size - 1 - k));
  }
  const moves = size * size * 30;
  for (let m = 0; m < moves; m++) {
    if (rng() < 0.5) path.reverse();
    const head = path[0];
    const ns = neighbours(size, head);
    const n = ns[Math.floor(rng() * ns.length)];
    if (n === path[1]) continue;
    const i = path.indexOf(n);
    path = [...path.slice(0, i).reverse(), ...path.slice(i)];
  }
  return rng() < 0.5 ? path.reverse() : path;
}

/** A puzzle: numbers on the path's first and last cell, and spread out along it in between. */
export function generateZip(level: Pick<ZipLevel, 'size' | 'numbers'>, rng: Rng): ZipPuzzle {
  const { size, numbers } = level;
  const solution = randomHamiltonianPath(size, rng);
  const last = solution.length - 1;
  const idx = [0];
  const segs = numbers - 1;
  for (let k = 1; k < segs; k++) {
    // one waypoint inside each slice of the path, away from the slice edges
    const lo = Math.floor((k * last) / segs - last / segs / 3);
    const hi = Math.floor((k * last) / segs + last / segs / 3);
    idx.push(Math.max(idx[idx.length - 1] + 1, lo + Math.floor(rng() * (hi - lo + 1))));
  }
  idx.push(last);
  const numbered: Record<number, number> = {};
  idx.forEach((i, n) => { numbered[solution[i]] = n + 1; });
  return { size, numbered, solution };
}

export const maxNumber = (p: ZipPuzzle) => Math.max(...Object.values(p.numbered));
const startCell = (p: ZipPuzzle) => Number(Object.keys(p.numbered).find(k => p.numbered[Number(k)] === 1));

export type StepResult = 'start' | 'extend' | 'back' | 'same' | 'bad';

/**
 * One touch on `cell` (a tap, or the finger sliding into it):
 * - empty path: only number 1 starts it
 * - a cell already on the path: the path is cut back to it ('back')
 * - a neighbour of the end: added, if it isn't a number out of order
 */
export function applyStep(p: ZipPuzzle, path: number[], cell: number): { path: number[]; result: StepResult } {
  if (cell < 0 || cell >= p.size * p.size) return { path, result: 'bad' };
  if (path.length === 0) {
    return p.numbered[cell] === 1 ? { path: [cell], result: 'start' } : { path, result: 'bad' };
  }
  const head = path[path.length - 1];
  if (cell === head) return { path, result: 'same' };
  const at = path.indexOf(cell);
  if (at >= 0) return { path: path.slice(0, at + 1), result: 'back' };
  if (!isAdjacent(p.size, head, cell)) return { path, result: 'bad' };
  const n = p.numbered[cell];
  if (n !== undefined && n !== numbersPassed(p, path) + 1) return { path, result: 'bad' };
  return { path: [...path, cell], result: 'extend' };
}

export const numbersPassed = (p: ZipPuzzle, path: number[]) => path.filter(c => p.numbered[c] !== undefined).length;

/** A full, valid answer: every cell once, neighbours each step, numbers in order 1…max. */
export function isSolution(p: ZipPuzzle, path: number[]): boolean {
  const total = p.size * p.size;
  if (path.length !== total || new Set(path).size !== total) return false;
  if (path[0] !== startCell(p)) return false;
  let expect = 1;
  for (let i = 0; i < path.length; i++) {
    if (i > 0 && !isAdjacent(p.size, path[i - 1], path[i])) return false;
    const n = p.numbered[path[i]];
    if (n !== undefined) {
      if (n !== expect) return false;
      expect++;
    }
  }
  return expect === maxNumber(p) + 1;
}

/** Points for a solve: base, falling to 30 % of base at `par` seconds (never lower). */
export function zipScore(level: ZipLevel, seconds: number): number {
  return Math.round(level.base * Math.max(0.3, 1 - seconds / level.par));
}
