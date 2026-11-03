// Light Up rules: put lamps on white squares so every white square is lit. A lamp shines along its
// row and column until it reaches a wall or the edge. Two lamps may never shine on each other, and a
// wall with a number must touch exactly that many lamps (up / down / left / right).
// Puzzles are built from a lamp layout first, so they're always solvable. Seeded, for tests and "Level n".
import type { Rng } from '../../games/engine/rng';

export interface LightUpLevel {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  size: number;
  /** Points for an instant solve; the score drops towards 30 % of this by `par` seconds. */
  base: number;
  par: number;
}

export const LIGHTUP_LEVELS: LightUpLevel[] = [
  { id: 'easy', name: 'Easy', size: 6, base: 300, par: 90 },
  { id: 'medium', name: 'Medium', size: 8, base: 500, par: 240 },
  { id: 'hard', name: 'Hard', size: 10, base: 700, par: 420 },
];

export interface LightUpPuzzle {
  size: number;
  /** Wall cell → the number on it (0–4), or null for a plain wall. Cells not listed are white. */
  walls: Record<number, number | null>;
  /** One full answer (the lamps the puzzle was made from). Any other valid answer counts too. */
  solution: number[];
}

/** What she has put on a white square: a lamp, or a dot ("no lamp here" note). */
export type Mark = 'lamp' | 'dot';
/** A numbered wall: exactly right, too many lamps touching it, or still too few. */
export type WallState = 'ok' | 'tooMany' | 'tooFew';

const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const isWall = (p: Pick<LightUpPuzzle, 'walls'>, cell: number) => p.walls[cell] !== undefined;

/** Up / down / left / right neighbours inside the grid. */
export function neighbours(size: number, cell: number): number[] {
  const r = Math.floor(cell / size), c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

/** The white squares a lamp on `cell` shines on (not counting its own square): each way until a wall or the edge. */
export function seenFrom(p: LightUpPuzzle, cell: number): number[] {
  const { size } = p;
  const r0 = Math.floor(cell / size), c0 = cell % size;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < size && c >= 0 && c < size) {
      const k = r * size + c;
      if (isWall(p, k)) break;
      out.push(k);
      r += dr; c += dc;
    }
  }
  return out;
}

const onBoard = (p: LightUpPuzzle, cell: number) => Number.isInteger(cell) && cell >= 0 && cell < p.size * p.size;
const realLamps = (p: LightUpPuzzle, lamps: Iterable<number>) =>
  [...new Set(lamps)].filter(c => onBoard(p, c) && !isWall(p, c));

export const whiteCells = (p: LightUpPuzzle): number[] =>
  Array.from({ length: p.size * p.size }, (_, c) => c).filter(c => !isWall(p, c));

/** Every white square that is lit: the lamps' own squares and everything they shine on. */
export function litCells(p: LightUpPuzzle, lamps: Iterable<number>): Set<number> {
  const lit = new Set<number>();
  for (const l of realLamps(p, lamps)) {
    lit.add(l);
    for (const k of seenFrom(p, l)) lit.add(k);
  }
  return lit;
}

/** The lamps that shine on another lamp (both of each pair). Walls block the light between them. */
export function clashes(p: LightUpPuzzle, lamps: Iterable<number>): Set<number> {
  const list = realLamps(p, lamps);
  const set = new Set(list);
  const out = new Set<number>();
  for (const l of list) {
    for (const k of seenFrom(p, l)) {
      if (set.has(k)) { out.add(l); out.add(k); }
    }
  }
  return out;
}

/** How many lamps touch a wall (up / down / left / right). */
export function lampsTouching(p: LightUpPuzzle, lamps: Iterable<number>, wall: number): number {
  const set = new Set(realLamps(p, lamps));
  return neighbours(p.size, wall).filter(n => set.has(n)).length;
}

/** Each numbered wall's state. Plain walls aren't listed. */
export function wallStatus(p: LightUpPuzzle, lamps: Iterable<number>): Record<number, WallState> {
  const list = realLamps(p, lamps);
  const out: Record<number, WallState> = {};
  for (const [key, n] of Object.entries(p.walls)) {
    if (n === null) continue;
    const have = lampsTouching(p, list, Number(key));
    out[Number(key)] = have === n ? 'ok' : have > n ? 'tooMany' : 'tooFew';
  }
  return out;
}

