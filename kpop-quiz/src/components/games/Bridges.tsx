import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import ConfettiBurst from '../ConfettiBurst';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { playClick, playPop, playWrong, playCorrect } from '../../utils/sounds';
import {
  BRIDGES_LEVELS, generateBridges, levelSeed, canLink, cycleBridge, bridgeCount, islandCount, isSolved,
  neighbourIn, bridgeAtCell, islandAt, bridgesLeft, bridgesScore,
} from './bridgesLogic';
import type { Bridge, BridgesLevel, BridgesPuzzle, Dir } from './bridgesLogic';

const DEBUG = new URLSearchParams(window.location.search).has('debug');

type DiffId = BridgesLevel['id'];
type Progress = Record<DiffId, number>;

// Content keys: the next level number per difficulty, and the last difficulty picked.
// (The score itself goes through finishRound.)
const LEVEL_KEY = 'bridges_level';
const DIFF_KEY = 'bridges_diff';

const levelNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1);
const readProgress = (): Progress => {
  try {
    const raw = JSON.parse(localStorage.getItem(LEVEL_KEY) || '{}') as Partial<Record<DiffId, unknown>> | null;
    return { easy: levelNumber(raw?.easy), medium: levelNumber(raw?.medium), hard: levelNumber(raw?.hard) };
  } catch {
    return { easy: 1, medium: 1, hard: 1 };
  }
};
const readDiff = (): number => {
  try {
    const i = BRIDGES_LEVELS.findIndex(l => l.id === localStorage.getItem(DIFF_KEY));
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
};

const makePuzzle = (level: BridgesLevel, n: number) => generateBridges(level, createRng(levelSeed(level.id, n)));
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** How far (in cells) the finger must move from an island before it counts as a drag, not a tap. */
const DRAG_MIN = 0.4;
/** Island radius in cells: about 64 px across at Medium on an iPad, 46 px at Hard. */
const ISLAND_R = 0.4;

/** Which way a drag points: the bigger of the two moves wins. */
const dirOf = (dx: number, dy: number): Dir => (Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);

type Press = { pointerId: number; x0: number; y0: number } & (
  | { kind: 'island'; id: number }
  | { kind: 'bridge'; a: number; b: number }
  | { kind: 'empty' }
);
/** The bridge a drag would build right now (shown dashed). */
interface Aim { from: number; to: number; ok: boolean }

export default function Bridges() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [levelIdx, setLevelIdx] = useState(readDiff);
  const level = BRIDGES_LEVELS[levelIdx];
  const [progress, setProgress] = useState<Progress>(readProgress);
  const [levelNo, setLevelNo] = useState(() => progress[level.id]);
  const [puzzle, setPuzzle] = useState<BridgesPuzzle>(() => makePuzzle(level, progress[level.id]));
  const [bridges, setBridgesState] = useState<Bridge[]>([]);
  const bridgesRef = useRef<Bridge[]>([]);
  const [history, setHistory] = useState<Bridge[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const aimKey = useRef('');
  const [note, setNote] = useState<string | null>(null);
  const noteId = useRef(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const wonRef = useRef(false);
  const [shake, setShake] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);

  const setBridges = (b: Bridge[]) => { bridgesRef.current = b; setBridgesState(b); };
  const { size, islands } = puzzle;
  const playing = status === 'playing' && !won;

  // The clock starts at the first bridge.
  useEffect(() => {
    if (!playing || !started) return;
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [playing, started]);

  const say = (msg: string) => {
    const id = ++noteId.current;
    setNote(msg);
    later(() => { if (noteId.current === id) setNote(null); }, 2600);
  };

  const showAim = (next: Aim | null) => {
    const key = next ? `${next.from}-${next.to}-${next.ok}` : '';
    if (key === aimKey.current) return;
    aimKey.current = key;
    setAim(next);
  };

  const pickLevel = (i: number) => {
    playClick();
    const l = BRIDGES_LEVELS[i];
    setLevelIdx(i);
    setPuzzle(makePuzzle(l, progress[l.id]));
    setLevelNo(progress[l.id]);
  };

  const start = () => {
    const n = progress[level.id];
    try { localStorage.setItem(DIFF_KEY, level.id); } catch { /* private mode */ }
    setPuzzle(makePuzzle(level, n));
    setLevelNo(n);
    setBridges([]);
    setHistory([]);
    setSelected(null);
    press.current = null;
    showAim(null);
    setNote(null);
    setSeconds(0);
    setStarted(false);
    wonRef.current = false;
    setWon(false);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const solved = () => {
    if (wonRef.current) return;
    wonRef.current = true;
    setWon(true);
    setSelected(null);
    playCorrect();
    const next = { ...progress, [level.id]: Math.max(progress[level.id], levelNo + 1) };
    setProgress(next);
    try { localStorage.setItem(LEVEL_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    later(() => setStatus('over'), 1600);
  };

  const commit = (next: Bridge[]) => {
    setHistory(h => [...h.slice(-199), bridgesRef.current]);
    setBridges(next);
    setStarted(true);
    if (isSolved(puzzle, next)) solved();
  };

  /** Build (or cycle) the bridge between two islands in line: none → 1 → 2 → none. */
  const link = (a: number, b: number) => {
    if (!canLink(puzzle, a, b, bridgesRef.current)) {
      playWrong();
      setShake(s => s + 1);
      say("Oops, bridges can't cross each other. Try another way!");
      return;
    }
    const next = cycleBridge(bridgesRef.current, a, b);
    if (bridgeCount(next, a, b) === 0) playClick(); else playPop();
    commit(next);
  };

  const tapIsland = (id: number) => {
    if (selected === null || selected === id) {
      playClick();
      setSelected(selected === id ? null : id);
      return;
    }
    if (canLink(puzzle, selected, id)) {
      setSelected(null);
      link(selected, id);
      return;
    }
    // not in a straight line from the first one: start again from this island
    playClick();
    setSelected(id);
  };

  const pointAt = (e: ReactPointerEvent) => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * size, y: ((e.clientY - rect.top) / rect.height) * size };
  };

  const aimFor = (from: number, dx: number, dy: number): Aim | null => {
    if (Math.hypot(dx, dy) < DRAG_MIN) return null;
    const to = neighbourIn(puzzle, from, dirOf(dx, dy));
    return to >= 0 ? { from, to, ok: canLink(puzzle, from, to, bridgesRef.current) } : null;
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!playing || press.current) return; // one finger at a time
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const pt = pointAt(e);
    if (!pt) return;
    const r = Math.floor(pt.y), c = Math.floor(pt.x);
    const base = { pointerId: e.pointerId, x0: pt.x, y0: pt.y };
    const id = islandAt(puzzle, r, c);
    if (id >= 0) { press.current = { ...base, kind: 'island', id }; return; }
    const br = bridgeAtCell(puzzle, bridgesRef.current, r, c);
    press.current = br ? { ...base, kind: 'bridge', a: br.a, b: br.b } : { ...base, kind: 'empty' };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId || p.kind !== 'island' || !playing) return;
    const pt = pointAt(e);
    if (pt) showAim(aimFor(p.id, pt.x - p.x0, pt.y - p.y0));
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    press.current = null;
    showAim(null);
    if (!playing) return;
    const pt = pointAt(e);
    if (!pt) return;
    const dx = pt.x - p.x0, dy = pt.y - p.y0;
    const moved = Math.hypot(dx, dy) >= DRAG_MIN;
    if (p.kind === 'island') {
      if (!moved) { tapIsland(p.id); return; }
      setSelected(null);
      const to = neighbourIn(puzzle, p.id, dirOf(dx, dy));
      if (to >= 0) link(p.id, to);
      else say('No island that way. Try another direction!');
      return;
    }
    if (moved) return;
    setSelected(null);
    if (p.kind === 'bridge') link(p.a, p.b); // tap a bridge: single → double → gone
  };

  const onPointerCancel = (e: ReactPointerEvent) => {
    if (press.current?.pointerId !== e.pointerId) return;
    press.current = null;
    showAim(null);
  };

  const undo = () => {
    if (!playing || !history.length) return;
    playClick();
    setBridges(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setSelected(null);
  };
  const clear = () => {
    if (!playing || !bridges.length) return;
    playClick();
    setHistory(h => [...h, bridgesRef.current]);
    setBridges([]);
    setSelected(null);
  };

  // Debug hook for end-to-end tests: ?debug → window.__puzzle.solve() builds the answer and wins.
  const solveRef = useRef<() => void>(() => {});
  solveRef.current = () => { if (playing) commit(puzzle.solution.map(b => ({ ...b }))); };
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;
  useEffect(() => {
    if (!DEBUG || status !== 'playing') return;
    const api = {
      solve: () => solveRef.current(),
      get puzzle() { return puzzleRef.current; },
      get bridges() { return bridgesRef.current; },
    };
    (window as unknown as { __puzzle?: typeof api }).__puzzle = api;
    return () => { delete (window as unknown as { __puzzle?: unknown }).__puzzle; };
  }, [status]);

  const counts = islands.map(isl => islandCount(bridges, isl.id));
  const tooMany = islands.some((isl, k) => counts[k] > isl.n);
  const allMet = islands.every((isl, k) => counts[k] === isl.n);
  const left = Math.max(0, bridgesLeft(puzzle, bridges));
  const targets = selected === null
    ? []
    : ([0, 1, 2, 3] as Dir[]).map(d => neighbourIn(puzzle, selected, d)).filter(j => j >= 0 && canLink(puzzle, selected, j, bridges));
  const score = won ? bridgesScore(level, seconds) : 0;
  const centre = (id: number) => ({ x: islands[id].c + 0.5, y: islands[id].r + 0.5 });

  const hint = won
    ? '🎉 Every island is joined up!'
    : note ?? (
      selected !== null ? 'Now tap an island in a straight line from it.'
        : bridges.length === 0 ? 'Drag from an island towards a neighbour to build a bridge!'
          : tooMany ? 'An orange island has one bridge too many. Tap a bridge to change it.'
            : allMet ? 'Every number is right! Now join all the islands into one group.'
              : 'Tip: tap a bridge to make it double, and again to take it away.'
    );

  const chip = (on: boolean) => `min-h-[56px] rounded-2xl px-2 py-2 font-fredoka text-lg ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;

  return (
    <GameShell
      gameId="bridges"
      title="Bridges"
      icon="🌉"
      xpScale={9}
      status={status}
      score={score}
      round={round}
      celebrateEnd
      overTitle={`Level ${levelNo} built in ${fmtTime(seconds)}!`}
      overStats={[
        { label: '⏱️ Time', value: fmtTime(seconds) },
        { label: '➡️ Next up', value: `${level.name} ${levelNo + 1}` },
      ]}
      onStart={start}
      onPause={() => { press.current = null; showAim(null); setStatus('paused'); }}
      onResume={() => setStatus('playing')}
      startLabel={`▶ Play Level ${progress[level.id]}`}
      readyContent={
        <div className="space-y-3">
          <ul className="font-nunito text-lg text-violet-100 text-left space-y-1">
            <li>🏝️ The number on an island = how many bridges touch it.</li>
            <li>🌉 Bridges go straight, 1 or 2 between two islands, and never cross.</li>
            <li>🔗 Join every island into one big group!</li>
            <li>👆 Drag from an island to a neighbour, or tap one and then the other. Do it again for a double bridge.</li>
          </ul>
          <div className="grid grid-cols-3 gap-2">
            {BRIDGES_LEVELS.map((l, i) => (
              <button key={l.id} onClick={() => pickLevel(i)} className={chip(i === levelIdx)} aria-pressed={i === levelIdx}>
                <div>{l.name}</div>
                <div className="font-nunito text-base opacity-90">Level {progress[l.id]}</div>
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
            <span className="rounded-full bg-white/10 px-4 py-1">{level.name} · Level {levelNo}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">⏱️ {fmtTime(seconds)}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">🌉 Bridges left: {left}</span>
          </div>

          <motion.div
            key={shake}
            animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
            transition={{ duration: 0.35 }}
            className="rounded-3xl bg-sky-950/80 border-2 border-sky-400/40 p-2 shadow-2xl"
          >
            <div
              ref={boardRef}
              className="relative game-surface"
              style={{ width: 'min(90vw, calc(100dvh - 300px), 560px)', aspectRatio: '1 / 1' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              role="group"
              aria-label="Bridges board"
            >
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                {/* the water: a faint dot on every square, so lines are easy to see */}
                {Array.from({ length: size * size }, (_, i) => (
                  <circle key={i} cx={(i % size) + 0.5} cy={Math.floor(i / size) + 0.5} r={0.05} fill="rgba(255,255,255,0.16)" />
                ))}

                {bridges.map(br => (
                  <BridgeLines key={`${br.a}-${br.b}`} from={centre(br.a)} to={centre(br.b)} count={br.count} />
                ))}

                {aim && (
                  <line
                    x1={centre(aim.from).x} y1={centre(aim.from).y} x2={centre(aim.to).x} y2={centre(aim.to).y}
                    stroke={aim.ok ? 'rgba(255,255,255,0.8)' : 'rgba(253,186,116,0.85)'}
                    strokeWidth={0.08} strokeDasharray="0.16 0.12" strokeLinecap="round"
                  />
                )}

                {islands.map((isl, k) => {
                  const { x, y } = centre(isl.id);
                  const done = counts[k] === isl.n;
                  const over = counts[k] > isl.n;
                  const fill = done ? '#4ade80' : over ? '#fdba74' : '#1e1b4b';
                  const stroke = done ? '#dcfce7' : over ? '#fff7ed' : '#facc15';
                  const ink = done ? '#052e16' : over ? '#431407' : '#fde68a';
                  const ring = isl.id === selected || aim?.from === isl.id || (aim?.ok && aim.to === isl.id);
                  return (
                    <g key={isl.id}>
                      {ring && <circle cx={x} cy={y} r={ISLAND_R + 0.08} fill="none" stroke="#ffffff" strokeWidth={0.07} />}
                      {targets.includes(isl.id) && (
                        <circle cx={x} cy={y} r={ISLAND_R + 0.08} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={0.05} strokeDasharray="0.12 0.1" />
                      )}
                      <circle cx={x} cy={y} r={ISLAND_R} fill={fill} stroke={stroke} strokeWidth={0.06} />
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={0.42}
                        fontFamily="Fredoka One, sans-serif" fill={ink}>{isl.n}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </motion.div>

          <div className="flex gap-3">
            <button onClick={undo} disabled={!playing || !history.length} className="min-h-[56px] px-6 rounded-2xl bg-sky-600 font-fredoka text-xl disabled:opacity-40">↩️ Undo</button>
            <button onClick={clear} disabled={!playing || !bridges.length} className="min-h-[56px] px-6 rounded-2xl bg-white/15 font-fredoka text-xl disabled:opacity-40">🔄 Clear</button>
          </div>
          <p className="font-nunito text-lg text-violet-100 text-center min-h-[3.5rem]" aria-live="polite">{hint}</p>
        </div>
      </div>
    </GameShell>
  );
}

/** One plank line for a single bridge, two side by side for a double. */
function BridgeLines({ from, to, count }: { from: { x: number; y: number }; to: { x: number; y: number }; count: 1 | 2 }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * 0.11, oy = (dx / len) * 0.11;
  return (
    <g>
      {(count === 2 ? [-1, 1] : [0]).map(k => (
        <line key={k} x1={from.x + ox * k} y1={from.y + oy * k} x2={to.x + ox * k} y2={to.y + oy * k}
          stroke="#fcd34d" strokeWidth={0.1} strokeLinecap="round" />
      ))}
    </g>
  );
}
