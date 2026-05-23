import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const GAMES = [
  {
    id: 'ninja_slice',
    title: 'Ninja Slice',
    icon: '⚔️',
    emoji: '🥷',
    description: 'Slice flying K-Pop items with your finger! Dodge the bombs. Chain combos for MEGA points!',
    rules: ['Swipe across items to slice them', 'NEVER hit a bomb 💣 (−1 life)', '3 lives total · 45 second rush', 'Combo chains = score multiplier'],
    color: 'from-red-500 to-orange-600',
    border: 'border-red-400',
    bg: 'bg-red-950',
    scoreKey: 'ninja_best',
  },
  {
    id: 'battle_arena',
    title: 'Battle Arena',
    icon: '⚡',
    emoji: '🏆',
    description: 'Pick your K-Pop warrior and beat the CPU idol in an epic turn-based battle!',
    rules: ['Choose PUNCH, KICK, SPECIAL or GUARD each turn', 'SPECIAL costs energy — use it wisely!', 'GUARD blocks 65% of all damage', 'First fighter to 0 HP loses!'],
    color: 'from-blue-600 to-violet-700',
    border: 'border-blue-400',
    bg: 'bg-blue-950',
    scoreKey: 'arena_wins',
  },
  {
    id: 'rocket_launch',
    title: 'Rocket Launch',
    icon: '🚀',
    emoji: '🌟',
    description: 'Aim your rocket with the right angle and power to hit every target across the city!',
    rules: ['Adjust ANGLE (0–90°) and POWER (0–100)', 'Watch the trajectory preview before firing', '3 tries per target · 5 targets total', 'Fewer shots = higher bonus score!'],
    color: 'from-emerald-500 to-teal-600',
    border: 'border-emerald-400',
    bg: 'bg-emerald-950',
    scoreKey: 'rocket_best',
  },
];

const ACHIEVEMENTS = [
  { key: 'ninja_best',   label: 'Ninja Best',   icon: '⚔️', fmt: (v: string) => v ? `${v} pts` : '—' },
  { key: 'arena_wins',   label: 'Arena Wins',   icon: '🏆', fmt: (v: string) => v ? `${v} wins` : '—' },
  { key: 'rocket_best',  label: 'Rocket Best',  icon: '🚀', fmt: (v: string) => v ? `${v} pts` : '—' },
];

const BoysZone: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [confetti, setConfetti] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    if (tapCount >= 5) {
      setConfetti(true);
      playWin();
      addXP(20);
      setTimeout(() => { setConfetti(false); setTapCount(0); }, 3000);
    }
  }, [tapCount, addXP]);

  const launch = (gameId: string) => {
    playClick();
    setGameState(gameId as 'ninja_slice' | 'battle_arena' | 'rocket_launch');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a4e 40%, #0d1b3e 100%)' }}
    >
      {confetti && <ConfettiBurst count={80} durationMs={2500} />}

      <div className="max-w-2xl w-full mx-auto">
        <button
          onClick={() => { playClick(); setGameState('game_mode'); }}
          className="mb-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-fredoka text-sm border border-white/20 transition-colors"
        >
          ← Back to Games
        </button>

        {/* Header */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 160 }}
          className="text-center mb-6"
        >
          <motion.div
            className="text-6xl mb-2 cursor-pointer select-none"
            animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            onClick={() => setTapCount(t => t + 1)}
          >
            🔥
          </motion.div>
          <h1
            className="text-5xl font-fredoka font-bold mb-1"
            style={{ background: 'linear-gradient(90deg, #ff6b35, #f7c59f, #efefd0, #4cc9f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            BOYS ZONE
          </h1>
          <p className="font-nunito text-blue-300 text-sm">Action · Strategy · Skill — 3 epic challenges await!</p>
          {tapCount > 0 && tapCount < 5 && (
            <p className="font-nunito text-yellow-400 text-xs mt-1">⚡ {5 - tapCount} more taps for a surprise...</p>
          )}
        </motion.div>

        {/* Stats bar */}
        <div className="flex gap-3 justify-center mb-6 flex-wrap">
          {ACHIEVEMENTS.map(a => {
            const val = localStorage.getItem(a.key) || '';
            return (
              <div key={a.key} className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-center backdrop-blur">
                <div className="text-lg">{a.icon}</div>
                <div className="font-fredoka font-bold text-white text-sm">{a.fmt(val)}</div>
                <div className="font-nunito text-white/50 text-xs">{a.label}</div>
              </div>
            );
          })}
        </div>

        {/* Game cards */}
        <div className="space-y-4">
          {GAMES.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ x: i % 2 === 0 ? -60 : 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.12, type: 'spring', stiffness: 140 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <button
                onClick={() => launch(g.id)}
                className={`w-full ${g.bg} border-2 ${g.border} rounded-3xl p-5 text-left group relative overflow-hidden transition-all hover:brightness-110`}
              >
                {/* Glow sweep on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, white, transparent 60%)' }} />

                <div className="flex items-start gap-4">
                  <div className={`bg-gradient-to-br ${g.color} rounded-2xl w-16 h-16 flex items-center justify-center text-3xl shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    {g.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-fredoka font-bold text-white text-2xl">{g.title}</h2>
                      <span className="text-xl">{g.emoji}</span>
                    </div>
                    <p className="font-nunito text-white/70 text-sm mb-3">{g.description}</p>
                    {/* Rules chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {g.rules.map(r => (
                        <span key={r} className="bg-white/10 border border-white/20 text-white/80 font-nunito text-xs px-2 py-0.5 rounded-full">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-white/40 group-hover:text-white/80 transition-colors text-3xl flex-shrink-0 self-center">
                    ▶
                  </div>
                </div>

                {/* Personal best badge */}
                {localStorage.getItem(g.scoreKey) && (
                  <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-fredoka font-bold px-2 py-0.5 rounded-full">
                    Best: {localStorage.getItem(g.scoreKey)}
                  </div>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Footer tip */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center font-nunito text-white/30 text-xs mt-6"
        >
          🎮 Complete all 3 challenges to become the ultimate K-Pop warrior!
        </motion.p>
      </div>
    </motion.div>
  );
};

export default BoysZone;
