import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import ConfettiBurst from '../ConfettiBurst';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { playClick, playPop, playCorrect, playPerfect } from '../../utils/sounds';
import { PICTURE_PUZZLES, PALETTE } from '../../data/picturePuzzles';
import type { PicturePuzzleDef } from '../../data/picturePuzzles';
import {
  PICTURE_LEVELS, FILLED, MARKED, solutionFromRows, rowCluesOf, colCluesOf, emptyBoard, boardFromSolution,
  setCell, paintTarget, paintCells, dragAxis, dragRun, rowsDone, colsDone, isSolved, hintCell, wrongCell,
  pictureScore, nextPicture, article, filledCount,
} from './pictureLogic';
import type { Board, CellState, DragAxis, PaintMode, Pos } from './pictureLogic';

// Content keys (the score itself goes through finishRound): solved picture ids and the chosen size.
const SOLVED_KEY = 'picture_solved';
const SIZE_KEY = 'picture_size';
const UNDO_LIMIT = 60;

const readSolved = (): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SOLVED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
};
const readLevelIdx = (): number => {
  try { return Math.max(0, PICTURE_LEVELS.findIndex(l => l.id === localStorage.getItem(SIZE_KEY))); } catch { return 0; }
};

const BY_SIZE = PICTURE_LEVELS.map(l => PICTURE_PUZZLES.filter(p => p.rows.length === l.size));
const pick = (levelIdx: number, solved: string[], lastId?: string): PicturePuzzleDef => {
  const list = BY_SIZE[levelIdx];
  const id = nextPicture(list.map(p => p.id), new Set(solved), lastId);
  return list.find(p => p.id === id) ?? list[0];
};

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
/** Clue numbers: bigger on smaller boards, never under text-base. */
const CLUE_PX: Record<number, number> = { 5: 22, 8: 18, 10: 16 };
const FILL_COLOUR = '#d946ef';

/** A tiny full-colour picture (start card collection). */
function PicturePreview({ pic, px }: { pic: PicturePuzzleDef; px: number }) {
  const n = pic.rows.length;
  return (
    <svg width={px} height={px} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label={pic.name}
      className="rounded-md bg-indigo-900 shrink-0">
      <title>{pic.name}</title>
      {pic.rows.flatMap((row, r) => [...row].flatMap((ch, c) => (ch === '.' ? [] : [
        <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={PALETTE[ch]} />,
      ])))}
    </svg>
  );
}

interface Drag {
  pointerId: number;
  start: Pos;
  axis: DragAxis | null;
  base: Board;
  from: CellState;
  to: CellState;
  last: string;
  len: number;
}

