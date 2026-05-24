import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playCoin, playWin, playWrong, playUnlock } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const SIZE = 7;
const CHARMS = ['💖', '⭐', '🌸', '👑', '🎀', '💎'];
const POWER_CHARM = '⚡';
const TIME = 60;

type Cell = { id: number; charm: string; isPower: boolean };

function makeCell(id: number, charm?: string, isPower = false): Cell {
  return { id, charm: charm ?? CHARMS[Math.floor(Math.random() * CHARMS.length)], isPower };
}

function findMatches(grid: Cell[][]): Set<string> {
  const m = new Set<string>();
  // horizontal
  for (let r = 0; r < SIZE; r++) {
    let run = 1;
    for (let c = 1; c < SIZE; c++) {
      if (grid[r][c].charm === grid[r][c - 1].charm) run++;
      else {
        if (run >= 3) for (let k = 0; k < run; k++) m.add(`${r}-${c - 1 - k}`);
        run = 1;
      }
    }
    if (run >= 3) for (let k = 0; k < run; k++) m.add(`${r}-${SIZE - 1 - k}`);
  }
  // vertical
  for (let c = 0; c < SIZE; c++) {
    let run = 1;
    for (let r = 1; r < SIZE; r++) {
      if (grid[r][c].charm === grid[r - 1][c].charm) run++;
      else {
        if (run >= 3) for (let k = 0; k < run; k++) m.add(`${r - 1 - k}-${c}`);
        run = 1;
      }
    }
    if (run >= 3) for (let k = 0; k < run; k++) m.add(`${SIZE - 1 - k}-${c}`);
  }
  return m;
}

let idCounter = 0;
function freshGrid(): Cell[][] {
  let grid: Cell[][];
  do {
    grid = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => makeCell(++idCounter))
    );
  } while (findMatches(grid).size > 0);
  return grid;
}

