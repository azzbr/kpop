// Block Blast — pure rules, no React.
//
// Rules:
// - 8×8 board. You get 3 pieces at a time; drag each one onto the board (no rotating).
// - A piece fits if every square lands on an empty cell inside the board.
// - After a placement, every full row AND every full column clears at the same time
//   (a cell where a full row and a full column cross is cleared once, both lines count).
// - Points: +1 per square placed, plus 10 per cleared line × the combo multiplier.
//   The combo goes up by 1 each time placements in a row clear lines (1×, 2×, 3×…), and resets
//   to 0 after a placement that clears nothing.
// - When all 3 pieces are used, 3 new ones are dealt.
// - Game over when none of the pieces left in the tray fit anywhere.

import type { Rng } from '../../games/engine/rng';

export const BOARD = 8;
export const LINE_POINTS = 10;

/** A piece's squares as [row, col] offsets from its top-left corner. */
export type Shape = [number, number][];

export interface Piece {
  id: number;
  shape: Shape;
  color: number; // index into COLORS (1-based; 0 = empty on the board)
}

export interface BlastState {
  /** BOARD×BOARD cells, row-major; 0 = empty, otherwise a colour index. */
  board: number[];
  /** The tray: 3 slots, null once a piece has been placed. */
  tray: (Piece | null)[];
  score: number;
  combo: number;
  bestCombo: number;
  lines: number;
  nextId: number;
}

export const COLORS = ['', '#f43f5e', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];

// ─── Shapes ─────────────────────────────────────────────────────────────────

/** Parses a little picture like "XX\n.X" into a shape. */
function art(s: string): Shape {
  const out: Shape = [];
  s.split('\n').forEach((line, r) => [...line].forEach((ch, c) => { if (ch === 'X') out.push([r, c]); }));
  return out;
}

function normalize(shape: Shape): Shape {
  const minR = Math.min(...shape.map(p => p[0]));
  const minC = Math.min(...shape.map(p => p[1]));
  return shape.map(([r, c]) => [r - minR, c - minC] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const rotate = (shape: Shape): Shape => normalize(shape.map(([r, c]) => [c, -r] as [number, number]));
const key = (shape: Shape) => shape.map(p => p.join(',')).join(';');

/** Every distinct rotation of a shape. */
function rotations(shape: Shape): Shape[] {
  const out: Shape[] = [];
  let s = normalize(shape);
  for (let i = 0; i < 4; i++) {
    if (!out.some(o => key(o) === key(s))) out.push(s);
    s = rotate(s);
  }
  return out;
}

/** Base shapes with how often they're dealt (bigger number = more common). */
const BASE: { art: string; weight: number }[] = [
  { art: 'X', weight: 2 },
  { art: 'XX', weight: 3 },
  { art: 'XXX', weight: 3 },
  { art: 'XXXX', weight: 2 },
  { art: 'XXXXX', weight: 1.5 },
  { art: 'XX\nXX', weight: 3 },
  { art: 'XXX\nXXX\nXXX', weight: 1 },
  { art: 'XX\nX.', weight: 2.5 }, // small corner
  { art: 'X.\nX.\nXX', weight: 2 }, // L
  { art: '.X\n.X\nXX', weight: 2 }, // J
  { art: 'X..\nX..\nXXX', weight: 1 }, // big corner
  { art: 'XXX\n.X.', weight: 2 }, // T
  { art: '.XX\nXX.', weight: 1.5 }, // S
  { art: 'XX.\n.XX', weight: 1.5 }, // Z
  { art: 'XX\nXX\nXX', weight: 1 }, // 2×3 block
];

/** The full deck: every rotation of every base shape, each with the base's weight shared out. */
export const SHAPES: { shape: Shape; weight: number }[] = BASE.flatMap(b => {
  const rots = rotations(art(b.art));
  return rots.map(shape => ({ shape, weight: b.weight / rots.length }));
});

export const shapeSize = (shape: Shape) => ({
  rows: Math.max(...shape.map(p => p[0])) + 1,
  cols: Math.max(...shape.map(p => p[1])) + 1,
});

// ─── Board helpers ──────────────────────────────────────────────────────────

export const emptyBoard = () => Array<number>(BOARD * BOARD).fill(0);

/** Builds a board from rows like "XX......" (X = filled). For tests. */
export function boardFrom(rows: string[]): number[] {
  const b = emptyBoard();
  rows.forEach((line, r) => [...line].forEach((ch, c) => { if (ch !== '.') b[r * BOARD + c] = 1; }));
  return b;
}

/** True if the shape fits with its top-left corner at (row, col). */
export function canPlace(board: number[], shape: Shape, row: number, col: number): boolean {
  for (const [dr, dc] of shape) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || c < 0 || r >= BOARD || c >= BOARD) return false;
    if (board[r * BOARD + c]) return false;
  }
  return true;
}

