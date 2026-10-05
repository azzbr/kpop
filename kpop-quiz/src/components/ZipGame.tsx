import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { createRng } from '../games/engine/rng';
import ConfettiBurst from './ConfettiBurst';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playPop, playWrong, playCorrect } from '../utils/sounds';
import { ZIP_LEVELS, generateZip, applyStep, numbersPassed, maxNumber, zipScore } from './games/zipLogic';
import type { ZipLevel, ZipPuzzle } from './games/zipLogic';

// Best time per difficulty (content key, like before; the score itself goes through finishRound).
const BEST_KEY = 'zip_best';
type BestTimes = Partial<Record<ZipLevel['id'], number>>;
const readBest = (): BestTimes => {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') as BestTimes; } catch { return {}; }
};
const LEVEL_KEY = 'zip_level';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function ZipGame() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  // Pause when she switches apps
  useEffect(() => {
    const h = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  const [levelIdx, setLevelIdx] = useState(() => {
    try { return Math.min(ZIP_LEVELS.length - 1, Math.max(0, Number(localStorage.getItem(LEVEL_KEY)) || 0)); } catch { return 0; }
  });
  const level = ZIP_LEVELS[levelIdx];
  const [puzzle, setPuzzle] = useState<ZipPuzzle>(() => generateZip(ZIP_LEVELS[0], createRng(1)));
  const [path, setPathState] = useState<number[]>([]);
  const pathRef = useRef<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(0);
  const [best, setBest] = useState<BestTimes>(readBest);
  const [newBest, setNewBest] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setPath = (p: number[]) => { pathRef.current = p; setPathState(p); };
  const { size, numbered } = puzzle;
  const total = size * size;
  const playing = status === 'playing' && !won;

  useEffect(() => {
    if (!playing || path.length === 0) return;
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [playing, path.length]);

  const start = () => {
    try { localStorage.setItem(LEVEL_KEY, String(levelIdx)); } catch { /* private mode */ }
    setPuzzle(generateZip(level, createRng((Date.now() ^ (Math.random() * 1e9)) >>> 0)));
    setPath([]);
    setSeconds(0);
    setWon(false);
    setNewBest(false);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const solved = () => {
    setWon(true);
    playCorrect();
    const prev = best[level.id];
    if (prev === undefined || seconds < prev) {
      const next = { ...best, [level.id]: seconds };
      setBest(next);
      setNewBest(true);
      try { localStorage.setItem(BEST_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    }
    later(() => setStatus('over'), 1600);
  };

  const bad = () => { playWrong(); setShake(s => s + 1); };

  const cellAt = (e: ReactPointerEvent): number => {
    const el = boardRef.current;
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * size);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * size);
    if (r < 0 || c < 0 || r >= size || c >= size) return -1;
    return r * size + c;
  };

  const touch = (cell: number, fromDrag: boolean) => {
    const cur = pathRef.current;
    const res = applyStep(puzzle, cur, cell);
    if (res.result === 'same') return;
    if (res.result === 'bad') { if (!fromDrag) bad(); return; }
    // While dragging, only step back one square at a time (sliding over your own path shouldn't cut it).
    if (fromDrag && res.result === 'back' && cell !== cur[cur.length - 2]) return;
    if (res.result === 'back') playClick(); else playPop();
    setPath(res.path);
    if (res.path.length === total) solved();
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!playing) return;
    e.preventDefault();
    dragging.current = true;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const cell = cellAt(e);
    if (cell >= 0) touch(cell, false);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current || !playing) return;
    const cell = cellAt(e);
    if (cell >= 0) touch(cell, true);
  };
  const endDrag = () => { dragging.current = false; };

  const undo = () => { if (!playing || !path.length) return; playClick(); setPath(path.slice(0, -1)); };
  const restart = () => { if (!playing) return; playClick(); setPath([]); };

  const center = (cell: number) => ({ x: (cell % size) + 0.5, y: Math.floor(cell / size) + 0.5 });
  const passed = numbersPassed(puzzle, path);
  const score = won ? zipScore(level, seconds) : 0;

  const chip = (on: boolean) => `min-h-[56px] rounded-2xl px-3 py-2 font-fredoka text-lg text-left ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;

  return (
    <GameShell
      gameId="zip_game"
      title="Zip"
      icon="🔗"
      xpScale={9}
      status={status}
      score={score}
      round={round}
      overTitle={`${level.name} solved in ${fmtTime(seconds)}!`}
      overStats={[
        { label: '⏱️ Time', value: fmtTime(seconds) },
        { label: newBest ? '⭐ New best time!' : `Best (${level.name})`, value: best[level.id] !== undefined ? fmtTime(best[level.id]!) : '—' },
      ]}
      onStart={start}
      onPause={() => { dragging.current = false; setStatus('paused'); }}
      onResume={() => setStatus('playing')}
      startLabel={round === 0 ? '▶ Play' : '▶ New puzzle'}
      readyContent={
        <div className="space-y-3">
          <p className="font-nunito text-lg text-violet-100">
            Start on <b>1</b> and draw one path through <b>every square</b>, passing the numbers in order. Drag your finger or tap square by square.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ZIP_LEVELS.map((l, i) => (
              <button key={l.id} onClick={() => { playClick(); setLevelIdx(i); }} className={chip(i === levelIdx)}>
                <div>{l.name} · {l.size}×{l.size}</div>
                <div className="font-nunito text-sm opacity-80">Best: {best[l.id] !== undefined ? fmtTime(best[l.id]!) : '—'}</div>
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
            <span className="rounded-full bg-white/10 px-4 py-1">{level.name} · {size}×{size}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">⏱️ {fmtTime(seconds)}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">{path.length}/{total} squares</span>
            <span className="rounded-full bg-white/10 px-4 py-1">Next: {passed < maxNumber(puzzle) ? passed + 1 : '✔'}</span>
          </div>

          <motion.div
            key={shake}
            animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
            transition={{ duration: 0.35 }}
            className="rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/40 p-2 shadow-2xl"
          >
            <div
              ref={boardRef}
              className="relative game-surface"
              style={{ width: 'min(90vw, calc(100dvh - 300px), 560px)', aspectRatio: '1 / 1' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              role="grid"
              aria-label="Zip board"
            >
              <div className="absolute inset-0 grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
                {Array.from({ length: total }, (_, cell) => {
                  const pos = path.indexOf(cell);
                  const inPath = pos >= 0;
                  const isHead = inPath && pos === path.length - 1;
                  const ratio = inPath ? pos / Math.max(total - 1, 1) : 0;
                  return (
                    <div
                      key={cell}
                      className={`rounded-xl flex items-center justify-center ${isHead ? 'ring-4 ring-yellow-300' : ''}`}
                      style={{ background: inPath ? `hsl(${280 - ratio * 120}, 70%, 45%)` : 'rgba(255,255,255,0.10)' }}
                    />
                  );
                })}
              </div>
              {/* the path line */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${size} ${size}`}>
                {path.length > 1 && (
                  <polyline
                    points={path.map(c => { const p = center(c); return `${p.x},${p.y}`; }).join(' ')}
                    fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={0.18} strokeLinecap="round" strokeLinejoin="round"
                  />
                )}
                {Object.entries(numbered).map(([cell, n]) => {
                  const p = center(Number(cell));
                  const hit = path.includes(Number(cell));
                  return (
                    <g key={cell}>
                      <circle cx={p.x} cy={p.y} r={0.32} fill={hit ? '#facc15' : '#0f172a'} stroke="#facc15" strokeWidth={0.06} />
                      <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={0.36}
                        fontFamily="Fredoka One, sans-serif" fill={hit ? '#0f172a' : '#fde68a'}>{n}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </motion.div>

          <div className="flex gap-3">
            <button onClick={undo} disabled={!playing || !path.length} className="min-h-[56px] px-6 rounded-2xl bg-sky-600 font-fredoka text-xl disabled:opacity-40">↩️ Undo</button>
            <button onClick={restart} disabled={!playing || !path.length} className="min-h-[56px] px-6 rounded-2xl bg-white/15 font-fredoka text-xl disabled:opacity-40">🔄 Clear</button>
          </div>
          <p className="font-nunito text-base text-violet-200 text-center">
            {path.length === 0 ? 'Put your finger on 1 to start!' : 'Tip: touch any square on your path to go back to it.'}
          </p>
        </div>
      </div>
    </GameShell>
  );
}