const SparkleMatch: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [grid, setGrid] = useState<Cell[][]>(() => freshGrid());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('sparkle_best') || '0'));
  const [confetti, setConfetti] = useState(false);
  const [matchedKeys, setMatchedKeys] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const floatId = useRef(0);

  // Timer
  useEffect(() => {
    if (!running || done) return;
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [running, done]);

  useEffect(() => {
    if (timeLeft <= 0 && running && !done) {
      setRunning(false);
      setDone(true);
      const isHigh = score > highScore;
      if (isHigh) {
        setHighScore(score);
        localStorage.setItem('sparkle_best', String(score));
        setConfetti(true);
        setTimeout(() => setConfetti(false), 2500);
        playWin();
      } else playWrong();
      addXP(Math.floor(score / 8));
    }
  }, [timeLeft, running, done, score, highScore, addXP]);

  const addFloat = (r: number, c: number, text: string) => {
    const id = ++floatId.current;
    setFloats(f => [...f, { id, x: c * 100 / SIZE, y: r * 100 / SIZE, text }]);
    setTimeout(() => setFloats(f => f.filter(fl => fl.id !== id)), 900);
  };

  const adjacent = (a: [number, number], b: [number, number]) =>
    (a[0] === b[0] && Math.abs(a[1] - b[1]) === 1) || (a[1] === b[1] && Math.abs(a[0] - b[0]) === 1);

  const applyMatches = useCallback((g: Cell[][], chainDepth = 1) => {
    const matches = findMatches(g);
    if (matches.size === 0) return { grid: g, scored: 0, chain: chainDepth - 1 };

    // Identify match groups for power charm creation
    const runs: { r: number; c: number; len: number; dir: 'h' | 'v' }[] = [];
    // horizontal runs
    for (let r = 0; r < SIZE; r++) {
      let run = 1, start = 0;
      for (let c = 1; c < SIZE; c++) {
        if (g[r][c].charm === g[r][c - 1].charm) run++;
        else { if (run >= 3) runs.push({ r, c: start, len: run, dir: 'h' }); run = 1; start = c; }
      }
      if (run >= 3) runs.push({ r, c: start, len: run, dir: 'h' });
    }
    for (let c = 0; c < SIZE; c++) {
      let run = 1, start = 0;
      for (let r = 1; r < SIZE; r++) {
        if (g[r][c].charm === g[r - 1][c].charm) run++;
        else { if (run >= 3) runs.push({ r: start, c, len: run, dir: 'v' }); run = 1; start = r; }
      }
      if (run >= 3) runs.push({ r: start, c, len: run, dir: 'v' });
    }

    // Power charm spawn locations (where 4+ matches happened)
    const powerSpawn = new Set<string>();
    runs.forEach(rn => {
      if (rn.len >= 4) {
        const mid = rn.dir === 'h' ? `${rn.r}-${rn.c + Math.floor(rn.len / 2)}` : `${rn.r + Math.floor(rn.len / 2)}-${rn.c}`;
        powerSpawn.add(mid);
      }
    });

    // Expand power charm clears
    const cleared = new Set<string>(matches);
    matches.forEach(key => {
      const [r, c] = key.split('-').map(Number);
      if (g[r][c].isPower) {
        // clear row and column
        for (let i = 0; i < SIZE; i++) {
          cleared.add(`${r}-${i}`);
          cleared.add(`${i}-${c}`);
        }
      }
    });

    // Score
    const matchScore = cleared.size * 10 * chainDepth;
    const fourBonus = runs.filter(r => r.len === 4).length * 25;
    const fiveBonus = runs.filter(r => r.len >= 5).length * 60;
    const earned = matchScore + fourBonus + fiveBonus;

    // Visual matched indicator (briefly)
    setMatchedKeys(cleared);

    // Apply removal + gravity
    const next = g.map(row => row.map(c => ({ ...c })));
    cleared.forEach(key => {
      const [r, c] = key.split('-').map(Number);
      next[r][c] = makeCell(++idCounter, '_', false);
      next[r][c].charm = '_'; // placeholder
    });

    // power charms spawn
    powerSpawn.forEach(k => {
      if (cleared.has(k)) {
        const [r, c] = k.split('-').map(Number);
        next[r][c] = { id: ++idCounter, charm: POWER_CHARM, isPower: true };
      }
    });

    // Drop: for each column, compact non-empty downward
    for (let c = 0; c < SIZE; c++) {
      const col: Cell[] = [];
      for (let r = SIZE - 1; r >= 0; r--) {
        if (next[r][c].charm !== '_') col.push(next[r][c]);
      }
      for (let r = SIZE - 1; r >= 0; r--) {
        if (col.length > 0) next[r][c] = col.shift()!;
        else next[r][c] = makeCell(++idCounter);
      }
    }

    return { grid: next, scored: earned, chain: chainDepth };
  }, []);

  const handleTap = useCallback((r: number, c: number) => {
    if (busy || done) return;
    if (!running) { setRunning(true); }
    playPop();

    if (!selected) { setSelected([r, c]); return; }
    if (selected[0] === r && selected[1] === c) { setSelected(null); return; }
    if (!adjacent(selected, [r, c])) { setSelected([r, c]); return; }

    // Swap
    setBusy(true);
    const sr = selected[0], sc = selected[1];
    setSelected(null);

    const swapped = grid.map(row => row.map(cell => ({ ...cell })));
    [swapped[sr][sc], swapped[r][c]] = [swapped[r][c], swapped[sr][sc]];

    // Check if swap creates a match
    if (findMatches(swapped).size === 0) {
      // Invalid swap → wiggle and revert
      playWrong();
      setGrid(swapped);
      setTimeout(() => { setGrid(grid); setBusy(false); }, 300);
      return;
    }

    // Cascade through matches
    let cur = swapped;
    let totalEarned = 0;
    let depth = 0;
    const cascade = (delay: number) => {
      const result = applyMatches(cur, depth + 1);
      if (result.scored === 0) {
        setGrid(cur);
        setMatchedKeys(new Set());
        setBusy(false);
        if (totalEarned > 0) {
          setScore(s => s + totalEarned);
          setCombo(depth);
          if (depth >= 2) addFloat(r, c, `COMBO x${depth}!`);
          if (depth >= 3) playUnlock();
          else playCoin();
        }
        return;
      }
      depth = result.chain;
      totalEarned += result.scored;
      cur = result.grid;
      setGrid(cur);
      setTimeout(() => cascade(delay + 30), 380);
    };
    setTimeout(() => cascade(0), 250);
  }, [busy, done, running, selected, grid, applyMatches]);

  const startOver = () => {
    playClick();
    setGrid(freshGrid());
    setSelected(null);
    setScore(0);
    setCombo(0);
    setTimeLeft(TIME);
    setRunning(false);
    setDone(false);
    setMatchedKeys(new Set());
    setBusy(false);
  };

  const timePct = (timeLeft / TIME) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center p-4"
      style={{ background: 'linear-gradient(135deg, #fae8ff 0%, #f3e8ff 100%)' }}
    >
      {confetti && <ConfettiBurst count={70} durationMs={2500} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('girls_zone'); }}
          className="mb-3 px-4 py-2 bg-white/70 hover:bg-white text-purple-700 rounded-full font-fredoka text-sm border-2 border-purple-200">
          ← Girls Zone
        </button>

        <div className="text-center mb-3">
          <h1 className="text-3xl font-fredoka font-bold text-purple-700">💎 Sparkle Match</h1>
          <p className="font-nunito text-purple-500 text-sm">Match 3+ charms to make them sparkle!</p>
        </div>

        {/* Stats */}
        <div className="flex justify-between bg-white/80 border-2 border-purple-200 rounded-2xl px-4 py-2 mb-2 shadow-sm">
          <span className="font-fredoka font-bold text-purple-700">⭐ {score}</span>
          <span className={`font-fredoka font-bold ${timeLeft <= 10 ? 'text-red-500' : 'text-purple-700'}`}>⏱️ {timeLeft}s</span>
          <span className="font-fredoka text-pink-500">🏆 {Math.max(highScore, score)}</span>
        </div>
        <div className="bg-purple-100 rounded-full h-2 mb-3 overflow-hidden border border-purple-200">
          <motion.div
            className={`h-2 rounded-full ${timeLeft > 30 ? 'bg-green-400' : timeLeft > 10 ? 'bg-yellow-400' : 'bg-red-400'}`}
            animate={{ width: `${timePct}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>

        {/* Combo flash */}
        <AnimatePresence>
          {combo >= 2 && (
            <motion.p
              key={combo}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1.1 }}
              exit={{ opacity: 0 }}
              className="text-center font-fredoka font-bold text-pink-500 text-xl mb-2"
            >
              🔥 COMBO x{combo}!
            </motion.p>
          )}
        </AnimatePresence>

        {/* Grid */}
        <div className="relative bg-white/80 rounded-3xl p-2 shadow-xl border-2 border-purple-200 mb-3">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r}-${c}`;
                const isSelected = selected?.[0] === r && selected?.[1] === c;
                const isMatched = matchedKeys.has(key);
                return (
                  <motion.button
                    key={cell.id}
                    layout
                    onClick={() => handleTap(r, c)}
                    initial={{ scale: 1 }}
                    animate={{
                      scale: isMatched ? [1, 1.3, 0.8] : isSelected ? 1.15 : 1,
                      rotate: isMatched ? [0, 20, -20, 0] : 0,
                    }}
                    transition={{ duration: isMatched ? 0.3 : 0.15 }}
                    className={`aspect-square rounded-xl text-3xl flex items-center justify-center transition-colors
                      ${isSelected ? 'bg-yellow-200 ring-4 ring-yellow-400' :
                        cell.isPower ? 'bg-gradient-to-br from-yellow-200 to-orange-300 shadow-md' :
                        'bg-white hover:bg-purple-50'}
                      ${isMatched ? 'opacity-50' : ''}
                    `}
                  >
                    {cell.charm === '_' ? '' : cell.charm}
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Float texts */}
          <AnimatePresence>
            {floats.map(f => (
              <motion.div
                key={f.id}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -40, scale: 1.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9 }}
                className="absolute pointer-events-none font-fredoka font-bold text-pink-500 text-lg"
                style={{ left: `${f.x}%`, top: `${f.y}%` }}
              >
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {!running && !done && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 text-center mb-3">
            <p className="font-nunito text-blue-700 text-sm">
              💡 Tap a charm, then tap an <strong>adjacent</strong> one to swap. Make 3+ in a row to score!
            </p>
            <p className="font-nunito text-blue-600 text-xs mt-1">Match 4+ = create a ⚡ POWER charm that clears a row & column!</p>
          </div>
        )}

        <button onClick={startOver} className="w-full py-2 bg-purple-200 text-purple-700 rounded-full font-fredoka text-sm">
          🔄 Restart
        </button>

        {/* Done */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/95 rounded-3xl p-6 shadow-2xl border-4 border-purple-300 text-center mt-4"
            >
              <div className="text-5xl mb-2">{score > highScore - 1 && score >= highScore ? '🏆' : '✨'}</div>
              <h2 className="text-3xl font-fredoka font-bold text-purple-700 mb-1">
                {score >= highScore && score > 0 ? 'NEW BEST!' : 'Time\'s Up!'}
              </h2>
              <p className="font-fredoka text-2xl text-pink-500 mb-1">⭐ {score}</p>
              <p className="font-nunito text-purple-500 mb-3">+{Math.floor(score / 8)} XP earned!</p>
              <button onClick={startOver} className="btn-kid mr-2">🔄 Again</button>
              <button onClick={() => setGameState('girls_zone')} className="btn-kid-secondary">← Zone</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SparkleMatch;
