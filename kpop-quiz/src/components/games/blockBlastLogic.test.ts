import { describe, it, expect } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  BOARD, LINE_POINTS, SHAPES, boardFrom, canPlace, emptyBoard, fitsAnywhere, fullLines, isGameOver, newGame, place, shapeSize,
} from './blockBlastLogic';
import type { BlastState, Piece, Shape } from './blockBlastLogic';

const DOT: Shape = [[0, 0]];
const LINE3: Shape = [[0, 0], [0, 1], [0, 2]];
const VLINE3: Shape = [[0, 0], [1, 0], [2, 0]];
const SQUARE: Shape = [[0, 0], [0, 1], [1, 0], [1, 1]];
const BIG: Shape = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]];

function stateWith(board: number[], shapes: (Shape | null)[], extra: Partial<BlastState> = {}): BlastState {
  const tray: (Piece | null)[] = shapes.map((s, i) => (s ? { id: i + 1, shape: s, color: 3 } : null));
  return { board, tray, score: 0, combo: 0, bestCombo: 0, lines: 0, nextId: 10, ...extra };
}

const filled = (b: number[]) => b.filter(Boolean).length;

describe('the piece set', () => {
  it('has pieces of 1 to 9 squares, all within 5×5, including lines up to 5 and the 3×3', () => {
    const sizes = new Set(SHAPES.map(s => s.shape.length));
    for (const n of [1, 2, 3, 4, 5, 9]) expect(sizes.has(n)).toBe(true);
    for (const s of SHAPES) {
      const { rows, cols } = shapeSize(s.shape);
      expect(rows).toBeLessThanOrEqual(5);
      expect(cols).toBeLessThanOrEqual(5);
    }
    const keys = SHAPES.map(s => JSON.stringify(s.shape));
    expect(keys).toContain(JSON.stringify([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]));
    expect(keys).toContain(JSON.stringify([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]));
    expect(keys).toContain(JSON.stringify(BIG));
    expect(new Set(keys).size).toBe(keys.length); // no duplicate rotations
  });
});

describe('fit check', () => {
  it('fits on an empty board, including touching the edges', () => {
    const b = emptyBoard();
    expect(canPlace(b, BIG, 0, 0)).toBe(true);
    expect(canPlace(b, BIG, 5, 5)).toBe(true);
    expect(canPlace(b, LINE3, 7, 5)).toBe(true);
  });
  it('does not fit past any edge', () => {
    const b = emptyBoard();
    expect(canPlace(b, BIG, 6, 0)).toBe(false);
    expect(canPlace(b, BIG, 0, 6)).toBe(false);
    expect(canPlace(b, LINE3, 0, 6)).toBe(false);
    expect(canPlace(b, VLINE3, 6, 0)).toBe(false);
    expect(canPlace(b, DOT, -1, 0)).toBe(false);
    expect(canPlace(b, DOT, 0, -1)).toBe(false);
  });
  it('does not fit over a filled cell, but fits around it', () => {
    const b = boardFrom(['.X......']);
    expect(canPlace(b, SQUARE, 0, 0)).toBe(false);
    expect(canPlace(b, SQUARE, 0, 2)).toBe(true);
    // The L-gap: a corner shape can wrap around a filled cell.
    expect(canPlace(b, [[1, 0], [1, 1], [0, 0]], 0, 0)).toBe(true);
  });
  it('fitsAnywhere finds the only hole', () => {
    const rows = Array(BOARD).fill('XXXXXXXX');
    rows[4] = 'XXX..XXX';
    rows[5] = 'XXX..XXX';
    const b = boardFrom(rows);
    expect(fitsAnywhere(b, SQUARE)).toBe(true);
    expect(fitsAnywhere(b, BIG)).toBe(false);
    expect(fitsAnywhere(b, LINE3)).toBe(false);
  });
});

describe('placement', () => {
  it('fills the cells and scores 1 point per square', () => {
    const res = place(stateWith(emptyBoard(), [SQUARE, DOT, DOT]), 0, 2, 3, createRng(1));
    expect(res.ok).toBe(true);
    expect(res.gained).toBe(4);
    expect(res.state.score).toBe(4);
    expect(res.state.board[2 * BOARD + 3]).toBe(3);
    expect(res.state.board[3 * BOARD + 4]).toBe(3);
    expect(filled(res.state.board)).toBe(4);
    expect(res.state.tray[0]).toBeNull();
  });
  it('refuses a piece that does not fit and leaves the state alone', () => {
    const s = stateWith(boardFrom(['X.......']), [SQUARE, DOT, DOT]);
    const res = place(s, 0, 0, 0, createRng(1));
    expect(res.ok).toBe(false);
    expect(res.state).toBe(s);
  });
  it('refuses an empty tray slot', () => {
    expect(place(stateWith(emptyBoard(), [null, DOT, DOT]), 0, 0, 0, createRng(1)).ok).toBe(false);
  });
  it('deals 3 new pieces when the last one is placed', () => {
    const res = place(stateWith(emptyBoard(), [null, null, DOT]), 2, 0, 0, createRng(1));
    expect(res.dealt).toBe(true);
    expect(res.state.tray.every(p => p !== null)).toBe(true);
    expect(new Set(res.state.tray.map(p => p!.id)).size).toBe(3);
  });
  it('does not mutate the old board', () => {
    const s = stateWith(emptyBoard(), [DOT, DOT, DOT]);
    place(s, 0, 0, 0, createRng(1));
    expect(filled(s.board)).toBe(0);
  });
});

