import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import DailyChallenge from './DailyChallenge';

const WelcomeScreen: React.FC = () => {
  const [inputName, setInputName] = useState('');
  const { setUserName, setGameState } = useGameStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      setUserName(inputName.trim());
      setGameState('game_mode');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-kid-pattern"
    >
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ scale: 0.8, rotate: -5 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 200 }}
          className="mb-6"
        >
          <span className="text-6xl md:text-8xl">🎵</span>
        </motion.div>

        <motion.h1
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-4xl md:text-6xl font-fredoka font-bold text-purple-600 mb-4 text-kid-glow"
        >
          K-Pop Fun Quest
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-2xl md:text-3xl font-fredoka font-semibold text-pink-500 mb-8"
        >
          Adventure Quiz! 🌟
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-lg md:text-xl text-gray-700 mb-8 max-w-lg mx-auto leading-relaxed font-nunito"
        >
          Ready for an amazing K-pop adventure? Test your knowledge and become a K-pop superstar!
          Answer questions about your favorite artists and earn cool rewards! 🎉
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mb-8 max-w-lg mx-auto"
        >
          <DailyChallenge />
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="max-w-md mx-auto">
            <label
              htmlFor="player-name"
              className="block text-lg font-bold text-purple-600 mb-3 font-fredoka"
            >
              What's your name, superstar? ✨
            </label>
            <input
              id="player-name"
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Enter your awesome name..."
              className="w-full px-6 py-4 bg-white border-3 border-purple-300 rounded-full text-gray-800 placeholder-purple-400 focus:outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-200 transition-all duration-300 text-lg font-nunito shadow-lg"
              autoFocus
              required
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.1, rotate: [0, -2, 2, 0] }}
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={!inputName.trim()}
            className={`btn-kid font-fredoka ${
              !inputName.trim() ? 'opacity-50 cursor-not-allowed transform-none hover:scale-100' : ''
            }`}
          >
            Start the Fun! 🚀
          </motion.button>
        </motion.form>
      </div>
    </motion.div>
  );
};

export default WelcomeScreen;
