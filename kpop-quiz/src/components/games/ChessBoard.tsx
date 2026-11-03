// Chess Academy's board: a controlled 8×8 board for touch. It knows nothing about chess rules — the
// screen passes the position (FEN), which squares a piece may go to (`legal`) and gets `onMove` back,
// so lessons can bring their own rules. Tap a piece then a target, or drag it (Pointer Events, drawn
// above the finger). Squares are buttons with labels like "e4, white knight" (arrow keys move between them).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChessPiece } from './chessPieces';
import type { PieceColor, PieceType } from './chessPieces';
import { playClick, playPop } from '../../utils/sounds';

export type Promotion = 'q' | 'r' | 'b' | 'n';
export type SquareMark = 'star' | 'hint' | 'goal' | 'good' | 'oops';

export interface ChessBoardProps {
  /** The position. Only the first field (where the pieces stand) is read. */
  fen: string;
  /** Which side is at the bottom. */
  orientation: 'w' | 'b';
  /** Whose pieces she can pick up. */
  canMove: 'w' | 'b' | 'both' | 'none';
  /** Squares the piece on `from` may move to. */
  legal: (from: string) => string[];
  onMove: (from: string, to: string, promotion?: Promotion) => void;
  /** Does from → to need the promotion picker? Default: a pawn reaching the last row. */
  needsPromotion?: (from: string, to: string) => boolean;
  /** Highlighted as the last move. */
  lastMove?: [string, string];
  /** The king in check (red glow). */
  checkSquare?: string;
  /** ⭐ lesson stars, a gentle glow for hints, 🎯 goals, ✅ good, ✖ oops. */
  marks?: Record<string, SquareMark>;
  /** Letters and numbers on the edge squares. Default true. */
  showCoords?: boolean;
  /** No picking up pieces (e.g. while the other side is moving). */
  disabled?: boolean;
  /** Slide the last move's piece into place when the position changes (taps and replies; drags land where dropped). Default true. */
  animate?: boolean;
  /** Board width and height (any CSS length). Default min(92vw, calc(100dvh - 260px), 640px). */
  size?: string;
}

interface BoardPiece { type: PieceType; color: PieceColor }

const FILES = 'abcdefgh';
const PIECE_NAMES: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const PROMOTIONS: Promotion[] = ['q', 'r', 'b', 'n'];

const LIGHT = '#efe7fb';
const DARK = '#9d86c9';
const FRAME = '#2b1652';
/** Plum ink for dots, rings and shadows (r, g, b). */
const INK = '42, 20, 80';
const DEFAULT_SIZE = 'min(92vw, calc(100dvh - 260px), 640px)';

/** A drag starts after the finger moves this far (less is a tap). */
const TAP_PX = 7;
/** The dragged piece is drawn this far above the finger so her hand doesn't hide it (0 for a mouse). */
const LIFT_PX = 40;
/** The dragged piece is a bit bigger than a square. */
const DRAG_SCALE = 1.25;
const SLIDE_BACK_MS = 170;

/** The piece placement field of a FEN → square → piece. Anything odd is skipped, never thrown. */
function parseFen(fen: string): Map<string, BoardPiece> {
  const out = new Map<string, BoardPiece>();
  const rows = (fen.trim().split(/\s+/)[0] ?? '').split('/');
  rows.slice(0, 8).forEach((row, i) => {
    const rank = 8 - i;
    let file = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) { file += Number(ch); continue; }
      const type = ch.toLowerCase();
      if (!'pnbrqk'.includes(type) || file > 7) { file++; continue; }
      out.set(`${FILES[file]}${rank}`, { type: type as PieceType, color: ch === type ? 'b' : 'w' });
      file++;
    }
  });
  return out;
}

/** Square → column/row on screen (0,0 = top left) for this orientation. */
function toCell(sq: string, orientation: 'w' | 'b'): { col: number; row: number } {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  return orientation === 'w' ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
}
function toSquare(col: number, row: number, orientation: 'w' | 'b'): string {
  return orientation === 'w' ? `${FILES[col]}${8 - row}` : `${FILES[7 - col]}${row + 1}`;
}

