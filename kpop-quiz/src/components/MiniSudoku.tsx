import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { createRng } from '../games/engine/rng';
import ConfettiBurst from './ConfettiBurst';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playPop, playWrong, playCorrect } from '../utils/sounds';
import { N, BOX_H, BOX_W, SUDOKU_LEVELS, makePuzzle, findConflicts, isSolvedGrid, sudokuScore } from './games/sudokuLogic';
import type { Grid } from './games/sudokuLogic';

const NUMBER_COLORS = ['', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f472b6'];
const LEVEL_KEY = 'sudoku_level';
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const emptyGrid = (): Grid => Array.from({ length: N }, () => Array(N).fill(0));

export default function MiniSudoku() {
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
    try { return Math.min(SUDOKU_LEVELS.length - 1, Math.max(0, Number(localStorage.getItem(LEVEL_KEY)) || 0)); } catch { return 0; }
  });
  const level = SUDOKU_LEVELS[levelIdx];
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [given, setGiven] = useState<boolean[][]>(() => emptyGrid().map(r => r.map(() => false)));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [won, setWon] = useState(false);

  const playing = status === 'playing' && !won;

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [playing]);

  const start = () => {
    try { localStorage.setItem(LEVEL_KEY, String(levelIdx)); } catch { /* private mode */ }
    const { puzzle } = makePuzzle(level, createRng((Date.now() ^ (Math.random() * 1e9)) >>> 0));
    setGrid(puzzle);
    setGiven(puzzle.map(row => row.map(v => v !== 0)));
    const firstEmpty = puzzle.flatMap((row, r) => row.map((v, c) => [r, c, v])).find(x => x[2] === 0);
    setSelected(firstEmpty ? [firstEmpty[0], firstEmpty[1]] : null);
    setSeconds(0);
    setMistakes(0);
    setWon(false);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const conflicts = findConflicts(grid);

  const place = (num: number) => {
    if (!playing || !selected) return;
    const [r, c] = selected;
    if (given[r][c]) return;
    const next = grid.map(row => [...row]);
    next[r][c] = next[r][c] === num ? 0 : num;
    setGrid(next);
    if (next[r][c] === 0) { playClick(); return; }
    if (findConflicts(next).has(`${r}-${c}`)) { playWrong(); setMistakes(m => m + 1); return; }
    playPop();
    if (isSolvedGrid(next)) {
      setWon(true);
      setSelected(null);
      playCorrect();
      later(() => setStatus('over'), 1800);
    }
  };

  const erase = () => {
    if (!playing || !selected) return;
    const [r, c] = selected;
    if (given[r][c]) return;
    playClick();
    const next = grid.map(row => [...row]);
    next[r][c] = 0;
    setGrid(next);
  };

  const remaining = (num: number) => N - grid.flat().filter(v => v === num).length;
  const score = won ? sudokuScore(level, seconds) : 0;
  const selVal = selected ? grid[selected[0]][selected[1]] : 0;

  const chip = (on: boolean) => `min-h-[56px] rounded-2xl px-3 py-2 font-fredoka text-lg ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;

  return (
    <GameShell
      gameId="mini_sudoku"
      title="Mini Sudoku"
      icon="🔢"
      xpScale={9}
      status={status}
      score={score}
      round={round}
      overTitle={`${level.name} sudoku solved!`}
      overStats={[
        { label: '⏱️ Time', value: fmtTime(seconds) },
        { label: '🙈 Oops', value: mistakes === 0 ? '0 — flawless! ✨' : String(mistakes) },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      startLabel={round === 0 ? '▶ Play' : '▶ New puzzle'}
      readyContent={
        <div className="space-y-3">
          <p className="font-nunito text-lg text-violet-100">
            Fill the 6×6 grid so every row, column and box has 1–6 once each. Every puzzle has exactly one answer. Be quick for more points!
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SUDOKU_LEVELS.map((l, i) => (
              <button key={l.id} onClick={() => { playClick(); setLevelIdx(i); }} className={chip(i === levelIdx)}>{l.name}</button>
            ))}
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {won && <ConfettiBurst count={70} durationMs={2500} />}
        <div className="max-w-xl mx-auto flex flex-col items-center gap-3">
          <div className="flex flex-wrap justify-center gap-2 font-fredoka text-lg">
            <span className="rounded-full bg-white/10 px-4 py-1">{level.name}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">⏱️ {fmtTime(seconds)}</span>
            <span className={`rounded-full px-4 py-1 ${conflicts.size ? 'bg-rose-500/70' : 'bg-white/10'}`}>
              {conflicts.size ? '⚠️ Two the same!' : '✓ Looking good'}
            </span>
          </div>

          {/* Grid */}
          <div className="rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/40 p-2 shadow-2xl">
            <div className="grid rounded-xl overflow-hidden bg-fuchsia-300/70 gap-[2px] p-[3px]"
              style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`, width: 'min(88vw, calc(100dvh - 360px), 480px)' }}>
              {grid.map((row, r) => row.map((v, c) => {
                const isGiven = given[r]?.[c];
                const isSel = selected?.[0] === r && selected?.[1] === c;
                const isConflict = conflicts.has(`${r}-${c}`);
                const sameNum = selVal !== 0 && v === selVal;
                const inLine = selected && (selected[0] === r || selected[1] === c);
                const borderR = (c + 1) % BOX_W === 0 && c < N - 1;
                const borderB = (r + 1) % BOX_H === 0 && r < N - 1;
                const bg = isSel ? '#a78bfa' : isConflict ? '#9f1239' : sameNum ? '#5b21b6' : inLine ? '#312e81' : isGiven ? '#1e1b4b' : '#27235f';
                return (
                  <motion.button
                    key={`${r}-${c}`}
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    animate={won ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                    transition={{ delay: won ? (r + c) * 0.04 : 0, duration: 0.3 }}
                    onClick={() => { if (!playing) return; playClick(); setSelected([r, c]); }}
                    aria-label={`Row ${r + 1} column ${c + 1}${v ? `, ${v}` : ', empty'}`}
                    className="aspect-square flex items-center justify-center font-fredoka"
                    style={{
                      background: bg,
                      color: isConflict ? '#fecdd3' : isGiven ? '#ffffff' : NUMBER_COLORS[v],
                      fontSize: 'min(7vw, 2.4rem)',
                      marginRight: borderR ? 3 : 0,
                      marginBottom: borderB ? 3 : 0,
                    }}
                  >
                    {v !== 0 ? v : ''}
                  </motion.button>
                );
              }))}
            </div>
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-7 gap-2 w-full" style={{ maxWidth: 'min(92vw, 520px)' }}>
            {[1, 2, 3, 4, 5, 6].map(num => {
              const left = remaining(num);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => place(num)}
                  disabled={!playing}
                  className={`min-h-[56px] rounded-2xl font-fredoka text-3xl bg-white/15 active:scale-95 transition-transform disabled:opacity-40 ${left <= 0 ? 'opacity-40' : ''}`}
                  style={{ color: NUMBER_COLORS[num] }}
                  aria-label={`Put ${num}`}
                >
                  {num}
                </button>
              );
            })}
            <button type="button" onClick={erase} disabled={!playing} aria-label="Erase"
              className="min-h-[56px] rounded-2xl font-fredoka text-2xl bg-white/10 active:scale-95 disabled:opacity-40">⌫</button>
          </div>
          <p className="font-nunito text-base text-violet-200 text-center">
            {won ? '🎉 Solved! Amazing!' : 'Tap a square, then a number. Tap the same number again to remove it.'}
          </p>
        </div>
      </div>
    </GameShell>
  );
}
