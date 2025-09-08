import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import type { Difficulty } from '../store';

const DifficultyScreen: React.FC = () => {
  const { userName, setDifficulty, initializeQuiz } = useGameStore();

  const handleDifficultySelect = (difficulty: Difficulty) => {
    setDifficulty(difficulty);
    initializeQuiz();
  };

  const difficulties = [
    {
      level: 'easy' as Difficulty,
      title: 'Fun Start',
      description: 'Perfect for beginners! 🎈',
      questions: 5,
      emoji: '🌟',
      color: 'from-green-400 to-emerald-500',
      hoverColor: 'hover:from-green-300 hover:to-emerald-400',
    },
    {
      level: 'normal' as Difficulty,
      title: 'Super Fan',
      description: 'Show your K-pop skills! ⭐',
      questions: 7,
      emoji: '🚀',
      color: 'from-yellow-400 to-orange-500',
      hoverColor: 'hover:from-yellow-300 hover:to-orange-400',
    },
    {
      level: 'hard' as Difficulty,
      title: 'Mega Star',
      description: 'Ultimate K-pop challenge! 👑',
      questions: 10,
      emoji: '💎',
      color: 'from-purple-400 to-pink-500',
      hoverColor: 'hover:from-purple-300 hover:to-pink-400',
    },
    {
      level: 'lyrics' as Difficulty,
      title: 'Know Your Lyrics',
      description: 'Test your song knowledge! 🎤',
      questions: 15,
      emoji: '🎵',
      color: 'from-blue-400 to-cyan-500',
      hoverColor: 'hover:from-blue-300 hover:to-cyan-400',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-kid-pattern"
    >
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ scale: 0.8, rotate: -3 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
          className="mb-6"
        >
          <span className="text-5xl">👋</span>
        </motion.div>

        <motion.h1
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-3xl md:text-5xl font-fredoka font-bold text-purple-600 mb-4 text-kid-glow"
        >
          Hey {userName}! 🎉
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500 mb-12"
        >
          Pick Your Adventure Level! 🌟
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto"
        >
          {difficulties.map((difficulty, index) => (
            <motion.button
              key={difficulty.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.05, y: -5, rotate: [0, -1, 1, 0] }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleDifficultySelect(difficulty.level)}
              className="card-kid p-6 cursor-pointer text-center group"
            >
              <div className="text-center">
                <motion.div
                  className={`w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r ${difficulty.color} ${difficulty.hoverColor} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300`}
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                >
                  <span className="text-3xl">{difficulty.emoji}</span>
                </motion.div>

                <h3 className="text-xl font-fredoka font-bold text-purple-600 mb-2 group-hover:text-pink-500 transition-colors duration-300">
                  {difficulty.title}
                </h3>

                <p className="text-sm text-purple-500 mb-3 font-nunito font-semibold">
                  {difficulty.questions} Questions
                </p>

                <p className="text-sm text-gray-600 leading-relaxed font-nunito">
                  {difficulty.description}
                </p>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-purple-600 text-sm max-w-md mx-auto font-nunito">
            Pick the level that feels just right for you! Every superstar starts somewhere! 🌈
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default DifficultyScreen;
