import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

const AppStatsDashboard: React.FC = () => {
  const {
    totalQuizzesCompleted,
    totalCorrectAnswers,
    earnedBadges,
    badges,
    secretStats,
    songsListened
  } = useGameStore();

  const stats = [
    {
      label: 'Drawings Created',
      value: secretStats.drawingsCreated,
      icon: '🎨',
      color: 'from-purple-400 to-pink-500',
      description: 'Artworks made in Creative Corner'
    },
    {
      label: 'Bubbles Popped',
      value: secretStats.bubblesPopped,
      icon: '🫧',
      color: 'from-blue-400 to-cyan-500',
      description: 'Bubbles popped in game paradise'
    },
    {
      label: 'Quizzes Completed',
      value: totalQuizzesCompleted,
      icon: '🧠',
      color: 'from-green-400 to-emerald-500',
      description: 'K-pop knowledge tests passed'
    },
    {
      label: 'Correct Answers',
      value: totalCorrectAnswers,
      icon: '✅',
      color: 'from-yellow-400 to-orange-500',
      description: 'Questions answered correctly'
    },
    {
      label: 'Songs Listened',
      value: songsListened,
      icon: '🎵',
      color: 'from-pink-400 to-rose-500',
      description: 'K-pop tracks enjoyed'
    },
    {
      label: 'Stickers Placed',
      value: secretStats.treasureFound, // Using treasureFound as general interaction counter for now
      icon: '🖼️',
      color: 'from-indigo-400 to-purple-500',
      description: 'Decorations added to drawings'
    }
  ];

  const totalScore = stats.reduce((sum, stat) => sum + stat.value, 0);
  const unlockedBadges = earnedBadges.length;
  const totalBadges = badges.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="text-5xl mb-4"
        >
          📊
        </motion.div>
        <h3 className="text-2xl font-fredoka font-bold text-purple-600 mb-2">
          Your K-Pop Adventure Stats! 🌟
        </h3>
        <p className="text-sm font-nunito text-gray-600">
          See how amazing you've become at K-pop and creativity!
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-gradient-to-br from-yellow-400 to-orange-500 p-4 rounded-xl text-center shadow-lg"
        >
          <div className="text-3xl font-bold text-white">{totalScore}</div>
          <div className="text-sm text-white font-semibold">Total Score</div>
          <div className="text-xs text-yellow-100 mt-1">All Activities</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-gradient-to-br from-green-400 to-emerald-500 p-4 rounded-xl text-center shadow-lg"
        >
          <div className="text-3xl font-bold text-white">{unlockedBadges}</div>
          <div className="text-sm text-white font-semibold">Badges Earned</div>
          <div className="text-xs text-green-100 mt-1">Out of {totalBadges}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-gradient-to-br from-blue-400 to-cyan-500 p-4 rounded-xl text-center shadow-lg"
        >
          <div className="text-3xl font-bold text-white">
            {Math.round(totalCorrectAnswers / Math.max(totalQuizzesCompleted * 5, 1) * 100) || 0}%
          </div>
          <div className="text-sm text-white font-semibold">Avg Score</div>
          <div className="text-xs text-blue-100 mt-1">Quiz Performance</div>
        </motion.div>
      </div>

      {/* Detailed Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
            className={`bg-gradient-to-br ${stat.color} p-4 rounded-xl shadow-lg relative overflow-hidden`}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 text-6xl transform rotate-12">
                {stat.icon}
              </div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{stat.icon}</span>
                <span className="text-3xl font-bold text-white">{stat.value}</span>
              </div>
              <div className="text-white font-semibold text-lg mb-1">{stat.label}</div>
              <div className="text-sm text-blue-100">{stat.description}</div>

              {/* Progress Bar */}
              <div className="mt-3 bg-white bg-opacity-30 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stat.value / 50) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 0.7 + index * 0.1, ease: "easeOut" }}
                  className="bg-white h-2 rounded-full"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Achievements Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="bg-white rounded-xl p-6 border-2 border-purple-200 shadow-lg"
      >
        <h4 className="text-xl font-fredoka font-bold text-purple-600 mb-4 text-center">
          🏆 Your Achievements
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {earnedBadges.slice(0, 8).map((badgeId, index) => {
            const badge = badges.find(b => b.id === badgeId);
            if (!badge) return null;

            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.9 + index * 0.1 }}
                className="bg-gradient-to-br from-yellow-300 to-yellow-500 p-3 rounded-lg text-center shadow-md"
              >
                <div className="text-2xl mb-1">{badge.icon}</div>
                <div className="text-xs font-bold text-gray-800">{badge.name}</div>
              </motion.div>
            );
          })}

          {earnedBadges.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full text-center py-8"
            >
              <div className="text-4xl mb-2">🎯</div>
              <p className="text-gray-600 font-nunito">Complete quizzes and games to earn badges!</p>
            </motion.div>
          )}
        </div>

        {earnedBadges.length > 0 && (
          <div className="text-center mt-4">
            <p className="text-sm text-purple-600 font-nunito">
              You've earned {earnedBadges.length} badge{earnedBadges.length !== 1 ? 's' : ''}!
              Keep playing to unlock more! ✨
            </p>
          </div>
        )}
      </motion.div>

      {/* Fun Facts Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="bg-gradient-to-br from-pink-100 to-purple-100 p-6 rounded-xl border-2 border-pink-200"
      >
        <h4 className="text-xl font-fredoka font-bold text-pink-600 mb-4 text-center">
          🎉 Fun Facts About You!
        </h4>

        <div className="space-y-3">
          {totalScore > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-3 p-3 bg-white bg-opacity-50 rounded-lg"
            >
              <span className="text-2xl">🎨</span>
              <span className="font-nunito text-gray-800">
                You're a {totalScore < 50 ? 'Budding' : totalScore < 200 ? 'Growing' : 'Master'} K-pop explorer!
              </span>
            </motion.div>
          )}

          {secretStats.drawingsCreated > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center space-x-3 p-3 bg-white bg-opacity-50 rounded-lg"
            >
              <span className="text-2xl">🎭</span>
              <span className="font-nunito text-gray-800">
                {secretStats.drawingsCreated === 1
                  ? "You've created your first masterpiece!"
                  : `You've made ${secretStats.drawingsCreated} creative drawings!`}
              </span>
            </motion.div>
          )}

          {secretStats.bubblesPopped > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center space-x-3 p-3 bg-white bg-opacity-50 rounded-lg"
            >
              <span className="text-2xl">🫧</span>
              <span className="font-nunito text-gray-800">
                {secretStats.bubblesPopped < 10
                  ? "You're getting the hang of popping bubbles!"
                  : `Bubble master! ${secretStats.bubblesPopped} bubbles defeated!`}
              </span>
            </motion.div>
          )}

          {totalCorrectAnswers > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center space-x-3 p-3 bg-white bg-opacity-50 rounded-lg"
            >
              <span className="text-2xl">🧠</span>
              <span className="font-nunito text-gray-800">
                {totalCorrectAnswers === 1
                  ? "You got your first correct answer - great start!"
                  : `K-pop expert! ${totalCorrectAnswers} questions answered correctly!`}
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Encouragement Message */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="text-center py-4"
      >
        <p className="text-lg font-fredoka text-purple-600">
          Keep exploring and creating - your adventure is just getting started! 🚀
        </p>
      </motion.div>
    </div>
  );
};

export default AppStatsDashboard;
