// Drawing ops for Friends Arena's DrawCanvas (pure — no React, no DOM; `replay` only needs a
// 2D-context-like object). A drawing is a log of ops: points, fills, clears and undos. Every
// device that gets the same ops in the same order shows the same picture, because undo is
// resolved from the action history (strokes / fills / clears), not from pixels.
//
// Coordinates are normalised 0..1 (3 decimals) so any screen size matches. Line widths are in
// BASE_W units (a 640-wide board), scaled to the real canvas.
import { floodFill, hexToRgba } from '../draw/doodleLogic';

/** One point: x, y (0..1, 3 decimals) and 1 when it starts a new stroke. */
export type DrawPt = [number, number, number];

export type DrawOp =
  | { k: 'pt'; pt: DrawPt; c: string; w: number }
  | { k: 'undo' }
  | { k: 'fill'; x: number; y: number; c: string }
  | { k: 'clear' };

export type Action =
  | { k: 'stroke'; c: string; w: number; pts: DrawPt[] }
  | { k: 'fill'; x: number; y: number; c: string }
  | { k: 'clear' };

export const BASE_W = 640;
export const PAPER = '#ffffff';
/** The 12 pen colours and 3 pen sizes (BASE_W units). */
export const COLORS = [
  '#1f2937', '#ef4444', '#f97316', '#facc15', '#22c55e', '#15803d',
  '#38bdf8', '#2563eb', '#a855f7', '#ec4899', '#92400e', '#fcd5b5',
];
export const SIZES = [4, 9, 20];

/** What the canvas has to paint after an op: a dot, a segment from the previous point, a fill, a wipe, or everything again. */
export type Effect =
  | { k: 'dot'; pt: DrawPt; c: string; w: number }
  | { k: 'seg'; from: DrawPt; to: DrawPt; c: string; w: number }
  | { k: 'fill'; x: number; y: number; c: string }
  | { k: 'clear' }
  | { k: 'redraw' }
  | { k: 'none' };

/** Adds an op to the action history IN PLACE (strokes get thousands of points) and says what to paint. */
export function addOp(actions: Action[], op: DrawOp): Effect {
  if (op.k === 'pt') {
    const last = actions[actions.length - 1];
    if (!op.pt[2] && last?.k === 'stroke' && last.c === op.c && last.w === op.w && last.pts.length > 0) {
      const from = last.pts[last.pts.length - 1];
      last.pts.push(op.pt);
      return { k: 'seg', from, to: op.pt, c: op.c, w: op.w };
    }
    const pt: DrawPt = [op.pt[0], op.pt[1], 1];
    actions.push({ k: 'stroke', c: op.c, w: op.w, pts: [pt] });
    return { k: 'dot', pt, c: op.c, w: op.w };
  }
  if (op.k === 'undo') {
    if (actions.length === 0) return { k: 'none' };
    actions.pop();
    return { k: 'redraw' };
  }
  if (op.k === 'fill') {
    actions.push({ k: 'fill', x: op.x, y: op.y, c: op.c });
    return { k: 'fill', x: op.x, y: op.y, c: op.c };
  }
  actions.push({ k: 'clear' });
  return { k: 'clear' };
}

/** The action history for a list of ops (undos resolved). */
export function toActions(ops: DrawOp[]): Action[] {
  const a: Action[] = [];
  for (const op of ops) addOp(a, op);
  return a;
}

/** The shortest op list that draws the same picture (no undos, nothing undone) — for late joiners. */
export function compactOps(actions: Action[]): DrawOp[] {
  const out: DrawOp[] = [];
  for (const a of actions) {
    if (a.k === 'stroke') a.pts.forEach((pt, i) => out.push({ k: 'pt', pt: [pt[0], pt[1], i === 0 ? 1 : 0], c: a.c, w: a.w }));
    else if (a.k === 'fill') out.push({ k: 'fill', x: a.x, y: a.y, c: a.c });
    else out.push({ k: 'clear' });
  }
  return out;
}

export const strokeCount = (actions: Action[]) => actions.filter(a => a.k === 'stroke').length;

// ---------- painting (any CanvasRenderingContext2D-like object) ----------

/** The bits of CanvasRenderingContext2D that painting needs (so tests can pass a fake). */
export interface Paintable {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  beginPath(): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray; width: number; height: number };
  putImageData(img: ImageData, x: number, y: number): void;
}

/** Fills the area around (x, y) (0..1) in an RGBA image, in place. Returns pixels filled. */
export function fillImage(img: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number, color: string): number {
  return floodFill(img.data, img.width, img.height, x * img.width, y * img.height, hexToRgba(color));
}

