// 🤖 Robo Quest (robo_quest): program a friendly robot with snap-together Blockly blocks to reach
// its charging dock 🔋. 30 levels in 3 worlds (data/roboLevels.ts); the rules and the interpreter
// are in roboLogic.ts, the Blockly side in roboBlocks.ts. Each solved level is one GameShell round.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import ConfettiBurst from '../ConfettiBurst';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { playClick, playCorrect, playNote, playPop } from '../../utils/sounds';
import { ROBO_LEVELS, WORLDS } from '../../data/roboLevels';
import {
  parseLevel, runProgram, blockCount, starsFor, levelScore, stripIds, sanitizeProgram, DX, DY,
} from './roboLogic';
import type { Board, Dir, Program, Run, RoboLevelDef } from './roboLogic';
import { createWorkspace, workspaceToProgram, programToWorkspace, highlight, resize, toolboxFor } from './roboBlocks';
import type { RoboWorkspace } from './roboBlocks';

const STARS_KEY = 'robo_stars';
const CODE_KEY = 'robo_code';
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
const CELL = 40;

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

const isUnlocked = (i: number, stars: Record<string, number>) => i === 0 || (stars[ROBO_LEVELS[i - 1].id] ?? 0) > 0;
const firstOpenLevel = (stars: Record<string, number>) => {
  const i = ROBO_LEVELS.findIndex((l, j) => isUnlocked(j, stars) && !stars[l.id]);
  return ROBO_LEVELS[i >= 0 ? i : ROBO_LEVELS.length - 1].id;
};
const starRow = (n: number) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

const MESSAGES: Record<Exclude<Run['result'], 'dock'>, string> = {
  bump: 'Bonk! The robot bumped into a wall — try again! 🧱',
  short: 'The robot stopped before the dock 🔋 — add more blocks!',
  missing: 'Nearly! Grab every ⚡ battery first, then dock.',
  loop: 'Round and round! That loop never gets to the dock 🔁 — try changing it.',
  empty: 'Put some blocks inside the loop first! 🔁',
};

interface Shown { x: number; y: number; dir: Dir; trail: { x: number; y: number }[]; got: Set<number>; sense: { x: number; y: number; clear: boolean } | null; bump: { x: number; y: number } | null; blockId?: string }

/** What the board shows after the first `n` steps of a run. */
function showAfter(board: Board, run: Run | null, n: number): Shown {
  const s: Shown = { x: board.start.x, y: board.start.y, dir: board.dir, trail: [{ x: board.start.x, y: board.start.y }], got: new Set(), sense: null, bump: null };
  if (!run) return s;
  for (let i = 0; i < Math.min(n, run.steps.length); i++) {
    const st = run.steps[i];
    s.x = st.x; s.y = st.y; s.dir = st.dir; s.blockId = st.blockId;
    s.sense = null; s.bump = null;
    if (st.kind === 'move') s.trail.push({ x: st.x, y: st.y });
    if (st.got !== undefined) s.got.add(st.got);
    if (st.kind === 'sense' && st.cell) s.sense = { ...st.cell, clear: !!st.clear };
    if (st.kind === 'bump' && st.cell) s.bump = st.cell;
  }
  return s;
}

