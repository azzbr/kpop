import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import ConfettiBurst from '../ConfettiBurst';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { playClick, playCorrect, playPop } from '../../utils/sounds';
import {
  UNTANGLE_LEVELS, generateUntangle, crossingPairs, crossingPoint, isSolved, untangleScore, levelSeed, clampPoint,
} from './untangleLogic';
import type { Point, UntangleLevel, UntanglePuzzle } from './untangleLogic';

// Which "Level n" comes next for each difficulty, and the difficulty she picked last (content keys;
// the score itself goes through finishRound).
const LEVEL_KEY = 'untangle_level';
const DIFF_KEY = 'untangle_diff';
type LevelId = UntangleLevel['id'];
type Progress = Record<LevelId, number>;

const readProgress = (): Progress => {
  const out: Progress = { easy: 1, medium: 1, hard: 1 };
  try {
    const raw = JSON.parse(localStorage.getItem(LEVEL_KEY) || '{}') as Record<string, unknown>;
    for (const l of UNTANGLE_LEVELS) {
      const n = Number(raw?.[l.id]);
      if (Number.isInteger(n) && n >= 1) out[l.id] = n;
    }
  } catch { /* private mode or a broken value */ }
  return out;
};
const readDiff = (): number => {
  try {
    const i = UNTANGLE_LEVELS.findIndex(l => l.id === localStorage.getItem(DIFF_KEY));
    return i >= 0 ? i : 0;
  } catch { return 0; }
};

const makePuzzle = (level: UntangleLevel, n: number): UntanglePuzzle => generateUntangle(level, createRng(levelSeed(level.id, n)));

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const DEBUG = new URLSearchParams(window.location.search).has('debug');

/** SVG board units (the logic works in 0..1). */
const VIEW = 100;
const DOT_R = 4;
/** A dragged dot is drawn this far above the finger, so her hand never hides it. */
const LIFT_PX = 30;
/** How close (in screen pixels) a touch must be to a dot to pick it up. */
const HIT_PX = 34;
/** Less movement than this is a tap, not a drag: the dot stays where it was. */
const TAP_PX = 8;

const DOT_COLORS = [
  '#f472b6', '#38bdf8', '#facc15', '#a78bfa', '#fb923c', '#22d3ee', '#e879f9',
  '#5eead4', '#fcd34d', '#818cf8', '#d8b4fe', '#fda4af', '#93c5fd',
];
const LINE_OK = '#4ade80';
const LINE_CROSS = '#fb7185';
const LINE_GOLD = '#facc15';

interface Drag {
  dot: number;
  pointerId: number;
  /** Pixels the dot sits above the finger (0 for a mouse, which doesn't cover it). */
  lift: number;
  downX: number;
  downY: number;
  moved: boolean;
  /** The finger, in board units 0..1 (for the faint line). */
  finger: Point;
}

