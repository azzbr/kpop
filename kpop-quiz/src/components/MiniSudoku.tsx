import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

// 6x6 Sudoku — boxes are 2 rows tall x 3 cols wide, numbers 1-6.
const N = 6;
const BOX_H = 2;
const BOX_W = 3;

type Grid = number[][]; // 0 = empty

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function basePattern(r: number, c: number): number {
  return (BOX_W * (r % BOX_H) + Math.floor(r / BOX_H) + c) % N;
}

function generateSolution(): Grid {
  const digits = shuffle([1, 2, 3, 4, 5, 6]);

  // Rows: 3 bands of 2 rows each — shuffle bands and rows within
  const rowOrder: number[] = [];
  shuffle([0, 1, 2]).forEach(band => {
    shuffle([band * 2, band * 2 + 1]).forEach(r => rowOrder.push(r));
  });

  // Cols: 2 stacks of 3 cols each — shuffle stacks and cols within
  const colOrder: number[] = [];
  shuffle([0, 1]).forEach(stack => {
    shuffle([stack * 3, stack * 3 + 1, stack * 3 + 2]).forEach(c => colOrder.push(c));
  });

  const grid: Grid = [];
  for (let r = 0; r < N; r++) {
    const row: number[] = [];
    for (let c = 0; c < N; c++) {
      row.push(digits[basePattern(rowOrder[r], colOrder[c])]);
    }
    grid.push(row);
  }
  return grid;
}

function makePuzzle(removeProb: number): { puzzle: Grid; given: boolean[][] } {
  const solution = generateSolution();
  const puzzle: Grid = solution.map(row => [...row]);
  const given: boolean[][] = [];
  for (let r = 0; r < N; r++) {
    const gr: boolean[] = [];
    for (let c = 0; c < N; c++) {
      if (Math.random() < removeProb) { puzzle[r][c] = 0; gr.push(false); }
      else gr.push(true);
    }
    given.push(gr);
  }
  return { puzzle, given };
}

// Returns set of "r-c" keys that conflict (duplicate in row/col/box)
function findConflicts(grid: Grid): Set<string> {
  const bad = new Set<string>();
  const mark = (cells: [number, number][]) => {
    const seen: Record<number, [number, number][]> = {};
    cells.forEach(([r, c]) => {
      const v = grid[r][c];
      if (v === 0) return;
      (seen[v] ||= []).push([r, c]);
    });
    Object.values(seen).forEach(group => {
      if (group.length > 1) group.forEach(([r, c]) => bad.add(`${r}-${c}`));
    });
  };
  for (let r = 0; r < N; r++) mark(Array.from({ length: N }, (_, c) => [r, c] as [number, number]));
  for (let c = 0; c < N; c++) mark(Array.from({ length: N }, (_, r) => [r, c] as [number, number]));
  for (let br = 0; br < N; br += BOX_H) {
    for (let bc = 0; bc < N; bc += BOX_W) {
      const cells: [number, number][] = [];
      for (let r = 0; r < BOX_H; r++) for (let c = 0; c < BOX_W; c++) cells.push([br + r, bc + c]);
      mark(cells);
    }
  }
  return bad;
}

const DIFFICULTIES = [
  { name: 'Easy', removeProb: 0.42 },
  { name: 'Medium', removeProb: 0.55 },
  { name: 'Hard', removeProb: 0.66 },
];

