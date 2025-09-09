import React from 'react';
import type { Badge as BadgeType } from '../store';

interface BadgeProps {
  badge: BadgeType;
  isEarned: boolean;
}

const Badge: React.FC<BadgeProps> = ({ badge, isEarned }) => {
  return (
    <div
      className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
        isEarned
          ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-purple-300 shadow-lg shadow-purple-500/25'
          : 'bg-gray-100 border-gray-300 opacity-60'
      }`}
    >
      <div className="text-center">
        <div className={`text-4xl mb-2 ${isEarned ? '' : 'grayscale'}`}>
          {badge.icon}
        </div>
        <h3 className={`font-bold text-sm mb-1 ${isEarned ? 'text-white' : 'text-gray-500'}`}>
          {badge.name}
        </h3>
        <p className={`text-xs leading-tight ${isEarned ? 'text-purple-100' : 'text-gray-400'}`}>
          {badge.description}
        </p>
      </div>

      {!isEarned && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-20 rounded-xl flex items-center justify-center">
          <div className="text-white text-xs font-bold bg-gray-800 bg-opacity-80 px-2 py-1 rounded">
            🔒 Locked
          </div>
        </div>
      )}
    </div>
  );
};

export default Badge;
