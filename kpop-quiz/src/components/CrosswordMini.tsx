import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { PUZZLES, CROSSWORD_SIZE, clueNumbers } from '../data/crossword';

const randomPuzzleIdx = (exclude = -1) => {
  if (PUZZLES.length < 2) return 0;
  let i;
  do { i = Math.floor(Math.random() * PUZZLES.length); } while (i === exclude);
  return i;
};


interface CellState {
  value: string;
  correct: boolean | null;
}

const CrosswordMini: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [puzzleIdx, setPuzzleIdx] = useState(() => randomPuzzleIdx());
  const p = PUZZLES[puzzleIdx];
  const SIZE = CROSSWORD_SIZE;
  const grid = p.rows.map(row => row.split('').map(ch => (ch === '#' ? null : ch)));
  const numbers = clueNumbers(p);
  const clueLen = (cl: { answer: string }) => cl.answer.length;

  const initCells = (): CellState[][] =>
    Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({ value: '', correct: null })));

  const [cells, setCells] = useState<CellState[][]>(initCells);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [dir, setDir] = useState<'across' | 'down'>('across');
  const [won, setWon] = useState(false);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confettiTimer = useRef<number | null>(null);

  useEffect(() => () => { if (confettiTimer.current) clearTimeout(confettiTimer.current); }, []);

  const isBlack = (r: number, c: number) => grid[r][c] === null;

  // Standard crossword numbering, so every clue number (even shared start cells) is shown
  const getCellClueNumber = (r: number, c: number): number | undefined => numbers.get(`${r}-${c}`);

  const handleCellClick = (r: number, c: number) => {
    if (isBlack(r, c)) return;
    if (selected?.row === r && selected?.col === c) {
      setDir(d => d === 'across' ? 'down' : 'across');
    } else {
      setSelected({ row: r, col: c });
    }
    inputRef.current?.focus();
    playClick();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!selected) return;
    const { row, col } = selected;
    const key = e.key.toUpperCase();

    if (key === 'BACKSPACE') {
      setCells(c => {
        const n = c.map(r => r.map(cell => ({ ...cell })));
        if (n[row][col].value) {
          n[row][col] = { value: '', correct: null };
        } else {
          const pr = dir === 'across' ? row : row - 1;
          const pc = dir === 'across' ? col - 1 : col;
          if (pr >= 0 && pc >= 0 && !isBlack(pr, pc)) {
            n[pr][pc] = { value: '', correct: null };
            setSelected({ row: pr, col: pc });
          }
        }
        return n;
      });
      return;
    }

    if (key === 'ARROWLEFT') { if (col > 0 && !isBlack(row, col - 1)) setSelected({ row, col: col - 1 }); return; }
    if (key === 'ARROWRIGHT') { if (col < SIZE - 1 && !isBlack(row, col + 1)) setSelected({ row, col: col + 1 }); return; }
    if (key === 'ARROWUP') { if (row > 0 && !isBlack(row - 1, col)) setSelected({ row: row - 1, col }); return; }
    if (key === 'ARROWDOWN') { if (row < SIZE - 1 && !isBlack(row + 1, col)) setSelected({ row: row + 1, col }); return; }

    if (/^[A-Z]$/.test(key)) {
      setCells(c => {
        const n = c.map(r => r.map(cell => ({ ...cell })));
        n[row][col] = { value: key, correct: null };
        return n;
      });
      const nr = dir === 'across' ? row : row + 1;
      const nc = dir === 'across' ? col + 1 : col;
      if (nr < SIZE && nc < SIZE && !isBlack(nr, nc)) setSelected({ row: nr, col: nc });
    }
  };

  const checkAnswers = () => {
    playClick();
    let allCorrect = true;
    const newCells = cells.map((row, r) => row.map((cell, c) => {
      if (isBlack(r, c)) return cell;
      const answer = grid[r][c] as string;
      const correct = cell.value === answer;
      if (!correct) allCorrect = false;
      return { ...cell, correct };
    }));
    setCells(newCells);
    setChecked(true);
    if (allCorrect) {
      playWin();
      setWon(true);
      setShowConfetti(true);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = window.setTimeout(() => setShowConfetti(false), 2500);
      if (!revealed) addXP(40);
    } else {
      playWrong();
    }
  };

  const reveal = () => {
    playClick();
    setCells(grid.map(row => row.map(cell => ({
      value: cell ?? '',
      correct: cell !== null ? true : null,
    }))));
    setChecked(true);
    setRevealed(true);
  };

  const resetPuzzle = () => {
    playClick();
    setCells(initCells());
    setSelected(null);
    setWon(false);
    setChecked(false);
    setRevealed(false);
  };

  const nextPuzzle = () => {
    resetPuzzle();
    setShowConfetti(false);
    setDir('across');
    setPuzzleIdx(i => randomPuzzleIdx(i));
  };

  const getHighlight = (r: number, c: number) => {
    if (!selected || isBlack(r, c)) return '';
    if (r === selected.row && c === selected.col) return 'bg-yellow-200 border-yellow-500';
    const clue = p.clues.find(cl =>
      cl.dir === dir &&
      ((dir === 'across' && cl.row === selected.row && r === cl.row && c >= cl.col && c < cl.col + clueLen(cl)) ||
       (dir === 'down' && cl.col === selected.col && c === cl.col && r >= cl.row && r < cl.row + clueLen(cl)))
    );
    if (clue) return 'bg-blue-100 border-blue-300';
    return '';
  };

  const filledCount = cells.flat().filter((c, i) => {
    const r = Math.floor(i / SIZE), col = i % SIZE;
    return !isBlack(r, col) && c.value !== '';
  }).length;
  const totalWhite = grid.flat().filter(c => c !== null).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={60} durationMs={2500} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-4">
          <div className="text-5xl mb-1">📰</div>
          <h1 className="text-4xl font-fredoka font-bold text-indigo-600 text-kid-glow">Crossword!</h1>
          <p className="font-nunito text-gray-500 text-sm">Quick mini crossword</p>
          <p className="font-fredoka text-indigo-500 text-lg mt-1">{p.name}</p>
        </div>

        <div className="bg-gray-100 rounded-xl p-2 text-center font-nunito text-xs text-gray-500 mb-2">
          Tap a cell to select · Tap again to switch Across/Down · Type to fill in letters
        </div>

        {/* Progress */}
        <div className="flex justify-between bg-white rounded-xl px-4 py-2 shadow border-2 border-indigo-100 mb-3">
          <span className="font-fredoka text-indigo-600">{filledCount}/{totalWhite} letters</span>
          <span className="font-fredoka text-gray-500">{checked ? '' : dir === 'across' ? '→ Across' : '↓ Down'}</span>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-2xl p-3 shadow-xl border-2 border-indigo-200 mb-4 flex justify-center">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: 3 }}>
            {Array.from({ length: SIZE }, (_, r) =>
              Array.from({ length: SIZE }, (_, c) => {
                if (isBlack(r, c)) return (
                  <div key={`${r}-${c}`} className="w-12 h-12 rounded bg-gray-800" />
                );
                const num = getCellClueNumber(r, c);
                const cell = cells[r][c];
                const hl = getHighlight(r, c);
                const correct = checked ? cell.correct : null;
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    onKeyDown={handleKey}
                    className={`w-12 h-12 rounded border-2 flex items-center justify-center relative select-none outline-none
                      ${correct === true ? 'bg-green-100 border-green-400' :
                        correct === false ? 'bg-red-100 border-red-400' :
                        hl || 'bg-white border-gray-300'}
                    `}
                  >
                    {num && <span className="absolute top-0.5 left-1 text-[9px] font-bold text-indigo-500">{num}</span>}
                    <span className="font-fredoka font-bold text-gray-800 text-lg">{cell.value}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Hidden input for mobile keyboard */}
        <input
          ref={inputRef}
          className="opacity-0 h-0 w-0 absolute"
          onKeyDown={handleKey}
          readOnly
        />

        {/* Clues */}
        <div className="bg-white rounded-2xl p-4 shadow border-2 border-indigo-100 mb-3">
          <div className="grid grid-cols-2 gap-3">
            {(['across', 'down'] as const).map(d => (
              <div key={d}>
                <h3 className="font-fredoka font-bold text-indigo-600 mb-2">{d === 'across' ? '→ Across' : '↓ Down'}</h3>
                {p.clues.filter(cl => cl.dir === d).map(cl => (
                  <p key={`${cl.id}-${cl.dir}`} className="font-nunito text-sm text-gray-600 mb-1">
                    <span className="font-bold text-indigo-500">{cl.id}.</span> {cl.clue}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 justify-center mb-4">
          <button onClick={checkAnswers} className="btn-kid px-4">✅ Check</button>
          <button onClick={reveal} className="btn-kid-secondary px-4">💡 Reveal</button>
          <button onClick={resetPuzzle} aria-label="Clear the grid" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-full font-fredoka text-gray-600">🔄</button>
        </div>
        <div className="flex justify-center mb-4">
          <button onClick={nextPuzzle} className="btn-kid-secondary px-4">➡️ Next puzzle</button>
        </div>

        <AnimatePresence>
          {won && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-yellow-400 text-center"
            >
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-3xl font-fredoka font-bold text-indigo-600 mb-1">Solved it!</h2>
              <p className="font-nunito text-gray-600 mb-1">{revealed ? 'Now try a puzzle without peeking! 💪' : '+40 XP earned!'}</p>
              <div className="flex gap-2 justify-center flex-wrap mt-2">
                <button onClick={nextPuzzle} className="btn-kid">➡️ Next puzzle</button>
                <button onClick={resetPuzzle} className="btn-kid-secondary">🔄 Play again</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default CrosswordMini;
