import React from 'react';
import { useGameStore } from '../store';
import Badge from './Badge';

const BadgeGallery: React.FC = () => {
  const { badges, earnedBadges } = useGameStore();

  const earnedCount = earnedBadges.length;
  const totalCount = badges.length;

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-purple-600 mb-2">🏆 Achievement Gallery</h2>
        <p className="text-gray-600">
          {earnedCount} of {totalCount} badges unlocked
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(earnedCount / totalCount) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {badges.map((badge) => (
          <Badge
            key={badge.id}
            badge={badge}
            isEarned={earnedBadges.includes(badge.id)}
          />
        ))}
      </div>

      {earnedCount === 0 && (
        <div className="text-center mt-8 p-6 bg-gray-50 rounded-xl">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Start Your Journey!</h3>
          <p className="text-gray-500">
            Complete quizzes and challenges to unlock your first badge!
          </p>
        </div>
      )}

      {earnedCount > 0 && earnedCount < totalCount && (
        <div className="text-center mt-8 p-6 bg-purple-50 rounded-xl">
          <div className="text-4xl mb-4">🚀</div>
          <h3 className="text-lg font-semibold text-purple-700 mb-2">Keep Going!</h3>
          <p className="text-purple-600">
            {totalCount - earnedCount} more badges to unlock!
          </p>
        </div>
      )}

      {earnedCount === totalCount && (
        <div className="text-center mt-8 p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl">
          <div className="text-6xl mb-4">👑</div>
          <h3 className="text-2xl font-bold mb-2">Achievement Master!</h3>
          <p className="text-purple-100">
            You've unlocked all badges! You're a true K-pop expert! 🎉
          </p>
        </div>
      )}
    </div>
  );
};

export default BadgeGallery;
