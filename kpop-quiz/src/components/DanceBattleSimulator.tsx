import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWrong, playWin, playTimeOut } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface Move {
  emoji: string;
  name: string;
  color: string;
}

const MOVES: Move[] = [
  { emoji: '💃', name: 'Spin!', color: 'from-pink-400 to-rose-500' },
  { emoji: '🕺', name: 'Pop!', color: 'from-purple-400 to-indigo-500' },
  { emoji: '🙌', name: 'Clap!', color: 'from-yellow-400 to-orange-500' },
  { emoji: '🤸', name: 'Jump!', color: 'from-green-400 to-teal-500' },
];

const SEQUENCE_LENGTHS = [3, 4, 5, 5, 6, 6, 7, 7, 8, 9];
const SHOW_MS = 600;
const PAUSE_MS = 120;

type Phase = 'intro' | 'watch' | 'your_turn' | 'feedback' | 'done';

const DanceBattleSimulator: React.FC = () => {
  const { setGameState } = useGameStore();
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerMoves, setPlayerMoves] = useState<number[]>([]);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [wrongAt, setWrongAt] = useState(-1);
  const playingRef = useRef(false);

  const showSequence = useCallback((seq: number[]) => {
    if (playingRef.current) return;
    playingRef.current = true;
    setPhase('watch');
    setHighlightIdx(null);

    seq.forEach((moveIdx, i) => {
      setTimeout(() => {
        setHighlightIdx(moveIdx);
        setTimeout(() => setHighlightIdx(null), SHOW_MS - PAUSE_MS);
      }, i * (SHOW_MS + PAUSE_MS));
    });

    setTimeout(() => {
      setHighlightIdx(null);
      setPlayerMoves([]);
      setPhase('your_turn');
      playingRef.current = false;
    }, seq.length * (SHOW_MS + PAUSE_MS) + 300);
  }, []);

  const startRound = useCallback((roundNum: number) => {
    const len = SEQUENCE_LENGTHS[Math.min(roundNum, SEQUENCE_LENGTHS.length - 1)];
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * MOVES.length));
    setSequence(seq);
    setPlayerMoves([]);
    setTimeout(() => showSequence(seq), 800);
  }, [showSequence]);

  const handleMoveClick = (moveIdx: number) => {
    if (phase !== 'your_turn') return;
    playClick();

    const nextMoves = [...playerMoves, moveIdx];
    const pos = nextMoves.length - 1;

    if (nextMoves[pos] !== sequence[pos]) {
      playWrong();
      setWrongAt(pos);
      setFeedback('wrong');
      setPhase('feedback');
      setTimeout(() => {
        setPhase('done');
      }, 1500);
      return;
    }

    setPlayerMoves(nextMoves);
    playCorrect();

    if (nextMoves.length === sequence.length) {
      const pts = sequence.length * 10 + round * 5;
      setScore(prev => prev + pts);
      setFeedback('correct');
      setPhase('feedback');
      setTimeout(() => {
        const nextRound = round + 1;
        if (nextRound >= SEQUENCE_LENGTHS.length) {
          setShowConfetti(true);
          playWin();
          setPhase('done');
        } else {
          setRound(nextRound);
          setFeedback(null);
          setWrongAt(-1);
          startRound(nextRound);
        }
      }, 1200);
    }
  };

  const startGame = () => {
    playClick();
    setRound(0);
    setScore(0);
    setFeedback(null);
    setWrongAt(-1);
    setShowConfetti(false);
    startRound(0);
  };

  useEffect(() => {
    if (phase === 'done' && score > 0) {
      if (!showConfetti) {
        playTimeOut();
      }
    }
  }, [phase]);

  const stars = score >= 800 ? 3 : score >= 400 ? 2 : score > 0 ? 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={80} durationMs={3500} />}

      <div className="max-w-lg w-full mx-auto">
        <button
          onClick={() => { playClick(); setGameState('game_mode'); }}
          className="btn-kid-secondary mb-4"
        >
          ← Back
        </button>

        <AnimatePresence mode="wait">
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [-5, 5, -5] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-7xl mb-4"
              >
                💃
              </motion.div>
              <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow mb-3">
                Dance Battle!
              </h1>
              <p className="text-lg font-nunito text-gray-600 mb-6 leading-relaxed">
                Watch the dance sequence, then repeat it perfectly! Each round gets longer. Can you keep up? 🕺✨
              </p>
              <div className="grid grid-cols-2 gap-3 mb-8">
                {MOVES.map((move) => (
                  <div key={move.name} className={`bg-gradient-to-r ${move.color} rounded-2xl p-4 text-white text-center`}>
                    <div className="text-4xl mb-1">{move.emoji}</div>
                    <p className="font-fredoka font-bold">{move.name}</p>
                  </div>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="btn-kid text-xl px-10 py-4 font-fredoka"
              >
                Let's Dance! 💃
              </motion.button>
            </motion.div>
          )}

          {(phase === 'watch' || phase === 'your_turn' || phase === 'feedback') && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div className="bg-white rounded-2xl px-4 py-2 shadow border-2 border-purple-200">
                  <span className="font-fredoka font-bold text-purple-600">Round {round + 1}</span>
                </div>
                <div className="bg-white rounded-2xl px-4 py-2 shadow border-2 border-yellow-300">
                  <span className="font-fredoka font-bold text-yellow-600">⭐ {score}</span>
                </div>
              </div>

              {/* Phase label */}
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                {phase === 'watch' && (
                  <div className="bg-blue-100 border-2 border-blue-300 rounded-2xl p-3">
                    <p className="font-fredoka text-xl text-blue-700">👀 Watch the moves!</p>
                    <p className="text-sm font-nunito text-blue-500">
                      Memorize {sequence.length} moves
                    </p>
                  </div>
                )}
                {phase === 'your_turn' && (
                  <div className="bg-green-100 border-2 border-green-300 rounded-2xl p-3">
                    <p className="font-fredoka text-xl text-green-700">🕺 Your turn! ({playerMoves.length}/{sequence.length})</p>
                    <p className="text-sm font-nunito text-green-500">Repeat the sequence!</p>
                  </div>
                )}
                {phase === 'feedback' && feedback === 'correct' && (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="bg-yellow-100 border-2 border-yellow-400 rounded-2xl p-3"
                  >
                    <p className="font-fredoka text-2xl text-yellow-700">🎉 Perfect! +{sequence.length * 10 + round * 5} pts</p>
                  </motion.div>
                )}
                {phase === 'feedback' && feedback === 'wrong' && (
                  <motion.div
                    animate={{ x: [-4, 4, -4, 4, 0] }}
                    transition={{ duration: 0.4 }}
                    className="bg-red-100 border-2 border-red-400 rounded-2xl p-3"
                  >
                    <p className="font-fredoka text-xl text-red-700">😬 Oops! Wrong move!</p>
                  </motion.div>
                )}
              </motion.div>

              {/* Sequence display dots */}
              <div className="flex justify-center gap-2 mb-6 flex-wrap">
                {sequence.map((moveIdx, i) => (
                  <motion.div
                    key={i}
                    animate={highlightIdx === moveIdx && phase === 'watch'
                      ? { scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }
                      : {}
                    }
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg transition-all duration-200 ${
                      i < playerMoves.length
                        ? wrongAt === i
                          ? 'bg-red-400 border-red-600'
                          : 'bg-green-400 border-green-600'
                        : highlightIdx === moveIdx && phase === 'watch'
                        ? 'bg-purple-400 border-purple-600'
                        : 'bg-gray-200 border-gray-300'
                    }`}
                  >
                    {i < playerMoves.length || (highlightIdx !== null && i <= sequence.indexOf(highlightIdx ?? -1))
                      ? MOVES[moveIdx].emoji
                      : <span className="text-xs text-gray-400">{i + 1}</span>}
                  </motion.div>
                ))}
              </div>

              {/* Move Buttons */}
              <div className="grid grid-cols-2 gap-4">
                {MOVES.map((move, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={phase === 'your_turn' ? { scale: 1.05 } : {}}
                    whileTap={phase === 'your_turn' ? { scale: 0.92 } : {}}
                    animate={
                      highlightIdx === idx && phase === 'watch'
                        ? { scale: [1, 1.2, 1], boxShadow: ['0 0 0px rgba(0,0,0,0)', '0 0 30px rgba(168,85,247,0.7)', '0 0 0px rgba(0,0,0,0)'] }
                        : {}
                    }
                    onClick={() => handleMoveClick(idx)}
                    disabled={phase !== 'your_turn'}
                    className={`bg-gradient-to-r ${move.color} text-white rounded-3xl p-6 flex flex-col items-center gap-2 shadow-lg transition-all duration-200 ${
                      phase !== 'your_turn' ? 'opacity-70' : 'hover:shadow-xl'
                    }`}
                  >
                    <span className="text-5xl">{move.emoji}</span>
                    <span className="font-fredoka font-bold text-xl">{move.name}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 150 }}
              className="text-center"
            >
              <div className="text-7xl mb-4">
                {showConfetti ? '🏆' : feedback === 'wrong' ? '😅' : '🎉'}
              </div>
              <h2 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow mb-2">
                {showConfetti ? 'YOU DID IT!' : 'Game Over!'}
              </h2>
              <p className="text-xl font-nunito text-gray-600 mb-4">
                {showConfetti
                  ? 'You finished all rounds! Amazing dancer! 💃'
                  : `You made it to round ${round + 1}!`}
              </p>

              <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-purple-200 mb-6">
                <div className="text-4xl mb-2">{'⭐'.repeat(stars)}{'🌑'.repeat(3 - stars)}</div>
                <p className="text-3xl font-fredoka font-bold text-purple-600 mb-1">{score} points</p>
                <p className="font-nunito text-gray-500">
                  {stars === 3 ? 'Dance Legend!' : stars === 2 ? 'Great Dancer!' : stars === 1 ? 'Keep Practising!' : 'Try Again!'}
                </p>
              </div>

              <div className="flex gap-3 justify-center flex-wrap">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="btn-kid font-fredoka text-lg"
                >
                  🔄 Dance Again!
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); setGameState('game_mode'); }}
                  className="btn-kid-secondary font-fredoka text-lg"
                >
                  🏠 Menu
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default DanceBattleSimulator;
