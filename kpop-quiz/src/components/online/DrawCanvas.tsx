import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { playClick, playPop } from '../../utils/sounds';
import {
  addOp, compactOps, paint, replay, toActions, PAPER, COLORS, SIZES,
  type Action, type DrawOp, type DrawPt,
} from './drawOps';

// The kid drawing surface for Friends Arena (Doodle Dash, Picture Telephone, Fake Artist…).
// - Picture Telephone grabs the finished picture as a small JPEG dataURL (getImage).
// - Streaming games send every op this device makes (onOp) and replay other devices' ops
//   (applyOp / applyOps). The picture is an action history, so undo re-renders identically on
//   every device; snapshot()/load() hand a late joiner the picture so far.
// Points are normalised to 0..1 so any screen size matches (see drawOps.ts).

export type { DrawPt, DrawOp } from './drawOps';

export interface DrawCanvasHandle {
  /** Downscaled JPEG dataURL (default 240×180; Picture Telephone 2.0 uses 480×360). */
  getImage: (w?: number, h?: number, quality?: number) => string;
  /** The picture re-drawn at w×h as a PNG (default 1200×900, the Doodle Pad's board). */
  toBlob: (w?: number, h?: number) => Promise<Blob | null>;
  /** Wipes the picture and its history (not undoable, not streamed — e.g. a new round). */
  clear: () => void;
  /** Replays points drawn on another device (older streaming API). */
  drawPoints: (pts: DrawPt[], color: string, width: number) => void;
  /** Applies an op from another device. */
  applyOp: (op: DrawOp) => void;
  applyOps: (ops: DrawOp[]) => void;
  /** The picture so far as the shortest op list (for a late joiner). */
  snapshot: () => DrawOp[];
  /** Replaces the picture with these ops. */
  load: (ops: DrawOp[]) => void;
}

export interface DrawTools { sizes?: boolean; fill?: boolean; eraser?: boolean; undo?: boolean; clear?: boolean }

interface Props {
  /** No drawing and no tools (watching someone else draw). */
  disabled?: boolean;
  /** Every point this device draws, with the pen it was drawn with (older streaming API). */
  onPoints?: (pt: DrawPt, color: string, width: number) => void;
  /** Every op this device makes (points, fills, undo, clear) — stream these to other devices. */
  onOp?: (op: DrawOp) => void;
  /** The 🗑️ Clear button was pressed. */
  onClear?: () => void;
  /** A fixed pen colour (Fake Artist: each player has their own) — hides the colour row. */
  color?: string;
  /** Which tools to show (all by default). */
  tools?: DrawTools;
  /** At most this many strokes from this device per `strokeKey` (e.g. per turn). Undo gives one back. */
  maxStrokes?: number;
  strokeKey?: string | number;
  /** A stroke from this device finished; `used` = strokes so far this `strokeKey`. */
  onStrokeEnd?: (used: number) => void;
  /** Extra classes for the canvas (e.g. a bigger board screen). */
  className?: string;
}

const CW = 960;
const CH = 720;
const ERASER_MUL = 2.6;
const MIN_STEP = 0.004; // skip points closer than this (normalised) to the last one sent
const r3 = (v: number) => Math.round(v * 1000) / 1000;

type Tool = 'pen' | 'fill' | 'eraser';

