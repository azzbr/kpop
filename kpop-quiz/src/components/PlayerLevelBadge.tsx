import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore, getLevel, xpToNextLevel, LEVEL_NAMES } from '../store';

const LEVEL_COLORS = [
  'from-gray-400 to-gray-500',
  'from-green-400 to-emerald-500',
  'from-blue-400 to-cyan-500',
  'from-purple-400 to-violet-500',
  'from-yellow-400 to-orange-500',
  'from-pink-400 to-rose-500',
  'from-yellow-300 to-yellow-500',
];

const PlayerLevelBadge: React.FC = () => {
  const { xp, userName, huntrxUnlocked } = useGameStore();
  const level = getLevel(xp);
  const { current, needed } = xpToNextLevel(xp);
  const pct = Math.min((current / needed) * 100, 100);
  const isMaxLevel = level >= LEVEL_NAMES.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white rounded-2xl px-4 py-3 shadow-lg border-2 flex items-center gap-3 max-w-sm mx-auto mb-6 ${
        huntrxUnlocked ? 'border-yellow-400' : 'border-purple-200'
      }`}
    >
      <div className={`relative bg-gradient-to-r ${LEVEL_COLORS[level]} rounded-xl w-12 h-12 flex items-center justify-center text-white font-fredoka font-bold text-xl shadow-md flex-shrink-0`}>
        {level}
        {huntrxUnlocked && (
          <span className="absolute -top-3 -right-2 text-xl drop-shadow" title="HUNTR/X Superstar">👑</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-fredoka font-bold text-gray-800 truncate">
          {userName || 'Player'} · <span className="text-purple-600">{LEVEL_NAMES[level]}</span>
          {huntrxUnlocked && <span className="text-yellow-500"> · SUPERSTAR</span>}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-2 rounded-full bg-gradient-to-r ${LEVEL_COLORS[level]}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
          <span className="text-xs font-nunito text-gray-400 flex-shrink-0">
            {isMaxLevel ? '⭐ MAX' : `${xp} XP`}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default PlayerLevelBadge;
