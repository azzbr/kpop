import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';
import { playCoin, playPerfect, playPop, playWrong } from '../../utils/sounds';
import { BOARD, COLORS, canPlace, fitsAnywhere, isGameOver, newGame, place, shapeSize } from './blockBlastLogic';
import type { BlastState, Piece, Shape } from './blockBlastLogic';

/** How far above the finger the dragged piece is drawn, so her hand never hides it. */
const LIFT_PX = 80;
const TRAY_SCALE = 0.5;

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');

interface Drag { slot: number; pointerId: number; x: number; y: number }
interface Burst { key: string; index: number; color: number }
interface Float { id: number; text: string; big: boolean }
interface Layout { cell: number; landscape: boolean }

export default function BlockBlast() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [game, setGame] = useState<BlastState | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [placedAt, setPlacedAt] = useState<{ cells: Set<number>; n: number }>({ cells: new Set(), n: 0 });
  const [shake, setShake] = useState(-1);
  const [over, setOver] = useState({ score: 0, lines: 0, bestCombo: 0 });
  const [layout, setLayout] = useState<Layout>({ cell: 48, landscape: false });

  const rngRef = useRef<Rng>(createRng(1));
  const gameRef = useRef<BlastState | null>(null);
  gameRef.current = game;
  const statusRef = useRef(status);
  statusRef.current = status;
  const areaRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const uid = useRef(0);

  // Size the board to the screen (portrait: board above tray; landscape: tray beside the board).
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect();
      const landscape = w > h * 1.15;
      const cell = landscape
        ? Math.min((w * 0.6 - 24) / BOARD, (h - 110) / BOARD)
        : Math.min((w - 32) / BOARD, (h - 290) / BOARD);
      setLayout({ cell: Math.max(28, Math.min(72, Math.floor(cell))), landscape });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { cell, landscape } = layout;

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) : Math.floor(Math.random() * 1e9);
    rngRef.current = createRng(seed);
    setGame(newGame(rngRef.current));
    setBursts([]);
    setFloats([]);
    setDrag(null);
    setPlacedAt({ cells: new Set(), n: 0 });
    setRound(r => r + 1);
    setStatus('playing');
  }, []);

  /** Where the dragged piece would land: top-left board cell, snapped to the nearest fit within 1 cell. */
  const target = useCallback((d: Drag, shape: Shape): { row: number; col: number; fits: boolean; overBoard: boolean } | null => {
    const boardEl = boardRef.current;
    if (!boardEl) return null;
    const rect = boardEl.getBoundingClientRect();
    const { rows, cols } = shapeSize(shape);
    const pieceLeft = d.x - (cols * cell) / 2;
    const pieceTop = d.y - LIFT_PX - (rows - 0.5) * cell;
    // Cells sit inside the board's border.
    const fc = (pieceLeft - rect.left - boardEl.clientLeft) / cell;
    const fr = (pieceTop - rect.top - boardEl.clientTop) / cell;
    const overBoard = fc > -cols + 0.5 && fr > -rows + 0.5 && fc < BOARD - 0.5 && fr < BOARD - 0.5;
    if (!overBoard) return { row: Math.round(fr), col: Math.round(fc), fits: false, overBoard: false };
    const g = gameRef.current!;
    const candidates: [number, number][] = [];
    const r0 = Math.round(fr);
    const c0 = Math.round(fc);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) candidates.push([r0 + dr, c0 + dc]);
    candidates.sort((a, b) => Math.hypot(a[0] - fr, a[1] - fc) - Math.hypot(b[0] - fr, b[1] - fc));
    for (const [r, c] of candidates) {
      // Only snap if the finger is reasonably close (within ~0.75 cell) to that spot.
      if (Math.hypot(r - fr, c - fc) > 0.85) break;
      if (canPlace(g.board, shape, r, c)) return { row: r, col: c, fits: true, overBoard };
    }
    return { row: r0, col: c0, fits: false, overBoard };
  }, [cell]);

  const drop = useCallback((d: Drag) => {
    const g = gameRef.current;
    const piece = g?.tray[d.slot];
    if (!g || !piece) return;
    const t = target(d, piece.shape);
    if (!t || !t.fits) {
      if (t?.overBoard) playWrong();
      setShake(d.slot);
      setTimeout(() => setShake(-1), 400);
      return;
    }
    const res = place(g, d.slot, t.row, t.col, rngRef.current);
    if (!res.ok) return;
    gameRef.current = res.state;
    setGame(res.state);
    setPlacedAt(p => ({ cells: new Set(piece.shape.map(([r, c]) => (t.row + r) * BOARD + t.col + c)), n: p.n + 1 }));

    const lines = res.clearedRows.length + res.clearedCols.length;
    if (lines) {
      const n = ++uid.current;
      setBursts(b => [...b, ...res.cleared.map(c => ({ key: `${n}-${c.index}`, index: c.index, color: c.color }))]);
      setTimeout(() => setBursts(b => b.filter(x => !x.key.startsWith(`${n}-`))), 600);
      const combo = res.state.combo;
      const text = `+${res.gained}${lines > 1 ? ` · ${lines} lines!` : ''}${combo > 1 ? ` · Combo ×${combo}` : ''}`;
      setFloats(f => [...f.slice(-2), { id: n, text, big: lines > 1 || combo > 1 }]);
      setTimeout(() => setFloats(f => f.filter(x => x.id !== n)), 1200);
      if (combo > 1 || lines > 1) playPerfect(); else playCoin();
    } else {
      playPop();
    }

    if (isGameOver(res.state)) {
      setTimeout(() => {
        setOver({ score: res.state.score, lines: res.state.lines, bestCombo: res.state.bestCombo });
        setStatus('over');
      }, 900);
    }
  }, [target]);

  // While dragging, follow the finger anywhere on screen.
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const dragPointer = drag ? drag.pointerId : null;
  useEffect(() => {
    if (dragPointer === null) return;
    const id = dragPointer;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      setDrag(d => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const d = dragRef.current;
      setDrag(null);
      if (d && e.type === 'pointerup' && statusRef.current === 'playing') drop({ ...d, x: e.clientX, y: e.clientY });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragPointer, drop]);

  // Stop dragging if the game pauses or ends mid-drag.
  useEffect(() => { if (status !== 'playing') setDrag(null); }, [status]);

  const startDrag = (slot: number, e: React.PointerEvent) => {
    const g = gameRef.current;
    if (!g?.tray[slot] || statusRef.current !== 'playing' || dragRef.current) return;
    e.preventDefault();
    setDrag({ slot, pointerId: e.pointerId, x: e.clientX, y: e.clientY });
  };

  // Debug hook: ?debug&seed=42 → window.__game.place(slot, row, col)
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      get state() { return gameRef.current; },
      get status() { return statusRef.current; },
      start,
      place: (slot: number, row: number, col: number) => {
        const g = gameRef.current;
        if (!g) return false;
        const res = place(g, slot, row, col, rngRef.current);
        if (res.ok) { gameRef.current = res.state; setGame(res.state); }
        return res.ok;
      },
    };
    (window as unknown as { __game: typeof api }).__game = api;
    return () => { delete (window as unknown as { __game?: unknown }).__game; };
  }, [start]);

  const draggedPiece = drag && game ? game.tray[drag.slot] : null;
  const ghost = drag && draggedPiece ? target(drag, draggedPiece.shape) : null;
  const ghostCells = new Map<number, boolean>();
  if (ghost?.overBoard && draggedPiece) {
    for (const [dr, dc] of draggedPiece.shape) {
      const r = ghost.row + dr;
      const c = ghost.col + dc;
      if (r >= 0 && c >= 0 && r < BOARD && c < BOARD) ghostCells.set(r * BOARD + c, ghost.fits);
    }
  }
  const areaRect = areaRef.current?.getBoundingClientRect();
  const boardPx = cell * BOARD;

  return (
    <GameShell
      gameId="block_blast"
      title="Block Blast"
      icon="🧱"
      xpScale={12}
      status={status}
      score={over.score}
      round={round}
      overTitle="No more room!"
      overStats={[
        { label: 'Lines cleared', value: String(over.lines) },
        { label: 'Best combo', value: over.bestCombo > 1 ? `×${over.bestCombo}` : '—' },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <ul className="text-left font-nunito text-base text-violet-100 space-y-1">
          <li>👆 <b>Drag</b> a block from the tray onto the board.</li>
          <li>🧹 Fill a whole <b>row or column</b> to clear it.</li>
          <li>🔥 Clear lines move after move for a <b>combo</b> — more points!</li>
          <li>🧩 The game ends when none of your blocks fit.</li>
        </ul>
      }
    >
      <div ref={areaRef} className={`absolute inset-0 game-surface flex items-center justify-center gap-4 p-4 ${landscape ? 'flex-row' : 'flex-col'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex gap-3 font-fredoka" style={{ width: boardPx }}>
            <div className="flex-1 rounded-2xl bg-black/35 px-4 py-2">
              <div className="font-nunito text-base text-violet-200">Score</div>
              <div className="text-3xl text-yellow-300 tabular-nums">{(game?.score ?? 0).toLocaleString()}</div>
            </div>
            <div className="rounded-2xl bg-black/35 px-4 py-2 text-center min-w-[96px]">
              <div className="font-nunito text-base text-violet-200">Combo</div>
              <div className={`text-3xl tabular-nums ${game && game.combo > 1 ? 'text-orange-300' : ''}`}>
                {game && game.combo > 0 ? `🔥×${game.combo}` : '—'}
              </div>
            </div>
          </div>

          {/* Board */}
          <div ref={boardRef} className="relative rounded-2xl bg-indigo-900/80 border-2 border-fuchsia-400/40 shadow-2xl"
            style={{ width: boardPx + 4, height: boardPx + 4 }}>
            {game?.board.map((v, i) => {
              const g = ghostCells.get(i);
              const placedNow = placedAt.cells.has(i);
              return (
                <motion.div
                  key={placedNow ? `p${placedAt.n}-${i}` : `c${i}`}
                  initial={placedNow ? { scale: 0.7 } : false}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className="absolute"
                  style={{ left: (i % BOARD) * cell, top: Math.floor(i / BOARD) * cell, width: cell, height: cell, padding: 2 }}
                >
                  <div className="w-full h-full rounded-md"
                    style={v ? blockStyle(COLORS[v]) : g !== undefined
                      ? { background: g ? 'rgba(74,222,128,0.55)' : 'rgba(248,113,113,0.55)', border: `2px solid ${g ? '#4ade80' : '#f87171'}` }
                      : { background: 'rgba(255,255,255,0.07)' }} />
                  {v && g !== undefined ? <div className="absolute inset-0.5 rounded-md bg-red-500/50" /> : null}
                </motion.div>
              );
            })}
            <AnimatePresence>
              {bursts.map(b => (
                <motion.div key={b.key} initial={{ scale: 1, opacity: 1 }} animate={{ scale: 1.5, opacity: 0, rotate: 20 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.45 }}
                  className="absolute rounded-md pointer-events-none"
                  style={{ left: (b.index % BOARD) * cell + 2, top: Math.floor(b.index / BOARD) * cell + 2, width: cell - 4, height: cell - 4, ...blockStyle(COLORS[b.color]), boxShadow: '0 0 20px #fff' }} />
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {floats.map(f => (
                <motion.div key={f.id} initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: -20, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className={`absolute inset-x-0 top-1/3 text-center font-fredoka pointer-events-none ${f.big ? 'text-4xl text-orange-300' : 'text-3xl text-yellow-200'}`}
                  style={{ textShadow: '0 3px 8px rgba(0,0,0,0.7)' }}>
                  {f.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Tray */}
        <div className={`flex items-center justify-around gap-2 rounded-3xl bg-black/30 p-2 ${landscape ? 'flex-col' : 'flex-row'}`}
          style={landscape ? { height: boardPx, width: cell * 5 * TRAY_SCALE + 40 } : { width: boardPx, minHeight: cell * 5 * TRAY_SCALE + 24 }}>
          {[0, 1, 2].map(slot => {
            const p = game?.tray[slot] ?? null;
            const usable = !!p && !!game && fitsAnywhere(game.board, p.shape);
            const box = cell * 5 * TRAY_SCALE + 16;
            return (
              <motion.div key={p ? p.id : `empty${slot}`}
                initial={p ? { scale: 0.4, opacity: 0 } : false}
                animate={shake === slot ? { x: [0, -8, 8, -6, 6, 0], scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
                transition={{ duration: shake === slot ? 0.35 : 0.25 }}
                onPointerDown={e => startDrag(slot, e)}
                className="flex items-center justify-center rounded-2xl"
                style={{ width: box, height: box, minWidth: 64, minHeight: 64, cursor: p ? 'grab' : 'default' }}
                aria-label={p ? `Block ${slot + 1}` : undefined}
              >
                {p && (!drag || drag.slot !== slot) && (
                  <PieceView piece={p} cell={cell * TRAY_SCALE} dim={!usable} />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* The dragged piece, drawn above the finger */}
        {drag && draggedPiece && areaRect && (() => {
          const { rows, cols } = shapeSize(draggedPiece.shape);
          return (
            <div className="absolute pointer-events-none z-20"
              style={{
                left: drag.x - areaRect.left - (cols * cell) / 2,
                top: drag.y - areaRect.top - LIFT_PX - (rows - 0.5) * cell,
                filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.5))',
              }}>
              <PieceView piece={draggedPiece} cell={cell} />
            </div>
          );
        })()}
      </div>
    </GameShell>
  );
}

function PieceView({ piece, cell, dim }: { piece: Piece; cell: number; dim?: boolean }) {
  const { rows, cols } = shapeSize(piece.shape);
  return (
    <div className="relative" style={{ width: cols * cell, height: rows * cell, opacity: dim ? 0.35 : 1 }}>
      {piece.shape.map(([r, c]) => (
        <div key={`${r}-${c}`} className="absolute" style={{ left: c * cell, top: r * cell, width: cell, height: cell, padding: Math.max(1, cell * 0.04) }}>
          <div className="w-full h-full rounded-md" style={blockStyle(COLORS[piece.color])} />
        </div>
      ))}
    </div>
  );
}

function blockStyle(color: string): React.CSSProperties {
  return {
    background: `linear-gradient(145deg, ${color} 0%, ${color} 55%, rgba(0,0,0,0.25) 140%)`,
    boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -3px 0 rgba(0,0,0,0.25)',
  };
}