/** A full, valid answer: lamps only on white squares, every white square lit, no clashes, every number exact. */
export function isSolved(p: LightUpPuzzle, lamps: Iterable<number>): boolean {
  const raw = [...lamps];
  if (raw.some(c => !onBoard(p, c) || isWall(p, c))) return false;
  const lit = litCells(p, raw);
  if (whiteCells(p).some(c => !lit.has(c))) return false;
  if (clashes(p, raw).size > 0) return false;
  return Object.values(wallStatus(p, raw)).every(s => s === 'ok');
}

/** One tap on a white square: empty → 💡 lamp → • dot → empty. */
export const cycleMark = (m: Mark | undefined): Mark | undefined => (m === undefined ? 'lamp' : m === 'lamp' ? 'dot' : undefined);

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * After turning `changed` into walls: no row or column is all walls, and no white square is shut in
 * on all four sides (it would just be a free lamp).
 */
function wallsStillFine(size: number, wall: boolean[], changed: number[]): boolean {
  for (const cell of changed) {
    const r = Math.floor(cell / size), c = cell % size;
    let rowAll = true, colAll = true;
    for (let k = 0; k < size; k++) {
      if (!wall[r * size + k]) rowAll = false;
      if (!wall[k * size + c]) colAll = false;
    }
    if (rowAll || colAll) return false;
    for (const n of neighbours(size, cell)) {
      if (!wall[n] && neighbours(size, n).every(m => wall[m])) return false;
    }
  }
  return true;
}

/**
 * A new puzzle:
 * 1. walls on about 18–22 % of the squares, in mirror pairs (180° turn) so the board looks tidy;
 * 2. lamps placed one at a time on a random square that is still dark, until everything is lit —
 *    a dark square can't be seen by any lamp, so a lamp there never clashes;
 * 3. numbers (how many of those lamps touch it) on about 60–70 % of the walls.
 */
export function generateLightUp(level: Pick<LightUpLevel, 'size'>, rng: Rng): LightUpPuzzle {
  const { size } = level;
  const total = size * size;
  const wall: boolean[] = new Array(total).fill(false);

  const targetWalls = 2 * Math.round((total * (0.18 + rng() * 0.04)) / 2);
  const firstOfPair = shuffle(Array.from({ length: total }, (_, c) => c).filter(c => c <= total - 1 - c), rng);
  let count = 0;
  for (const c of firstOfPair) {
    if (count >= targetWalls) break;
    const m = total - 1 - c;
    const pair = c === m ? [c] : [c, m];
    for (const k of pair) wall[k] = true;
    if (wallsStillFine(size, wall, pair)) count += pair.length;
    else for (const k of pair) wall[k] = false;
  }

  const walls: Record<number, number | null> = {};
  for (let c = 0; c < total; c++) if (wall[c]) walls[c] = null;
  const puzzle: LightUpPuzzle = { size, walls, solution: [] };

  const lit = new Set<number>();
  const lamps: number[] = [];
  const whites = whiteCells(puzzle);
  for (;;) {
    const dark = whites.filter(c => !lit.has(c));
    if (dark.length === 0) break;
    const c = dark[Math.floor(rng() * dark.length)];
    lamps.push(c);
    lit.add(c);
    for (const k of seenFrom(puzzle, c)) lit.add(k);
  }

  const wallList = shuffle(Object.keys(walls).map(Number), rng);
  const numbered = Math.round(wallList.length * (0.6 + rng() * 0.1));
  for (const w of wallList.slice(0, numbered)) walls[w] = lampsTouching(puzzle, lamps, w);

  puzzle.solution = lamps.sort((a, b) => a - b);
  return puzzle;
}

/** A stable seed for "Level n" of a difficulty, so Level 3 is always the same puzzle (FNV-1a hash). */
export function levelSeed(levelId: string, n: number): number {
  const s = `lightup:${levelId}:${n}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Points for a solve: base, falling to 30 % of base at `par` seconds (never lower). */
export function lightUpScore(level: LightUpLevel, seconds: number): number {
  return Math.round(level.base * Math.max(0.3, 1 - seconds / level.par));
}