export default function PicturePuzzle() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [levelIdx, setLevelIdx] = useState(readLevelIdx);
  const [solvedIds, setSolvedIds] = useState<string[]>(readSolved);
  const [pic, setPic] = useState<PicturePuzzleDef>(() => pick(readLevelIdx(), readSolved()));
  const [board, setBoardState] = useState<Board>(() => emptyBoard(pic.rows.length));
  const boardRef = useRef<Board>(board);
  const [history, setHistory] = useState<Board[]>([]);
  const [mode, setMode] = useState<PaintMode>('fill');
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [hints, setHints] = useState(0);
  const [won, setWon] = useState(false);
  const wonRef = useRef(false);
  const [flash, setFlash] = useState<(Pos & { id: number }) | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const lastPlayed = useRef<Partial<Record<string, string>>>({});

  const n = pic.rows.length;
  const level = PICTURE_LEVELS.find(l => l.size === n) ?? PICTURE_LEVELS[0];
  const solution = useMemo(() => solutionFromRows(pic.rows), [pic]);
  const rowClues = useMemo(() => rowCluesOf(solution), [solution]);
  const colClues = useMemo(() => colCluesOf(solution), [solution]);
  const playing = status === 'playing' && !won;
  const boardBlank = filledCount(board) === 0 && board.every(row => row.every(st => st !== MARKED));

  // The clock starts at her first move.
  useEffect(() => {
    if (!playing || !started) return;
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [playing, started]);

  const win = () => {
    if (wonRef.current) return;
    wonRef.current = true;
    drag.current = null;
    setWon(true);
    setNote(null);
    playCorrect();
    if (!solvedIds.includes(pic.id)) {
      const next = [...solvedIds, pic.id];
      setSolvedIds(next);
      try { localStorage.setItem(SOLVED_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    }
    later(() => setStatus('over'), 1600);
  };

  /** Show a new board; finishing the picture wins straight away. */
  const apply = (next: Board) => {
    boardRef.current = next;
    setBoardState(next);
    if (isSolved(next, solution)) win();
  };
  const remember = (prev: Board) => setHistory(h => [...h.slice(-(UNDO_LIMIT - 1)), prev]);

  const start = () => {
    try { localStorage.setItem(SIZE_KEY, PICTURE_LEVELS[levelIdx].id); } catch { /* private mode */ }
    const lvl = PICTURE_LEVELS[levelIdx];
    const next = pick(levelIdx, solvedIds, lastPlayed.current[lvl.id]);
    lastPlayed.current[lvl.id] = next.id;
    setPic(next);
    const fresh = emptyBoard(next.rows.length);
    boardRef.current = fresh;
    setBoardState(fresh);
    setHistory([]);
    setMode('fill');
    setSeconds(0);
    setStarted(false);
    setHints(0);
    setWon(false);
    wonRef.current = false;
    setFlash(null);
    setNote(null);
    drag.current = null;
    setRound(r => r + 1);
    setStatus('playing');
  };

  // ---------- touch: tap or drag a straight run of squares ----------

  const cellAt = (e: ReactPointerEvent, clamp: boolean): Pos | null => {
    const el = areaRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    let c = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    let r = Math.floor(((e.clientY - rect.top) / rect.height) * n);
    if (clamp) {
      c = Math.max(0, Math.min(n - 1, c));
      r = Math.max(0, Math.min(n - 1, r));
    } else if (r < 0 || c < 0 || r >= n || c >= n) return null;
    return { r, c };
  };

  const sound = (to: CellState) => (to === FILLED ? playPop() : playClick());

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!playing || drag.current) return;
    e.preventDefault();
    const pos = cellAt(e, false);
    if (!pos) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const base = boardRef.current;
    const from = base[pos.r][pos.c];
    const to = paintTarget(mode, from);
    drag.current = { pointerId: e.pointerId, start: pos, axis: null, base, from, to, last: `${pos.r},${pos.c}`, len: 1 };
    remember(base);
    setStarted(true);
    setNote(null);
    sound(to);
    apply(paintCells(base, [pos], from, to));
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || !playing) return;
    const pos = cellAt(e, true);
    if (!pos) return;
    const key = `${pos.r},${pos.c}`;
    if (key === d.last) return;
    d.last = key;
    if (!d.axis && (pos.r !== d.start.r || pos.c !== d.start.c)) d.axis = dragAxis(d.start, pos);
    const run = dragRun(d.start, pos, d.axis);
    if (run.length > d.len) sound(d.to);
    d.len = run.length;
    apply(paintCells(d.base, run, d.from, d.to));
  };

  const endDrag = (e: ReactPointerEvent) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  };

  // ---------- buttons ----------

  const chooseMode = (m: PaintMode) => { if (m !== mode) playClick(); setMode(m); };

  const undo = () => {
    if (!playing || !history.length) return;
    playClick();
    drag.current = null;
    apply(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setNote(null);
  };

  const clear = () => {
    if (!playing || boardBlank) return;
    playClick();
    drag.current = null;
    remember(board);
    apply(emptyBoard(n));
    setNote('All clear — your old squares are one ↩️ Undo away.');
  };

  const hint = () => {
    if (!playing) return;
    const cur = boardRef.current;
    let pos = hintCell(cur, solution, rowClues, colClues);
    let next: Board;
    if (pos) {
      next = setCell(cur, pos.r, pos.c, FILLED);
      setNote('💡 Here’s a square that belongs in the picture!');
    } else {
      pos = wrongCell(cur, solution);
      if (!pos) return;
      next = setCell(cur, pos.r, pos.c, MARKED);
      setNote('💡 This square stays empty — so close now!');
    }
    playPerfect();
    drag.current = null;
    remember(cur);
    setHints(h => h + 1);
    setStarted(true);
    const id = Date.now();
    setFlash({ ...pos, id });
    later(() => setFlash(f => (f?.id === id ? null : f)), 1400);
    apply(next);
  };

  // Debug hook for end-to-end tests: ?debug → window.__puzzle.solve() fills the answer and wins as usual.
  const solveNow = useRef<() => void>(() => {});
  solveNow.current = () => { setStarted(true); apply(boardFromSolution(solution)); };
  useEffect(() => {
    if (!DEBUG || status !== 'playing' || won) return;
    const api = {
      solve: () => solveNow.current(),
      get picture() { return { id: pic.id, name: pic.name, size: pic.rows.length }; },
    };
    (window as unknown as { __puzzle?: typeof api }).__puzzle = api;
    return () => { delete (window as unknown as { __puzzle?: unknown }).__puzzle; };
  }, [status, won, pic]);

  // ---------- layout ----------

  const doneRows = rowsDone(board, rowClues);
  const doneCols = colsDone(board, colClues);
  const clueFont = CLUE_PX[n] ?? 16;
  const digitW = clueFont * 0.62;
  const clueGap = clueFont * 0.4;
  const rowClueW = Math.ceil(Math.max(...rowClues.map(cl => {
    const nums = cl.length ? cl : [0];
    return nums.reduce((w, x) => w + String(x).length * digitW, 0) + (nums.length - 1) * clueGap;
  })) + 16);
  const colClueH = Math.ceil(Math.max(...colClues.map(cl => Math.max(1, cl.length))) * clueFont * 1.15 + 10);
  // Cell area like Zip's board, with room left for the clues outside it.
  const AREA = `min(calc(90vw - ${rowClueW + 24}px), calc(100dvh - ${300 + colClueH}px), 560px)`;
  const guide = n === 10 ? 5 : n === 8 ? 4 : 0;
  const levelSolved = (i: number) => BY_SIZE[i].filter(p => solvedIds.includes(p.id)).length;
  const myPictures = PICTURE_PUZZLES.filter(p => solvedIds.includes(p.id));
  const score = won ? pictureScore(level, seconds, hints) : 0;

  const chip = (on: boolean) => `min-h-[64px] rounded-2xl px-2 py-2 font-fredoka text-lg ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;
  const modeBtn = (on: boolean) => `min-h-[56px] min-w-[56px] px-4 rounded-xl font-fredoka text-xl transition-colors ${on ? 'bg-fuchsia-500 shadow-lg' : 'bg-transparent text-violet-200'}`;

  return (
    <GameShell
      gameId="picture_puzzle"
      title="Picture Puzzles"
      icon="🖼️"
      xpScale={9}
      status={status}
      score={score}
      round={round}
      overTitle={`${pic.emoji} ${pic.name} solved in ${fmtTime(seconds)}!`}
      overStats={[
        { label: '⏱️ Time', value: fmtTime(seconds) },
        { label: '💡 Hints', value: String(hints) },
        { label: `🖼️ ${level.name} pictures`, value: `${levelSolved(PICTURE_LEVELS.indexOf(level))}/${BY_SIZE[PICTURE_LEVELS.indexOf(level)].length}` },
        { label: '🌟 All pictures', value: `${solvedIds.length}/${PICTURE_PUZZLES.length}` },
      ]}
      onStart={start}
      onPause={() => { drag.current = null; setStatus('paused'); }}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-3">
          <p className="font-nunito text-lg text-violet-100">
            The numbers tell you how many squares in a row to fill. Fill the right squares to find the <b>hidden picture</b>!
          </p>
          <p className="font-nunito text-base text-violet-200">
            Tap or drag to fill. Use ❌ to mark squares you know stay empty. Stuck? A 💡 hint helps (−10% points).
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PICTURE_LEVELS.map((l, i) => (
              <button key={l.id} onClick={() => { playClick(); setLevelIdx(i); }} className={chip(i === levelIdx)} aria-pressed={i === levelIdx}>
                <div>{l.name}</div>
                <div className="font-nunito text-base opacity-90">{l.size}×{l.size}</div>
                <div className="font-nunito text-sm opacity-80">🖼️ {levelSolved(i)}/{BY_SIZE[i].length}</div>
              </button>
            ))}
          </div>
          <div className="rounded-2xl bg-white/5 p-3 text-left">
            <div className="font-fredoka text-lg mb-2">My pictures {myPictures.length > 0 && <span className="text-violet-300">· {myPictures.length}/{PICTURE_PUZZLES.length}</span>}</div>
            {myPictures.length ? (
              <div className="flex flex-wrap gap-1.5">
                {myPictures.map(p => <PicturePreview key={p.id} pic={p} px={40} />)}
              </div>
            ) : (
              <p className="font-nunito text-base text-violet-200">Solve a puzzle to start your collection!</p>
            )}
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {won && <ConfettiBurst count={70} durationMs={2500} />}
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2 font-fredoka text-lg">
            <span className="rounded-full bg-white/10 px-4 py-1">{level.name} · {n}×{n}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">⏱️ {fmtTime(seconds)}</span>
            <span className="rounded-full bg-white/10 px-4 py-1">{won ? `${pic.emoji} ${pic.name}` : '❓ Mystery picture'}</span>
          </div>

          <div className={`rounded-3xl bg-indigo-900/80 border-2 p-2 shadow-2xl transition-colors ${won ? 'border-yellow-300' : 'border-fuchsia-400/40'}`}>
            <div className="grid" style={{ gridTemplateColumns: 'auto auto' }}>
              <div />
              {/* column clues */}
              <div className="grid" style={{ width: AREA, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                {colClues.map((cl, c) => (
                  <div key={c}
                    className={`flex flex-col items-center justify-end pb-1.5 font-fredoka leading-[1.15] tabular-nums transition-opacity ${c % 2 ? 'bg-white/5' : ''} ${doneCols[c] || won ? 'opacity-35' : 'text-yellow-100'}`}
                    style={{ fontSize: clueFont, minHeight: colClueH }}>
                    {(cl.length ? cl : [0]).map((x, i) => <span key={i}>{x}</span>)}
                  </div>
                ))}
              </div>
              {/* row clues */}
              <div className="grid" style={{ height: AREA, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}>
                {rowClues.map((cl, r) => (
                  <div key={r}
                    className={`flex items-center justify-end pr-2 pl-1 font-fredoka tabular-nums transition-opacity ${r % 2 ? 'bg-white/5' : ''} ${doneRows[r] || won ? 'opacity-35' : 'text-yellow-100'}`}
                    style={{ fontSize: clueFont, gap: clueGap, minWidth: rowClueW }}>
                    {(cl.length ? cl : [0]).map((x, i) => <span key={i}>{x}</span>)}
                  </div>
                ))}
              </div>
              {/* the squares */}
              <div
                ref={areaRef}
                className="relative game-surface rounded-lg overflow-hidden bg-indigo-950/70"
                style={{ width: AREA, height: AREA }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                role="grid"
                aria-label="Picture puzzle board"
              >
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}>
                  {board.map((row, r) => row.map((s, c) => {
                    const ch = pic.rows[r][c];
                    const colour = won ? (ch === '.' ? 'transparent' : PALETTE[ch]) : s === FILLED ? FILL_COLOUR : 'transparent';
                    const isFlash = flash?.r === r && flash?.c === c;
                    return (
                      <div key={`${r}-${c}`} className="relative"
                        style={{ boxShadow: won ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,0.13)' }}>
                        <div className={`absolute ${isFlash ? 'ring-4 ring-yellow-300 animate-pulse' : ''}`}
                          style={{
                            inset: won ? 0 : '7%',
                            borderRadius: won ? 0 : '18%',
                            background: colour,
                            transition: 'background-color 450ms ease, inset 300ms ease, border-radius 300ms ease',
                            transitionDelay: won ? `${(r + c) * 30}ms` : '0ms',
                          }} />
                        {s === MARKED && !won && (
                          <span className="absolute inset-0 flex items-center justify-center font-fredoka text-violet-300/70 pointer-events-none"
                            style={{ fontSize: `calc(${AREA} / ${n} * 0.5)` }} aria-hidden>✕</span>
                        )}
                      </div>
                    );
                  }))}
                </div>
                {/* guide lines every 4 or 5 squares */}
                {guide > 0 && !won && Array.from({ length: n / guide - 1 }, (_, i) => {
                  const at = `${((i + 1) * guide * 100) / n}%`;
                  return (
                    <div key={i} className="pointer-events-none">
                      <div className="absolute top-0 bottom-0 w-[2px] -ml-px bg-white/40" style={{ left: at }} />
                      <div className="absolute left-0 right-0 h-[2px] -mt-px bg-white/40" style={{ top: at }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {won ? (
            <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="font-fredoka text-3xl text-yellow-300 text-center">
              You made {article(pic.name)} {pic.emoji} {pic.name}!
            </motion.p>
          ) : (
            <>
              <div className="flex flex-wrap justify-center gap-2">
                <div className="flex rounded-2xl bg-white/10 p-1 gap-1" role="group" aria-label="What a tap does">
                  <button onClick={() => chooseMode('fill')} aria-pressed={mode === 'fill'} className={modeBtn(mode === 'fill')}>✏️ Fill</button>
                  <button onClick={() => chooseMode('mark')} aria-pressed={mode === 'mark'} className={modeBtn(mode === 'mark')}>❌ Mark</button>
                </div>
                <button onClick={hint} disabled={!playing} className="min-h-[56px] px-5 rounded-2xl bg-amber-500 font-fredoka text-xl disabled:opacity-40">
                  💡 Hint{hints > 0 && <span className="ml-1 rounded-full bg-black/25 px-2 text-base">{hints}</span>}
                </button>
                <button onClick={undo} disabled={!playing || !history.length} className="min-h-[56px] px-5 rounded-2xl bg-sky-600 font-fredoka text-xl disabled:opacity-40">↩️ Undo</button>
                <button onClick={clear} disabled={!playing || boardBlank} className="min-h-[56px] px-5 rounded-2xl bg-white/15 font-fredoka text-xl disabled:opacity-40">🔄 Clear</button>
              </div>
              <p className="font-nunito text-lg text-violet-200 text-center min-h-[1.75rem]">
                {note ?? (mode === 'fill'
                  ? 'Tap or drag to fill squares. Tap a filled square to empty it.'
                  : 'Tap or drag to mark squares that stay empty.')}
              </p>
            </>
          )}
        </div>
      </div>
    </GameShell>
  );
}
