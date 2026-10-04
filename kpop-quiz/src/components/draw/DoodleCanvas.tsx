import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { playClick, playPop } from '../../utils/sounds';
import {
  BOARD_W, BOARD_H, COLORS, SIZES, BASE_STICKERS, STICKER_DEFAULT,
  pushOp, undo as undoOp, fitBoard, toBoard, addPoint, stickerSize, rainbowColor, hexToRgba, floodFill,
  type DoodleOp, type History, type StrokeOp, type StickerOp, type Tool,
} from './doodleLogic';

// The one drawing surface on the site: the Doodle Pad, the sticker board, and Truth or Dare's
// "Draw it" dares. The picture lives on a fixed-size offscreen board; the screen canvas shows it
// letterboxed and sharp at the device pixel ratio.

export interface DoodleHandle {
  /** The picture with its background, as a PNG. */
  toBlob(): Promise<Blob | null>;
  /** A small JPEG preview for the gallery. */
  thumbnail(): string;
  clear(): void;
  isEmpty(): boolean;
}

interface Props {
  background: string;
  compact?: boolean;
  initialTool?: Tool;
  /** Picture to start from (e.g. a saved doodle); its contents can't be undone. */
  initialImage?: Blob | null;
  /** Locker stickers the player owns, shown first in the sticker tray. */
  extraStickers?: string[];
  onEdit?: () => void;
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function makeBoard() {
  const c = document.createElement('canvas');
  c.width = BOARD_W; c.height = BOARD_H;
  return c;
}

function renderOp(ctx: CanvasRenderingContext2D, op: DoodleOp) {
  ctx.save();
  if (op.type === 'sticker') {
    ctx.font = `${op.size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(op.emoji, op.x, op.y);
  } else if (op.type === 'fill') {
    const img = ctx.getImageData(0, 0, BOARD_W, BOARD_H);
    floodFill(img.data, BOARD_W, BOARD_H, op.x, op.y, hexToRgba(op.color));
    ctx.putImageData(img, 0, 0);
  } else {
    drawStroke(ctx, op);
  }
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, op: StrokeOp) {
  const p = op.points;
  if (p.length < 2) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const width = op.tool === 'marker' ? op.size * 2 : op.size;
  ctx.lineWidth = width;
  if (op.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
  if (op.tool === 'marker') ctx.globalAlpha = 0.4;
  if (p.length === 2) {
    // A tap: a dot.
    ctx.fillStyle = op.tool === 'rainbow' ? rainbowColor(0) : op.color;
    ctx.beginPath();
    ctx.arc(p[0], p[1], width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (op.tool === 'rainbow') {
    for (let i = 2; i < p.length; i += 2) {
      ctx.strokeStyle = rainbowColor(i / 2);
      ctx.beginPath();
      ctx.moveTo(p[i - 2], p[i - 1]);
      ctx.lineTo(p[i], p[i + 1]);
      ctx.stroke();
    }
    return;
  }
  // Smooth curve through the midpoints, stroked once so the marker's transparency stays even.
  ctx.strokeStyle = op.color;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
    ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
  }
  ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  ctx.stroke();
}

const TOOLS: { id: Tool; icon: string; label: string; compact: boolean }[] = [
  { id: 'pen', icon: '✏️', label: 'Pen', compact: true },
  { id: 'marker', icon: '🖍️', label: 'Marker', compact: false },
  { id: 'rainbow', icon: '🌈', label: 'Rainbow', compact: true },
  { id: 'eraser', icon: '🧽', label: 'Eraser', compact: true },
  { id: 'fill', icon: '🪣', label: 'Fill', compact: false },
  { id: 'sticker', icon: '😀', label: 'Stickers', compact: true },
];

const DoodleCanvas = forwardRef<DoodleHandle, Props>(function DoodleCanvas(
  { background, compact = false, initialTool = 'pen', initialImage, extraStickers = [], onEdit }, ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const board = useRef<HTMLCanvasElement | null>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  const history = useRef<History>({ ops: [] });
  const live = useRef<{ op: StrokeOp | StickerOp; pointer: number; sx: number; sy: number } | null>(null);
  const dirty = useRef(true);
  const bgRef = useRef(background);
  const [tool, setTool] = useState<Tool>(initialTool);
  const [color, setColor] = useState(COLORS[1]);
  const [brush, setBrush] = useState(SIZES[1]);
  const [sticker, setSticker] = useState(extraStickers[0] ?? BASE_STICKERS[0]);
  const [canUndo, setCanUndo] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const stickers = [...new Set([...extraStickers, ...BASE_STICKERS])];

  bgRef.current = background;
  useEffect(() => { dirty.current = true; }, [background]);

  if (!board.current && typeof document !== 'undefined') { board.current = makeBoard(); base.current = makeBoard(); }

  const recompose = useCallback(() => {
    const b = board.current!.getContext('2d')!;
    b.clearRect(0, 0, BOARD_W, BOARD_H);
    b.drawImage(base.current!, 0, 0);
    for (const op of history.current.ops) renderOp(b, op);
    dirty.current = true;
  }, []);

  // Start from a saved picture.
  useEffect(() => {
    if (!initialImage) return;
    let cancelled = false;
    createImageBitmap(initialImage).then(bmp => {
      if (cancelled) return;
      const ctx = base.current!.getContext('2d')!;
      ctx.clearRect(0, 0, BOARD_W, BOARD_H);
      ctx.drawImage(bmp, 0, 0, BOARD_W, BOARD_H);
      history.current = { ops: [] };
      setCanUndo(false);
      recompose();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [initialImage, recompose]);

  const commit = useCallback((op: DoodleOp) => {
    const { history: h, flatten } = pushOp(history.current, op);
    history.current = h;
    if (flatten.length) {
      const bctx = base.current!.getContext('2d')!;
      for (const f of flatten) renderOp(bctx, f);
    }
    renderOp(board.current!.getContext('2d')!, op);
    dirty.current = true;
    setCanUndo(true);
    onEdit?.();
  }, [onEdit]);

  // Draw loop: only repaints when something changed.
  useEffect(() => {
    let raf = 0;
    let drawnW = 0, drawnH = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Size from layout (clientWidth), not getBoundingClientRect: the card flips in with a 3D
      // transform, which would give a squashed size. Resizing clears the canvas, so repaint then.
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (pw !== drawnW || ph !== drawnH) {
        drawnW = pw; drawnH = ph;
        canvas.width = pw; canvas.height = ph;
        dirty.current = true;
      }
      if (!dirty.current) return;
      dirty.current = false;
      const ctx = canvas.getContext('2d');
      if (!ctx || !w) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const fit = fitBoard(w, h);
      ctx.fillStyle = bgRef.current;
      ctx.fillRect(fit.x, fit.y, BOARD_W * fit.scale, BOARD_H * fit.scale);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(board.current!, fit.x, fit.y, BOARD_W * fit.scale, BOARD_H * fit.scale);
      if (live.current) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(fit.x, fit.y, BOARD_W * fit.scale, BOARD_H * fit.scale);
        ctx.clip();
        ctx.translate(fit.x, fit.y);
        ctx.scale(fit.scale, fit.scale);
        // The eraser can't preview with destination-out on the screen, so show it as background.
        const op = live.current.op;
        renderOp(ctx, op.type === 'stroke' && op.tool === 'eraser' ? { ...op, tool: 'pen', color: bgRef.current } : op);
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const boardPoint = (e: React.PointerEvent | PointerEvent): [number, number] => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    // Scale from on-screen (possibly transformed) size back to layout size.
    const sx = c.clientWidth / (rect.width || 1), sy = c.clientHeight / (rect.height || 1);
    return toBoard(fitBoard(c.clientWidth, c.clientHeight), (e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (live.current) return; // one finger draws; a second finger (or a palm) is ignored
    e.preventDefault();
    const [x, y] = boardPoint(e);
    if (tool === 'fill') { commit({ type: 'fill', color, x, y }); playPop(); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'sticker') {
      live.current = { op: { type: 'sticker', emoji: sticker, x, y, size: STICKER_DEFAULT }, pointer: e.pointerId, sx: x, sy: y };
      playPop();
    } else {
      const op: StrokeOp = { type: 'stroke', tool, color, size: tool === 'eraser' ? brush * 2 : brush, points: [] };
      addPoint(op.points, x, y);
      live.current = { op, pointer: e.pointerId, sx: x, sy: y };
    }
    dirty.current = true;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || e.pointerId !== l.pointer) return;
    if (l.op.type === 'sticker') {
      const [x, y] = boardPoint(e);
      l.op.size = stickerSize(Math.hypot(x - l.sx, y - l.sy));
    } else {
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events.length ? events : [e.nativeEvent]) {
        const [x, y] = boardPoint(ev);
        addPoint(l.op.points, x, y);
      }
    }
    dirty.current = true;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const l = live.current;
    if (!l || e.pointerId !== l.pointer) return;
    live.current = null;
    commit(l.op);
  };

  useImperativeHandle(ref, () => ({
    toBlob: () => new Promise(resolve => {
      const out = makeBoard();
      const ctx = out.getContext('2d')!;
      ctx.fillStyle = bgRef.current;
      ctx.fillRect(0, 0, BOARD_W, BOARD_H);
      ctx.drawImage(board.current!, 0, 0);
      out.toBlob(b => resolve(b), 'image/png');
    }),
    thumbnail: () => {
      const t = document.createElement('canvas');
      t.width = 240; t.height = 180;
      const ctx = t.getContext('2d')!;
      ctx.fillStyle = bgRef.current;
      ctx.fillRect(0, 0, 240, 180);
      ctx.drawImage(board.current!, 0, 0, 240, 180);
      return t.toDataURL('image/jpeg', 0.7);
    },
    clear: () => clearAll(),
    isEmpty: () => history.current.ops.length === 0 && !initialImage,
  }));

  const clearAll = () => {
    base.current!.getContext('2d')!.clearRect(0, 0, BOARD_W, BOARD_H);
    history.current = { ops: [] };
    setCanUndo(false);
    recompose();
  };

  const doUndo = () => {
    playClick();
    history.current = undoOp(history.current);
    setCanUndo(history.current.ops.length > 0);
    recompose();
  };

  const btn = (active: boolean) =>
    `min-w-[48px] min-h-[48px] px-2 rounded-xl font-fredoka text-base flex flex-col items-center justify-center gap-0.5 ${active ? 'bg-fuchsia-500 text-white shadow' : 'bg-white/15 text-white'}`;
  const tools = TOOLS.filter(t => !compact || t.compact);
  const showColors = tool === 'pen' || tool === 'marker' || tool === 'fill';
  const showSizes = !compact && (tool === 'pen' || tool === 'marker' || tool === 'rainbow' || tool === 'eraser');

  return (
    <div className="flex flex-col gap-2 w-full h-full min-h-0">
      <div className="relative flex-1 min-h-[220px] rounded-2xl overflow-hidden bg-black/20">
        <canvas
          ref={canvasRef}
          data-testid="doodle-canvas"
          className="absolute inset-0 w-full h-full game-surface"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Drawing tools">
        {tools.map(t => (
          <button key={t.id} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => { playClick(); setTool(t.id); }} className={btn(tool === t.id)}>
            <span className="text-2xl leading-none">{t.icon}</span>
            {!compact && <span className="text-xs">{t.label}</span>}
          </button>
        ))}
        <span className="flex-1" />
        <button aria-label="Undo" disabled={!canUndo} onClick={doUndo} className={`${btn(false)} disabled:opacity-40`}>
          <span className="text-2xl leading-none">↩️</span>{!compact && <span className="text-xs">Undo</span>}
        </button>
        <button aria-label={confirmClear ? 'Tap again to clear' : 'Clear'}
          onClick={() => { playClick(); if (confirmClear) { clearAll(); setConfirmClear(false); onEdit?.(); } else { setConfirmClear(true); window.setTimeout(() => setConfirmClear(false), 2500); } }}
          className={`${btn(confirmClear)} ${confirmClear ? '!bg-red-500' : ''}`}>
          <span className="text-2xl leading-none">🗑️</span>{!compact && <span className="text-xs">{confirmClear ? 'Sure?' : 'Clear'}</span>}
        </button>
      </div>

      {showColors && (
        <div className="flex flex-wrap gap-2" aria-label="Colours">
          {(compact ? COLORS.slice(0, 8) : COLORS).map(c => (
            <button key={c} aria-label={`Colour ${c}`} onClick={() => { playClick(); setColor(c); }}
              className={`w-11 h-11 rounded-full border-4 ${color === c ? 'border-white scale-110' : 'border-white/20'}`} style={{ background: c }} />
          ))}
        </div>
      )}
      {showSizes && (
        <div className="flex gap-2" aria-label="Brush size">
          {SIZES.map(s => (
            <button key={s} aria-label={`Brush ${s}`} onClick={() => { playClick(); setBrush(s); }} className={btn(brush === s)}>
              <span className="rounded-full bg-white" style={{ width: Math.min(32, s + 4), height: Math.min(32, s + 4) }} />
            </button>
          ))}
        </div>
      )}
      {tool === 'sticker' && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Stickers">
          {stickers.map(s => (
            <button key={s} aria-label={`Sticker ${s}`} onClick={() => { playClick(); setSticker(s); }}
              className={`shrink-0 w-12 h-12 rounded-xl text-3xl ${sticker === s ? 'bg-fuchsia-500' : 'bg-white/15'}`}>{s}</button>
          ))}
        </div>
      )}
      {tool === 'sticker' && !compact && <p className="font-nunito text-sm text-violet-200">Tap to stick it — keep your finger down and drag to make it bigger.</p>}
    </div>
  );
});

export default DoodleCanvas;