const DrawCanvas = forwardRef<DrawCanvasHandle, Props>((props, ref) => {
  const { disabled, color, tools = {}, maxStrokes, strokeKey, className = '' } = props;
  const show = { sizes: true, fill: true, eraser: true, undo: true, clear: true, ...tools };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const actions = useRef<Action[]>([]);
  const drawing = useRef<{ id: number; last: [number, number] } | null>(null);
  const mine = useRef(0); // strokes this device drew since strokeKey changed (for maxStrokes / undo)
  const [colorIdx, setColorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(1);
  const [tool, setTool] = useState<Tool>('pen');
  const [canUndo, setCanUndo] = useState(false);
  const [used, setUsed] = useState(0);
  const propsRef = useRef(props);
  propsRef.current = props;

  const limited = maxStrokes !== undefined;
  const refreshUndo = () => setCanUndo(limited ? mine.current > 0 && actions.current.length > 0 : actions.current.length > 0);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d', { willReadFrequently: true }) ?? null;
    if (!ctx) return;
    ctxRef.current = ctx;
    replay(ctx, actions.current, CW, CH);
  }, []);

  useEffect(() => {
    mine.current = 0;
    setUsed(0);
    setCanUndo(false);
  }, [strokeKey]);

  const run = (op: DrawOp) => {
    const e = addOp(actions.current, op);
    const ctx = ctxRef.current;
    if (ctx) paint(ctx, e, CW, CH, actions.current);
  };

  const local = (op: DrawOp) => {
    run(op);
    propsRef.current.onOp?.(op);
    if (op.k === 'pt') propsRef.current.onPoints?.(op.pt, op.c, op.w);
  };

  const reset = (ops: DrawOp[]) => {
    actions.current = toActions(ops);
    drawing.current = null;
    const ctx = ctxRef.current;
    if (ctx) replay(ctx, actions.current, CW, CH);
    refreshUndo();
  };

  const render = (w: number, h: number) => {
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (ctx) replay(ctx, actions.current, w, h);
    return out;
  };

  useImperativeHandle(ref, () => ({
    clear: () => reset([]),
    drawPoints: (pts, c, w) => { for (const pt of pts) run({ k: 'pt', pt, c, w }); refreshUndo(); },
    applyOp: (op) => { run(op); refreshUndo(); },
    applyOps: (ops) => { for (const op of ops) run(op); refreshUndo(); },
    snapshot: () => compactOps(actions.current),
    load: (ops) => reset(ops),
    getImage: (w = 240, h = 180, quality = 0.5) => {
      const cv = canvasRef.current;
      if (!cv) return '';
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext('2d');
      if (!tctx) return '';
      tctx.fillStyle = PAPER;
      tctx.fillRect(0, 0, w, h);
      tctx.drawImage(cv, 0, 0, w, h);
      return tmp.toDataURL('image/jpeg', quality);
    },
    toBlob: (w = 1200, h = 900) => new Promise((resolve) => {
      try { render(w, h).toBlob((b) => resolve(b), 'image/png'); } catch { resolve(null); }
    }),
  }));

  const pen = () => {
    const w = SIZES[sizeIdx];
    if (tool === 'eraser') return { c: PAPER, w: Math.round(w * ERASER_MUL) };
    return { c: color ?? COLORS[colorIdx], w };
  };

  const getNorm = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [
      r3(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))),
      r3(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))),
    ];
  };

  const outOfStrokes = () => limited && mine.current >= (maxStrokes ?? 0);

  const down = (e: React.PointerEvent) => {
    if (disabled || drawing.current) return;
    e.preventDefault();
    const [x, y] = getNorm(e);
    if (tool === 'fill') {
      if (outOfStrokes()) return;
      playPop();
      local({ k: 'fill', x, y, c: color ?? COLORS[colorIdx] });
      if (limited) { mine.current++; setUsed(mine.current); propsRef.current.onStrokeEnd?.(mine.current); }
      refreshUndo();
      return;
    }
    if (outOfStrokes()) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = { id: e.pointerId, last: [x, y] };
    const { c, w } = pen();
    local({ k: 'pt', pt: [x, y, 1], c, w });
  };
  const move = (e: React.PointerEvent) => {
    const d = drawing.current;
    if (disabled || !d || e.pointerId !== d.id) return;
    e.preventDefault();
    const [x, y] = getNorm(e);
    if (Math.hypot(x - d.last[0], y - d.last[1]) < MIN_STEP) return;
    d.last = [x, y];
    const { c, w } = pen();
    local({ k: 'pt', pt: [x, y, 0], c, w });
  };
  const up = (e: React.PointerEvent) => {
    const d = drawing.current;
    if (!d || e.pointerId !== d.id) return;
    drawing.current = null;
    mine.current++;
    setUsed(mine.current);
    refreshUndo();
    propsRef.current.onStrokeEnd?.(mine.current);
  };

  const undo = () => {
    if (!canUndo || drawing.current) return;
    playClick();
    local({ k: 'undo' });
    if (limited) { mine.current = Math.max(0, mine.current - 1); setUsed(mine.current); }
    refreshUndo();
  };

  const clearAll = () => {
    if (actions.current.length === 0 || actions.current[actions.current.length - 1].k === 'clear') return;
    playClick();
    local({ k: 'clear' });
    refreshUndo();
    propsRef.current.onClear?.();
  };

  const strokesLeft = limited ? Math.max(0, (maxStrokes ?? 0) - used) : null;
  const pill = 'min-h-[48px] min-w-[48px] px-3 rounded-full font-fredoka text-lg border-2 flex items-center justify-center gap-1';
  const on = 'bg-amber-400/30 border-amber-300';
  const off = 'bg-white/10 border-white/30';

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        data-testid="draw-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
        onContextMenu={(e) => e.preventDefault()}
        className={`game-surface block w-full aspect-[4/3] bg-white rounded-2xl shadow-2xl ${disabled ? '' : tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair'} ${className}`}
        style={{ touchAction: 'none' }}
      />
      {!disabled && (
        <div className="mt-3 space-y-2 select-none">
          {color === undefined && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap" role="group" aria-label="Colours">
              {COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${i + 1}`}
                  aria-pressed={colorIdx === i && tool !== 'eraser'}
                  onClick={() => { setColorIdx(i); if (tool === 'eraser') setTool('pen'); }}
                  className={`w-12 h-12 rounded-full border-4 transition-transform ${colorIdx === i && tool !== 'eraser' ? 'border-amber-300 scale-110' : 'border-white/30'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {show.sizes && SIZES.map((s, i) => (
              <button key={s} type="button" aria-label={['Thin', 'Medium', 'Thick'][i]} aria-pressed={sizeIdx === i}
                onClick={() => { setSizeIdx(i); if (tool === 'fill') setTool('pen'); }}
                className={`${pill} ${sizeIdx === i && tool !== 'fill' ? on : off}`}>
                <span className="rounded-full bg-white" style={{ width: 6 + i * 7, height: 6 + i * 7 }} />
              </button>
            ))}
            {(show.fill || show.eraser) && (
              <button type="button" aria-label="Pen" aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} className={`${pill} ${tool === 'pen' ? on : off}`}>✏️</button>
            )}
            {show.fill && (
              <button type="button" aria-label="Fill" aria-pressed={tool === 'fill'} onClick={() => setTool('fill')} className={`${pill} ${tool === 'fill' ? on : off}`}>🪣</button>
            )}
            {show.eraser && (
              <button type="button" aria-label="Eraser" aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} className={`${pill} ${tool === 'eraser' ? on : off}`}>🧽</button>
            )}
            {show.undo && (
              <button type="button" aria-label="Undo" onClick={undo} disabled={!canUndo} className={`${pill} ${off} disabled:opacity-40`}>↩️ Undo</button>
            )}
            {show.clear && (
              <button type="button" aria-label="Clear" onClick={clearAll} className={`${pill} bg-red-500/30 border-red-400`}>🗑️</button>
            )}
            {strokesLeft !== null && (
              <span className="font-fredoka text-lg px-2" data-testid="strokes-left">✏️ {strokesLeft} left</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

DrawCanvas.displayName = 'DrawCanvas';
export default DrawCanvas;
