import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import type { Theme } from '../store';
import { LEVEL_THRESHOLDS, getLevel } from '../store';
import { playClick, playUnlock } from '../utils/sounds';

interface ThemeOption {
  id: Theme;
  name: string;
  emoji: string;
  preview: string;
  unlockLevel: number;
  description: string;
}

const THEMES: ThemeOption[] = [
  { id: 'default', name: 'K-Pop Pink', emoji: '🌸', preview: 'bg-gradient-to-r from-pink-400 to-purple-500', unlockLevel: 0, description: 'The classic look!' },
  { id: 'neon', name: 'Neon Night', emoji: '⚡', preview: 'bg-gradient-to-r from-cyan-400 to-fuchsia-500', unlockLevel: 1, description: 'Electric & bold!' },
  { id: 'ocean', name: 'Ocean Waves', emoji: '🌊', preview: 'bg-gradient-to-r from-blue-400 to-teal-500', unlockLevel: 2, description: 'Cool ocean vibes!' },
  { id: 'forest', name: 'Forest Magic', emoji: '🌿', preview: 'bg-gradient-to-r from-green-400 to-emerald-600', unlockLevel: 3, description: 'Earthy & fresh!' },
  { id: 'sunset', name: 'Sunset Glow', emoji: '🌅', preview: 'bg-gradient-to-r from-orange-400 to-rose-500', unlockLevel: 4, description: 'Warm golden hour!' },
  { id: 'galaxy', name: 'Galaxy Mode', emoji: '🌌', preview: 'bg-gradient-to-r from-indigo-600 to-violet-700', unlockLevel: 5, description: 'Out of this world!' },
];

const ThemeSwitcher: React.FC = () => {
  const { currentTheme, setTheme, xp } = useGameStore();
  const currentLevel = getLevel(xp);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  const handleSelect = (theme: ThemeOption) => {
    if (currentLevel < theme.unlockLevel) {
      playClick();
      return;
    }
    if (theme.id === currentTheme) return;
    playUnlock();
    setTheme(theme.id);
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-fredoka font-bold text-purple-700 mb-1 text-center">🎨 Theme Switcher</h3>
      <p className="text-sm font-nunito text-gray-500 text-center mb-4">Unlock new themes by leveling up!</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {THEMES.map((theme, i) => {
          const locked = currentLevel < theme.unlockLevel;
          const active = currentTheme === theme.id;
          return (
            <motion.button
              key={theme.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={!locked ? { scale: 1.05 } : {}}
              whileTap={!locked ? { scale: 0.95 } : {}}
              onClick={() => handleSelect(theme)}
              className={`relative rounded-2xl overflow-hidden border-4 transition-all duration-300 ${
                active ? 'border-yellow-400 shadow-xl' : locked ? 'border-gray-200 opacity-60' : 'border-white shadow-md hover:border-purple-300'
              }`}
            >
              <div className={`${theme.preview} p-4 flex flex-col items-center gap-1`}>
                <span className="text-3xl">{locked ? '🔒' : theme.emoji}</span>
                <span className="font-fredoka font-bold text-white text-sm drop-shadow">{theme.name}</span>
              </div>
              <div className="bg-white p-2 text-center">
                {locked ? (
                  <p className="text-xs font-nunito text-gray-500">
                    Level {theme.unlockLevel} needed
                    <br />
                    <span className="text-purple-500 font-bold">{LEVEL_THRESHOLDS[theme.unlockLevel]} XP</span>
                  </p>
                ) : (
                  <p className="text-xs font-nunito text-gray-500">{theme.description}</p>
                )}
              </div>
              {active && (
                <div className="absolute top-1 right-1 bg-yellow-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSwitcher;
