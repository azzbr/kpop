import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import BadgeGallery from './BadgeGallery';

const ResultScreen: React.FC = () => {
  const { userName, score, questions, hunterProfile, resetGame, earnedBadges, badges } = useGameStore();
  const [showBadges, setShowBadges] = useState(false);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const isSuccess = score === questions.length;
  const percentage = Math.round((score / questions.length) * 100);

  useEffect(() => {
    // Check for newly earned badges
    const previousBadges = JSON.parse(localStorage.getItem('previousBadges') || '[]');
    const currentBadges = earnedBadges;
    const newlyEarned = currentBadges.filter(badge => !previousBadges.includes(badge));
    
    if (newlyEarned.length > 0) {
      setNewBadges(newlyEarned);
      // Show badge notification after a delay
      setTimeout(() => {
        // Badge unlock notification would go here
      }, 1500);
    }
    
    // Update localStorage with current badges
    localStorage.setItem('previousBadges', JSON.stringify(currentBadges));
  }, [earnedBadges]);

  const handleRetry = () => {
    resetGame();
  };

  const handleViewBadges = () => {
    setShowBadges(true);
  };

  const handleCloseBadges = () => {
    setShowBadges(false);
  };

  if (showBadges) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-kid-pattern"
      >
        <div className="flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold text-purple-600">Your Achievements</h1>
          <button
            onClick={handleCloseBadges}
            className="text-purple-600 hover:text-purple-800 text-xl font-bold"
          >
            ✕ Back
          </button>
        </div>
        <BadgeGallery />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-kid-pattern"
    >
      <div className="max-w-2xl mx-auto w-full text-center">
        {isSuccess ? (
          // Success Screen
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, duration: 0.6, type: "spring", stiffness: 200 }}
              className="mb-6"
            >
              <span className="text-6xl">🎉</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-4xl md:text-6xl font-fredoka font-bold text-purple-600 mb-4 text-kid-glow"
            >
              Amazing Job, {userName}! 🌟
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="text-xl text-gray-700 mb-8 font-nunito"
            >
              You're a K-pop superstar! You've mastered all the questions! 🎊
            </motion.p>

            {/* K-pop Star ID Card */}
            {hunterProfile && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="card-kid p-8 mb-8 border-2 border-pink-300"
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-fredoka font-bold text-purple-600 mb-2">
                    K-POP STAR ID CARD ✨
                  </h2>
                  <div className="w-24 h-1 bg-gradient-to-r from-pink-400 to-purple-500 mx-auto rounded-full"></div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Profile Image */}
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: [0, -2, 2, 0] }}
                    className="flex-shrink-0"
                  >
                    <img
                      src={hunterProfile.imageUrl}
                      alt={hunterProfile.name}
                      className="w-32 h-32 rounded-full border-4 border-pink-400 shadow-lg object-cover"
                    />
                  </motion.div>

                  {/* Profile Info */}
                  <div className="flex-1 text-left md:text-center">
                    <h3 className="text-2xl font-fredoka font-bold text-purple-600 mb-2">
                      {hunterProfile.name}
                    </h3>
                    <p className="text-lg text-pink-500 font-semibold mb-1 font-nunito">
                      {hunterProfile.group}
                    </p>
                    <p className="text-sm text-purple-500 mb-3 font-nunito">
                      Stage Name: <span className="text-pink-500 font-bold">{hunterProfile.codename}</span>
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed font-nunito">
                      {hunterProfile.specialAbility}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-purple-200">
                  <div className="flex justify-between items-center text-sm font-nunito">
                    <span className="text-purple-600">Rank Achieved:</span>
                    <span className="text-pink-500 font-bold">SUPERSTAR ⭐</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2 font-nunito">
                    <span className="text-purple-600">Perfect Score:</span>
                    <span className="text-yellow-500 font-bold">{score}/{questions.length} ({percentage}%)</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.5 }}
                whileHover={{ scale: 1.1, rotate: [0, -2, 2, 0] }}
                whileTap={{ scale: 0.9 }}
                onClick={handleViewBadges}
                className="btn-kid font-fredoka bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600"
              >
                View Badges! 🏆
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                whileHover={{ scale: 1.1, rotate: [0, -2, 2, 0] }}
                whileTap={{ scale: 0.9 }}
                onClick={handleRetry}
                className="btn-kid font-fredoka"
              >
                Play Again! 🎮
              </motion.button>
            </div>
          </motion.div>
        ) : (
          // Keep Trying Screen
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, duration: 0.6, type: "spring", stiffness: 200 }}
              className="mb-6"
            >
              <span className="text-6xl">💪</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-4xl md:text-6xl font-fredoka font-bold text-blue-600 mb-4 text-kid-glow"
            >
              Great Try, {userName}! 🌈
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="text-xl text-gray-700 mb-8 font-nunito"
            >
              You're getting better every time! Keep practicing! 📚
            </motion.p>

            {/* K-pop Star ID Card for non-perfect scores */}
            {hunterProfile && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="card-kid p-8 mb-8 border-2 border-blue-300"
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-fredoka font-bold text-blue-600 mb-2">
                    K-POP STAR ID CARD ✨
                  </h2>
                  <div className="w-24 h-1 bg-gradient-to-r from-blue-400 to-purple-500 mx-auto rounded-full"></div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Profile Image */}
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: [0, -2, 2, 0] }}
                    className="flex-shrink-0"
                  >
                    <img
                      src={hunterProfile.imageUrl}
                      alt={hunterProfile.name}
                      className="w-32 h-32 rounded-full border-4 border-blue-400 shadow-lg object-cover"
                    />
                  </motion.div>

                  {/* Profile Info */}
                  <div className="flex-1 text-left md:text-center">
                    <h3 className="text-2xl font-fredoka font-bold text-blue-600 mb-2">
                      {hunterProfile.name}
                    </h3>
                    <p className="text-lg text-blue-500 font-semibold mb-1 font-nunito">
                      {hunterProfile.group}
                    </p>
                    <p className="text-sm text-purple-500 mb-3 font-nunito">
                      Stage Name: <span className="text-blue-500 font-bold">{hunterProfile.codename}</span>
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed font-nunito">
                      {hunterProfile.specialAbility}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-blue-200">
                  <div className="flex justify-between items-center text-sm font-nunito">
                    <span className="text-blue-600">Your Score:</span>
                    <span className="text-yellow-500 font-bold">{score}/{questions.length} ({percentage}%)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2 font-nunito">
                    <span className="text-blue-600">Keep Practicing:</span>
                    <span className="text-blue-500 font-bold">You're Improving! 💪</span>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              className="text-purple-600 mb-8 max-w-md mx-auto font-nunito"
            >
              Don't worry! Every K-pop superstar started as a beginner.
              Practice makes perfect! You've got this! 💫
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              whileHover={{ scale: 1.1, rotate: [0, -2, 2, 0] }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRetry}
              className="btn-kid font-fredoka"
            >
              Try Again! 🚀
            </motion.button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default ResultScreen;
