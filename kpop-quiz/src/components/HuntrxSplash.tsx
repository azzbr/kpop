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

const HuntrxSplash: React.FC = () => {
  const { setGameState, userName } = useGameStore();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    playWin();
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
  }, [setGameState]);

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

        {/* Member powers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-2 gap-3 mb-8"
        >
          {POWERS.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="bg-white bg-opacity-10 rounded-2xl p-3 backdrop-blur-sm border border-white border-opacity-20"
            >
              <div className="text-3xl mb-1">{member.emoji}</div>
              <p className="font-fredoka font-bold text-white">{member.name}</p>
              <p className={`text-xs font-nunito ${member.color}`}>{member.power}</p>
            </motion.div>
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
