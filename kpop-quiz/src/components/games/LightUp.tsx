import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import ConfettiBurst from '../ConfettiBurst';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { playClick, playPop, playCorrect } from '../../utils/sounds';
import {
  LIGHTUP_LEVELS, generateLightUp, levelSeed, litCells, clashes, wallStatus, isSolved, isWall, cycleMark, lightUpScore,
} from './lightUpLogic';
import type { LightUpLevel, LightUpPuzzle, Mark } from './lightUpLogic';

// Progress: the next "Level n" to play per difficulty, and the chosen difficulty (content keys;
// the score itself goes through finishRound).
const LEVEL_KEY = 'lightup_level';
const DIFF_KEY = 'lightup_diff';
type Progress = Record<LightUpLevel['id'], number>;
type Marks = Record<number, Mark>;

const readProgress = (): Progress => {
  const out: Progress = { easy: 1, medium: 1, hard: 1 };
  try {
    const raw = JSON.parse(localStorage.getItem(LEVEL_KEY) || '{}') as Record<string, unknown> | null;
    for (const l of LIGHTUP_LEVELS) {
      const n = Number(raw?.[l.id]);
      if (Number.isInteger(n) && n >= 1) out[l.id] = n;
    }
  } catch { /* private mode or a broken value */ }
  return out;
};
const readDiff = (): number => {
  try { return Math.max(0, LIGHTUP_LEVELS.findIndex(l => l.id === localStorage.getItem(DIFF_KEY))); } catch { return 0; }
};

const DEBUG = new URLSearchParams(window.location.search).has('debug');
const BOARD = 'min(90vw, calc(100dvh - 300px), 560px)';
const HISTORY_MAX = 200;

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const makePuzzle = (level: LightUpLevel, n: number) => generateLightUp(level, createRng(levelSeed(level.id, n)));
const lampsOf = (m: Marks) => Object.keys(m).map(Number).filter(c => m[c] === 'lamp');

// Square colours: dark room → warm glow.
const DARK = 'rgba(199, 210, 254, 0.16)';
const LIT = '#fde68a';
const LAMP = '#fcd34d';
const WALL = '#0b0b1e';
const WALL_OK = '#10b981';
const RING = '#fb923c';

function squareStyle(lamp: boolean, lit: boolean, clash: boolean): CSSProperties {
  const glow = lamp
    ? 'inset 0 0 16px rgba(245, 158, 11, 0.8), 0 0 14px rgba(253, 224, 71, 0.7)'
    : lit ? 'inset 0 0 14px rgba(251, 191, 36, 0.55)' : 'none';
  return {
    background: lamp ? LAMP : lit ? LIT : DARK,
    boxShadow: clash ? `inset 0 0 0 4px ${RING}, 0 0 12px ${RING}` : glow,
  };
}

/** The tiny solved example on the start card: a "2" wall touching two lamps, every square glowing. */
function MiniExample() {
  const lamps = new Set([1, 3, 8]);
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-indigo-900/80 p-1 shrink-0" aria-hidden>
      {Array.from({ length: 9 }, (_, c) => (
        <div key={c} className="w-8 h-8 rounded-md flex items-center justify-center font-fredoka text-lg"
          style={c === 4 ? { background: WALL_OK, color: '#fff' } : squareStyle(lamps.has(c), true, false)}>
          {c === 4 ? 2 : lamps.has(c) ? '💡' : ''}
        </div>
      ))}
    </div>
  );
}

