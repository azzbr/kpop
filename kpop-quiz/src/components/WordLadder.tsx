import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { PUZZLES, VALID_WORDS, differsBy1, ladderHint } from '../data/wordLadder';

const WordLadder: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [chain, setChain] = useState<string[]>(() => [PUZZLES[0].start]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [won, setWon] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [solved, setSolved] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wordladder_solved') || '[]')); } catch { return new Set(); }
  });

  const confettiTimer = useRef<number | null>(null);
  useEffect(() => () => { if (confettiTimer.current) clearTimeout(confettiTimer.current); }, []);

  const puzzle = PUZZLES[puzzleIdx];

  const resetPuzzle = (idx: number) => {
    setPuzzleIdx(idx);
    setChain([PUZZLES[idx].start]);
    setInput('');
    setError('');
    setWon(false);
  };

  const last = chain[chain.length - 1];

  const submitWord = () => {
    const word = input.toLowerCase().trim();
    if (!word) return;

    if (word.length !== puzzle.start.length) {
      setError(`Must be ${puzzle.start.length} letters!`);
      playWrong();
      return;
    }
    if (chain.includes(word)) {
      setError('Already used that word!');
      playWrong();
      return;
    }
    if (!differsBy1(last, word)) {
      setError('Change exactly 1 letter!');
      playWrong();
      return;
    }
    if (!VALID_WORDS.has(word)) {
      setError('Not a valid word!');
      playWrong();
      return;
    }

    setError('');
    playCorrect();
    const newChain = [...chain, word];
    setChain(newChain);
    setInput('');

    if (word === puzzle.end) {
      playWin();
      setWon(true);
      setShowConfetti(true);
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
      confettiTimer.current = window.setTimeout(() => setShowConfetti(false), 2500);
      addXP(25 + Math.max(0, (puzzle.steps + 2 - newChain.length) * 5));
      const newSolved = new Set([...solved, puzzleIdx]);
      setSolved(newSolved);
      localStorage.setItem('wordladder_solved', JSON.stringify([...newSolved]));
    }
  };

  const handleUndo = () => {
    if (chain.length <= 1) return;
    playClick();
    setChain(c => c.slice(0, -1));
    setError('');
  };

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
          <div className="text-5xl mb-1">🔤</div>
          <h1 className="text-4xl font-fredoka font-bold text-blue-600 text-kid-glow">Word Ladder</h1>
          <p className="font-nunito text-gray-500 text-sm">Change one letter at a time to reach the goal!</p>
        </div>

        {/* Puzzle selector */}
        <div className="flex gap-1.5 flex-wrap justify-center mb-4">
          {PUZZLES.map((p, i) => (
            <button
              key={i}
              onClick={() => { playClick(); resetPuzzle(i); }}
              className={`px-3 py-1.5 rounded-full font-fredoka text-sm border-2 transition-colors relative ${
                i === puzzleIdx
                  ? 'bg-blue-500 border-blue-600 text-white'
                  : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
              }`}
            >
              {p.start}→{p.end}
              {solved.has(i) && <span className="absolute -top-1 -right-1 text-xs">✅</span>}
            </button>
          ))}
        </div>

        {/* Goal display */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow border-2 border-blue-200 mb-4 flex items-center justify-between">
          <div className="text-center">
            <p className="font-nunito text-xs text-gray-400">Start</p>
            <p className="font-fredoka font-bold text-2xl text-blue-600 uppercase">{puzzle.start}</p>
          </div>
          <div className="text-2xl">→</div>
          <div className="text-center">
            <p className="font-nunito text-xs text-gray-400">Goal</p>
            <p className="font-fredoka font-bold text-2xl text-green-600 uppercase">{puzzle.end}</p>
          </div>
          <div className="text-center">
            <p className="font-nunito text-xs text-gray-400">Steps</p>
            <p className="font-fredoka font-bold text-xl text-gray-600">{chain.length - 1}</p>
          </div>
        </div>

        {/* Chain display */}
        <div className="bg-white rounded-3xl p-4 shadow-xl border-2 border-blue-200 mb-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {chain.map((word, i) => (
              <React.Fragment key={i}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`px-4 py-2 rounded-xl font-fredoka font-bold text-xl uppercase shadow ${
                    i === 0 ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' :
                    word === puzzle.end ? 'bg-green-100 text-green-700 border-2 border-green-400' :
                    'bg-purple-100 text-purple-700 border-2 border-purple-200'
                  }`}
                >
                  {word}
                </motion.div>
                {i < chain.length - 1 && <div className="self-center text-gray-300 font-bold">→</div>}
              </React.Fragment>
            ))}
            {!won && (
              <div className="self-center text-gray-300 font-bold">→</div>
            )}
            {!won && (
              <div className="px-4 py-2 rounded-xl font-fredoka font-bold text-xl uppercase bg-green-50 text-green-400 border-2 border-dashed border-green-200">
                {puzzle.end}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        {!won && (
          <div className="flex gap-2 mb-2">
            <input
              value={input}
              onChange={e => { setInput(e.target.value.toLowerCase().replace(/[^a-z]/g, '')); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && submitWord()}
              maxLength={puzzle.start.length}
              placeholder={`${puzzle.start.length}-letter word...`}
              className="flex-1 border-2 border-blue-200 rounded-xl px-4 py-3 font-fredoka text-lg uppercase focus:outline-none focus:border-blue-400 text-center tracking-widest"
            />
            <button onClick={submitWord} className="btn-kid px-4">Go!</button>
          </div>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center font-nunito text-red-500 text-sm mb-2"
          >
            {error}
          </motion.p>
        )}

        {chain.length > 1 && !won && (
          <button onClick={handleUndo} className="w-full py-2 font-fredoka text-gray-500 hover:text-red-500 transition-colors">
            ↩️ Undo last step
          </button>
        )}

        {/* Hint */}
        {!won && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-3 mt-3 text-center">
            <p className="font-nunito text-yellow-700 text-sm">💡 Hint: {ladderHint(puzzle)}</p>
          </div>
        )}

        {/* Win banner */}
        <AnimatePresence>
          {won && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-green-400 text-center"
            >
              <div className="text-6xl mb-2">🎉</div>
              <h2 className="text-3xl font-fredoka font-bold text-green-600 mb-1">You did it!</h2>
              <p className="font-nunito text-gray-600 mb-1">
                {chain.join(' → ')} in {chain.length - 1} steps!
              </p>
              <p className="font-nunito text-purple-600 mb-3">+XP earned!</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {puzzleIdx + 1 < PUZZLES.length && (
                  <button onClick={() => { playClick(); resetPuzzle(puzzleIdx + 1); }} className="btn-kid">➡️ Next</button>
                )}
                <button onClick={() => { playClick(); resetPuzzle(puzzleIdx); }} className="btn-kid-secondary">🔄 Again</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default WordLadder;