const NUMBER_COLORS = ['', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

const MiniSudoku: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [difficulty, setDifficulty] = useState(0);
  const [grid, setGrid] = useState<Grid>([]);
  const [given, setGiven] = useState<boolean[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const timerRef = useRef<number | null>(null);

  const newGame = useCallback((diffIdx: number) => {
    const { puzzle, given: g } = makePuzzle(DIFFICULTIES[diffIdx].removeProb);
    setGrid(puzzle);
    setGiven(g);
    setSelected(null);
    setSeconds(0);
    setRunning(true);
    setWon(false);
    setMistakes(0);
  }, []);

  useEffect(() => { newGame(0); }, [newGame]);

  useEffect(() => {
    if (running && !won) {
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, won]);

  const conflicts = grid.length ? findConflicts(grid) : new Set<string>();

  const isFull = grid.length > 0 && grid.every(row => row.every(v => v !== 0));
  const isSolved = isFull && conflicts.size === 0;

  useEffect(() => {
    if (isSolved && !won && grid.length) {
      setWon(true);
      setRunning(false);
      playWin();
      addXP(50);
    }
  }, [isSolved, won, grid, addXP]);

  const selectCell = (r: number, c: number) => {
    if (given[r]?.[c] || won) { playClick(); return; }
    playClick();
    setSelected([r, c]);
  };

  const placeNumber = (num: number) => {
    if (!selected || won) return;
    const [r, c] = selected;
    if (given[r][c]) return;
    const next = grid.map(row => [...row]);
    next[r][c] = next[r][c] === num ? 0 : num;
    setGrid(next);
    if (next[r][c] !== 0) {
      const conf = findConflicts(next);
      if (conf.has(`${r}-${c}`)) { playWrong(); setMistakes(m => m + 1); }
      else playPop();
    } else {
      playClick();
    }
  };

  const erase = () => {
    if (!selected || won) return;
    const [r, c] = selected;
    if (given[r][c]) return;
    playClick();
    const next = grid.map(row => [...row]);
    next[r][c] = 0;
    setGrid(next);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Count how many of each number are still needed
  const remaining = (num: number) => {
    let count = 0;
    grid.forEach(row => row.forEach(v => { if (v === num) count++; }));
    return N - count;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {won && <ConfettiBurst count={70} durationMs={3000} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-4">
          <div className="text-5xl mb-1">🔢</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow">Mini Sudoku</h1>
          <p className="font-nunito text-gray-500 text-sm">⏱️ 3-minute break — fill so every row, column & box has 1–6</p>
        </div>

        {/* Difficulty */}
        <div className="flex gap-2 justify-center mb-4">
          {DIFFICULTIES.map((d, i) => (
            <button
              key={d.name}
              onClick={() => { playClick(); setDifficulty(i); newGame(i); }}
              className={`px-4 py-1.5 rounded-full font-fredoka text-sm border-2 transition-colors ${
                i === difficulty
                  ? 'bg-purple-500 border-purple-600 text-white'
                  : 'bg-white border-purple-200 text-purple-600 hover:bg-purple-50'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex justify-between items-center bg-white rounded-2xl px-4 py-2 shadow border-2 border-purple-200 mb-4">
          <span className="font-fredoka font-bold text-purple-600">⏱️ {fmtTime(seconds)}</span>
          <span className={`font-fredoka ${conflicts.size > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {conflicts.size > 0 ? `⚠️ ${conflicts.size} conflicts` : '✓ Looking good'}
          </span>
          <span className="font-fredoka text-gray-400 text-sm">Oops: {mistakes}</span>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-3xl p-3 shadow-xl border-2 border-purple-200 mb-4">
          <div
            className="grid mx-auto bg-gray-800 gap-[2px] p-[2px] rounded-lg"
            style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, maxWidth: 340 }}
          >
            {grid.map((row, r) =>
              row.map((v, c) => {
                const isGiven = given[r]?.[c];
                const isSelected = selected && selected[0] === r && selected[1] === c;
                const isConflict = conflicts.has(`${r}-${c}`);
                const sameAsSelected = selected && v !== 0 && grid[selected[0]][selected[1]] === v;
                // thicker borders between boxes
                const borderR = (c + 1) % BOX_W === 0 && c < N - 1;
                const borderB = (r + 1) % BOX_H === 0 && r < N - 1;
                return (
                  <motion.button
                    key={`${r}-${c}`}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => selectCell(r, c)}
                    className="aspect-square flex items-center justify-center font-fredoka font-bold text-2xl transition-colors duration-100"
                    style={{
                      background: isSelected
                        ? '#c4b5fd'
                        : isConflict
                        ? '#fecaca'
                        : sameAsSelected
                        ? '#ede9fe'
                        : isGiven
                        ? '#f3f4f6'
                        : '#ffffff',
                      color: isConflict ? '#dc2626' : isGiven ? '#374151' : (NUMBER_COLORS[v] || '#9ca3af'),
                      marginRight: borderR ? 3 : 0,
                      marginBottom: borderB ? 3 : 0,
                    }}
                  >
                    {v !== 0 ? v : ''}
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        {/* Number pad */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6].map(num => {
            const left = remaining(num);
            return (
              <motion.button
                key={num}
                whileTap={{ scale: 0.88 }}
                onClick={() => placeNumber(num)}
                disabled={won || left <= 0}
                className={`aspect-square rounded-2xl font-fredoka font-bold text-2xl border-2 shadow transition-all duration-150 ${
                  left <= 0
                    ? 'bg-gray-100 border-gray-200 text-gray-300'
                    : 'bg-white border-purple-200 hover:bg-purple-50'
                }`}
                style={{ color: left > 0 ? NUMBER_COLORS[num] : undefined }}
              >
                {num}
              </motion.button>
            );
          })}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={erase}
            disabled={won}
            className="aspect-square rounded-2xl font-fredoka font-bold text-xl border-2 border-gray-300 bg-gray-100 hover:bg-gray-200 shadow"
          >
            ⌫
          </motion.button>
        </div>

        {/* Controls */}
        <div className="flex gap-3 justify-center mb-4">
          <button
            onClick={() => { playClick(); newGame(difficulty); }}
            className="px-6 py-2 bg-purple-100 hover:bg-purple-200 border-2 border-purple-300 rounded-full font-fredoka text-purple-700 transition-colors"
          >
            🔄 New Puzzle
          </button>
        </div>

        {/* Tip */}
        {!won && !selected && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 text-center">
            <p className="font-nunito text-blue-700 text-sm">
              💡 Tap an empty square, then tap a number. Every row, column, and outlined box needs 1–6 once each!
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
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-1">Puzzle Solved!</h2>
              <p className="font-nunito text-gray-600 mb-1">
                {DIFFICULTIES[difficulty].name} cleared in {fmtTime(seconds)} — +50 XP!
              </p>
              <p className="font-nunito text-gray-400 text-sm mb-3">
                {mistakes === 0 ? '✨ Flawless — no mistakes!' : `${mistakes} little oops along the way`}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={() => { playClick(); newGame(difficulty); }} className="btn-kid font-fredoka">
                  🔄 Another One!
                </button>
                <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary font-fredoka">
                  🏠 Menu
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MiniSudoku;
