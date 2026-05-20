import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin, playWrong, playPop } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const TOTAL_ROUNDS = 10;
const SIGNALS = ['🌟', '⚡', '🎵', '🔥', '💥'];
const COLORS = ['bg-pink-400', 'bg-blue-400', 'bg-yellow-400', 'bg-green-400', 'bg-purple-400'];

type Phase = 'setup' | 'waiting' | 'go' | 'result' | 'done';

const ReactionDuel: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [scores, setScores] = useState([0, 0]);
  const [round, setRound] = useState(0);
  const [signal, setSignal] = useState(0);
  const [roundWinner, setRoundWinner] = useState<number | null>(null);
  const [fakeFlash, setFakeFlash] = useState(false);
  const [names, setNames] = useState(['Player 1', 'Player 2']);
  const timeoutRef = useRef<number | null>(null);
  const goRef = useRef(false);

  const clearT = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };

  useEffect(() => () => clearT(), []);

  const startRound = () => {
    setRoundWinner(null);
    setFakeFlash(false);
    goRef.current = false;
    setPhase('waiting');

    const delay = 1500 + Math.random() * 3000;
    timeoutRef.current = window.setTimeout(() => {
      setSignal(Math.floor(Math.random() * SIGNALS.length));
      setPhase('go');
      goRef.current = true;

      timeoutRef.current = window.setTimeout(() => {
        if (goRef.current) {
          // Nobody tapped in time — draw
          setRoundWinner(-1);
          setPhase('result');
        }
      }, 2000);
    }, delay);

    // Random fake flash
    const fakeDelay = 400 + Math.random() * (delay - 600);
    if (fakeDelay < delay - 200) {
      setTimeout(() => {
        if (!goRef.current) {
          setFakeFlash(true);
          setTimeout(() => setFakeFlash(false), 120);
        }
      }, fakeDelay);
    }
  };

  const handleTap = (player: number) => {
    if (phase === 'waiting' || fakeFlash) {
      playWrong();
      setRoundWinner(player === 0 ? 1 : 0);
      setScores(s => { const n = [...s]; n[player === 0 ? 1 : 0]++; return n; });
      clearT();
      goRef.current = false;
      setPhase('result');
      return;
    }
    if (phase !== 'go') return;
    clearT();
    goRef.current = false;
    playPop();
    setRoundWinner(player);
    setScores(s => { const n = [...s]; n[player]++; return n; });
    setPhase('result');
  };

  const nextRound = () => {
    const newRound = round + 1;
    setRound(newRound);
    if (newRound >= TOTAL_ROUNDS) {
      setPhase('done');
      playWin();
      addXP(40);
    } else {
      startRound();
    }
  };

  const winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;

  const bgColor = phase === 'go' ? COLORS[signal] : 'bg-gray-900';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`min-h-screen flex flex-col transition-colors duration-100 ${bgColor}`}
    >
      {phase === 'done' && winner >= 0 && <ConfettiBurst count={60} durationMs={2500} />}

      {/* Setup screen */}
      {phase === 'setup' && (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-kid-pattern">
          <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary self-start mb-6">← Back</button>
          <div className="text-6xl mb-2">⚡</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow mb-2">Reaction Duel</h1>
          <p className="font-nunito text-gray-600 text-center mb-6">2 players, 1 device — who's fastest?<br/>Tap YOUR side when the signal appears!</p>
          <div className="bg-white rounded-2xl p-4 shadow border-2 border-purple-200 w-full max-w-sm mb-6">
            <p className="font-fredoka font-bold text-gray-700 mb-2">Player Names (optional)</p>
            {[0, 1].map(i => (
              <input
                key={i}
                value={names[i]}
                onChange={e => setNames(n => { const c = [...n]; c[i] = e.target.value; return c; })}
                className="w-full border-2 border-purple-200 rounded-xl px-3 py-2 font-nunito mb-2 focus:outline-none focus:border-purple-400"
                placeholder={`Player ${i + 1}`}
              />
            ))}
          </div>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 text-sm font-nunito text-blue-700 mb-6 max-w-sm text-center">
            ⚠️ Watch out for fake flashes! Tapping early means your opponent scores!
          </div>
          <button onClick={() => { playClick(); setRound(0); setScores([0, 0]); startRound(); }} className="btn-kid text-xl px-8 py-3">🎮 Start Duel!</button>
        </div>
      )}

      {/* Game screen */}
      {(phase === 'waiting' || phase === 'go' || phase === 'result') && (
        <div className="flex flex-col min-h-screen">
          {/* Score bar */}
          <div className={`flex justify-between items-center px-6 py-3 ${phase === 'go' ? 'bg-black/20' : 'bg-gray-800'}`}>
            <span className="font-fredoka font-bold text-white text-xl">{names[0]}: {scores[0]}</span>
            <span className="font-fredoka text-gray-300">Round {round + 1}/{TOTAL_ROUNDS}</span>
            <span className="font-fredoka font-bold text-white text-xl">{scores[1]} :{names[1]}</span>
          </div>

          {/* Player 2 tap zone (rotated) */}
          <button
            onClick={() => handleTap(1)}
            className="flex-1 flex items-center justify-center rotate-180 select-none active:brightness-75"
          >
            {phase === 'waiting' && !fakeFlash && (
              <div className="text-center opacity-50">
                <div className="text-5xl mb-2">👆</div>
                <p className="font-fredoka text-white text-2xl">Wait...</p>
              </div>
            )}
            {(phase === 'go' || fakeFlash) && (
              <div className="text-center">
                <div className="text-8xl mb-2 drop-shadow-lg">{SIGNALS[signal]}</div>
                <p className="font-fredoka text-white text-3xl font-bold drop-shadow">TAP!</p>
              </div>
            )}
          </button>

          {/* Middle divider */}
          <div className={`h-2 ${phase === 'go' ? 'bg-white/40' : 'bg-gray-600'}`} />

          {/* Player 1 tap zone */}
          <button
            onClick={() => handleTap(0)}
            className="flex-1 flex items-center justify-center select-none active:brightness-75"
          >
            {phase === 'waiting' && !fakeFlash && (
              <div className="text-center opacity-50">
                <div className="text-5xl mb-2">👆</div>
                <p className="font-fredoka text-white text-2xl">Wait...</p>
              </div>
            )}
            {(phase === 'go' || fakeFlash) && (
              <div className="text-center">
                <div className="text-8xl mb-2 drop-shadow-lg">{SIGNALS[signal]}</div>
                <p className="font-fredoka text-white text-3xl font-bold drop-shadow">TAP!</p>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Round result overlay */}
      <AnimatePresence>
        {phase === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-3xl p-8 shadow-2xl text-center mx-4"
            >
              {roundWinner === -1 ? (
                <><div className="text-5xl mb-2">🤝</div><h2 className="text-3xl font-fredoka font-bold text-gray-600">Draw!</h2></>
              ) : (
                <><div className="text-5xl mb-2">🏅</div><h2 className="text-3xl font-fredoka font-bold text-purple-600">{roundWinner !== null && roundWinner >= 0 ? names[roundWinner] : ''} wins!</h2></>
              )}
              <p className="font-nunito text-gray-500 mt-2 mb-4">{names[0]} {scores[0]} — {scores[1]} {names[1]}</p>
              <button onClick={nextRound} className="btn-kid">
                {round + 1 >= TOTAL_ROUNDS ? '🏁 See Results' : '➡️ Next Round'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Done screen */}
      {phase === 'done' && (
        <div className="min-h-screen bg-kid-pattern flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 shadow-2xl border-4 border-yellow-400 text-center max-w-sm w-full"
          >
            <div className="text-6xl mb-2">{winner >= 0 ? '🏆' : '🤝'}</div>
            <h2 className="text-4xl font-fredoka font-bold text-purple-600 mb-2">
              {winner >= 0 ? `${names[winner]} Wins!` : 'Tie Game!'}
            </h2>
            <div className="flex justify-center gap-6 mb-4">
              <div className="text-center">
                <p className="font-fredoka text-2xl font-bold text-pink-500">{scores[0]}</p>
                <p className="font-nunito text-gray-500 text-sm">{names[0]}</p>
              </div>
              <div className="font-fredoka text-2xl text-gray-300 self-center">vs</div>
              <div className="text-center">
                <p className="font-fredoka text-2xl font-bold text-blue-500">{scores[1]}</p>
                <p className="font-nunito text-gray-500 text-sm">{names[1]}</p>
              </div>
            </div>
            <p className="font-nunito text-gray-500 mb-4">+40 XP earned!</p>
            <button onClick={() => { setRound(0); setScores([0, 0]); setPhase('setup'); }} className="btn-kid mr-2">🔄 Again</button>
            <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary">🏠 Home</button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default ReactionDuel;
