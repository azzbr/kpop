// 2048 — pure rules, no React. Tiles keep an id so the component can animate them sliding.
//
// Rules (standard 2048):
// - 4×4 board. A move slides every tile as far as it goes in one direction.
// - Two equal tiles that meet merge into one with double the value; the merged value is added
//   to the score. A tile can only merge once per move ([2,2,2,2] → [4,4], not [8]).
// - Merging starts from the side the tiles move towards ([2,2,2] moving left → [4,2]).
// - If anything moved, one new tile appears on an empty cell: 2 (90%) or 4 (10%).
// - The game is over when the board is full and no two neighbours are equal.

import type { Rng } from '../../games/engine/rng';

export const SIZE = 4;
export const WIN_VALUE = 2048;

/** 0 = up, 1 = right, 2 = down, 3 = left (same as SwipeDir). */
export type Dir2048 = 0 | 1 | 2 | 3;

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  /** True for one move after it was spawned (pop-in animation). */
  isNew?: boolean;
  /** True for one move after it was made by a merge (bump animation). */
  merged?: boolean;
  /** Merged away: still drawn sliding into its partner for one move, then removed. */
  gone?: boolean;
}

export interface Board2048 {
  tiles: Tile[];
  score: number;
  nextId: number;
  /** The biggest tile so far. */
  best: number;
  moves: number;
}

/** Slides one line towards index 0. Returns the new values and points gained. */
export function slideLine(line: number[]): { line: number[]; gained: number } {
  const vals = line.filter(v => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
      out.push(vals[i] * 2);
      gained += vals[i] * 2;
      i++;
    } else {
      out.push(vals[i]);
    }
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained };
}

export function emptyBoard(): Board2048 {
  return { tiles: [], score: 0, nextId: 1, best: 0, moves: 0 };
}

/** The values as a 4×4 grid (0 = empty). Ignores merged-away tiles. */
export function toGrid(b: Board2048): number[][] {
  const g = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
  for (const t of b.tiles) if (!t.gone) g[t.row][t.col] = t.value;
  return g;
}

/** Builds a board from a grid of values (for tests and debugging). */
export function fromGrid(grid: number[][], score = 0): Board2048 {
  const b = emptyBoard();
  b.score = score;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (v) {
        b.tiles.push({ id: b.nextId++, value: v, row: r, col: c });
        b.best = Math.max(b.best, v);
      }
    }
  }
  return b;
}

/** Adds a tile on a random empty cell: 2 (90%) or 4 (10%). Mutates and returns the board. */
export function spawnTile(b: Board2048, rng: Rng): Board2048 {
  const grid = toGrid(b);
  const empty: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empty.push([r, c]);
  if (!empty.length) return b;
  const [row, col] = empty[Math.floor(rng() * empty.length)];
  const value = rng() < 0.9 ? 2 : 4;
  b.tiles.push({ id: b.nextId++, value, row, col, isNew: true });
  b.best = Math.max(b.best, value);
  return b;
}

export function newGame(rng: Rng): Board2048 {
  const b = emptyBoard();
  spawnTile(b, rng);
  spawnTile(b, rng);
  return b;
}

/** Cells of line `i` in the order tiles travel towards (index 0 = the wall they slide to). */
function lineCells(dir: Dir2048, i: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let k = 0; k < SIZE; k++) {
    if (dir === 0) cells.push([k, i]);
    else if (dir === 2) cells.push([SIZE - 1 - k, i]);
    else if (dir === 3) cells.push([i, k]);
    else cells.push([i, SIZE - 1 - k]);
  }
  return cells;
}

export interface MoveResult {
  board: Board2048;
  moved: boolean;
  gained: number;
  /** Values made by merges this move (for sounds/celebrations). */
  mergedValues: number[];
}

/**
 * Slides the board. Returns a NEW board (the old one is untouched, so it can be kept for Undo).
 * If nothing moved, no tile is spawned and `moved` is false.
 */
export function move(b: Board2048, dir: Dir2048, rng: Rng): MoveResult {
  const live = b.tiles.filter(t => !t.gone);
  const at = new Map<string, Tile>();
  for (const t of live) at.set(`${t.row},${t.col}`, t);

  const next: Tile[] = [];
  let nextId = b.nextId;
  let moved = false;
  let gained = 0;
  const mergedValues: number[] = [];

  for (let i = 0; i < SIZE; i++) {
    const cells = lineCells(dir, i);
    const line = cells.map(([r, c]) => at.get(`${r},${c}`)).filter((t): t is Tile => !!t);
    let target = 0;
    for (let k = 0; k < line.length; k++) {
      const [row, col] = cells[target];
      const a = line[k];
      const c = line[k + 1];
      if (c && c.value === a.value) {
        // Both slide into the target cell; a fresh tile with the doubled value replaces them.
        next.push({ ...a, row, col, gone: true, isNew: false, merged: false });
        next.push({ ...c, row, col, gone: true, isNew: false, merged: false });
        next.push({ id: nextId++, value: a.value * 2, row, col, merged: true });
        gained += a.value * 2;
        mergedValues.push(a.value * 2);
        moved = true;
        k++;
      } else {
        if (a.row !== row || a.col !== col) moved = true;
        next.push({ ...a, row, col, isNew: false, merged: false });
      }
      target++;
    }
  }

  if (!moved) return { board: b, moved: false, gained: 0, mergedValues: [] };

  const board: Board2048 = {
    tiles: next,
    score: b.score + gained,
    nextId,
    best: Math.max(b.best, ...mergedValues, 0),
    moves: b.moves + 1,
  };
  spawnTile(board, rng);
  return { board, moved: true, gained, mergedValues };
}

/** True when at least one move would change the board. */
export function canMove(b: Board2048): boolean {
  const g = toGrid(b);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!g[r][c]) return true;
      if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
      if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
    }
  }
  return false;
}

export const isGameOver = (b: Board2048) => !canMove(b);

/** Board colours for each value — bright, readable on the dark arcade background. */
export const TILE_STYLE: Record<number, { bg: string; fg: string }> = {
  2: { bg: '#fdf2f8', fg: '#581c87' },
  4: { bg: '#fbcfe8', fg: '#581c87' },
  8: { bg: '#fb923c', fg: '#fff' },
  16: { bg: '#f97316', fg: '#fff' },
  32: { bg: '#f43f5e', fg: '#fff' },
  64: { bg: '#e11d48', fg: '#fff' },
  128: { bg: '#facc15', fg: '#422006' },
  256: { bg: '#eab308', fg: '#422006' },
  512: { bg: '#a3e635', fg: '#1a2e05' },
  1024: { bg: '#22d3ee', fg: '#083344' },
  2048: { bg: '#d946ef', fg: '#fff' },
};
export const tileStyle = (v: number) => TILE_STYLE[v] ?? { bg: '#7c3aed', fg: '#fff' };
