import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { playClick } from '../../utils/sounds';

// A self-contained kid drawing surface. The parent grabs the finished picture
// as a small JPEG dataURL via the imperative handle (used by Picture Telephone).

export interface DrawCanvasHandle {
  getImage: () => string; // downscaled JPEG dataURL (~240×180)
  clear: () => void;
}

const CW = 640;
const CH = 480;
const COLORS = ['#1f2937', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#92400e'];
const ERASER = '#ffffff';

const DrawCanvas = forwardRef<DrawCanvasHandle, { disabled?: boolean }>(({ disabled }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
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
  };

  useImperativeHandle(ref, () => ({
    clear,
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

  const getXY = (e: React.PointerEvent): [number, number] => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * CW,
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * CH,
    ];
  };

  const stroke = (x: number, y: number, newStroke: boolean) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { c, w } = pen.current;
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (newStroke || !lastPt.current) {
      ctx.beginPath();
      ctx.arc(x, y, w / 2, 0, Math.PI * 2);
      ctx.fill();
      lastPt.current = { x, y };
      return;
    }
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPt.current = { x, y };
  };

  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    drawing.current = true;
    const [x, y] = getXY(e);
    stroke(x, y, true);
  };
  const move = (e: React.PointerEvent) => {
    if (disabled || !drawing.current) return;
    e.preventDefault();
    const [x, y] = getXY(e);
    stroke(x, y, false);
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
        onPointerLeave={up}
        className={`w-full aspect-[4/3] bg-white rounded-2xl shadow-2xl ${disabled ? '' : 'cursor-crosshair'}`}
        style={{ touchAction: 'none' }}
      />
      {!disabled && (
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          {COLORS.map((c, i) => (
            <button
              key={c}
              onClick={() => { setColorIdx(i); setEraser(false); }}
              className={`w-9 h-9 rounded-full border-4 ${colorIdx === i && !eraser ? 'border-amber-300 scale-110' : 'border-white/30'}`}
              style={{ background: c }}
            />
          ))}
          <button
            onClick={() => setEraser(!eraser)}
            className={`px-3 h-9 rounded-full font-fredoka text-sm border-2 ${eraser ? 'bg-amber-400/30 border-amber-300' : 'bg-white/10 border-white/30'}`}
          >
            🧽 Eraser
          </button>
          <button
            onClick={() => { playClick(); clear(); }}
            className="px-3 h-9 rounded-full font-fredoka text-sm bg-red-500/30 border-2 border-red-400"
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