export default function RoboQuest() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [stars, setStars] = useState<Record<string, number>>(() => read(STARS_KEY, {}));
  const [levelId, setLevelId] = useState(() => firstOpenLevel(read(STARS_KEY, {})));
  const level = ROBO_LEVELS.find(l => l.id === levelId) ?? ROBO_LEVELS[0];
  const board = useMemo(() => parseLevel(level), [level]);
  const world = WORLDS[level.world - 1];
  const [blocks, setBlocks] = useState(0);
  const [run, setRun] = useState<Run | null>(null);
  const [shown, setShownN] = useState(0);
  const [auto, setAuto] = useState(false);
  const [fast, setFast] = useState(false);
  const [message, setMessage] = useState('');
  const [won, setWon] = useState<{ stars: number; blocks: number } | null>(null);
  const [orphans, setOrphans] = useState(false);

  const divRef = useRef<HTMLDivElement>(null);
  const rw = useRef<RoboWorkspace | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const levelRef = useRef(level);
  levelRef.current = level;
  const loading = useRef(false);
  const saveTimer = useRef(0);

  // ── Blockly workspace (one for the whole screen; the toolbox and blocks change per level) ──
  const clearRun = useCallback(() => {
    if (!runRef.current) return;
    setRun(null); setShownN(0); setAuto(false);
    if (rw.current) highlight(rw.current.ws, null);
  }, []);

  const onEdit = useCallback(() => {
    const r = rw.current;
    if (!r || loading.current) return;
    const prog = workspaceToProgram(r.ws);
    setBlocks(blockCount(prog));
    const all = r.ws.getAllBlocks(false);
    setOrphans(all.some(b => !b.isEnabled()));
    // Any edit puts the robot back at the start.
    clearRun();
    setMessage('');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const codes = read<Record<string, Program>>(CODE_KEY, {});
      codes[levelRef.current.id] = stripIds(prog);
      write(CODE_KEY, codes);
    }, 400);
  }, [clearRun]);

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    const r = createWorkspace(div, level.blocks, window.innerWidth < 500, onEdit);
    rw.current = r;
    const ro = new ResizeObserver(() => resize(r.ws));
    ro.observe(div);
    return () => { ro.disconnect(); r.dispose(); rw.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Opens a level: its blocks in the flyout and her saved program on the canvas. */
  const loadLevel = useCallback((l: RoboLevelDef, prog?: Program) => {
    const r = rw.current;
    if (!r) return;
    loading.current = true;
    r.ws.updateToolbox(toolboxFor(l.blocks));
    const saved = prog ?? sanitizeProgram(read<Record<string, unknown>>(CODE_KEY, {})[l.id]);
    programToWorkspace(r.ws, saved);
    loading.current = false;
    setBlocks(blockCount(saved));
    setOrphans(false);
    resize(r.ws);
  }, []);

  const startLevel = useCallback((id: string) => {
    const l = ROBO_LEVELS.find(x => x.id === id) ?? ROBO_LEVELS[0];
    setLevelId(l.id);
    levelRef.current = l;
    setRun(null); setShownN(0); setAuto(false); setWon(null);
    setMessage(l.n === 1 ? `${WORLDS[l.world - 1].emoji} ${l.hint}` : '');
    setRound(r => r + 1);
    setStatus('playing');
    // The workspace div is under the start card, so it exists: load straight away.
    loadLevel(l);
  }, [loadLevel]);

  // ── Running the program ──
  const finish = useCallback((r: Run) => {
    const l = levelRef.current;
    const prog = rw.current ? workspaceToProgram(rw.current.ws) : [];
    if (r.result === 'dock') {
      const n = blockCount(prog);
      const st = starsFor(n, l.target);
      setWon({ stars: st, blocks: n });
      setMessage(`🎉 Docked! ${starRow(st)}`);
      playCorrect();
      setStars(prev => {
        const next = { ...prev, [l.id]: Math.max(prev[l.id] ?? 0, st) };
        write(STARS_KEY, next);
        return next;
      });
      later(() => setStatus('over'), 1100);
    } else {
      setMessage(MESSAGES[r.result]);
      if (r.result === 'bump') playNote(150, 0.25, 'square', 0.08);
      if (r.result === 'empty' && rw.current && r.emptyId) highlight(rw.current.ws, r.emptyId);
    }
  }, [later]);

  const startRun = useCallback((mode: 'auto' | 'step' | 'instant') => {
    const r = rw.current;
    if (!r || status !== 'playing') return null;
    const prog = workspaceToProgram(r.ws);
    if (prog.length === 0) { setMessage('Tap a block to add it under ▶ When Run, then press Run.'); return null; }
    const result = runProgram(board, prog);
    setRun(result);
    setMessage('');
    setWon(null);
    if (mode === 'instant') { setShownN(result.steps.length); finish(result); return result; }
    setShownN(mode === 'step' ? 1 : 0);
    setAuto(mode === 'auto');
    if (mode === 'step' && result.steps.length <= 1) finish(result);
    return result;
  }, [board, finish, status]);

  // Autoplay: one step at a time; sensor checks are quick, moves take longer.
  useEffect(() => {
    if (!auto || !run || status !== 'playing') return;
    if (shown >= run.steps.length) { setAuto(false); finish(run); return; }
    const next = run.steps[shown];
    const ms = next?.kind === 'sense' ? (fast ? 90 : 180) : fast ? 160 : 340;
    const t = window.setTimeout(() => {
      if (next?.kind === 'move') playPop();
      setShownN(n => n + 1);
    }, shown === 0 ? 120 : ms);
    return () => window.clearTimeout(t);
  }, [auto, run, shown, fast, status, finish]);

  // The running block lights up.
  const view = showAfter(board, run, shown);
  useEffect(() => {
    if (!rw.current) return;
    if (run && shown > 0) highlight(rw.current.ws, view.blockId ?? null);
  }, [run, shown, view.blockId]);

  const step = () => {
    playClick();
    if (!run) { startRun('step'); return; }
    if (auto) setAuto(false);
    if (shown >= run.steps.length) return;
    const n = shown + 1;
    setShownN(n);
    if (n >= run.steps.length) finish(run);
  };

  const reset = () => { playClick(); clearRun(); setMessage(''); setWon(null); };
  const hint = () => { playClick(); setMessage(`💡 ${level.hint}`); };

  // ?debug: tests open levels, load programs and solve them without dragging blocks.
  const hook = useRef({ startLevel, loadLevel, startRun, level });
  hook.current = { startLevel, loadLevel, startRun, level };
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      open: (id: string) => hook.current.startLevel(id),
      load: (prog: Program) => hook.current.loadLevel(hook.current.level, prog),
      run: () => hook.current.startRun('instant')?.result ?? null,
      solve: () => { hook.current.loadLevel(hook.current.level, hook.current.level.solution); setTimeout(() => hook.current.startRun('instant'), 0); },
      blocks: () => (rw.current ? blockCount(workspaceToProgram(rw.current.ws)) : 0),
      program: () => (rw.current ? stripIds(workspaceToProgram(rw.current.ws)) : []),
      get levelId() { return hook.current.level.id; },
    };
    (window as unknown as { __robo: typeof api }).__robo = api;
    return () => { delete (window as unknown as { __robo?: unknown }).__robo; };
  }, []);

  const idx = ROBO_LEVELS.findIndex(l => l.id === level.id);
  const nextLevel = ROBO_LEVELS[idx + 1];
  const running = auto && !!run && shown < run.steps.length;
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  const score = won ? levelScore(level.world, won.stars) : 0;

  const onStart = () => {
    if (status === 'over' && won && nextLevel) startLevel(nextLevel.id);
    else startLevel(level.id);
  };

  return (
    <GameShell
      gameId="robo_quest" title="Robo Quest" icon="🤖" xpScale={15} status={status} score={score} round={round}
      celebrateEnd
      onBack={status === 'ready' ? undefined : () => { setRun(null); setStatus('ready'); }}
      leaveLabel="🗺️ Level map"
      againLabel={nextLevel ? '▶ Next level' : '🔁 Play again'}
      overTitle={won ? `${level.title}: ${starRow(won.stars)}` : level.title}
      overStats={won ? [{ label: 'Your blocks', value: `🧩 ${won.blocks}` }, { label: '⭐⭐⭐ with', value: `🧩 ${level.target}` }] : undefined}
      overExtra={won && won.stars < 3 ? (
        <button onClick={() => { playClick(); startLevel(level.id); }}
          className="w-full min-h-[52px] rounded-full bg-sky-600 font-fredoka text-xl mb-3">
          🔧 Try for ⭐⭐⭐ ({level.target} blocks)
        </button>
      ) : undefined}
      startLabel={`▶ Play: ${world.emoji} ${level.title}`}
      onStart={onStart}
      onPause={() => { setAuto(false); setStatus('paused'); }}
      onResume={() => setStatus('playing')}
      readyContent={
        <LevelMap stars={stars} selected={level.id} total={totalStars}
          onPick={id => { playClick(); setLevelId(id); }} />
      }
    >
      {won && status === 'playing' && <ConfettiBurst count={60} durationMs={2000} />}
      {/* isolate: Blockly's flyout has its own z-index — keep it under the GameShell cards. */}
      <div className="absolute inset-0 isolate flex flex-col [@media(min-width:900px)_and_(orientation:landscape)]:flex-row">
        <section className="shrink-0 p-2 flex flex-col gap-2 [@media(min-width:900px)_and_(orientation:landscape)]:w-[44%] [@media(min-width:900px)_and_(orientation:landscape)]:h-full">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="font-fredoka text-lg truncate">{world.emoji} {level.world}-{level.n} · {level.title}</div>
            <div className="font-fredoka text-base whitespace-nowrap rounded-full bg-white/10 px-3 py-1" data-testid="robo-blocks">
              🧩 {blocks} · ⭐⭐⭐ with {level.target}
            </div>
          </div>
          <BoardView board={board} view={view} world={level.world} />
          <div className="font-nunito text-base text-center min-h-[24px] sm:min-h-[48px] flex items-center justify-center px-2" role="status" data-testid="robo-message">
            {message || (orphans ? 'Grey blocks aren’t joined to ▶ When Run, so they won’t run.' : <span className="hidden sm:inline">Tap blocks to add them, then press ▶ Run.</span>)}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            <Btn onClick={() => { playClick(); if (running) setAuto(false); else startRun('auto'); }} className="bg-green-600 min-w-[104px]" label={running ? '⏸ Stop' : '▶ Run'} />
            <Btn onClick={step} className="bg-sky-600" label={<>👣<span className="hidden sm:inline"> Step</span></>} ariaLabel="👣 Step" />
            <Btn onClick={reset} className="bg-white/15" label={<>🔄<span className="hidden sm:inline"> Reset</span></>} ariaLabel="🔄 Reset" />
            <Btn onClick={() => { playClick(); setFast(f => !f); }} className="bg-white/15" label={<>{fast ? '🐇' : '🐢'}<span className="hidden sm:inline">{fast ? ' Fast' : ' Slow'}</span></>} ariaLabel={fast ? 'Speed: fast' : 'Speed: slow'} />
            <Btn onClick={hint} className="bg-amber-500 text-stone-900" label={<>💡<span className="hidden sm:inline"> Hint</span></>} ariaLabel="💡 Hint" />
          </div>
        </section>
        <div ref={divRef} className="relative flex-1 min-h-[240px]" data-testid="robo-workspace" />
      </div>
    </GameShell>
  );
}

