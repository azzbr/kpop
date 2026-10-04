// Pure rules for Pixel Studio — no React, no DOM (except the tiny canvas draw helper, which
// only needs a 2D context). A picture is a flat row-major array of hex colours ('' = empty).
import type { PixelArt } from '../../store';

export const GRID = 16;
export const CELLS = GRID * GRID;
export const MAX_UNDO = 30;

export const PALETTE = [
  '#000000', '#ffffff', '#9ca3af', '#7c4a2d',
  '#ef4444', '#f97316', '#facc15', '#a3e635',
  '#22c55e', '#14b8a6', '#38bdf8', '#3b82f6',
  '#8b5cf6', '#d946ef', '#f472b6', '#fcd5b5',
] as const;

export const PRESET_NAMES = [
  'Pixel Pal', 'Tiny Hero', 'Space Buddy', 'Cool Cat', 'Star Bot', 'Happy Blob',
  'Rainbow Dash', 'Mini Dragon', 'Pizza Pal', 'Ghosty', 'Robo Pup', 'Comet Kid',
];

export function emptyPixels(size = GRID): string[] {
  return Array.from({ length: size * size }, () => '');
}

export function isEmptyArt(pixels: readonly string[]): boolean {
  return pixels.every(p => !p);
}

/** Index of the cell mirrored left/right in the same row. */
export function mirrorIndex(i: number, size = GRID): number {
  const row = Math.floor(i / size);
  const col = i % size;
  return row * size + (size - 1 - col);
}

/** Indices a brush touch at `i` paints (one, or two with mirror on). */
export function brushIndices(i: number, mirror: boolean, size = GRID): number[] {
  if (!mirror) return [i];
  const m = mirrorIndex(i, size);
  return m === i ? [i] : [i, m];
}

/** Sets cells to a colour; returns the same array when nothing changes. */
export function paintCells(pixels: readonly string[], indices: number[], color: string): string[] {
  if (indices.every(i => pixels[i] === color)) return pixels as string[];
  const next = pixels.slice();
  for (const i of indices) if (i >= 0 && i < next.length) next[i] = color;
  return next;
}

/** 4-way flood fill from `start`. Returns the same array (no-op) when the colour already matches. */
export function floodFill(pixels: readonly string[], start: number, color: string, size = GRID): string[] {
  const target = pixels[start];
  if (target === undefined || target === color) return pixels as string[];
  const next = pixels.slice();
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (next[i] !== target) continue;
    next[i] = color;
    const r = Math.floor(i / size);
    const c = i % size;
    if (c > 0) stack.push(i - 1);
    if (c < size - 1) stack.push(i + 1);
    if (r > 0) stack.push(i - size);
    if (r < size - 1) stack.push(i + size);
  }
  return next;
}

/** Push a snapshot onto an undo stack, keeping at most `cap` (oldest dropped). */
export function pushUndo<T>(stack: readonly T[], snapshot: T, cap = MAX_UNDO): T[] {
  const next = [...stack, snapshot];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Cell index under a point, given the grid's bounding box; -1 if outside. */
export function cellAt(x: number, y: number, rect: { left: number; top: number; width: number; height: number }, size = GRID): number {
  const col = Math.floor(((x - rect.left) / rect.width) * size);
  const row = Math.floor(((y - rect.top) / rect.height) * size);
  if (col < 0 || row < 0 || col >= size || row >= size) return -1;
  return row * size + col;
}

/** Cells along a straight line between two cells (so fast drags don't leave gaps). */
export function lineCells(a: number, b: number, size = GRID): number[] {
  let x0 = a % size, y0 = Math.floor(a / size);
  const x1 = b % size, y1 = Math.floor(b / size);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: number[] = [];
  for (;;) {
    out.push(y0 * size + x0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}

/** Next unused preset name, e.g. "Pixel Pal 1", "Tiny Hero 2". */
export function nextPresetName(existing: readonly string[], seed = existing.length): string {
  const taken = new Set(existing);
  for (let n = 0; n < 1000; n++) {
    const base = PRESET_NAMES[(seed + n) % PRESET_NAMES.length];
    const name = `${base} ${Math.floor((seed + n) / PRESET_NAMES.length) + 1}`;
    if (!taken.has(name)) return name;
  }
  return `Pixel Pal ${Date.now() % 1000}`;
}

export function makeArt(id: string, name: string, pixels: readonly string[], now = Date.now()): PixelArt {
  return { id, name, size: GRID, pixels: pixels.slice(0, CELLS).concat(emptyPixels().slice(pixels.length)), updatedAt: now };
}

export function newArtId(now = Date.now()): string {
  return `px_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Draws the art scaled into a size×size square at (x, y). Empty cells stay transparent. */
export function drawPixelArt(
  ctx: Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect'>,
  art: Pick<PixelArt, 'size' | 'pixels'>,
  x: number, y: number, size: number,
): void {
  const n = art.size || GRID;
  const cell = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const col = art.pixels[r * n + c];
      if (!col) continue;
      ctx.fillStyle = col;
      // Round edges outward a touch so neighbouring cells don't show hairline seams.
      const px = x + c * cell, py = y + r * cell;
      ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(px + cell) - Math.floor(px), Math.ceil(py + cell) - Math.floor(py));
    }
  }
}