export default function LightUp() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [levelIdx, setLevelIdx] = useState(readDiff);
  const level = LIGHTUP_LEVELS[levelIdx];
  const [progress, setProgress] = useState<Progress>(readProgress);
  /** The "Level n" number of the puzzle on the board. */
  const [num, setNum] = useState(() => progress[level.id]);
  const [puzzle, setPuzzle] = useState<LightUpPuzzle>(() => makePuzzle(level, progress[level.id]));
  const [marks, setMarksState] = useState<Marks>({});
  const marksRef = useRef<Marks>({});
  const [history, setHistory] = useState<Marks[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [moved, setMoved] = useState(false);
  const [won, setWon] = useState(false);
  const wonRef = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const setMarks = (m: Marks) => { marksRef.current = m; setMarksState(m); };
  const { size } = puzzle;
  const total = size * size;
  const playing = status === 'playing' && !won;

  // The clock starts at her first tap.
  useEffect(() => {
    if (!playing || !moved) return;
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [playing, moved]);

  const lamps = useMemo(() => lampsOf(marks), [marks]);
  const lit = useMemo(() => litCells(puzzle, lamps), [puzzle, lamps]);
  const clash = useMemo(() => clashes(puzzle, lamps), [puzzle, lamps]);
  const walls = useMemo(() => wallStatus(puzzle, lamps), [puzzle, lamps]);
  const whiteCount = total - Object.keys(puzzle.walls).length;

  const pickLevel = (i: number) => {
    playClick();
    setLevelIdx(i);
    const l = LIGHTUP_LEVELS[i];
    setNum(progress[l.id]);
    setPuzzle(makePuzzle(l, progress[l.id])); // preview behind the start card
  };

  const start = () => {
    const n = progress[level.id];
    try { localStorage.setItem(DIFF_KEY, level.id); } catch { /* private mode */ }
    setPuzzle(makePuzzle(level, n));
    setNum(n);
    setMarks({});
    setHistory([]);
    setSeconds(0);
    setMoved(false);
    setWon(false);
    wonRef.current = false;
    setRound(r => r + 1);
    setStatus('playing');
  };

  const solved = () => {
    wonRef.current = true;
    setWon(true);
    playCorrect();
    const next = { ...progress, [level.id]: Math.max(progress[level.id], num + 1) };
    setProgress(next);
    try { localStorage.setItem(LEVEL_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    later(() => setStatus('over'), 1600);
  };

  const commit = (next: Marks) => {
    const prev = marksRef.current;
    setHistory(h => [...h.slice(-(HISTORY_MAX - 1)), prev]);
    setMarks(next);
    setMoved(true);
    if (isSolved(puzzle, lampsOf(next))) solved();
  };

  const tap = (cell: number) => {
    if (!playing || wonRef.current || cell < 0 || cell >= total || isWall(puzzle, cell)) return;
    const cur = marksRef.current;
    const m = cycleMark(cur[cell]);
    const next = { ...cur };
    if (m) next[cell] = m; else delete next[cell];
    if (m === 'lamp') playPop(); else playClick();
    commit(next);
  };

  const cellAt = (e: ReactPointerEvent): number => {
    const el = boardRef.current;
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * size);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * size);
    if (r < 0 || c < 0 || r >= size || c >= size) return -1;
    return r * size + c;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!playing || e.button > 0) return;
    e.preventDefault();
    tap(cellAt(e));
  };

  const undo = () => {
    if (!playing || !history.length) return;
    playClick();
    setMarks(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };
  const clear = () => {
    if (!playing || Object.keys(marksRef.current).length === 0) return;
    playClick();
    commit({});
  };

  // Debug hook for end-to-end tests: ?debug → window.__puzzle.solve() places the answer and wins as normal.
  const solveRef = useRef(() => {});
  solveRef.current = () => {
    if (!playing || wonRef.current) return;
    const next: Marks = {};
    for (const c of puzzle.solution) next[c] = 'lamp';
    commit(next);
  };
  useEffect(() => {
    if (!DEBUG || !playing) return;
    const api = { solve: () => solveRef.current() };
    (window as unknown as { __puzzle: typeof api }).__puzzle = api;
    return () => { delete (window as unknown as { __puzzle?: unknown }).__puzzle; };
  }, [playing]);

  const score = won ? lightUpScore(level, seconds) : 0;
  const markCount = Object.keys(marks).length;
  const tooMany = Object.values(walls).includes('tooMany');
  const allLit = lit.size === whiteCount;
  const tip = won
    ? '✨ Every square is glowing — brilliant!'
    : clash.size > 0
      ? 'Two lamps can see each other — move one!'
      : tooMany
        ? 'A number has too many lamps next to it — take one away.'
        : allLit
          ? 'Everything glows! Now make the numbers match.'
          : markCount === 0
            ? 'Tap a square to put a 💡 lamp on it.'
            : 'Tap again for • (no lamp here), and once more to clear it.';

  const fontFor = (k: number) => `calc(${BOARD} / ${size} * ${k})`;
  const chip = (on: boolean) => `min-h-[56px] rounded-2xl px-2 py-2 font-fredoka text-lg ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;

  return (
    <GameShell
      gameId="light_up"
      title="Light Up"
      icon="💡"
      xpScale={9}
      status={status}
      score={score}
      round={round}
      overTitle={`Level ${num} lit up in ${fmtTime(seconds)}!`}
      overStats={[
        { label: '⏱️ Time', value: fmtTime(seconds) },
        { label: `Next up (${level.name})`, value: `Level ${progress[level.id]}` },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      startLabel={`▶ Play Level ${progress[level.id]}`}
      readyContent={
        <div className="space-y-3 text-left">
          <div className="flex items-center gap-3">
            <MiniExample />
            <p className="font-nunito text-lg text-violet-100">
              Put <b>💡 lamps</b> on squares until <b>every square glows</b>!
            </p>
          </div>
          <ul className="font-nunito text-lg text-violet-100 space-y-1 list-disc pl-5">
            <li>A lamp shines along its row and column, until a wall.</li>
            <li>Two lamps must never shine on each other.</li>
            <li>A number on a wall = how many lamps touch it (up, down, left, right).</li>
            <li>Tap twice for <b>•</b> — your “no lamp here” note.</li>
          </ul>
          <div className="grid grid-cols-3 gap-2">
            {LIGHTUP_LEVELS.map((l, i) => (
              <button key={l.id} onClick={() => pickLevel(i)} className={chip(i === levelIdx)} aria-pressed={i === levelIdx}>
                <div>{l.name}</div>
                <div className="font-nunito text-base">Level {progress[l.id]}</div>
                <div className="font-nunito text-base opacity-75">{l.size}×{l.size}</div>
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {won && <ConfettiBurst count={70} durationMs={2500} />}
        <div className="max-w-xl mx-auto flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2 font-fredoka text-lg">
            <span className="rounded-full bg-white/10 px-4 py-1">{level.name} · Level {num}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">⏱️ {fmtTime(seconds)}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">✨ {lit.size}/{whiteCount} lit</span>
          </div>

          <div className="rounded-3xl bg-indigo-900/80 border-2 border-amber-300/40 p-2 shadow-2xl">
            <div
              ref={boardRef}
              className="relative game-surface"
              style={{ width: BOARD, aspectRatio: '1 / 1' }}
              onPointerDown={onPointerDown}
              role="grid"
              aria-label="Light Up board"
            >
              <div className="absolute inset-0 grid gap-1"
                style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}>
                {Array.from({ length: total }, (_, cell) => {
                  const r = Math.floor(cell / size), c = cell % size;
                  const sparkle = won ? { scale: [1, 1.15, 1] } : { scale: 1 };
                  const sparkleT = { delay: (r + c) * 0.045, duration: 0.45 };
                  if (isWall(puzzle, cell)) {
                    const n = puzzle.walls[cell];
                    const st = n === null ? undefined : walls[cell];
                    return (
                      <motion.div key={cell} data-cell={cell} data-wall={n ?? ''} data-state={st}
                        className="rounded-lg flex items-center justify-center font-fredoka"
                        animate={sparkle} transition={sparkleT}
                        style={{
                          background: st === 'ok' ? WALL_OK : WALL,
                          color: st === 'ok' ? '#fff' : 'rgba(255,255,255,0.9)',
                          boxShadow: st === 'tooMany' ? `inset 0 0 0 4px ${RING}` : 'inset 0 0 0 2px rgba(255,255,255,0.08)',
                          fontSize: fontFor(0.5),
                        }}>
                        {n ?? ''}
                      </motion.div>
                    );
                  }
                  const mark = marks[cell];
                  const isLit = lit.has(cell);
                  return (
                    <motion.div key={cell} data-cell={cell} data-mark={mark ?? ''} data-lit={isLit ? '1' : '0'}
                      className="relative rounded-lg flex items-center justify-center leading-none"
                      animate={sparkle} transition={sparkleT}
                      style={{ ...squareStyle(mark === 'lamp', isLit, clash.has(cell)), fontSize: fontFor(0.55) }}>
                      {mark === 'lamp' && '💡'}
                      {mark === 'dot' && <span className="font-fredoka" style={{ color: isLit ? '#92400e' : '#ddd6fe' }}>•</span>}
                      {won && (
                        <motion.span className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.8] }}
                          transition={{ delay: (r + c) * 0.045 + 0.1, duration: 0.8 }}>
                          ✨
                        </motion.span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={undo} disabled={!playing || !history.length} className="min-h-[56px] px-6 rounded-2xl bg-sky-600 font-fredoka text-xl disabled:opacity-40">↩️ Undo</button>
            <button onClick={clear} disabled={!playing || !markCount} className="min-h-[56px] px-6 rounded-2xl bg-white/15 font-fredoka text-xl disabled:opacity-40">🔄 Clear</button>
          </div>
          <p className={`font-nunito text-base text-center ${clash.size > 0 && !won ? 'text-orange-200 font-bold' : 'text-violet-200'}`} aria-live="polite">
            {tip}
          </p>
        </div>
      </div>
    </GameShell>
  );
}