export default function Untangle() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [init] = useState(() => {
    const diff = readDiff();
    const progress = readProgress();
    const n = progress[UNTANGLE_LEVELS[diff].id];
    return { diff, progress, n, puzzle: makePuzzle(UNTANGLE_LEVELS[diff], n) };
  });
  const [diffIdx, setDiffIdx] = useState(init.diff);
  const [progress, setProgress] = useState<Progress>(init.progress);
  const level = UNTANGLE_LEVELS[diffIdx];
  const [puzzle, setPuzzle] = useState<UntanglePuzzle>(init.puzzle);
  const [puzzleNo, setPuzzleNo] = useState(init.n);
  const [pts, setPtsState] = useState<Point[]>(init.puzzle.start);
  const ptsRef = useRef<Point[]>(init.puzzle.start);
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const wonRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const setPts = (p: Point[]) => { ptsRef.current = p; setPtsState(p); };
  const setDrag = (d: Drag | null) => { dragRef.current = d; setDragState(d); };
  const playing = status === 'playing' && !won;

  // The clock starts at her first move.
  useEffect(() => {
    if (!playing || !started) return;
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [playing, started]);

  /** Show "Level n" of a difficulty on the board (behind the start card, or to play). */
  const load = (idx: number, n: number) => {
    const p = makePuzzle(UNTANGLE_LEVELS[idx], n);
    setPuzzle(p);
    setPuzzleNo(n);
    setPts(p.start);
    setDrag(null);
  };

  const pickLevel = (idx: number) => {
    playClick();
    setDiffIdx(idx);
    load(idx, progress[UNTANGLE_LEVELS[idx].id]);
  };

  const start = () => {
    try { localStorage.setItem(DIFF_KEY, level.id); } catch { /* private mode */ }
    load(diffIdx, progress[level.id]);
    setSeconds(0);
    setStarted(false);
    setWon(false);
    wonRef.current = false;
    setRound(r => r + 1);
    setStatus('playing');
  };

  const win = () => {
    if (wonRef.current) return;
    wonRef.current = true;
    setWon(true);
    setDrag(null);
    playCorrect();
    const next = { ...progress, [level.id]: puzzleNo + 1 };
    setProgress(next);
    try { localStorage.setItem(LEVEL_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    later(() => setStatus('over'), 1600);
  };

  // Debug hook for end-to-end tests: ?debug → window.__puzzle.solve()
  const solveRef = useRef<() => void>(() => {});
  solveRef.current = () => {
    if (!playing) return;
    setDrag(null);
    setPts(puzzle.solved.map(p => ({ ...p })));
    win();
  };
  const crossingsRef = useRef(0);
  useEffect(() => {
    if (!DEBUG || !playing) return;
    const api = {
      solve: () => solveRef.current(),
      get crossings() { return crossingsRef.current; },
    };
    (window as unknown as { __puzzle: typeof api }).__puzzle = api;
    return () => { delete (window as unknown as { __puzzle?: unknown }).__puzzle; };
  }, [playing]);

  /** A pointer position on the board, in 0..1 units, plus the board's size in pixels. */
  const boardAt = (e: ReactPointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width, h: r.height };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!playing || dragRef.current) return;
    const b = boardAt(e);
    if (!b) return;
    // the nearest dot within reach of the finger
    let dot = -1;
    let bestD = HIT_PX;
    ptsRef.current.forEach((p, i) => {
      const d = Math.hypot((p.x - b.x) * b.w, (p.y - b.y) * b.h);
      if (d <= bestD) { dot = i; bestD = d; }
    });
    if (dot < 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    playClick();
    setDrag({
      dot, pointerId: e.pointerId, lift: e.pointerType === 'touch' ? LIFT_PX : 0,
      downX: e.clientX, downY: e.clientY, moved: false, finger: { x: b.x, y: b.y },
    });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId || !playing) return;
    const b = boardAt(e);
    if (!b) return;
    const moved = d.moved || Math.hypot(e.clientX - d.downX, e.clientY - d.downY) >= TAP_PX;
    setDrag({ ...d, moved, finger: { x: b.x, y: b.y } });
    if (!moved) return;
    if (!started) setStarted(true);
    const p = clampPoint({ x: b.x, y: b.y - d.lift / b.h });
    setPts(ptsRef.current.map((q, i) => (i === d.dot ? p : q)));
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    setDrag(null);
    if (!d.moved || !playing) return; // a tap: nothing moved
    playPop();
    if (isSolved(puzzle.edges, ptsRef.current)) win();
  };

  const reset = () => {
    if (!playing) return;
    playClick();
    setDrag(null);
    setPts(puzzle.start);
  };

  const pairs = useMemo(() => crossingPairs(puzzle.edges, pts), [puzzle, pts]);
  const crossing = useMemo(() => new Set(pairs.flat()), [pairs]);
  const marks = useMemo(() => pairs.flatMap(([i, j]) => {
    const [a, b] = puzzle.edges[i], [c, d] = puzzle.edges[j];
    const at = crossingPoint(pts[a], pts[b], pts[c], pts[d]);
    return at ? [at] : [];
  }), [pairs, puzzle, pts]);
  const crossings = pairs.length;
  crossingsRef.current = crossings;
  const score = won ? untangleScore(level, seconds) : 0;

  const dragDot = drag ? drag.dot : -1;
  // draw the dot she's holding last, so it's on top
  const dotOrder = pts.map((_, i) => i).filter(i => i !== dragDot);
  if (dragDot >= 0) dotOrder.push(dragDot);

  const chip = (on: boolean) => `min-h-[56px] rounded-2xl px-2 py-2 font-fredoka text-lg text-center ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;

  const counter = won
    ? '🎉 All untangled!'
    : crossings === 0 ? 'Crossings: 0 — let go! 🎉' : `Crossings: ${crossings} ✨`;

  const line = (a: Point, b: Point, key: string | number, color: string, width: number, opacity = 1) => (
    <line key={key} x1={a.x * VIEW} y1={a.y * VIEW} x2={b.x * VIEW} y2={b.y * VIEW}
      stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity} />
  );

  return (
    <GameShell
      gameId="untangle"
      title="Untangle"
      icon="🕸️"
      xpScale={9}
      status={status}
      score={score}
      round={round}
      overTitle={`Level ${puzzleNo} untangled in ${fmtTime(seconds)}!`}
      overStats={[
        { label: '⏱️ Time', value: fmtTime(seconds) },
        { label: `➡️ Up next (${level.name})`, value: `Level ${puzzleNo + 1}` },
      ]}
      onStart={start}
      onPause={() => { setDrag(null); setStatus('paused'); }}
      onResume={() => {
        setStatus('playing');
        // paused with the last dot already in a good spot? that counts
        if (!wonRef.current && isSolved(puzzle.edges, ptsRef.current)) win();
      }}
      startLabel={`▶ Play Level ${progress[level.id]}`}
      readyContent={
        <div className="space-y-3">
          <HowToPicture />
          <p className="font-nunito text-lg text-violet-100">
            The dots are all tangled up! <b>Drag the dots</b> around until <b>no two lines cross</b>.
            Red lines are crossing, green lines are free — make them all green!
          </p>
          <div className="grid grid-cols-3 gap-2">
            {UNTANGLE_LEVELS.map((l, i) => (
              <button key={l.id} onClick={() => pickLevel(i)} className={chip(i === diffIdx)} aria-pressed={i === diffIdx}>
                <div>{l.name}</div>
                <div className="font-nunito text-base">Level {progress[l.id]}</div>
                <div className="font-nunito text-base opacity-75">{l.dots} dots</div>
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
            <span className="rounded-full bg-white/10 px-4 py-1">{level.name} · Level {puzzleNo}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">⏱️ {fmtTime(seconds)}</span>
            <span className={`rounded-full px-4 py-1 tabular-nums ${crossings === 0 ? 'bg-emerald-500/50' : 'bg-white/10'}`}>
              {counter}
            </span>
          </div>

          <motion.div
            animate={won ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 0.45 }}
            className={`rounded-3xl bg-indigo-900/80 border-2 p-2 shadow-2xl ${won ? 'border-yellow-300' : 'border-fuchsia-400/40'}`}
          >
            <div className="relative game-surface" style={{ width: 'min(90vw, calc(100dvh - 300px), 560px)', aspectRatio: '1 / 1' }}>
              <svg
                ref={svgRef}
                className="absolute inset-0 w-full h-full rounded-2xl game-surface"
                viewBox={`0 0 ${VIEW} ${VIEW}`}
                style={{ background: 'rgba(255,255,255,0.06)', cursor: playing ? 'grab' : 'default' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                role="application"
                aria-label={`Untangle board: ${puzzle.edges.length} lines, ${counter}`}
              >
                {/* lines: gold when solved; free ones first, crossing ones on top */}
                {won && puzzle.edges.map(([a, b], i) => line(pts[a], pts[b], `glow${i}`, '#fde68a', 3.2, 0.35))}
                {puzzle.edges.map(([a, b], i) => (crossing.has(i) ? null : line(pts[a], pts[b], i, won ? LINE_GOLD : LINE_OK, 1.3)))}
                {!won && puzzle.edges.map(([a, b], i) => (crossing.has(i) ? line(pts[a], pts[b], i, LINE_CROSS, 1.1) : null))}
                {/* little rings where lines cross (so it isn't only told by colour) */}
                {!won && marks.map((m, k) => (
                  <circle key={`x${k}`} cx={m.x * VIEW} cy={m.y * VIEW} r={1.3} fill="#fff1f2" stroke={LINE_CROSS} strokeWidth={0.5} />
                ))}

                {/* the faint line from the finger up to the dot she's holding */}
                {drag && drag.moved && drag.lift > 0 && (
                  <g pointerEvents="none">
                    {line(pts[drag.dot], drag.finger, 'finger', '#ffffff', 0.6, 0.35)}
                    <circle cx={drag.finger.x * VIEW} cy={drag.finger.y * VIEW} r={2.2} fill="#ffffff" opacity={0.18} />
                  </g>
                )}

                {dotOrder.map(i => {
                  const p = pts[i];
                  const held = i === dragDot;
                  const r = held ? DOT_R * 1.3 : DOT_R;
                  const cx = p.x * VIEW, cy = p.y * VIEW;
                  return (
                    <g key={i} pointerEvents="none">
                      {held && <circle cx={cx} cy={cy} r={r + 2.6} fill="#ffffff" opacity={0.25} />}
                      <circle cx={cx} cy={cy} r={r + 0.7} fill="#1e1b4b" />
                      <circle cx={cx} cy={cy} r={r} fill={DOT_COLORS[i % DOT_COLORS.length]} stroke={won ? LINE_GOLD : '#ffffff'} strokeWidth={0.7} />
                      <circle cx={cx - r * 0.35} cy={cy - r * 0.35} r={r * 0.3} fill="#ffffff" opacity={0.55} />
                    </g>
                  );
                })}
              </svg>
            </div>
          </motion.div>

          <button onClick={reset} disabled={!playing || !started} className="min-h-[56px] px-6 rounded-2xl bg-white/15 font-fredoka text-xl disabled:opacity-40">
            🔄 Reset
          </button>
          <p className="font-nunito text-base text-violet-200 text-center">
            {won
              ? 'Every line is free — brilliant!'
              : !started ? 'Put your finger on any dot and drag it somewhere new.' : 'Red lines are crossing — move a dot to set them free!'}
          </p>
        </div>
      </div>
    </GameShell>
  );
}

/** A tiny "before → after" picture for the start card. */
function HowToPicture() {
  const dot = (x: number, y: number, c: string) => <circle cx={x} cy={y} r={5} fill={c} stroke="#fff" strokeWidth={1.5} />;
  return (
    <svg viewBox="0 0 200 60" className="mx-auto w-48 h-14" aria-hidden="true">
      <line x1={15} y1={10} x2={65} y2={50} stroke={LINE_CROSS} strokeWidth={3} strokeLinecap="round" />
      <line x1={15} y1={50} x2={65} y2={10} stroke={LINE_CROSS} strokeWidth={3} strokeLinecap="round" />
      <circle cx={40} cy={30} r={3} fill="#fff1f2" stroke={LINE_CROSS} strokeWidth={1} />
      {dot(15, 10, '#f472b6')}{dot(65, 50, '#38bdf8')}{dot(15, 50, '#facc15')}{dot(65, 10, '#a78bfa')}
      <text x={100} y={36} textAnchor="middle" fontSize={22} fill="#fde68a">→</text>
      <line x1={135} y1={10} x2={185} y2={10} stroke={LINE_OK} strokeWidth={3} strokeLinecap="round" />
      <line x1={135} y1={50} x2={185} y2={50} stroke={LINE_OK} strokeWidth={3} strokeLinecap="round" />
      {dot(135, 10, '#f472b6')}{dot(185, 10, '#38bdf8')}{dot(135, 50, '#facc15')}{dot(185, 50, '#a78bfa')}
    </svg>
  );
}
