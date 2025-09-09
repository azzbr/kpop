import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import type { GameMode } from '../store';

const GameModeSelection: React.FC = () => {
  const { userName, setGameState, setSelectedGameMode } = useGameStore();

  const gameModes = [
    {
      id: 'quiz' as GameMode,
      title: 'K-pop Quiz',
      description: 'Test your K-pop knowledge with multiple difficulty levels!',
      icon: '🧠',
      color: 'from-purple-400 to-pink-500',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-300'
    },
    {
      id: 'memory' as GameMode,
      title: 'Memory Game',
      description: 'Match K-pop idols, songs, and album covers!',
      icon: '🃏',
      color: 'from-blue-400 to-cyan-500',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300'
    },
    {
      id: 'rhythm' as GameMode,
      title: 'Rhythm Game',
      description: 'Tap to the beat and unlock new songs!',
      icon: '🎵',
      color: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    },
    {
      id: 'trivia' as GameMode,
      title: 'Trivia Cards',
      description: 'Collect and trade K-pop idol cards!',
      icon: '🎴',
      color: 'from-orange-400 to-red-500',
      bgColor: 'bg-orange-100',
      borderColor: 'border-orange-300'
    },
    {
      id: 'instruments' as GameMode,
      title: 'Learn Instruments',
      description: 'Learn to play K-Pop songs on piano and recorder!',
      icon: '🎼',
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    {
      id: 'teams' as GameMode,
      title: 'Team Maker',
      description: 'Create random teams for sports and games!',
      icon: '👥',
      color: 'from-indigo-400 to-purple-500',
      bgColor: 'bg-indigo-100',
      borderColor: 'border-indigo-300'
    },
    {
      id: 'friends' as GameMode,
      title: 'Friends Trivia',
      description: 'Test your knowledge about your friends!',
      icon: '👫',
      color: 'from-pink-400 to-rose-500',
      bgColor: 'bg-pink-100',
      borderColor: 'border-pink-300'
    }
  ];

  const handleGameModeSelect = (mode: GameMode) => {
    setSelectedGameMode(mode);
    if (mode === 'quiz') {
      setGameState('difficulty');
    } else if (mode === 'memory') {
      setGameState('memory_game');
    } else if (mode === 'rhythm') {
      setGameState('rhythm_game');
    } else if (mode === 'trivia') {
      setGameState('trivia_cards');
    } else if (mode === 'instruments') {
      setGameState('instruments_tutorial');
    } else if (mode === 'teams') {
      setGameState('team_maker');
    } else if (mode === 'friends') {
      setGameState('friends_trivia');
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
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-5xl font-fredoka font-bold text-purple-600 mb-2 text-kid-glow">
            Welcome, {userName}! 🌟
          </h1>
          <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
            Choose Your Adventure!
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-lg text-gray-700 mb-12 max-w-2xl mx-auto leading-relaxed font-nunito"
        >
          What would you like to play today? Each game offers unique K-pop fun and challenges!
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {gameModes.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => handleGameModeSelect(mode.id)}
                className={`w-full p-6 ${mode.bgColor} ${mode.borderColor} border-3 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 text-left group`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`text-4xl md:text-5xl p-3 bg-gradient-to-r ${mode.color} rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl md:text-2xl font-fredoka font-bold text-gray-800 mb-2">
                      {mode.title}
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed font-nunito">
                      {mode.description}
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="mt-12"
        >
          <button
            onClick={() => setGameState('welcome')}
            className="btn-kid-secondary font-fredoka text-lg"
          >
            ← Back to Welcome
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default GameModeSelection;
