import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface Puzzle {
  name: string;
  size: number;
  numbered: Record<number, number>; // cell index -> checkpoint label
}

// Each puzzle's numbers are derived from a real Hamiltonian path,
// so a path that fills every cell while hitting numbers in order always exists.
const PUZZLES: Puzzle[] = [
  { name: 'Warm-Up', size: 3, numbered: { 0: 1, 4: 2, 8: 3 } },
  { name: 'Easy', size: 4, numbered: { 0: 1, 6: 2, 10: 3, 12: 4 } },
  { name: 'Medium', size: 5, numbered: { 0: 1, 8: 2, 12: 3, 16: 4, 24: 5 } },
  { name: 'Tricky', size: 5, numbered: { 0: 1, 14: 2, 20: 3, 8: 4, 12: 5 } },
  { name: 'Expert', size: 6, numbered: { 0: 1, 8: 2, 23: 3, 27: 4, 30: 5 } },
];

const ZipGame: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [path, setPath] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [bestTimes, setBestTimes] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('zip_best') || '{}'); } catch { return {}; }
  });
  const timerRef = useRef<number | null>(null);

  const puzzle = PUZZLES[puzzleIdx];
  const { size, numbered } = puzzle;
  const totalCells = size * size;
  const maxNumber = Math.max(...Object.values(numbered));

  useEffect(() => {
    if (running && !won) {
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, won]);

  const resetPuzzle = (idx: number) => {
    setPuzzleIdx(idx);
    setPath([]);
    setSeconds(0);
    setRunning(false);
    setWon(false);
  };

  const adjacent = (a: number, b: number) => {
    const ra = Math.floor(a / size), ca = a % size;
    const rb = Math.floor(b / size), cb = b % size;
    return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
  };

  const passedCount = path.filter(c => numbered[c]).length;

  const triggerShake = () => {
    playWrong();
    setShake(true);
    setTimeout(() => setShake(false), 350);
  };

  const handleCellTap = (cell: number) => {
    if (won) return;

    // Start the path — must begin on number 1
    if (path.length === 0) {
      if (numbered[cell] === 1) {
        playPop();
        setPath([cell]);
        setRunning(true);
      } else {
        triggerShake();
      }
      return;
    }

    const last = path[path.length - 1];

    // Tap the head -> undo
    if (cell === last) {
      playClick();
      setPath(p => p.slice(0, -1));
      return;
    }

    // Already visited (not head) -> ignore
    if (path.includes(cell)) {
      triggerShake();
      return;
    }

    // Must be adjacent
    if (!adjacent(cell, last)) {
      triggerShake();
      return;
    }

    // If it's a numbered cell, it must be the next number in order
    if (numbered[cell] && numbered[cell] !== passedCount + 1) {
      triggerShake();
      return;
    }

    const newPath = [...path, cell];
    playPop();
    setPath(newPath);

    if (newPath.length === totalCells) {
      setWon(true);
      setRunning(false);
      playWin();
      addXP(30);
      const key = `${size}x${size}`;
      setBestTimes(prev => {
        const best = prev[key];
        if (best === undefined || seconds < best) {
          const updated = { ...prev, [key]: seconds };
          localStorage.setItem('zip_best', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  };

  const pathPos = (cell: number) => path.indexOf(cell);
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {won && <ConfettiBurst count={60} durationMs={2500} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-4">
          <div className="text-5xl mb-1">🔗</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow">Zip!</h1>
          <p className="font-nunito text-gray-500 text-sm">⏱️ 30-second break — connect the dots & fill the grid</p>
        </div>

        {/* Puzzle selector */}
        <div className="flex gap-2 justify-center flex-wrap mb-4">
          {PUZZLES.map((p, i) => (
            <button
              key={p.name}
              onClick={() => { playClick(); resetPuzzle(i); }}
              className={`px-3 py-1.5 rounded-full font-fredoka text-sm border-2 transition-colors ${
                i === puzzleIdx
                  ? 'bg-purple-500 border-purple-600 text-white'
                  : 'bg-white border-purple-200 text-purple-600 hover:bg-purple-50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex justify-between items-center bg-white rounded-2xl px-4 py-2 shadow border-2 border-purple-200 mb-4">
          <span className="font-fredoka font-bold text-purple-600">⏱️ {fmtTime(seconds)}</span>
          <span className="font-fredoka text-gray-600">{path.length}/{totalCells} cells</span>
          <span className="font-fredoka text-gray-400 text-sm">
            Best: {bestTimes[`${size}x${size}`] !== undefined ? fmtTime(bestTimes[`${size}x${size}`]) : '—'}
          </span>
        </div>

        {/* Grid */}
        <motion.div
          animate={shake ? { x: [-6, 6, -6, 6, 0] } : {}}
          transition={{ duration: 0.35 }}
          className="bg-white rounded-3xl p-3 shadow-xl border-2 border-purple-200 mb-4"
        >
          <div
            className="grid gap-1.5 mx-auto"
            style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, maxWidth: 360 }}
          >
            {Array.from({ length: totalCells }).map((_, cell) => {
              const pos = pathPos(cell);
              const inPath = pos !== -1;
              const isHead = pos === path.length - 1 && inPath;
              const label = numbered[cell];
              const ratio = inPath ? pos / Math.max(totalCells - 1, 1) : 0;
              return (
                <motion.button
                  key={cell}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => handleCellTap(cell)}
                  className={`aspect-square rounded-xl flex items-center justify-center font-fredoka font-bold transition-colors duration-150 ${
                    inPath
                      ? 'text-white'
                      : label
                      ? 'bg-yellow-100 border-2 border-yellow-400 text-yellow-700'
                      : 'bg-gray-100 border-2 border-gray-200 text-gray-300 hover:bg-purple-50'
                  } ${isHead ? 'ring-4 ring-pink-400' : ''}`}
                  style={inPath ? {
                    background: `linear-gradient(135deg, hsl(${270 - ratio * 90}, 75%, 60%), hsl(${300 - ratio * 90}, 75%, 55%))`,
                  } : {}}
                >
                  {label ? (
                    <span className={`text-xl ${inPath ? 'drop-shadow' : ''}`}>{label}</span>
                  ) : inPath ? (
                    <span className="text-xs opacity-70">{pos + 1}</span>
                  ) : ''}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Controls */}
        <div className="flex gap-3 justify-center mb-4">
          <button
            onClick={() => { playClick(); setPath([]); setRunning(false); setSeconds(0); setWon(false); }}
            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-full font-fredoka text-gray-600 transition-colors"
          >
            🔄 Restart
          </button>
          {path.length > 0 && !won && (
            <button
              onClick={() => { playClick(); setPath(p => p.slice(0, -1)); }}
              className="px-5 py-2 bg-orange-100 hover:bg-orange-200 border-2 border-orange-300 rounded-full font-fredoka text-orange-600 transition-colors"
            >
              ↩️ Undo
            </button>
          )}
        </div>

        {/* How to play */}
        {path.length === 0 && !won && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 text-center">
            <p className="font-nunito text-blue-700 text-sm">
              💡 Tap <strong>number 1</strong> to start. Tap connected squares to draw a path
              through <strong>1 → {maxNumber}</strong> in order — and fill <strong>every</strong> square!
            </p>
          </div>
        )}

        {/* Win banner */}
        <AnimatePresence>
          {won && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-yellow-400 text-center"
            >
              <div className="text-6xl mb-2">🎉</div>
              <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-1">Solved it!</h2>
              <p className="font-nunito text-gray-600 mb-1">Finished in {fmtTime(seconds)} — +30 XP!</p>
              {bestTimes[`${size}x${size}`] === seconds && (
                <p className="font-fredoka text-yellow-600 mb-3">⭐ New best time!</p>
              )}
              <div className="flex gap-3 justify-center mt-3 flex-wrap">
                {puzzleIdx + 1 < PUZZLES.length && (
                  <button onClick={() => { playClick(); resetPuzzle(puzzleIdx + 1); }} className="btn-kid font-fredoka">
                    ➡️ Next Puzzle
                  </button>
                )}
                <button onClick={() => { playClick(); resetPuzzle(puzzleIdx); }} className="btn-kid-secondary font-fredoka">
                  🔄 Play Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ZipGame;
