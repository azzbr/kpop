import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { playClick } from '../../utils/sounds';

// A self-contained kid drawing surface for Friends Arena.
// - Picture Telephone grabs the finished picture as a small JPEG dataURL (getImage).
// - Doodle Dash streams the drawer's points (onPoints) and replays them on every other
//   device (drawPoints). Points are normalised to 0..1 so any screen size matches.

/** One point: x, y (0..1, 3 decimals) and 1 when it starts a new stroke. */
export type DrawPt = [number, number, number];

export interface DrawCanvasHandle {
  getImage: () => string; // downscaled JPEG dataURL (~240×180)
  clear: () => void;
  /** Replays points drawn on another device. */
  drawPoints: (pts: DrawPt[], color: string, width: number) => void;
}

interface Props {
  /** No drawing and no tools (watching someone else draw). */
  disabled?: boolean;
  /** Every point this device draws, with the pen it was drawn with (for streaming). */
  onPoints?: (pt: DrawPt, color: string, width: number) => void;
  /** The 🗑️ Clear button was pressed. */
  onClear?: () => void;
}

const CW = 640;
const CH = 480;
const COLORS = ['#1f2937', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#92400e'];
const ERASER = '#ffffff';
const r3 = (v: number) => Math.round(v * 1000) / 1000;

const DrawCanvas = forwardRef<DrawCanvasHandle, Props>(({ disabled, onPoints, onClear }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const remoteLast = useRef<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const [colorIdx, setColorIdx] = useState(0);
  const [eraser, setEraser] = useState(false);
  const pen = useRef({ c: COLORS[0], w: 5 });

  useEffect(() => {
    pen.current = eraser ? { c: ERASER, w: 26 } : { c: COLORS[colorIdx], w: 5 };
  }, [colorIdx, eraser]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);
  }, []);

  const clear = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);
    lastPt.current = null;
    remoteLast.current = null;
  };

  const paint = (x: number, y: number, newStroke: boolean, c: string, w: number, last: React.MutableRefObject<{ x: number; y: number } | null>) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (newStroke || !last.current) {
      ctx.beginPath();
      ctx.arc(x, y, w / 2, 0, Math.PI * 2);
      ctx.fill();
      last.current = { x, y };
      return;
    }
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
  };

  useImperativeHandle(ref, () => ({
    clear,
    drawPoints: (pts, color, width) => {
      for (const [x, y, ns] of pts) paint(x * CW, y * CH, !!ns, color, width, remoteLast);
    },
    getImage: () => {
      const cv = canvasRef.current;
      if (!cv) return '';
      const tmp = document.createElement('canvas');
      tmp.width = 240;
      tmp.height = 180;
      const tctx = tmp.getContext('2d');
      if (!tctx) return '';
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, 240, 180);
      tctx.drawImage(cv, 0, 0, 240, 180);
      return tmp.toDataURL('image/jpeg', 0.5);
    },
  }));

  const getNorm = (e: React.PointerEvent): [number, number] => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return [
      r3(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))),
      r3(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))),
    ];
  };

  const put = (e: React.PointerEvent, newStroke: boolean) => {
    const [x, y] = getNorm(e);
    const { c, w } = pen.current;
    paint(x * CW, y * CH, newStroke, c, w, lastPt);
    onPoints?.([x, y, newStroke ? 1 : 0], c, w);
  };

  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    put(e, true);
  };
  const move = (e: React.PointerEvent) => {
    if (disabled || !drawing.current) return;
    e.preventDefault();
    put(e, false);
  };
  const up = () => {
    drawing.current = false;
    lastPt.current = null;
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        onContextMenu={(e) => e.preventDefault()}
        className={`game-surface w-full aspect-[4/3] bg-white rounded-2xl shadow-2xl ${disabled ? '' : 'cursor-crosshair'}`}
        style={{ touchAction: 'none' }}
      />
      {!disabled && (
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          {COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${i + 1}`}
              onClick={() => { setColorIdx(i); setEraser(false); }}
              className={`w-12 h-12 rounded-full border-4 ${colorIdx === i && !eraser ? 'border-amber-300 scale-110' : 'border-white/30'}`}
              style={{ background: c }}
            />
          ))}
          <button
            type="button"
            onClick={() => setEraser(!eraser)}
            className={`px-4 h-12 rounded-full font-fredoka text-base border-2 ${eraser ? 'bg-amber-400/30 border-amber-300' : 'bg-white/10 border-white/30'}`}
          >
            🧽 Eraser
          </button>
          <button
            type="button"
            onClick={() => { playClick(); clear(); onClear?.(); }}
            className="px-4 h-12 rounded-full font-fredoka text-base bg-red-500/30 border-2 border-red-400"
          >
            🗑️ Clear
          </button>
        </div>
      )}
    </div>
  );
});

DrawCanvas.displayName = 'DrawCanvas';
export default DrawCanvas;