/** Paints one effect onto a W×H canvas (redraw needs the actions). */
export function paint(ctx: Paintable, e: Effect, W: number, H: number, actions?: Action[]) {
  const s = W / BASE_W;
  if (e.k === 'dot') {
    ctx.fillStyle = e.c;
    ctx.beginPath();
    ctx.arc(e.pt[0] * W, e.pt[1] * H, (e.w * s) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.k === 'seg') {
    ctx.strokeStyle = e.c;
    ctx.lineWidth = e.w * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(e.from[0] * W, e.from[1] * H);
    ctx.lineTo(e.to[0] * W, e.to[1] * H);
    ctx.stroke();
  } else if (e.k === 'fill') {
    const img = ctx.getImageData(0, 0, W, H);
    if (fillImage(img, e.x, e.y, e.c) > 0) ctx.putImageData(img as ImageData, 0, 0);
  } else if (e.k === 'clear') {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
  } else if (e.k === 'redraw' && actions) {
    replay(ctx, actions, W, H);
  }
}

/** Paints a whole history from blank paper — exactly what live painting produced. */
export function replay(ctx: Paintable, actions: Action[], W: number, H: number) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  for (const a of actions) {
    if (a.k === 'stroke') {
      a.pts.forEach((pt, i) => paint(ctx, i === 0 ? { k: 'dot', pt, c: a.c, w: a.w } : { k: 'seg', from: a.pts[i - 1], to: pt, c: a.c, w: a.w }, W, H));
    } else paint(ctx, a, W, H);
  }
}

// ---------- the wire ----------

/**
 * Compact form for messages: runs of points with the same pen become
 * ['p', colour, width, x, y, newStroke, x, y, newStroke, …] with x/y as 0..1000 integers;
 * ['u'] undo, ['f', x, y, colour] fill, ['c'] clear.
 */
export type Packed = (string | number)[][];

const q = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000);
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const okColor = (c: unknown): c is string => typeof c === 'string' && COLOR_RE.test(c);
const okNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function packOps(ops: DrawOp[]): Packed {
  const out: Packed = [];
  let run: (string | number)[] | null = null;
  for (const op of ops) {
    if (op.k === 'pt') {
      if (!run || run[1] !== op.c || run[2] !== op.w) { run = ['p', op.c, op.w]; out.push(run); }
      run.push(q(op.pt[0]), q(op.pt[1]), op.pt[2] ? 1 : 0);
      continue;
    }
    run = null;
    if (op.k === 'undo') out.push(['u']);
    else if (op.k === 'fill') out.push(['f', q(op.x), q(op.y), op.c]);
    else out.push(['c']);
  }
  return out;
}

/** Back to ops. Anything malformed (it came over the network) is dropped. */
export function unpackOps(p: unknown): DrawOp[] {
  const out: DrawOp[] = [];
  if (!Array.isArray(p)) return out;
  for (const item of p) {
    if (!Array.isArray(item)) continue;
    const t = item[0];
    if (t === 'p') {
      const c = item[1], w = item[2];
      if (!okColor(c) || !okNum(w) || w <= 0 || w > 80) continue;
      for (let i = 3; i + 2 < item.length; i += 3) {
        const x = item[i], y = item[i + 1];
        if (!okNum(x) || !okNum(y)) continue;
        out.push({ k: 'pt', pt: [q(x / 1000) / 1000, q(y / 1000) / 1000, item[i + 2] ? 1 : 0], c, w });
      }
    } else if (t === 'u') out.push({ k: 'undo' });
    else if (t === 'c') out.push({ k: 'clear' });
    else if (t === 'f' && okNum(item[1]) && okNum(item[2]) && okColor(item[3])) {
      out.push({ k: 'fill', x: q(item[1] / 1000) / 1000, y: q(item[2] / 1000) / 1000, c: item[3] });
    }
  }
  return out;
}

/**
 * Streams carry a sequence number `i` (index of the batch's first op in the drawing's log).
 * Given how many ops this device already has (`have`), returns how many of the batch's ops
 * to skip (already seen), or -1 when some ops were missed (ask for a snapshot).
 */
export function opsToSkip(have: number, i: number): number {
  if (i > have) return -1;
  return have - i;
}

/** Per-drawing receive log on one device: which drawing, how many ops seen, the ops themselves. */
export interface OpLog { key: string; n: number; ops: DrawOp[] }

/**
 * Takes one streamed batch. Returns the ops that are new for this device (to paint), whether
 * there was a gap (ask the sender for a snapshot), and the updated log. A batch for another
 * drawing starts a fresh log.
 */
export function receiveBatch(log: OpLog, key: string, i: number, ops: DrawOp[]): { log: OpLog; fresh: DrawOp[]; gap: boolean; reset: boolean } {
  const reset = log.key !== key;
  const base: OpLog = reset ? { key, n: 0, ops: [] } : log;
  const skip = opsToSkip(base.n, i);
  if (skip < 0) return { log: base, fresh: [], gap: true, reset };
  const fresh = ops.slice(skip);
  return { log: { key, n: base.n + fresh.length, ops: fresh.length ? [...base.ops, ...fresh] : base.ops }, fresh, gap: false, reset };
}
