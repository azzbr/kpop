import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const GAMES = [
  {
    id: 'style_studio',
    title: 'Style Studio',
    icon: '👗',
    emoji: '✨',
    description: 'Design your dream K-Pop look! Mix and match outfits, hair, accessories — then strut!',
    rules: ['Pick your model, hair, outfit, shoes & accessory', 'Try matching themed combos for VIBE bonus', 'Save unlimited looks to your closet', 'Strut on the runway for confetti!'],
    color: 'from-pink-500 to-rose-500',
    border: 'border-pink-300',
    bg: 'bg-pink-100/40',
    scoreKey: 'style_saves',
  },
  {
    id: 'sparkle_match',
    title: 'Sparkle Match',
    icon: '💎',
    emoji: '💖',
    description: 'Swap charms to make 3-in-a-row! Chain combos to clear the board and shine!',
    rules: ['Swap adjacent charms to match 3+ in a row', 'Match 4+ for special POWER charms ⚡', '60 second sparkle dash', 'Cascade matches = MEGA combo bonus!'],
    color: 'from-fuchsia-500 to-purple-500',
    border: 'border-purple-300',
    bg: 'bg-purple-100/40',
    scoreKey: 'sparkle_best',
  },
  {
    id: 'idol_diary',
    title: 'Idol Diary',
    icon: '📔',
    emoji: '🌸',
    description: 'Write your own funny K-Pop story by filling in the blanks — then save it forever!',
    rules: ['Pick from 3 story templates', 'Choose words to fill the blanks', 'Save your finished diary entries', 'Re-read your old stories anytime'],
    color: 'from-rose-400 to-pink-500',
    border: 'border-rose-300',
    bg: 'bg-rose-100/40',
    scoreKey: 'diary_entries',
  },
];

const STATS = [
  { key: 'style_saves',   label: 'Looks Saved',  icon: '👗' },
  { key: 'sparkle_best',  label: 'Sparkle Best', icon: '💎' },
  { key: 'diary_entries', label: 'Diary Pages',  icon: '📔' },
];

const GirlsZone: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [confetti, setConfetti] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  useEffect(() => {
    if (tapCount >= 5) {
      setConfetti(true); playWin(); addXP(20);
      setTimeout(() => { setConfetti(false); setTapCount(0); }, 3000);
    }
  }, [tapCount, addXP]);

  const launch = (gameId: string) => {
    playClick();
    setGameState(gameId as 'style_studio' | 'sparkle_match' | 'idol_diary');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center p-4"
      style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 30%, #f5d0fe 70%, #fbcfe8 100%)' }}
    >
      {confetti && <ConfettiBurst count={80} durationMs={2500} />}

      {/* Floating sparkles background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl select-none"
            style={{ left: `${(i * 83) % 100}%`, top: `${(i * 47) % 100}%` }}
            animate={{ y: [0, -20, 0], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
          >
            {['✨', '💖', '🌸', '⭐', '💎'][i % 5]}
          </motion.div>
        ))}
      </div>

      <div className="max-w-2xl w-full mx-auto relative z-10">
        <button
          onClick={() => { playClick(); setGameState('game_mode'); }}
          className="mb-4 px-4 py-2 bg-white/70 hover:bg-white text-pink-700 rounded-full font-fredoka text-sm border-2 border-pink-200 transition-colors"
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
            animate={{ rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
            onClick={() => setTapCount(t => t + 1)}
          >
            🌸
          </motion.div>
          <h1
            className="text-5xl font-fredoka font-bold mb-1"
            style={{ background: 'linear-gradient(90deg, #ec4899, #a855f7, #f472b6, #fb7185)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            GIRLS ZONE
          </h1>
          <p className="font-nunito text-pink-700 text-sm">Creative · Sparkle · Story — 3 magical experiences await!</p>
          {tapCount > 0 && tapCount < 5 && (
            <p className="font-nunito text-purple-500 text-xs mt-1">✨ {5 - tapCount} more taps for a sparkle...</p>
          )}
        </motion.div>

        {/* Stats bar */}
        <div className="flex gap-3 justify-center mb-6 flex-wrap">
          {STATS.map(s => {
            const val = localStorage.getItem(s.key) || '—';
            return (
              <div key={s.key} className="bg-white/80 border-2 border-pink-200 rounded-xl px-3 py-2 text-center backdrop-blur shadow-sm">
                <div className="text-lg">{s.icon}</div>
                <div className="font-fredoka font-bold text-pink-700 text-sm">{val}</div>
                <div className="font-nunito text-pink-400 text-xs">{s.label}</div>
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
                className={`w-full bg-white/85 border-2 ${g.border} rounded-3xl p-5 text-left group relative overflow-hidden transition-all hover:bg-white hover:shadow-xl`}
              >
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-br ${g.color}`} />

                <div className="flex items-start gap-4">
                  <div className={`bg-gradient-to-br ${g.color} rounded-2xl w-16 h-16 flex items-center justify-center text-3xl shadow-lg flex-shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-transform`}>
                    {g.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-fredoka font-bold text-pink-900 text-2xl">{g.title}</h2>
                      <span className="text-xl">{g.emoji}</span>
                    </div>
                    <p className="font-nunito text-pink-700/80 text-sm mb-3">{g.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.rules.map(r => (
                        <span key={r} className="bg-pink-50 border border-pink-200 text-pink-700 font-nunito text-xs px-2 py-0.5 rounded-full">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-pink-300 group-hover:text-pink-500 transition-colors text-3xl flex-shrink-0 self-center">▶</div>
                </div>

                {localStorage.getItem(g.scoreKey) && (
                  <div className="absolute top-3 right-3 bg-yellow-300 text-yellow-900 text-xs font-fredoka font-bold px-2 py-0.5 rounded-full">
                    ⭐ {localStorage.getItem(g.scoreKey)}
                  </div>
                )}
              </button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center font-nunito text-pink-500/60 text-xs mt-6"
        >
          🌸 Express yourself — there are no wrong answers here!
        </motion.p>
      </div>
    </motion.div>
  );
};

export default GirlsZone;
