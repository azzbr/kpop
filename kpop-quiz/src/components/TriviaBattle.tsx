import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { easyQuestions, normalQuestions, hardQuestions } from '../quizData';
import { playClick, playCorrect, playWrong, playWin, playTick, playTimeOut } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const ALL_Q = [...easyQuestions, ...normalQuestions, ...hardQuestions]
  .sort(() => Math.random() - 0.5)
  .map(q => ({ ...q, answers: [...q.answers].sort(() => Math.random() - 0.5) }));

const TOTAL_ROUNDS = 7;
const SECS_PER_Q = 10;

const PLAYER_COLORS = [
  { bg: 'from-pink-400 to-rose-500', light: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-600' },
  { bg: 'from-blue-400 to-indigo-500', light: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-600' },
];

const TAUNT_WIN = ["🔥 FIRST!", "⚡ TOO FAST!", "💥 BOOM!", "🌟 LEGEND!", "😎 EASY!", "🎯 NAILED IT!"];
const TAUNT_WRONG = ["😬 OOPS!", "💀 NOPE!", "😅 SO CLOSE!", "🙈 YEP, WRONG.", "💩 UH OH!"];

type Phase = 'setup' | 'countdown' | 'battle' | 'round_result' | 'final';

const TriviaBattle: React.FC = () => {
  const { setGameState } = useGameStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [names, setNames] = useState(['', '']);
  const [scores, setScores] = useState([0, 0]);
  const [round, setRound] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECS_PER_Q);
  const [answered, setAnswered] = useState<[number | null, number | null]>([null, null]);
  const [locked, setLocked] = useState(false);
  const [roundWinner, setRoundWinner] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [taunt, setTaunt] = useState('');
  const timerRef = useRef<number | null>(null);

  const q = ALL_Q[qIdx % ALL_Q.length];

  // Timer
  useEffect(() => {
    if (phase !== 'battle' || locked) return;
    if (timeLeft <= 0) {
      playTimeOut();
      resolveRound(null);
      return;
    }
    if (timeLeft <= 3) playTick();
    timerRef.current = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timeLeft, phase, locked]);

  // Countdown before battle
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) { setPhase('battle'); setTimeLeft(SECS_PER_Q); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  const startGame = () => {
    if (!names[0].trim() || !names[1].trim()) return;
    playClick();
    setScores([0, 0]);
    setRound(0);
    setQIdx(0);
    setAnswered([null, null]);
    setLocked(false);
    setCountdown(3);
    setPhase('countdown');
  };

  const handleAnswer = (player: 0 | 1, answerIdx: number) => {
    if (locked || answered[player] !== null) return;
    const isCorrect = q.answers[answerIdx].isCorrect;
    const newAnswered: [number | null, number | null] = [...answered] as any;
    newAnswered[player] = answerIdx;
    setAnswered(newAnswered);

    if (isCorrect) {
      playCorrect();
      const t = TAUNT_WIN[Math.floor(Math.random() * TAUNT_WIN.length)];
      setTaunt(t);
      resolveRound(player);
    } else {
      playWrong();
      const t = TAUNT_WRONG[Math.floor(Math.random() * TAUNT_WRONG.length)];
      setTaunt(t);
      // Other player wins if they haven't answered wrong yet
      const other = player === 0 ? 1 : 0;
      if (newAnswered[other] !== null && !q.answers[newAnswered[other]!].isCorrect) {
        resolveRound(null); // both wrong
      } else if (newAnswered[other] === null) {
        // let other player still answer — but mark this one as wrong
        setAnswered(newAnswered);
      } else {
        resolveRound(other);
      }
    }
  };

  const resolveRound = (winner: number | null) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLocked(true);
    setRoundWinner(winner);
    if (winner !== null) {
      setScores(prev => prev.map((s, i) => i === winner ? s + 1 : s) as [number, number]);
    }
    setPhase('round_result');
    setTimeout(() => {
      const nextRound = round + 1;
      if (nextRound >= TOTAL_ROUNDS) {
        const newScores = scores.map((s, i) => i === winner ? s + 1 : s);
        if (newScores[0] !== newScores[1]) {
          setShowConfetti(true);
          playWin();
        }
        setPhase('final');
      } else {
        setRound(nextRound);
        setQIdx(q => q + 1);
        setAnswered([null, null]);
        setLocked(false);
        setTaunt('');
        setRoundWinner(null);
        setCountdown(2);
        setPhase('countdown');
      }
    }, 2200);
  };

  const finalWinner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={80} durationMs={3000} />}

      <div className="max-w-2xl w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-5">
          <div className="text-5xl mb-1">⚔️</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow">Trivia Battle!</h1>
          <p className="font-nunito text-gray-500 text-sm">2 players • first to answer correctly wins the round</p>
        </div>

        <AnimatePresence mode="wait">

          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-purple-200 mb-4">
                <h2 className="font-fredoka font-bold text-xl text-center text-gray-800 mb-5">👥 Enter Player Names</h2>
                {[0, 1].map(i => (
                  <div key={i} className={`rounded-2xl p-4 mb-3 ${PLAYER_COLORS[i].light} border-2 ${PLAYER_COLORS[i].border}`}>
                    <label className={`block font-fredoka font-bold ${PLAYER_COLORS[i].text} mb-2`}>
                      {i === 0 ? '👈 Left Player' : '👉 Right Player'}
                    </label>
                    <input
                      type="text"
                      value={names[i]}
                      onChange={e => setNames(n => n.map((v, j) => j === i ? e.target.value : v) as [string, string])}
                      placeholder={`Player ${i + 1} name`}
                      maxLength={12}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-nunito text-base focus:outline-none focus:border-purple-400"
                    />
                  </div>
                ))}
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-3 mt-3">
                  <p className="font-nunito text-yellow-700 text-sm text-center">
                    💡 Each player taps <strong>their side</strong> of the screen to answer.<br />
                    First correct answer wins the round!
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={startGame}
                disabled={!names[0].trim() || !names[1].trim()}
                className="w-full btn-kid font-fredoka text-xl py-4"
              >
                ⚔️ Start Battle! ({TOTAL_ROUNDS} rounds)
              </motion.button>
            </motion.div>
          )}

          {phase === 'countdown' && (
            <motion.div key={`cd-${countdown}`} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
              className="text-center py-20">
              <div className="text-9xl font-fredoka font-bold text-purple-600">
                {countdown === 0 ? 'GO!' : countdown}
              </div>
              <p className="font-fredoka text-2xl text-gray-500 mt-4">Round {round + 1} of {TOTAL_ROUNDS}</p>
            </motion.div>
          )}

          {(phase === 'battle' || phase === 'round_result') && (
            <motion.div key="battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Scoreboard */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[0, 1].map(i => (
                  <div key={i} className={`bg-gradient-to-r ${PLAYER_COLORS[i].bg} rounded-2xl p-3 text-center text-white shadow-lg`}>
                    <p className="font-fredoka font-bold text-lg truncate">{names[i]}</p>
                    <p className="font-fredoka text-3xl font-bold">{scores[i]}</p>
                  </div>
                ))}
              </div>

              {/* Timer */}
              <div className="mb-4">
                <div className="flex justify-between text-sm font-nunito text-gray-500 mb-1">
                  <span>Round {round + 1}/{TOTAL_ROUNDS}</span>
                  <span className={timeLeft <= 3 ? 'text-red-500 font-bold animate-pulse' : ''}>{timeLeft}s</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <motion.div
                    className="h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
                    animate={{ width: `${(timeLeft / SECS_PER_Q) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="bg-white rounded-3xl p-5 shadow-xl border-2 border-purple-200 mb-4 text-center">
                <p className="font-fredoka font-bold text-xl text-gray-800 leading-snug">{q.questionText}</p>
              </div>

              {/* Split answer grid */}
              <div className="grid grid-cols-2 gap-3">
                {q.answers.map((ans, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2">
                    {/* Player 1 button (left half) */}
                    <motion.button
                      whileTap={!locked && answered[0] === null ? { scale: 0.92 } : {}}
                      onClick={() => handleAnswer(0, idx)}
                      disabled={locked || answered[0] !== null}
                      className={`p-3 rounded-2xl border-2 font-nunito text-sm font-bold transition-all duration-200 ${
                        phase === 'round_result' && ans.isCorrect
                          ? 'bg-green-400 border-green-600 text-white'
                          : answered[0] === idx && !ans.isCorrect
                          ? 'bg-red-300 border-red-500 text-white'
                          : answered[0] === idx && ans.isCorrect
                          ? 'bg-green-400 border-green-600 text-white'
                          : locked
                          ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-50'
                          : `${PLAYER_COLORS[0].light} ${PLAYER_COLORS[0].border} text-gray-700 hover:bg-pink-100`
                      }`}
                    >
                      {ans.answerText}
                    </motion.button>
                    {/* Player 2 button (right half) */}
                    <motion.button
                      whileTap={!locked && answered[1] === null ? { scale: 0.92 } : {}}
                      onClick={() => handleAnswer(1, idx)}
                      disabled={locked || answered[1] !== null}
                      className={`p-3 rounded-2xl border-2 font-nunito text-sm font-bold transition-all duration-200 ${
                        phase === 'round_result' && ans.isCorrect
                          ? 'bg-green-400 border-green-600 text-white'
                          : answered[1] === idx && !ans.isCorrect
                          ? 'bg-red-300 border-red-500 text-white'
                          : answered[1] === idx && ans.isCorrect
                          ? 'bg-green-400 border-green-600 text-white'
                          : locked
                          ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-50'
                          : `${PLAYER_COLORS[1].light} ${PLAYER_COLORS[1].border} text-gray-700 hover:bg-blue-100`
                      }`}
                    >
                      {ans.answerText}
                    </motion.button>
                  </div>
                ))}
              </div>

              {/* Labels */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <p className={`text-center font-fredoka font-bold ${PLAYER_COLORS[0].text} text-sm`}>👈 {names[0]}</p>
                <p className={`text-center font-fredoka font-bold ${PLAYER_COLORS[1].text} text-sm`}>{names[1]} 👉</p>
              </div>

              {/* Round result banner */}
              <AnimatePresence>
                {phase === 'round_result' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className={`mt-4 p-4 rounded-2xl text-center font-fredoka font-bold text-2xl shadow-xl ${
                      roundWinner !== null
                        ? `bg-gradient-to-r ${PLAYER_COLORS[roundWinner].bg} text-white`
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {roundWinner !== null ? `${taunt} ${names[roundWinner]} gets the point!` : "⏰ Time's up — no point!"}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {phase === 'final' && (
            <motion.div key="final" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 150 }}>
              <div className="bg-white rounded-3xl p-6 shadow-2xl border-2 border-purple-200 text-center mb-4">
                <div className="text-7xl mb-3">{finalWinner !== null ? '🏆' : '🤝'}</div>
                <h2 className="text-4xl font-fredoka font-bold text-purple-600 mb-2">
                  {finalWinner !== null ? `${names[finalWinner]} WINS!` : "It's a Tie!"}
                </h2>
                <p className="font-nunito text-gray-500 mb-6">
                  {finalWinner !== null ? `${names[finalWinner]} dominated with ${scores[finalWinner]} rounds!` : 'Both players are equally brilliant!'}
                </p>
                {[0, 1].map(i => (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-2xl mb-3 bg-gradient-to-r ${PLAYER_COLORS[i].bg} text-white shadow`}>
                    <span className="font-fredoka font-bold text-xl">{names[i]}</span>
                    <span className="font-fredoka text-3xl font-bold">{scores[i]} / {TOTAL_ROUNDS}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-center">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => { setPhase('setup'); setScores([0, 0]); }} className="btn-kid font-fredoka text-lg">
                  🔄 Rematch!
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary font-fredoka text-lg">
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

export default TriviaBattle;
