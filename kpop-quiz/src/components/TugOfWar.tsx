import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWin, playPop } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

type Phase = 'setup' | 'countdown' | 'battle' | 'round_result' | 'final';

const WIN_SCORE = 2; // best of 3 rounds
const PULL = 2.4; // % the lightstick moves per tap
const LEFT_GOAL = 8;
const RIGHT_GOAL = 92;

const TugOfWar: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [names, setNames] = useState(['', '']);
  const [scores, setScores] = useState([0, 0]);
  const [round, setRound] = useState(1);
  const [pos, setPos] = useState(50);
  const [countdown, setCountdown] = useState(3);
  const [roundWinner, setRoundWinner] = useState<number | null>(null);
  const [matchWinner, setMatchWinner] = useState<number | null>(null);
  const tapCount = useRef(0);

  // Countdown before each round
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      playCorrect();
      setPhase('battle');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 800);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  // A round ends when the lightstick reaches a goal zone
  useEffect(() => {
    if (phase !== 'battle') return;
    const winner = pos <= LEFT_GOAL ? 0 : pos >= RIGHT_GOAL ? 1 : null;
    if (winner === null) return;
    playWin();
    const next = [...scores];
    next[winner] += 1;
    setScores(next);
    setRoundWinner(winner);
    if (next[winner] >= WIN_SCORE) {
      setMatchWinner(winner);
      setPhase('final');
      addXP(30);
    } else {
      setPhase('round_result');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, phase]);

  const pull = useCallback((player: 0 | 1) => {
    if (phase !== 'battle') return;
    tapCount.current += 1;
    if (tapCount.current % 3 === 0) playPop();
    setPos(p => Math.max(0, Math.min(100, player === 0 ? p - PULL : p + PULL)));
  }, [phase]);

  // Keyboard controls: A = Player 1, L = Player 2 (held keys don't auto-repeat)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'a') pull(0);
      else if (k === 'l') pull(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pull]);

  const startMatch = () => {
    playClick();
    setNames(n => [n[0].trim() || 'Player 1', n[1].trim() || 'Player 2']);
    setScores([0, 0]);
    setRound(1);
    setPos(50);
    setRoundWinner(null);
    setMatchWinner(null);
    setCountdown(3);
    setPhase('countdown');
  };

  const nextRound = () => {
    playClick();
    setRound(r => r + 1);
    setPos(50);
    setRoundWinner(null);
    setCountdown(3);
    setPhase('countdown');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 text-white px-4 py-6 select-none"
    >
      <button
        onClick={() => { playClick(); setGameState('game_mode'); }}
        className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 rounded-full px-4 py-2 font-fredoka text-sm z-20"
      >
        ← Back
      </button>

      <div className="max-w-5xl mx-auto pt-10">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-5xl mb-1">
          🪢 Lightstick Tug-of-War
        </h1>
        <p className="text-center font-nunito text-purple-200 mb-6">
          Mash your button — pull the lightstick to YOUR side!
        </p>

        {phase === 'setup' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-lg mx-auto bg-white/10 rounded-3xl p-6 md:p-8 border border-white/20"
          >
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block font-fredoka text-pink-300 mb-2">💗 Player 1</label>
                <input
                  type="text"
                  value={names[0]}
                  maxLength={14}
                  onChange={(e) => setNames(n => [e.target.value, n[1]])}
                  placeholder="Player 1"
                  className="w-full px-4 py-3 rounded-2xl bg-white/90 text-gray-800 font-nunito border-2 border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-300"
                />
              </div>
              <div>
                <label className="block font-fredoka text-blue-300 mb-2">💙 Player 2</label>
                <input
                  type="text"
                  value={names[1]}
                  maxLength={14}
                  onChange={(e) => setNames(n => [n[0], e.target.value])}
                  placeholder="Player 2"
                  className="w-full px-4 py-3 rounded-2xl bg-white/90 text-gray-800 font-nunito border-2 border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-300"
                />
              </div>
            </div>
            <div className="bg-black/30 rounded-2xl p-4 mb-6 font-nunito text-sm md:text-base text-purple-100 leading-relaxed">
              👈 Player 1 taps the <span className="text-pink-300 font-bold">LEFT</span> button (or presses <kbd className="bg-white/20 px-2 rounded">A</kbd>)
              <br />
              👉 Player 2 taps the <span className="text-blue-300 font-bold">RIGHT</span> button (or presses <kbd className="bg-white/20 px-2 rounded">L</kbd>)
              <br />
              First to drag the 🌟 into their goal wins the round. Best of 3!
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startMatch}
              className="w-full py-4 rounded-full font-fredoka font-bold text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
            >
              ⚡ START THE BATTLE! ⚡
            </motion.button>
          </motion.div>
        )}

        {(phase === 'battle' || phase === 'countdown' || phase === 'round_result' || phase === 'final') && (
          <>
            <div className="flex items-center justify-between mb-4 font-fredoka gap-2">
              <div className="text-pink-300 text-lg md:text-2xl font-bold truncate">
                {names[0]} {'⭐'.repeat(scores[0])}
              </div>
              <div className="bg-white/10 rounded-full px-4 py-1 text-xs md:text-base whitespace-nowrap">
                Round {round} · first to {WIN_SCORE} ⭐
              </div>
              <div className="text-blue-300 text-lg md:text-2xl font-bold truncate text-right">
                {'⭐'.repeat(scores[1])} {names[1]}
              </div>
            </div>

            <div className="relative h-24 md:h-28 rounded-full bg-white/10 border-2 border-white/20 overflow-hidden mb-8">
              <div className="absolute inset-y-0 left-0 w-[10%] bg-gradient-to-r from-pink-500/80 to-transparent flex items-center justify-center text-2xl">
                🚩
              </div>
              <div className="absolute inset-y-0 right-0 w-[10%] bg-gradient-to-l from-blue-500/80 to-transparent flex items-center justify-center text-2xl">
                🚩
              </div>
              <div className="absolute inset-y-2 left-1/2 w-0.5 bg-white/30 -translate-x-1/2" />
              <div className="absolute top-1/2 left-[5%] right-[5%] h-2 -translate-y-1/2 bg-gradient-to-r from-pink-400 via-amber-300 to-blue-400 rounded-full opacity-60" />
              <div
                className="absolute top-1/2 text-5xl md:text-6xl"
                style={{
                  left: `${pos}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: 'left 90ms linear',
                  filter: 'drop-shadow(0 0 12px rgba(255, 220, 100, 0.9))',
                }}
              >
                🌟
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:gap-10">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onPointerDown={(e) => { e.preventDefault(); pull(0); }}
                onContextMenu={(e) => e.preventDefault()}
                style={{ touchAction: 'manipulation' }}
                className="h-40 md:h-52 rounded-3xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-2xl font-fredoka active:brightness-110"
              >
                <div className="text-4xl md:text-5xl mb-2">👈🌟</div>
                <div className="text-2xl md:text-3xl font-bold truncate px-2">{names[0]}</div>
                <div className="text-xs md:text-base opacity-80 font-nunito mt-1">TAP TAP TAP! (key A)</div>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onPointerDown={(e) => { e.preventDefault(); pull(1); }}
                onContextMenu={(e) => e.preventDefault()}
                style={{ touchAction: 'manipulation' }}
                className="h-40 md:h-52 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-2xl font-fredoka active:brightness-110"
              >
                <div className="text-4xl md:text-5xl mb-2">🌟👉</div>
                <div className="text-2xl md:text-3xl font-bold truncate px-2">{names[1]}</div>
                <div className="text-xs md:text-base opacity-80 font-nunito mt-1">TAP TAP TAP! (key L)</div>
              </motion.button>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {phase === 'countdown' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/60"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-fredoka font-bold text-8xl md:text-9xl text-amber-300"
              style={{ textShadow: '0 0 30px rgba(255,200,0,0.8)' }}
            >
              {countdown > 0 ? countdown : 'GO!'}
            </motion.div>
          </motion.div>
        )}

        {phase === 'round_result' && roundWinner !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/70"
          >
            <motion.div
              initial={{ scale: 0.5, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260 }}
              className="bg-gradient-to-br from-purple-800 to-fuchsia-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm mx-4"
            >
              <div className="text-6xl mb-3">{roundWinner === 0 ? '💗' : '💙'}</div>
              <h2 className="font-fredoka font-bold text-3xl mb-2 text-amber-300">
                {names[roundWinner]} takes the round! ⭐
              </h2>
              <p className="font-nunito text-purple-200 mb-6">
                {scores[0]} — {scores[1]}
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={nextRound}
                className="px-8 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
              >
                Next Round! 🔥
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {phase === 'final' && matchWinner !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-center justify-center bg-black/70"
          >
            <ConfettiBurst count={80} durationMs={4000} />
            <motion.div
              initial={{ scale: 0.5, rotate: -4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-purple-800 to-fuchsia-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm mx-4"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.4 }}
                className="text-7xl mb-3"
              >
                🏆
              </motion.div>
              <h2 className="font-fredoka font-bold text-3xl mb-1 text-amber-300">
                {names[matchWinner]} WINS!
              </h2>
              <p className="font-nunito text-purple-200 mb-2">
                Final score: {scores[0]} — {scores[1]}
              </p>
              <p className="font-fredoka text-green-300 mb-6">+30 XP! 🎉</p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startMatch}
                  className="px-6 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Rematch! ⚡
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); setGameState('game_mode'); }}
                  className="px-6 py-3 rounded-full font-fredoka font-bold bg-white/15 border border-white/30"
                >
                  All Games 🎮
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TugOfWar;