function Btn({ onClick, className, label, ariaLabel }: { onClick: () => void; className: string; label: ReactNode; ariaLabel?: string }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} className={`min-h-[48px] min-w-[48px] px-3 sm:px-4 rounded-2xl font-fredoka text-lg ${className}`}>{label}</button>
  );
}

function LevelMap({ stars, selected, total, onPick }: { stars: Record<string, number>; selected: string; total: number; onPick: (id: string) => void }) {
  return (
    <div className="text-left space-y-3 max-h-[56vh] overflow-y-auto pr-1">
      <p className="font-nunito text-lg text-violet-100 text-center">Program the robot with blocks to reach its dock 🔋. ⭐ {total} / {ROBO_LEVELS.length * 3}</p>
      {WORLDS.map(w => (
        <div key={w.world} className="rounded-2xl bg-white/5 p-2">
          <div className="font-fredoka text-lg mb-1">{w.emoji} {w.name} <span className="font-nunito text-sm text-violet-200">· {w.intro}</span></div>
          <div className="grid grid-cols-5 gap-2">
            {ROBO_LEVELS.filter(l => l.world === w.world).map(l => {
              const i = ROBO_LEVELS.indexOf(l);
              const open = isUnlocked(i, stars);
              return (
                <button key={l.id} disabled={!open} onClick={() => onPick(l.id)}
                  aria-label={`Level ${w.world}-${l.n} ${l.title}${open ? '' : ' (locked)'}`}
                  className={`min-h-[52px] rounded-xl font-fredoka text-base disabled:opacity-40 ${l.id === selected ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                  <div>{open ? l.n : '🔒'}</div>
                  <div className="text-[11px] leading-none">{open ? starRow(stars[l.id] ?? 0) : ''}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const FLOOR: Record<number, string> = { 1: '#bbf7d0', 2: '#fed7aa', 3: '#c4b5fd' };
const ARROW = ['▲', '▶', '▼', '◀'];

function BoardView({ board, view, world }: { board: Board; view: Shown; world: 1 | 2 | 3 }) {
  const wall = WORLDS[world - 1].wall;
  const W = board.w * CELL, H = board.h * CELL;
  const c = (x: number) => x * CELL + CELL / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[24vh] sm:max-h-[40vh] [@media(min-width:900px)_and_(orientation:landscape)]:max-h-[60vh] mx-auto block" role="img"
      aria-label={`Board: robot at column ${view.x + 1}, row ${view.y + 1}`} data-testid="robo-board">
      <style>{'@keyframes roboPulse{0%{opacity:.9;r:6}100%{opacity:0;r:22}} .robo-pulse{animation:roboPulse .45s ease-out infinite} @keyframes roboShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}'}</style>
      {board.cells.map((row, y) => row.map((ch, x) => {
        if (ch === ' ') return null;
        if (ch === '#') return <text key={`${x},${y}`} x={c(x)} y={c(y) + 2} fontSize={CELL * 0.62} textAnchor="middle" dominantBaseline="middle" opacity={0.85}>{wall}</text>;
        return <rect key={`${x},${y}`} x={x * CELL + 2} y={y * CELL + 2} width={CELL - 4} height={CELL - 4} rx={8} fill={FLOOR[world]} />;
      }))}
      {/* Breadcrumb trail */}
      <polyline points={view.trail.map(p => `${c(p.x)},${c(p.y)}`).join(' ')} fill="none" stroke="#6366f1" strokeWidth={4} strokeDasharray="2 8" strokeLinecap="round" opacity={0.8} />
      {view.trail.slice(1).map((p, i) => <circle key={i} cx={c(p.x)} cy={c(p.y)} r={3} fill="#6366f1" opacity={0.6} />)}
      <text x={c(board.dock.x)} y={c(board.dock.y) + 2} fontSize={CELL * 0.62} textAnchor="middle" dominantBaseline="middle">🔋</text>
      {board.batteries.map((b, i) => !view.got.has(i) && (
        <text key={i} x={c(b.x)} y={c(b.y) + 2} fontSize={CELL * 0.6} textAnchor="middle" dominantBaseline="middle" data-testid="robo-battery">⚡</text>
      ))}
      {view.sense && (
        <circle cx={c(view.sense.x)} cy={c(view.sense.y)} r={10} fill={view.sense.clear ? '#22c55e' : '#fb7185'} className="robo-pulse" data-testid="robo-sense" />
      )}
      {view.bump && <text x={c(view.bump.x)} y={c(view.bump.y) + 2} fontSize={CELL * 0.6} textAnchor="middle" dominantBaseline="middle">💥</text>}
      <g style={{ transform: `translate(${c(view.x)}px, ${c(view.y)}px)`, transition: 'transform 0.25s ease-out' }} data-testid="robo-robot">
        <g style={view.bump ? { animation: 'roboShake .3s ease-in-out 2' } : undefined}>
          <circle r={CELL * 0.44} fill="#ffffff" opacity={0.9} />
          <text y={2} fontSize={CELL * 0.62} textAnchor="middle" dominantBaseline="middle">🤖</text>
          <text x={DX[view.dir] * CELL * 0.42} y={DY[view.dir] * CELL * 0.42 + 2} fontSize={CELL * 0.3} textAnchor="middle" dominantBaseline="middle" fill="#4338ca">{ARROW[view.dir]}</text>
        </g>
      </g>
    </svg>
  );
}