/** True if the shape fits anywhere on the board. */
export function fitsAnywhere(board: number[], shape: Shape): boolean {
  const { rows, cols } = shapeSize(shape);
  for (let r = 0; r + rows <= BOARD; r++) for (let c = 0; c + cols <= BOARD; c++) if (canPlace(board, shape, r, c)) return true;
  return false;
}

/** Full rows and columns on a board. */
export function fullLines(board: number[]): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < BOARD; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < BOARD; j++) {
      if (!board[i * BOARD + j]) rowFull = false;
      if (!board[j * BOARD + i]) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
  }
  return { rows, cols };
}

// ─── Game flow ──────────────────────────────────────────────────────────────

function pickShape(rng: Rng): Shape {
  const total = SHAPES.reduce((s, x) => s + x.weight, 0);
  let t = rng() * total;
  for (const s of SHAPES) {
    t -= s.weight;
    if (t <= 0) return s.shape;
  }
  return SHAPES[SHAPES.length - 1].shape;
}

/**
 * Deals 3 new pieces. To keep it fair, it re-rolls a few times so at least one of them fits
 * (it can still end the game on a very full board — that's the challenge).
 */
export function deal(state: BlastState, rng: Rng): BlastState {
  let tray: Piece[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    tray = [0, 1, 2].map(i => ({ id: state.nextId + i, shape: pickShape(rng), color: 1 + Math.floor(rng() * (COLORS.length - 1)) }));
    if (tray.some(p => fitsAnywhere(state.board, p.shape))) break;
  }
  return { ...state, tray, nextId: state.nextId + 3 };
}

export function newGame(rng: Rng): BlastState {
  return deal({ board: emptyBoard(), tray: [null, null, null], score: 0, combo: 0, bestCombo: 0, lines: 0, nextId: 1 }, rng);
}

export interface PlaceResult {
  state: BlastState;
  ok: boolean;
  /** Cells that were cleared, with their colour before clearing (for the burst animation). */
  cleared: { index: number; color: number }[];
  clearedRows: number[];
  clearedCols: number[];
  gained: number;
  /** True when this placement used up the tray and 3 new pieces were dealt. */
  dealt: boolean;
}

/** Places tray piece `slot` with its top-left at (row, col). Returns a new state; the old one is untouched. */
export function place(state: BlastState, slot: number, row: number, col: number, rng: Rng): PlaceResult {
  const piece = state.tray[slot];
  const fail: PlaceResult = { state, ok: false, cleared: [], clearedRows: [], clearedCols: [], gained: 0, dealt: false };
  if (!piece || !canPlace(state.board, piece.shape, row, col)) return fail;

  const board = state.board.slice();
  for (const [dr, dc] of piece.shape) board[(row + dr) * BOARD + col + dc] = piece.color;

  const { rows, cols } = fullLines(board);
  const clearSet = new Set<number>();
  for (const r of rows) for (let c = 0; c < BOARD; c++) clearSet.add(r * BOARD + c);
  for (const c of cols) for (let r = 0; r < BOARD; r++) clearSet.add(r * BOARD + c);
  const cleared = [...clearSet].map(index => ({ index, color: board[index] }));
  for (const i of clearSet) board[i] = 0;

  const lineCount = rows.length + cols.length;
  const combo = lineCount ? state.combo + 1 : 0;
  const gained = piece.shape.length + lineCount * LINE_POINTS * combo;
  const tray = state.tray.slice();
  tray[slot] = null;

  let next: BlastState = {
    ...state,
    board,
    tray,
    score: state.score + gained,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    lines: state.lines + lineCount,
  };
  const dealt = tray.every(p => p === null);
  if (dealt) next = deal(next, rng);
  return { state: next, ok: true, cleared, clearedRows: rows, clearedCols: cols, gained, dealt };
}

/** Game over when none of the pieces left in the tray fit anywhere. */
export function isGameOver(state: BlastState): boolean {
  const left = state.tray.filter((p): p is Piece => p !== null);
  return left.length > 0 && !left.some(p => fitsAnywhere(state.board, p.shape));
}
