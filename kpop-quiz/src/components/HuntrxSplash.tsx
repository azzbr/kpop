import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const POWERS = [
  { name: 'Rumi', emoji: '⚡', power: 'Telekinesis', color: 'text-yellow-400' },
  { name: 'Mira', emoji: '🌸', power: 'Healing Voice', color: 'text-pink-400' },
  { name: 'Zoey', emoji: '🌙', power: 'Time Control', color: 'text-blue-400' },
  { name: 'Celine', emoji: '🌟', power: 'Star Magic', color: 'text-purple-400' },
];

const PERKS = [
  { emoji: '🎁', text: '+500 bonus XP added to your level!' },
  { emoji: '🎨', text: 'All 6 colour themes unlocked instantly!' },
  { emoji: '👑', text: 'Golden Superstar crown on your profile — forever!' },
];

const HuntrxSplash: React.FC = () => {
  const { setGameState, userName, unlockHuntrx, huntrxUnlocked } = useGameStore();
  const [countdown, setCountdown] = useState(5);
  const alreadyHad = useState(huntrxUnlocked)[0];

  useEffect(() => {
    playWin();
    unlockHuntrx();
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameState('game_mode');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [setGameState, unlockHuntrx]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center justify-center text-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #0f0c29 100%)' }}
    >
      <ConfettiBurst count={120} durationMs={5000} />

      {/* Floating stars background */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl pointer-events-none"
          initial={{ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, opacity: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
          transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
        >
          {['⭐', '✨', '💫', '🌟'][Math.floor(Math.random() * 4)]}
        </motion.div>
      ))}

      <div className="relative z-10 max-w-lg">
        {/* HUNTR/X Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 10 }}
          className="text-8xl mb-4"
        >
          🌟
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-yellow-400 font-fredoka text-2xl mb-1 tracking-widest uppercase">
            Welcome to
          </p>
          <h1
            className="text-6xl md:text-7xl font-fredoka font-bold mb-2"
            style={{ background: 'linear-gradient(90deg, #fbbf24, #f472b6, #818cf8, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            HUNTR/X
          </h1>
          <p className="text-3xl font-fredoka font-bold text-white mb-1">
            SUPERSTAR MODE
          </p>
          <p className="text-lg font-nunito text-purple-300 mb-8">
            The secret is unlocked, {userName}! ✨
          </p>
        </motion.div>

        {/* Perks unlocked — the real reward */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <p className="font-fredoka font-bold text-yellow-400 text-lg mb-3">
            {alreadyHad ? '⭐ Your Superstar Perks' : '🎉 Rewards Unlocked!'}
          </p>
          <div className="space-y-2">
            {PERKS.map((perk, i) => (
              <motion.div
                key={perk.text}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.2 }}
                className="flex items-center gap-3 bg-white bg-opacity-10 rounded-2xl p-3 backdrop-blur-sm border border-white border-opacity-20"
              >
                <span className="text-3xl flex-shrink-0">{perk.emoji}</span>
                <span className="font-nunito text-white text-left text-sm">{perk.text}</span>
                <span className="ml-auto text-green-400 text-xl flex-shrink-0">✓</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Member powers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="grid grid-cols-4 gap-2 mb-6"
        >
          {POWERS.map((member) => (
            <div
              key={member.name}
              className="bg-white bg-opacity-10 rounded-xl p-2 backdrop-blur-sm border border-white border-opacity-20"
            >
              <div className="text-2xl">{member.emoji}</div>
              <p className="font-fredoka font-bold text-white text-xs">{member.name}</p>
            </div>
          ))}
        </motion.div>

        {/* Auto-redirect countdown */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <motion.div
            key={countdown}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-5xl font-fredoka font-bold text-yellow-400 mb-2"
          >
            {countdown}
          </motion.div>
          <p className="font-nunito text-purple-300 text-sm mb-4">Entering your mission in...</p>
          <button
            onClick={() => setGameState('game_mode')}
            className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-fredoka font-bold px-8 py-3 rounded-full text-lg shadow-xl hover:scale-105 transition-transform"
          >
            Skip → Enter Now!
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default HuntrxSplash;