/** a1 is dark, h1 light. */
const isLight = (sq: string) => (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 0;

interface Drag {
  from: string;
  piece: BoardPiece;
  pointerId: number;
  startX: number;
  startY: number;
  lift: number;
  active: boolean;
  /** The piece was already selected when she touched it (a tap then deselects it). */
  wasSelected: boolean;
  rect: DOMRect;
}

interface PromoAsk { from: string; to: string; color: PieceColor; /** opened from the keyboard: focus the queen */ byKey: boolean }

export default function ChessBoard({
  fen, orientation, canMove, legal, onMove, needsPromotion, lastMove, checkSquare, marks, showCoords = true,
  disabled = false, animate = true, size = DEFAULT_SIZE,
}: ChessBoardProps) {
  const reduceMotion = useReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const floatPos = useRef('');
  const backTimer = useRef<number | undefined>(undefined);
  /** The current press began inside the promotion picker (the tap that opened it mustn't also answer it). */
  const promoPressed = useRef(false);
  /** The last square a pointer pressed, so a click the same press fires (e.g. from VoiceOver) isn't handled twice. */
  const lastPress = useRef({ sq: '', t: 0 });
  const queenRef = useRef<HTMLButtonElement>(null);

  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ from: string; piece: BoardPiece } | null>(null);
  const [promo, setPromo] = useState<PromoAsk | null>(null);
  const [focusSq, setFocusSq] = useState<string | null>(null);
  const [sqPx, setSqPx] = useState(60);
  /** The move she just made by dragging (it lands where she dropped it: no slide). */
  const [dropped, setDropped] = useState<string | null>(null);
  const [slide, setSlide] = useState<{ from: string; to: string; n: number } | null>(null);

  const pieces = parseFen(fen);
  const lastKey = lastMove ? `${lastMove[0]}${lastMove[1]}` : '';

  // A new position: forget the selection, and slide the piece that just moved (unless she dragged it).
  const posKey = `${fen}|${orientation}|${lastKey}`;
  const [seenKey, setSeenKey] = useState(posKey);
  const [seenLast, setSeenLast] = useState(lastKey);
  if (posKey !== seenKey) {
    setSeenKey(posKey);
    setSeenLast(lastKey);
    setSel(null);
    setPromo(null);
    setDropped(null);
    const fenChanged = seenKey.split('|')[0] !== fen;
    const moved = lastMove && fenChanged && lastKey !== seenLast && lastKey !== dropped && pieces.has(lastMove[1]);
    setSlide(moved && animate && !reduceMotion ? { from: lastMove[0], to: lastMove[1], n: (slide?.n ?? 0) + 1 } : null);
  }

  const interactive = !disabled && canMove !== 'none' && !promo;
  const canPick = (sq: string) => {
    const p = pieces.get(sq);
    return !!p && (canMove === 'both' || canMove === p.color);
  };
  const shownSel = interactive && sel && canPick(sel) ? sel : null;
  const targets = shownSel ? legal(shownSel) : [];
  const hoverOk = !!(dragging && hover && hover !== dragging.from && targets.includes(hover));

  // Square size in pixels (for text sizes and the dragged piece).
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => { const w = el.getBoundingClientRect().width; if (w > 0) setSqPx(w / 8); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => window.clearTimeout(backTimer.current), []);
  useEffect(() => { if (promo?.byKey) queenRef.current?.focus(); }, [promo]);

  const squareFromPoint = (x: number, y: number, rect: DOMRect): string | null => {
    const col = Math.floor(((x - rect.left) / rect.width) * 8);
    const row = Math.floor(((y - rect.top) / rect.height) * 8);
    if (col < 0 || row < 0 || col > 7 || row > 7) return null;
    return toSquare(col, row, orientation);
  };

  const defaultPromotion = (from: string, to: string) => {
    const p = pieces.get(from);
    return p?.type === 'p' && to[1] === (p.color === 'w' ? '8' : '1');
  };

  const finish = (from: string, to: string, promotion: Promotion | undefined, viaDrag: boolean) => {
    playPop();
    setSel(null);
    setPromo(null);
    setDropped(viaDrag ? `${from}${to}` : null);
    onMove(from, to, promotion);
  };

  const attempt = (from: string, to: string, viaDrag: boolean, byKey = false) => {
    const asks = needsPromotion ? needsPromotion(from, to) : defaultPromotion(from, to);
    if (asks) {
      const p = pieces.get(from);
      promoPressed.current = false;
      setPromo({ from, to, color: p?.color ?? 'w', byKey });
      if (viaDrag) setDropped(`${from}${to}`);
      return;
    }
    finish(from, to, undefined, viaDrag);
  };

  /** Enter / Space on a square (pointer presses go through onPointerDown). */
  const activate = (sq: string) => {
    if (!interactive) return;
    if (shownSel && targets.includes(sq)) { attempt(shownSel, sq, false, true); return; }
    if (canPick(sq)) {
      if (shownSel === sq) { setSel(null); return; }
      setSel(sq);
      playClick();
      return;
    }
    setSel(null);
  };

  const placeFloat = (x: number, y: number, d: Drag) => {
    const half = (sqPx * DRAG_SCALE) / 2;
    floatPos.current = `translate3d(${x - d.rect.left - half}px, ${y - d.rect.top - d.lift - half}px, 0)`;
    const el = floatRef.current;
    if (el) { el.style.transition = 'none'; el.style.transform = floatPos.current; }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || dragRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = boardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sq = squareFromPoint(e.clientX, e.clientY, rect);
    if (!sq) return;
    e.preventDefault();
    lastPress.current = { sq, t: performance.now() };
    window.clearTimeout(backTimer.current);
    if (dragging) setDragging(null); // a piece still gliding back
    if (shownSel && targets.includes(sq)) { attempt(shownSel, sq, false); return; }
    const piece = pieces.get(sq);
    if (!piece || !canPick(sq)) { setSel(null); return; }
    const wasSelected = shownSel === sq;
    if (!wasSelected) { setSel(sq); playClick(); }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    dragRef.current = {
      from: sq, piece, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY,
      lift: e.pointerType === 'mouse' ? 0 : LIFT_PX, active: false, wasSelected, rect,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < TAP_PX) return;
      d.active = true;
      setDragging({ from: d.from, piece: d.piece });
    }
    placeFloat(e.clientX, e.clientY, d);
    const over = squareFromPoint(e.clientX, e.clientY, d.rect);
    if (over !== hover) setHover(over);
  };

  /** An illegal drop: the piece glides back to its square. */
  const slideBack = (d: Drag) => {
    setHover(null);
    const el = floatRef.current;
    if (!el || reduceMotion) { setDragging(null); return; }
    const { col, row } = toCell(d.from, orientation);
    const off = (sqPx * (DRAG_SCALE - 1)) / 2;
    el.style.transition = `transform ${SLIDE_BACK_MS}ms ease-out`;
    el.style.transform = `translate3d(${col * sqPx - off}px, ${row * sqPx - off}px, 0)`;
    backTimer.current = window.setTimeout(() => setDragging(null), SLIDE_BACK_MS);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    if (!d.active) {
      if (d.wasSelected) setSel(null); // tapped the selected piece again
      return;
    }
    const over = squareFromPoint(e.clientX, e.clientY, d.rect);
    if (interactive && over && over !== d.from && legal(d.from).includes(over)) {
      setHover(null);
      setDragging(null);
      attempt(d.from, over, true);
      return;
    }
    if (over === d.from) { setHover(null); setDragging(null); return; } // put back down: still selected
    slideBack(d);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    if (d.active) slideBack(d);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, sq: string) => {
    const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (e.key === 'Escape') { setSel(null); setPromo(null); return; }
    const s = step[e.key];
    if (!s) return;
    e.preventDefault();
    const { col, row } = toCell(sq, orientation);
    const c = Math.min(7, Math.max(0, col + s[0])), r = Math.min(7, Math.max(0, row + s[1]));
    const next = toSquare(c, r, orientation);
    setFocusSq(next);
    boardRef.current?.querySelector<HTMLButtonElement>(`[data-square="${next}"]`)?.focus();
  };

  const tabSquare = focusSq ?? shownSel ?? (orientation === 'w' ? 'e2' : 'e7');
  const fontPx = Math.max(11, Math.round(sqPx * 0.2));
  const markPx = Math.round(sqPx * 0.56);
  const lastSet = new Set(lastMove ?? []);

  // ---------- squares ----------
  const squares: string[] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) squares.push(toSquare(col, row, orientation));

  const renderSquare = (sq: string) => {
    const { col, row } = toCell(sq, orientation);
    const light = isLight(sq);
    const piece = pieces.get(sq);
    const target = targets.includes(sq) ? (piece ? 'capture' : 'move') : undefined;
    const mark = marks?.[sq];
    // a ring (not a dot) where a piece or a ⭐/🎯 already fills the square
    const ringTarget = target === 'capture' || (target === 'move' && (mark === 'star' || mark === 'goal'));
    const label = piece ? `${sq}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}` : sq;
    const coordColor = light ? DARK : LIGHT;
    const corner = (side: 'tl' | 'br', text: string) => (
      <span
        aria-hidden
        className="absolute font-nunito font-extrabold leading-none pointer-events-none"
        style={{
          color: coordColor, fontSize: fontPx,
          ...(side === 'tl' ? { left: '6%', top: '5%' } : { right: '7%', bottom: '5%' }),
        }}
      >{text}</span>
    );
    const badge = (text: string, bg: string) => (
      <span
        aria-hidden
        className="absolute right-[3%] top-[3%] flex items-center justify-center rounded-full font-nunito font-black text-white leading-none shadow"
        style={{ width: sqPx * 0.34, height: sqPx * 0.34, fontSize: sqPx * 0.2, background: bg }}
      >{text}</span>
    );
    return (
      <button
        key={sq}
        type="button"
        data-square={sq}
        data-piece={piece ? `${piece.color}${piece.type}` : undefined}
        data-target={target}
        data-selected={shownSel === sq || undefined}
        data-mark={mark}
        aria-label={label}
        aria-pressed={shownSel === sq ? true : undefined}
        tabIndex={sq === tabSquare ? 0 : -1}
        onClick={e => {
          // Pointer presses are handled in onPointerDown; this is for Enter / Space (and switch access).
          const p = lastPress.current;
          if (e.detail === 0 && !(p.sq === sq && performance.now() - p.t < 600)) activate(sq);
        }}
        onKeyDown={e => onKeyDown(e, sq)}
        onFocus={() => setFocusSq(sq)}
        className="relative block h-full w-full p-0 outline-none focus-visible:z-10 focus-visible:shadow-[inset_0_0_0_4px_#22d3ee]"
        style={{ background: light ? LIGHT : DARK, cursor: interactive && (canPick(sq) || target) ? 'pointer' : 'default' }}
      >
        {lastSet.has(sq) && <span aria-hidden className="absolute inset-0" style={{ background: light ? 'rgba(255, 218, 80, 0.55)' : 'rgba(255, 214, 90, 0.66)' }} />}
        {shownSel === sq && (
          <span aria-hidden className="absolute inset-0" style={{ background: 'rgba(255, 196, 30, 0.62)', boxShadow: 'inset 0 0 0 4px rgba(122, 72, 0, 0.55)' }} />
        )}
        {mark === 'good' && <span aria-hidden className="absolute inset-0" style={{ background: 'rgba(52, 211, 153, 0.5)' }} />}
        {mark === 'oops' && (
          <span aria-hidden className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(251,146,60,0.5) 0 6px, rgba(251,146,60,0.25) 6px 12px)' }} />
        )}
        {mark === 'hint' && (
          <motion.span
            aria-hidden className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle, #fff8d2 0%, #ffe783 55%, #ffd447 100%)',
              boxShadow: 'inset 0 0 0 4px rgba(250, 204, 21, 0.95), 0 0 14px 4px rgba(255, 220, 90, 0.8)',
            }}
            animate={reduceMotion ? undefined : { opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        {mark === 'goal' && (
          <span aria-hidden className="absolute rounded-full" style={{ inset: '9%', border: `${Math.max(3, sqPx * 0.06)}px dashed rgba(255,255,255,0.95)`, boxShadow: `0 0 0 2px rgba(${INK}, 0.45), inset 0 0 0 2px rgba(${INK}, 0.45)` }} />
        )}
        {checkSquare === sq && (
          <span
            aria-hidden className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle, rgba(255, 50, 80, 1) 0%, rgba(240, 30, 70, 0.85) 34%, rgba(240, 30, 70, 0.35) 62%, rgba(240, 30, 70, 0) 80%)',
              boxShadow: 'inset 0 0 0 3px rgba(220, 20, 60, 0.85)',
            }}
          />
        )}
        {hoverOk && hover === sq && (
          <span aria-hidden className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.4)', boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.95)' }} />
        )}
        {showCoords && col === 0 && corner('tl', sq[1])}
        {showCoords && row === 7 && corner('br', sq[0])}
        {mark === 'star' && !piece && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center leading-none" style={{ fontSize: markPx, filter: `drop-shadow(0 2px 2px rgba(${INK}, 0.45))` }}>⭐</span>
        )}
        {mark === 'goal' && !piece && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center leading-none" style={{ fontSize: markPx * 0.7 }}>🎯</span>
        )}
        {mark === 'star' && piece && badge('⭐', `rgba(${INK}, 0.75)`)}
        {mark === 'good' && badge('✓', '#059669')}
        {mark === 'oops' && badge('✕', '#ea580c')}
        {target === 'move' && !ringTarget && (
          <span aria-hidden className="absolute rounded-full" style={{ left: '34%', top: '34%', width: '32%', height: '32%', background: `rgba(${INK}, 0.42)`, boxShadow: '0 0 0 2px rgba(255,255,255,0.55)' }} />
        )}
        {ringTarget && (
          <span aria-hidden className="absolute rounded-full" style={{ inset: '3%', border: `${Math.max(4, sqPx * 0.08)}px solid rgba(${INK}, 0.5)`, boxShadow: '0 0 0 2px rgba(255,255,255,0.5), inset 0 0 0 2px rgba(255,255,255,0.5)' }} />
        )}
      </button>
    );
  };

  // ---------- pieces ----------
  const pieceBox = (col: number, row: number): CSSProperties => ({
    position: 'absolute', left: `${col * 12.5}%`, top: `${row * 12.5}%`, width: '12.5%', height: '12.5%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
  });

  const pieceEls = [...pieces.entries()].map(([sq, p]) => {
    const { col, row } = toCell(sq, orientation);
    // her piece stays faintly on its square while she drags it or picks what it becomes
    const faded = dragging?.from === sq || promo?.from === sq;
    const art = <ChessPiece type={p.type} color={p.color} size="88%" />;
    if (slide && slide.to === sq) {
      const a = toCell(slide.from, orientation);
      return (
        <motion.div
          key={`${sq}-slide${slide.n}`}
          style={{ ...pieceBox(col, row), opacity: faded ? 0.3 : 1 }}
          initial={{ x: `${(a.col - col) * 100}%`, y: `${(a.row - row) * 100}%` }}
          animate={{ x: '0%', y: '0%' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >{art}</motion.div>
      );
    }
    return (
      <div key={sq} style={{ ...pieceBox(col, row), opacity: faded ? 0.3 : 1, transition: 'opacity 120ms' }}>{art}</div>
    );
  });

  const hoverCell = hoverOk && hover ? toCell(hover, orientation) : null;
  const promoBtn = Math.max(56, Math.min(96, sqPx * 1.3));

  return (
    <div
      ref={boardRef}
      className="relative game-surface select-none rounded-xl"
      style={{ width: size, height: size, touchAction: 'none', boxShadow: `0 0 0 6px ${FRAME}, 0 14px 34px rgba(10, 2, 30, 0.55)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={e => e.preventDefault()}
      role="group"
      aria-label="Chess board"
      aria-disabled={disabled || canMove === 'none' || undefined}
    >
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 overflow-hidden rounded-xl">{squares.map(renderSquare)}</div>

      {/* where a dragged piece will land: a big soft circle that shows round her finger */}
      {hoverCell && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${(hoverCell.col - 0.5) * 12.5}%`, top: `${(hoverCell.row - 0.5) * 12.5}%`, width: '25%', height: '25%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.32) 55%, rgba(255,255,255,0) 72%)',
          }}
        />
      )}

      <div aria-hidden className="pointer-events-none absolute inset-0">{pieceEls}</div>

      {dragging && (
        <div
          ref={el => { floatRef.current = el; if (el && floatPos.current && !el.style.transform) el.style.transform = floatPos.current; }}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-30"
          style={{ width: sqPx * DRAG_SCALE, height: sqPx * DRAG_SCALE, filter: 'drop-shadow(0 10px 10px rgba(10, 2, 30, 0.45))' }}
        >
          <ChessPiece type={dragging.piece.type} color={dragging.piece.color} size="100%" shadow={false} />
        </div>
      )}

      {promo && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(22, 8, 46, 0.62)' }}
          onPointerDown={e => { e.stopPropagation(); promoPressed.current = true; }}
          onClick={e => { if (e.target === e.currentTarget && promoPressed.current) { playClick(); setPromo(null); setSel(null); } }}
        >
          <motion.div
            role="dialog"
            aria-label="Pick your new piece"
            className="rounded-3xl border-4 border-fuchsia-300 bg-violet-950 px-4 pb-3 pt-3 text-center shadow-2xl"
            initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <p className="mb-2 font-fredoka text-xl text-white">Your pawn made it! Pick a piece:</p>
            <div className="flex justify-center gap-2">
              {PROMOTIONS.map((t, i) => (
                <button
                  key={t}
                  ref={i === 0 ? queenRef : undefined}
                  type="button"
                  aria-label={PIECE_NAMES[t][0].toUpperCase() + PIECE_NAMES[t].slice(1)}
                  onClick={e => { if (e.detail === 0 || promoPressed.current) finish(promo.from, promo.to, t, dropped === `${promo.from}${promo.to}`); }}
                  className={`flex flex-col items-center justify-center rounded-2xl p-1 outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 active:scale-95 transition-transform ${i === 0 ? 'bg-amber-200 ring-4 ring-amber-400' : 'bg-violet-200'}`}
                  style={{ width: promoBtn, height: promoBtn }}
                >
                  <ChessPiece type={t} color={promo.color} size="100%" shadow={false} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={e => { if (e.detail === 0 || promoPressed.current) { playClick(); setPromo(null); setSel(null); } }}
              className="mt-2 min-h-[44px] rounded-full px-5 font-fredoka text-lg text-violet-200"
            >↩ Not now</button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
