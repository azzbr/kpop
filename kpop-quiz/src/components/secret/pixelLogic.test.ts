import { describe, expect, it } from 'vitest';
import {
  CELLS, GRID, MAX_UNDO, brushIndices, cellAt, drawPixelArt, emptyPixels, floodFill, isEmptyArt,
  lineCells, makeArt, mirrorIndex, nextPresetName, paintCells, pushUndo,
} from './pixelLogic';

const idx = (r: number, c: number) => r * GRID + c;

describe('floodFill', () => {
  it('fills only the enclosed region', () => {
    let px = emptyPixels();
    // A 4×4 box outline from (2,2) to (5,5).
    for (let k = 2; k <= 5; k++) {
      px = paintCells(px, [idx(2, k), idx(5, k), idx(k, 2), idx(k, 5)], '#000000');
    }
    const filled = floodFill(px, idx(3, 3), '#ef4444');
    expect(filled[idx(3, 3)]).toBe('#ef4444');
    expect(filled[idx(4, 4)]).toBe('#ef4444');
    expect(filled.filter(p => p === '#ef4444')).toHaveLength(4);
    expect(filled[idx(0, 0)]).toBe('');
    expect(filled[idx(2, 2)]).toBe('#000000');
    // original untouched
    expect(px[idx(3, 3)]).toBe('');
  });

  it('is 4-way (does not leak through diagonals)', () => {
    let px = emptyPixels();
    px = paintCells(px, [idx(0, 1), idx(1, 0)], '#000000');
    const filled = floodFill(px, idx(0, 0), '#22c55e');
    expect(filled[idx(0, 0)]).toBe('#22c55e');
    expect(filled[idx(1, 1)]).toBe('');
  });

  it('fills the whole empty canvas', () => {
    expect(floodFill(emptyPixels(), 0, '#fff').every(p => p === '#fff')).toBe(true);
  });

  it('is a no-op on the same colour', () => {
    const px = emptyPixels().map(() => '#3b82f6');
    expect(floodFill(px, 10, '#3b82f6')).toBe(px);
  });
});

describe('mirror', () => {
  it('maps a column to its opposite in the same row', () => {
    expect(mirrorIndex(idx(0, 0))).toBe(idx(0, 15));
    expect(mirrorIndex(idx(3, 4))).toBe(idx(3, 11));
    expect(mirrorIndex(idx(7, 15))).toBe(idx(7, 0));
    for (let i = 0; i < CELLS; i++) expect(mirrorIndex(mirrorIndex(i))).toBe(i);
  });
  it('brush paints one or two cells', () => {
    expect(brushIndices(idx(2, 3), false)).toEqual([idx(2, 3)]);
    expect(brushIndices(idx(2, 3), true)).toEqual([idx(2, 3), idx(2, 12)]);
  });
});

describe('undo stack', () => {
  it('caps at MAX_UNDO, dropping the oldest', () => {
    let stack: number[] = [];
    for (let i = 0; i < 50; i++) stack = pushUndo(stack, i);
    expect(MAX_UNDO).toBe(30);
    expect(stack).toHaveLength(30);
    expect(stack[0]).toBe(20);
    expect(stack[29]).toBe(49);
  });
});

describe('art helpers', () => {
  it('detects empty art', () => {
    expect(isEmptyArt(emptyPixels())).toBe(true);
    expect(isEmptyArt(paintCells(emptyPixels(), [5], '#000000'))).toBe(false);
  });

  it('serialises 256 pixels', () => {
    const art = makeArt('a', 'Pixel Pal 1', paintCells(emptyPixels(), [0], '#000000'), 1);
    expect(art.pixels).toHaveLength(256);
    expect(art.size).toBe(16);
    expect(JSON.parse(JSON.stringify(art)).pixels).toHaveLength(256);
    expect(makeArt('b', 'x', ['#fff']).pixels).toHaveLength(256);
    expect(JSON.stringify(art).length).toBeLessThan(2000);
  });

  it('finds the cell under a point', () => {
    const rect = { left: 100, top: 50, width: 320, height: 320 };
    expect(cellAt(100, 50, rect)).toBe(0);
    expect(cellAt(419, 369, rect)).toBe(255);
    expect(cellAt(130, 75, rect)).toBe(idx(1, 1));
    expect(cellAt(99, 60, rect)).toBe(-1);
    expect(cellAt(420, 60, rect)).toBe(-1);
  });

  it('draws straight lines between cells', () => {
    expect(lineCells(idx(0, 0), idx(0, 4))).toEqual([0, 1, 2, 3, 4]);
    expect(lineCells(idx(0, 0), idx(3, 3))).toEqual([idx(0, 0), idx(1, 1), idx(2, 2), idx(3, 3)]);
  });

  it('picks unused preset names', () => {
    const a = nextPresetName([]);
    expect(a).toBe('Pixel Pal 1');
    expect(nextPresetName([a], 0)).not.toBe(a);
  });

  it('drawPixelArt draws only filled cells', () => {
    const calls: [string, number, number, number, number][] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { calls.push([String(this.fillStyle), x, y, w, h]); } };
    const art = { size: 16, pixels: paintCells(emptyPixels(), [0, 255], '#ef4444') };
    drawPixelArt(ctx as unknown as CanvasRenderingContext2D, art, 0, 0, 32);
    expect(calls).toEqual([['#ef4444', 0, 0, 2, 2], ['#ef4444', 30, 30, 2, 2]]);
  });
});
