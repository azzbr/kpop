import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playCorrect, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const EMOJIS = ['🌸', '⭐', '🎵', '💜', '🦋', '🌙', '🎤', '💎', '🏆', '🌈', '🔥', '🎯'];
const GRID_SIZE = 4; // 4×4 = 16 cells, 8 pairs
const PAIR_COUNT = (GRID_SIZE * GRID_SIZE) / 2;
const TIME_LIMIT = 60;

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const makeCards = (): Card[] =>
  shuffle(
    EMOJIS.slice(0, PAIR_COUNT).flatMap((e, i) => [
      { id: i * 2, emoji: e, flipped: false, matched: false },
      { id: i * 2 + 1, emoji: e, flipped: false, matched: false },
    ])
  );

const MemorySpeedRound: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(TIME_LIMIT);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState<'win' | 'lose' | null>(null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [comboLabel, setComboLabel] = useState('');
  const timerRef = useRef<number | null>(null);
  const lockRef = useRef(false);

  const startGame = () => {
    setCards(makeCards());
    setSelected([]);
    setSeconds(TIME_LIMIT);
    setStarted(true);
    setDone(null);
    setCombo(0);
    setMaxCombo(0);
    setMatchCount(0);
    setComboLabel('');
    lockRef.current = false;
  };

  useEffect(() => {
    if (!started || done) return;
    timerRef.current = window.setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          setDone('lose');
          playWrong();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [started, done]);

  const showComboLabel = (c: number) => {
    if (c >= 5) setComboLabel('🔥 ON FIRE!');
    else if (c >= 3) setComboLabel('⚡ COMBO!');
    else if (c >= 2) setComboLabel('✨ Nice!');
    setTimeout(() => setComboLabel(''), 800);
  };

  const handleTap = useCallback((idx: number) => {
    if (!started || done || lockRef.current) return;
    const card = cards[idx];
    if (card.flipped || card.matched) return;

    playPop();
    const newSel = [...selected, idx];
    setCards(c => c.map((cd, i) => i === idx ? { ...cd, flipped: true } : cd));
    setSelected(newSel);

    if (newSel.length === 2) {
      lockRef.current = true;
      const [a, b] = newSel;
      if (cards[a].emoji === cards[b].emoji) {
        // Match!
        playCorrect();
        const newCombo = combo + 1;
        const newMax = Math.max(maxCombo, newCombo);
        setCombo(newCombo);
        setMaxCombo(newMax);
        showComboLabel(newCombo);
        const newMatch = matchCount + 1;
        setMatchCount(newMatch);
        setCards(c => c.map((cd, i) => (i === a || i === b) ? { ...cd, matched: true } : cd));
        setSelected([]);
        lockRef.current = false;
        if (newMatch === PAIR_COUNT) {
          playWin();
          setDone('win');
        }
      } else {
        playWrong();
        setCombo(0);
        setTimeout(() => {
          setCards(c => c.map((cd, i) => (i === a || i === b) ? { ...cd, flipped: false } : cd));
          setSelected([]);
          lockRef.current = false;
        }, 700);
      }
    }
  }, [cards, selected, started, done, combo, maxCombo, matchCount]);

  const xpEarned = done === 'win' ? 50 + maxCombo * 5 : matchCount * 3;
  const timerPct = (seconds / TIME_LIMIT) * 100;
  const timerColor = seconds > 30 ? 'bg-green-400' : seconds > 10 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {done === 'win' && <ConfettiBurst count={70} durationMs={2500} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-3">
          <div className="text-4xl mb-1">⚡</div>
          <h1 className="text-3xl font-fredoka font-bold text-purple-600 text-kid-glow">Speed Memory!</h1>
          <p className="font-nunito text-gray-500 text-sm">Match all pairs in 60 seconds — combos multiply XP!</p>
        </div>

        {/* Stats */}
        <div className="flex justify-between bg-white rounded-2xl px-4 py-2 shadow border-2 border-purple-200 mb-2">
          <span className="font-fredoka font-bold text-purple-600">⏱️ {seconds}s</span>
          <span className="font-fredoka text-gray-600">{matchCount}/{PAIR_COUNT} pairs</span>
          <span className="font-fredoka text-orange-500">🔥 x{combo}</span>
        </div>

        {/* Timer bar */}
        <div className="bg-gray-100 rounded-full h-3 mb-3 overflow-hidden border border-gray-200">
          <motion.div
            className={`h-3 rounded-full ${timerColor} transition-colors`}
            animate={{ width: `${timerPct}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>

        {/* Combo flash */}
        <AnimatePresence>
          {comboLabel && (
            <motion.div
              key={comboLabel + Date.now()}
              initial={{ opacity: 0, y: -10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1.1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center font-fredoka font-bold text-orange-500 text-2xl mb-2"
            >
              {comboLabel}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        {started && !done && (
          <div
            className="grid gap-2 bg-white rounded-3xl p-3 shadow-xl border-2 border-purple-200 mb-4"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
          >
            {cards.map((card, idx) => (
              <motion.button
                key={card.id}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleTap(idx)}
                className={`aspect-square rounded-xl text-2xl flex items-center justify-center border-2 transition-all ${
                  card.matched
                    ? 'bg-green-100 border-green-300'
                    : card.flipped
                    ? 'bg-purple-100 border-purple-400'
                    : 'bg-gray-100 border-gray-200 hover:bg-purple-50'
                }`}
              >
                {(card.flipped || card.matched) ? card.emoji : ''}
              </motion.button>
            ))}
          </div>
        )}

        {/* Start prompt */}
        {!started && !done && (
          <div className="text-center py-8">
            <button onClick={startGame} className="btn-kid text-xl px-8 py-3">⚡ Start Speed Round!</button>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white rounded-3xl p-6 shadow-2xl border-4 ${done === 'win' ? 'border-yellow-400' : 'border-red-300'} text-center`}
            >
              <div className="text-6xl mb-2">{done === 'win' ? '🏆' : '⏰'}</div>
              <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-1">
                {done === 'win' ? 'Blazing Fast!' : 'Time\'s Up!'}
              </h2>
              <p className="font-nunito text-gray-600 mb-1">
                {matchCount}/{PAIR_COUNT} pairs • Best combo x{maxCombo}
              </p>
              <p className="font-nunito text-purple-600 mb-4">+{xpEarned} XP!</p>
              <button onClick={() => { addXP(xpEarned); startGame(); }} className="btn-kid mr-2">🔄 Play Again</button>
              <button onClick={() => { addXP(xpEarned); setGameState('game_mode'); }} className="btn-kid-secondary">🏠 Home</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MemorySpeedRound;
