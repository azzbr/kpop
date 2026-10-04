import { describe, it, expect } from 'vitest';
import { pushOp, undo, floodFill, fitBoard, toBoard, addPoint, stickerSize, hexToRgba, BOARD_W, BOARD_H, STICKER_MAX, STICKER_MIN, type DoodleOp } from './doodleLogic';

const dot = (n: number): DoodleOp => ({ type: 'sticker', emoji: '⭐', x: n, y: n, size: 50 });

describe('doodle history', () => {
  it('keeps at most the undo limit and hands back the overflow to flatten', () => {
    let h = { ops: [] as DoodleOp[] };
    const flattened: DoodleOp[] = [];
    for (let i = 0; i < 25; i++) {
      const r = pushOp(h, dot(i), 20);
      h = r.history;
      flattened.push(...r.flatten);
    }
    expect(h.ops).toHaveLength(20);
    expect(flattened.map(o => (o as { x: number }).x)).toEqual([0, 1, 2, 3, 4]);
    expect((h.ops[0] as { x: number }).x).toBe(5);
  });
  it('undo removes the latest op and is safe when empty', () => {
    const h = pushOp({ ops: [] }, dot(1)).history;
    expect(undo(h).ops).toEqual([]);
    expect(undo({ ops: [] }).ops).toEqual([]);
  });
});

describe('board fitting', () => {
  it('letterboxes a 4:3 board and maps the screen back to board coordinates', () => {
    const fit = fitBoard(1000, 1000);
    expect(fit.scale).toBeCloseTo(1000 / BOARD_W);
    expect(fit.x).toBe(0);
    expect(fit.y).toBeGreaterThan(0);
    expect(toBoard(fit, 500, 500)).toEqual([BOARD_W / 2, BOARD_H / 2]);
    // Off the board clamps to the edge.
    expect(toBoard(fit, -50, 0)).toEqual([0, 0]);
  });
});

describe('points and stickers', () => {
  it('skips points that are too close', () => {
    const pts: number[] = [];
    expect(addPoint(pts, 10, 10)).toBe(true);
    expect(addPoint(pts, 10.5, 10.5)).toBe(false);
    expect(addPoint(pts, 20, 10)).toBe(true);
    expect(pts).toEqual([10, 10, 20, 10]);
  });
  it('sticker size grows with the drag and stays in bounds', () => {
    expect(stickerSize(0)).toBeGreaterThanOrEqual(STICKER_MIN);
    expect(stickerSize(100)).toBeGreaterThan(stickerSize(0));
    expect(stickerSize(10_000)).toBe(STICKER_MAX);
  });
  it('parses hex colours', () => {
    expect(hexToRgba('#ff8000')).toEqual([255, 128, 0, 255]);
    expect(hexToRgba('#fff')).toEqual([255, 255, 255, 255]);
  });
});

describe('flood fill', () => {
  // 10×10 transparent image with a closed 1px black square outline from (2,2) to (7,7).
  const make = () => {
    const w = 10, h = 10, d = new Uint8ClampedArray(w * h * 4);
    for (let i = 2; i <= 7; i++) for (const [x, y] of [[i, 2], [i, 7], [2, i], [7, i]]) {
      const p = (y * w + x) * 4; d[p + 3] = 255;
    }
    return { w, h, d };
  };
  const at = (d: Uint8ClampedArray, w: number, x: number, y: number) => Array.from(d.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

  it('fills inside a closed shape without leaking out', () => {
    const { w, h, d } = make();
    const n = floodFill(d, w, h, 4, 4, [255, 0, 0, 255]);
    expect(n).toBe(16); // 4×4 inside
    expect(at(d, w, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(at(d, w, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(at(d, w, 2, 2)).toEqual([0, 0, 0, 255]);
  });
  it('fills the outside around the shape', () => {
    const { w, h, d } = make();
    expect(floodFill(d, w, h, 0, 0, [0, 0, 255, 255])).toBe(100 - 36);
  });
  it('does nothing when the colour is already there or the point is off the image', () => {
    const { w, h, d } = make();
    expect(floodFill(d, w, h, 2, 2, [0, 0, 0, 255])).toBe(0);
    expect(floodFill(d, w, h, -1, 3, [9, 9, 9, 255])).toBe(0);
  });
});
