// Pure drawing model for the Doodle Pad and Truth or Dare's "Draw it" dares (no React, no DOM).
// A drawing is a fixed-size board (BOARD_W × BOARD_H) so it survives iPad rotation; the screen
// letterboxes it. Edits are a list of ops; the last UNDO_LIMIT ops can be undone, older ones are
// flattened into a base image by the component.

export const BOARD_W = 1200;
export const BOARD_H = 900;
export const UNDO_LIMIT = 20;

export type Tool = 'pen' | 'marker' | 'rainbow' | 'eraser' | 'fill' | 'sticker';

export interface StrokeOp { type: 'stroke'; tool: 'pen' | 'marker' | 'rainbow' | 'eraser'; color: string; size: number; points: number[] }
export interface FillOp { type: 'fill'; color: string; x: number; y: number }
export interface StickerOp { type: 'sticker'; emoji: string; x: number; y: number; size: number }
export type DoodleOp = StrokeOp | FillOp | StickerOp;

export const COLORS = ['#111827', '#ef4444', '#f97316', '#facc15', '#22c55e', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#ffffff', '#92400e', '#9ca3af'];
export const SIZES = [6, 14, 28];
export const BACKGROUNDS = [
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'cream', label: 'Paper', color: '#fdf6e3' },
  { id: 'sky', label: 'Sky', color: '#dbeafe' },
  { id: 'mint', label: 'Mint', color: '#dcfce7' },
  { id: 'pink', label: 'Pink', color: '#fce7f3' },
  { id: 'night', label: 'Night', color: '#1e1b4b' },
];
/** Everyday stickers; Locker stickers the player owns are added on top. */
export const BASE_STICKERS = ['⭐', '❤️', '🌈', '🌸', '🐱', '🐶', '🦋', '🌞', '🌙', '☁️', '🍀', '🎈', '👑', '🚀', '🏰', '🌊', '🐠', '🦖', '🎵', '✨'];
export const STICKER_MIN = 40;
export const STICKER_MAX = 360;
export const STICKER_DEFAULT = 110;

export interface History { ops: DoodleOp[] }

/** Adds an op. Returns the new history plus any ops that fell off the undo window (to flatten). */
export function pushOp(h: History, op: DoodleOp, limit = UNDO_LIMIT): { history: History; flatten: DoodleOp[] } {
  const ops = [...h.ops, op];
  const extra = Math.max(0, ops.length - limit);
  return { history: { ops: ops.slice(extra) }, flatten: ops.slice(0, extra) };
}

export function undo(h: History): History {
  return { ops: h.ops.slice(0, -1) };
}

/** Converts a point on the screen canvas to board coordinates, given where the board is drawn. */
export interface Fit { x: number; y: number; scale: number }
export function fitBoard(w: number, h: number, pad = 0): Fit {
  const scale = Math.min((w - pad * 2) / BOARD_W, (h - pad * 2) / BOARD_H);
  return { scale, x: (w - BOARD_W * scale) / 2, y: (h - BOARD_H * scale) / 2 };
}
export function toBoard(fit: Fit, sx: number, sy: number): [number, number] {
  return [clamp((sx - fit.x) / fit.scale, 0, BOARD_W), clamp((sy - fit.y) / fit.scale, 0, BOARD_H)];
}

/** Drops points closer than `minDist` to the previous kept point (fewer points, smoother lines). */
export function addPoint(points: number[], x: number, y: number, minDist = 2): boolean {
  const n = points.length;
  if (n >= 2) {
    const dx = x - points[n - 2], dy = y - points[n - 1];
    if (dx * dx + dy * dy < minDist * minDist) return false;
  }
  points.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  return true;
}

/** Sticker size from how far the finger dragged after placing it. */
export function stickerSize(dragDist: number): number {
  return Math.round(clamp(STICKER_DEFAULT + dragDist * 1.4, STICKER_MIN, STICKER_MAX));
}

export const rainbowColor = (i: number) => `hsl(${(i * 7) % 360} 90% 55%)`;

export function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/**
 * Scanline flood fill on RGBA pixels, in place. Pixels within `tolerance` (per channel, incl. alpha)
 * of the start pixel are filled, so anti-aliased edges don't leave gaps. Returns pixels filled.
 */
export function floodFill(data: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, rgba: [number, number, number, number], tolerance = 40): number {
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return 0;
  const s = (y0 * w + x0) * 4;
  const t = [data[s], data[s + 1], data[s + 2], data[s + 3]];
  if (Math.abs(t[0] - rgba[0]) <= 2 && Math.abs(t[1] - rgba[1]) <= 2 && Math.abs(t[2] - rgba[2]) <= 2 && Math.abs(t[3] - rgba[3]) <= 2) return 0;
  const seen = new Uint8Array(w * h);
  const match = (i: number) => {
    if (seen[i]) return false;
    const p = i * 4;
    return Math.abs(data[p] - t[0]) <= tolerance && Math.abs(data[p + 1] - t[1]) <= tolerance
      && Math.abs(data[p + 2] - t[2]) <= tolerance && Math.abs(data[p + 3] - t[3]) <= tolerance;
  };
  const paint = (i: number) => {
    seen[i] = 1;
    const p = i * 4;
    data[p] = rgba[0]; data[p + 1] = rgba[1]; data[p + 2] = rgba[2]; data[p + 3] = rgba[3];
  };
  let filled = 0;
  const stack: number[] = [x0, y0];
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    if (!match(y * w + x)) continue;
    let lx = x;
    while (lx > 0 && match(y * w + lx - 1)) lx--;
    let rx = x;
    while (rx < w - 1 && match(y * w + rx + 1)) rx++;
    for (let i = lx; i <= rx; i++) { paint(y * w + i); filled++; }
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= h) continue;
      let inRun = false;
      for (let i = lx; i <= rx; i++) {
        const m = match(ny * w + i);
        if (m && !inRun) { stack.push(i, ny); inRun = true; }
        else if (!m) inRun = false;
      }
    }
  }
  return filled;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