describe('clearing lines', () => {
  it('clears a full row', () => {
    const b = boardFrom(['XXXXX...']);
    const res = place(stateWith(b, [LINE3, DOT, DOT]), 0, 0, 5, createRng(1));
    expect(res.clearedRows).toEqual([0]);
    expect(res.clearedCols).toEqual([]);
    expect(filled(res.state.board)).toBe(0);
    expect(res.gained).toBe(3 + LINE_POINTS * 1);
  });
  it('clears a full column', () => {
    const b = boardFrom(['X', 'X', 'X', 'X', 'X', '.', '.', '.']);
    const res = place(stateWith(b, [VLINE3, DOT, DOT]), 0, 5, 0, createRng(1));
    expect(res.clearedCols).toEqual([0]);
    expect(filled(res.state.board)).toBe(0);
  });
  it('clears a row and a column at the same time, sharing the corner cell', () => {
    // Row 0 is full except (0,0); column 0 is full except (0,0). One dot fills both.
    const rows = ['.XXXXXXX', 'X', 'X', 'X', 'X', 'X', 'X', 'X'];
    const b = boardFrom(rows);
    const res = place(stateWith(b, [DOT, DOT, DOT]), 0, 0, 0, createRng(1));
    expect(res.clearedRows).toEqual([0]);
    expect(res.clearedCols).toEqual([0]);
    expect(res.cleared).toHaveLength(15); // 8 + 8 − the shared corner
    expect(filled(res.state.board)).toBe(0);
    expect(res.gained).toBe(1 + 2 * LINE_POINTS);
    expect(res.state.lines).toBe(2);
  });
  it('clears two rows at once', () => {
    const b = boardFrom(['XXXXXX..', 'XXXXXX..']);
    const res = place(stateWith(b, [SQUARE, DOT, DOT]), 0, 0, 6, createRng(1));
    expect(res.clearedRows).toEqual([0, 1]);
    expect(res.gained).toBe(4 + 2 * LINE_POINTS);
  });
  it('fullLines finds rows and columns', () => {
    const rows = Array(BOARD).fill('X.......');
    rows[3] = 'XXXXXXXX';
    expect(fullLines(boardFrom(rows))).toEqual({ rows: [3], cols: [0] });
  });
});

describe('combo scoring', () => {
  it('multiplies line points while consecutive placements keep clearing, and resets after a miss', () => {
    // Rows 0–2 each need their last cell; dots will clear one row per placement.
    const b = boardFrom(['XXXXXXX.', 'XXXXXXX.', 'XXXXXXX.']);
    let s = stateWith(b, [DOT, DOT, DOT]);
    const rng = createRng(5);

    const r1 = place(s, 0, 0, 7, rng);
    expect(r1.state.combo).toBe(1);
    expect(r1.gained).toBe(1 + 10 * 1);

    const r2 = place(r1.state, 1, 1, 7, rng);
    expect(r2.state.combo).toBe(2);
    expect(r2.gained).toBe(1 + 10 * 2);

    // A placement that clears nothing resets the combo.
    s = { ...r2.state, tray: [DOT, DOT, DOT].map((shape, i) => ({ id: 50 + i, shape, color: 2 })) };
    const r3 = place(s, 0, 7, 0, rng);
    expect(r3.state.combo).toBe(0);
    expect(r3.gained).toBe(1);

    const r4 = place(r3.state, 1, 2, 7, rng);
    expect(r4.state.combo).toBe(1);
    expect(r4.gained).toBe(1 + 10);
    expect(r4.state.bestCombo).toBe(2);
    expect(r4.state.score).toBe(11 + 21 + 1 + 11);
  });
});

describe('game over', () => {
  it('is over when no tray piece fits anywhere', () => {
    const rows = Array(BOARD).fill('XXXXXXXX');
    rows[0] = 'X.X.X.X.'; // only single holes
    const b = boardFrom(rows);
    expect(isGameOver(stateWith(b, [SQUARE, LINE3, null]))).toBe(true);
  });
  it('is not over while at least one piece fits', () => {
    const rows = Array(BOARD).fill('XXXXXXXX');
    rows[0] = 'X.X.X.X.';
    const b = boardFrom(rows);
    expect(isGameOver(stateWith(b, [SQUARE, DOT, null]))).toBe(false);
  });
  it('a fresh game is not over and has 3 pieces; seeded games repeat', () => {
    const a = newGame(createRng(11));
    const b = newGame(createRng(11));
    expect(isGameOver(a)).toBe(false);
    expect(a.tray.map(p => p!.shape)).toEqual(b.tray.map(p => p!.shape));
  });
  it('a simple greedy bot can play a whole game to the end', () => {
    const rng = createRng(3);
    let s = newGame(rng);
    let placements = 0;
    for (let guard = 0; guard < 2000 && !isGameOver(s); guard++) {
      let done = false;
      for (let slot = 0; slot < 3 && !done; slot++) {
        const p = s.tray[slot];
        if (!p) continue;
        for (let r = 0; r < BOARD && !done; r++) {
          for (let c = 0; c < BOARD && !done; c++) {
            const res = place(s, slot, r, c, rng);
            if (res.ok) { s = res.state; done = true; placements++; }
          }
        }
      }
      if (!done) break;
    }
    expect(placements).toBeGreaterThan(5);
    expect(s.score).toBeGreaterThan(0);
  });
});
