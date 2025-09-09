import React from 'react';
import { useGameStore } from '../store';
import type { DailyChallengeType } from '../store';

const DailyChallenge: React.FC = () => {
  const {
    dailyChallengeType,
    dailyChallengeCompleted,
    dailyStreak,
    initializeDailyChallenge
  } = useGameStore();

  React.useEffect(() => {
    initializeDailyChallenge();
  }, [initializeDailyChallenge]);

  const getChallengeInfo = (type: DailyChallengeType) => {
    switch (type) {
      case 'speed':
        return {
          title: '⚡ Speed Challenge',
          description: 'Complete quiz in under 2 minutes!',
          icon: '🏃‍♀️'
        };
      case 'music':
        return {
          title: '🎵 Music Challenge',
          description: 'Answer questions while listening to music!',
          icon: '🎧'
        };
      case 'streak':
        return {
          title: '🔥 Streak Challenge',
          description: 'Get 5 correct answers in a row!',
          icon: '🎯'
        };
      default:
        return {
          title: '📚 Daily Quiz',
          description: 'Complete today\'s quiz challenge!',
          icon: '📝'
        };
    }
  };

  const challengeInfo = getChallengeInfo(dailyChallengeType);

  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-xl shadow-lg mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{challengeInfo.icon}</span>
          <div>
            <h3 className="font-bold text-lg">{challengeInfo.title}</h3>
            <p className="text-purple-100 text-sm">{challengeInfo.description}</p>
          </div>
        </div>

        <div className="text-right">
          {dailyChallengeCompleted ? (
            <div className="flex items-center space-x-2">
              <span className="text-2xl">✅</span>
              <span className="text-sm font-medium">Completed!</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-2xl">⏳</span>
              <span className="text-sm font-medium">Pending</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm">🔥</span>
          <span className="text-sm font-medium">
            {dailyStreak} day streak
          </span>
        </div>

        {dailyStreak > 0 && (
          <div className="text-xs text-purple-200">
            Keep it up! 🎉
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyChallenge;
