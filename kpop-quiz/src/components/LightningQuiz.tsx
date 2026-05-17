import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { easyQuestions, normalQuestions } from '../quizData';
import { playCorrect, playWrong, playWin, playTick, playTimeOut, playCoin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const SECS = 8;
const TOTAL_Q = 12;

const ALL_Q = [...easyQuestions, ...normalQuestions]
  .sort(() => Math.random() - 0.5)
  .slice(0, TOTAL_Q);

type Phase = 'intro' | 'playing' | 'done';

export default function LightningQuiz() {
  const { setGameState } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [qi, setQi] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECS);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [confetti, setConfetti] = useState(false);

  const q = ALL_Q[qi];

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || picked !== null) return;
    if (timeLeft <= 0) {
      playTimeOut();
      setPicked(-1); // -1 = timed out
      setCombo(0);
      setTimeout(() => advance(), 1400);
      return;
    }
    if (timeLeft <= 3) playTick();
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, phase, picked]);

  function handleAnswer(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    const isRight = idx === q.correct;
    if (isRight) {
      playCorrect();
      const speedBonus = timeLeft >= 6 ? 50 : timeLeft >= 3 ? 25 : 0;
      const pts = 100 + combo * 15 + speedBonus;
      setScore(s => s + pts);
      setCorrect(c => c + 1);
      setCombo(c => {
        const next = c + 1;
        setMaxCombo(m => Math.max(m, next));
        if (next >= 3) playCoin();
        return next;
      });
    } else {
      playWrong();
      setCombo(0);
    }
    setTimeout(() => advance(), 1300);
  }

  function advance() {
    const next = qi + 1;
    if (next >= TOTAL_Q) {
      setPhase('done');
      playWin();
      setConfetti(true);
    } else {
      setQi(next);
      setPicked(null);
      setTimeLeft(SECS);
    }
  }

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-kid-pattern flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-4">⚡</div>
        <h1 className="text-4xl md:text-5xl font-fredoka font-bold text-purple-600 mb-3 text-kid-glow">
          Lightning Quiz!
        </h1>
        <p className="text-lg text-gray-700 font-nunito mb-2 max-w-sm">
          {TOTAL_Q} rapid-fire questions. <strong>{SECS} seconds</strong> each. Faster answers = more points!
        </p>
        <p className="text-base text-pink-500 font-fredoka mb-8">
          🔥 Build combos for bonus points!
        </p>
        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          onClick={() => setPhase('playing')} className="btn-kid text-2xl px-10 py-4 mb-4">
          ⚡ GO!
        </motion.button>
        <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary">← Back</button>
      </motion.div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const pct = Math.round((correct / TOTAL_Q) * 100);
    const rating =
      pct === 100 ? '🏆 PERFECT! Absolute Legend!'
      : pct >= 80 ? '⭐ K-pop Master!'
      : pct >= 60 ? '👍 Not bad, keep going!'
      : '😅 Practice makes perfect!';

    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-kid-pattern flex items-center justify-center p-4">
        {confetti && <ConfettiBurst count={70} durationMs={4000} />}
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-3">⚡</div>
          <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-1">Lightning Done!</h2>
          <p className="text-xl font-fredoka text-pink-500 mb-5">{rating}</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-purple-50 rounded-2xl p-3">
              <div className="text-3xl font-fredoka font-bold text-purple-600">{score}</div>
              <div className="text-sm text-gray-500">Total Score</div>
            </div>
            <div className="bg-pink-50 rounded-2xl p-3">
              <div className="text-3xl font-fredoka font-bold text-pink-600">{correct}/{TOTAL_Q}</div>
              <div className="text-sm text-gray-500">Correct</div>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-3">
              <div className="text-3xl font-fredoka font-bold text-yellow-600">{pct}%</div>
              <div className="text-sm text-gray-500">Accuracy</div>
            </div>
            <div className="bg-orange-50 rounded-2xl p-3">
              <div className="text-3xl font-fredoka font-bold text-orange-600">{maxCombo}x</div>
              <div className="text-sm text-gray-500">Best Combo</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.location.reload()} className="btn-kid flex-1">⚡ Again!</button>
            <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary flex-1">🏠 Home</button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  const timerPct = (timeLeft / SECS) * 100;
  const timerColor = timeLeft > 5 ? 'bg-green-400' : timeLeft > 2 ? 'bg-orange-400' : 'bg-red-500';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4">

      {/* Top bar */}
      <div className="w-full max-w-lg flex items-center justify-between mb-3">
        <div className="text-base font-fredoka text-purple-600 font-bold">{qi + 1}/{TOTAL_Q}</div>
        <div className="text-xl font-fredoka font-bold text-pink-500">⚡ {score}</div>
        <div className="flex items-center gap-1">
          {combo >= 2 && (
            <motion.div key={combo} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
              className="text-sm font-fredoka font-bold text-orange-500">
              🔥{combo}x
            </motion.div>
          )}
        </div>
      </div>

      {/* Timer bar */}
      <div className="w-full max-w-lg bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
        <motion.div className={`h-4 rounded-full ${timerColor} transition-colors duration-300`}
          animate={{ width: `${timerPct}%` }}
          transition={{ duration: 0.9, ease: 'linear' }} />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div key={qi} initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          exit={{ x: -80, opacity: 0 }} transition={{ duration: 0.25 }}
          className="w-full max-w-lg">

          <div className="card-kid p-6 mb-4 text-center">
            <div className="text-xs text-purple-400 font-fredoka mb-2 uppercase tracking-wider">
              ⚡ {timeLeft}s
            </div>
            <p className="text-xl md:text-2xl font-fredoka font-bold text-gray-800 leading-snug">
              {q.question}
            </p>
          </div>

          {/* Answers */}
          <div className="grid grid-cols-1 gap-3">
            {q.options.map((opt, idx) => {
              const isCorrect = idx === q.correct;
              const isSelected = picked === idx;
              const revealed = picked !== null;

              let cls = 'bg-white border-2 border-gray-200 text-gray-800 hover:border-purple-400 hover:bg-purple-50';
              if (revealed) {
                if (isCorrect) cls = 'bg-green-100 border-green-500 text-green-800 ring-2 ring-green-400';
                else if (isSelected) cls = 'bg-red-100 border-red-400 text-red-700';
                else cls = 'bg-gray-100 border-gray-200 text-gray-400';
              }

              return (
                <motion.button key={idx}
                  whileHover={!revealed ? { scale: 1.02 } : {}}
                  whileTap={!revealed ? { scale: 0.98 } : {}}
                  onClick={() => handleAnswer(idx)}
                  disabled={revealed}
                  className={`w-full text-left px-5 py-4 rounded-2xl font-fredoka font-bold text-lg transition-all duration-200 ${cls}`}>
                  <span className="inline-block w-7 h-7 rounded-full bg-white bg-opacity-60 text-center text-base mr-3 leading-7">
                    {revealed && isCorrect ? '✓' : revealed && isSelected ? '✗' : String.fromCharCode(65 + idx)}
                  </span>
                  {opt}
                </motion.button>
              );
            })}
          </div>

          {picked !== null && picked !== -1 && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="text-center mt-3 text-sm text-gray-600 font-nunito italic">
              {q.explanation}
            </motion.p>
          )}
          {picked === -1 && (
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="text-center mt-3 text-sm text-red-500 font-fredoka">
              ⏰ Too slow! The answer was: {q.options[q.correct]}
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
