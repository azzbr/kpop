import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, getLevel, xpToNextLevel, LEVEL_NAMES, LEVEL_THRESHOLDS } from '../store';
import { playClick } from '../utils/sounds';

const THEME_INFO: Record<string, { name: string; icon: string; desc: string; unlockLevel: number }> = {
  default: { name: 'Classic', icon: '🌸', desc: 'The original K-Pop pink!', unlockLevel: 0 },
  neon: { name: 'Neon', icon: '💜', desc: 'Electric purple vibes', unlockLevel: 2 },
  ocean: { name: 'Ocean', icon: '🌊', desc: 'Cool blue waves', unlockLevel: 3 },
  forest: { name: 'Forest', icon: '🌿', desc: 'Fresh green energy', unlockLevel: 4 },
  sunset: { name: 'Sunset', icon: '🌅', desc: 'Warm orange glow', unlockLevel: 4 },
  galaxy: { name: 'Galaxy', icon: '🌌', desc: 'Cosmic superstar', unlockLevel: 5 },
};

const STAT_ITEMS = [
  { key: 'kpop_xp', label: 'Total XP', icon: '⚡', format: (v: string) => `${parseInt(v) || 0} XP` },
  { key: 'simon_best', label: 'Simon Best Round', icon: '🧠', format: (v: string) => `Round ${v || '0'}` },
  { key: 'zip_best', label: 'Zip Puzzles', icon: '🔗', format: (v: string) => { try { return `${Object.keys(JSON.parse(v || '{}')).length} sizes beaten`; } catch { return '0 sizes'; } } },
  { key: 'kpop_dates_played', label: 'Days Played', icon: '🔥', format: (v: string) => { try { return `${JSON.parse(v || '[]').length} days`; } catch { return '0 days'; } } },
];

const TABS = ['🏅 Overview', '🎨 Themes', '📊 Stats'];

const AchievementShowcase: React.FC = () => {
  const { setGameState, xp, huntrxUnlocked, currentTheme } = useGameStore();
  const [tab, setTab] = useState(0);
  const level = getLevel(xp);
  const { current, needed } = xpToNextLevel(xp);
  const pct = Math.min((current / needed) * 100, 100);
  const isMax = level >= LEVEL_NAMES.length - 1;

  const LEVEL_COLORS = [
    'from-gray-400 to-gray-500',
    'from-green-400 to-emerald-500',
    'from-blue-400 to-cyan-500',
    'from-purple-400 to-violet-500',
    'from-yellow-400 to-orange-500',
    'from-pink-400 to-rose-500',
    'from-yellow-300 to-yellow-500',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-4">
          <div className="text-5xl mb-1">🏆</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow">Trophy Room</h1>
          <p className="font-nunito text-gray-500 text-sm">All your awesome achievements!</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-white rounded-2xl p-1 shadow border-2 border-purple-100">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => { playClick(); setTab(i); }}
              className={`flex-1 py-2 rounded-xl font-fredoka text-sm transition-colors ${
                tab === i ? 'bg-purple-500 text-white' : 'text-gray-500 hover:bg-purple-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === 0 && (
          <div className="space-y-4">
            {/* Level card */}
            <div className={`bg-white rounded-3xl p-5 shadow-xl border-2 ${huntrxUnlocked ? 'border-yellow-400' : 'border-purple-200'}`}>
              <div className="flex items-center gap-4">
                <div className={`relative bg-gradient-to-r ${LEVEL_COLORS[level]} rounded-2xl w-16 h-16 flex items-center justify-center text-white font-fredoka font-bold text-3xl shadow-lg`}>
                  {level}
                  {huntrxUnlocked && <span className="absolute -top-3 -right-2 text-2xl">👑</span>}
                </div>
                <div className="flex-1">
                  <p className="font-fredoka font-bold text-gray-800 text-lg">{LEVEL_NAMES[level]}</p>
                  {huntrxUnlocked && <p className="font-fredoka text-yellow-500 text-sm">✨ HUNTR/X SUPERSTAR</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <motion.div
                        className={`h-3 rounded-full bg-gradient-to-r ${LEVEL_COLORS[level]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                    <span className="font-nunito text-xs text-gray-400">{isMax ? '⭐ MAX' : `${xp} XP`}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Level roadmap */}
            <div className="bg-white rounded-2xl p-4 shadow border-2 border-purple-100">
              <h3 className="font-fredoka font-bold text-purple-600 mb-3">Level Journey</h3>
              <div className="space-y-2">
                {LEVEL_NAMES.map((name, i) => (
                  <div key={name} className={`flex items-center gap-3 p-2 rounded-xl ${i === level ? 'bg-purple-50 border-2 border-purple-300' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-fredoka font-bold text-sm bg-gradient-to-r ${LEVEL_COLORS[i]} ${xp >= LEVEL_THRESHOLDS[i] ? '' : 'opacity-40'}`}>
                      {xp >= LEVEL_THRESHOLDS[i] ? i : '🔒'}
                    </div>
                    <div className="flex-1">
                      <span className={`font-fredoka ${xp >= LEVEL_THRESHOLDS[i] ? 'text-gray-700' : 'text-gray-300'}`}>{name}</span>
                    </div>
                    <span className="font-nunito text-xs text-gray-400">{LEVEL_THRESHOLDS[i]} XP</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Themes tab */}
        {tab === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(THEME_INFO).map(([id, info]) => {
              const unlocked = huntrxUnlocked || level >= info.unlockLevel;
              const active = currentTheme === id;
              return (
                <motion.div
                  key={id}
                  whileTap={{ scale: 0.97 }}
                  className={`bg-white rounded-2xl p-4 shadow border-2 text-center relative overflow-hidden ${
                    active ? 'border-purple-500 bg-purple-50' : unlocked ? 'border-purple-100' : 'border-gray-200'
                  }`}
                >
                  {active && <div className="absolute top-2 right-2 text-xs font-fredoka text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">Active</div>}
                  <div className="text-3xl mb-1">{info.icon}</div>
                  <p className={`font-fredoka font-bold ${unlocked ? 'text-gray-800' : 'text-gray-400'}`}>{info.name}</p>
                  <p className="font-nunito text-xs text-gray-400 mt-0.5">{info.desc}</p>
                  {!unlocked && (
                    <div className="mt-2 bg-gray-100 rounded-lg px-2 py-1">
                      <span className="font-nunito text-xs text-gray-500">🔒 Level {info.unlockLevel}</span>
                    </div>
                  )}
                  {unlocked && !active && (
                    <div className="mt-2 bg-green-100 rounded-lg px-2 py-1">
                      <span className="font-nunito text-xs text-green-600">✅ Unlocked</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
            {huntrxUnlocked && (
              <div className="col-span-2 bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-3 text-center">
                <p className="font-fredoka text-yellow-700">👑 HUNTR/X Superstar — all themes unlocked!</p>
              </div>
            )}
          </div>
        )}

        {/* Stats tab */}
        {tab === 2 && (
          <div className="space-y-3">
            {STAT_ITEMS.map(item => {
              const raw = localStorage.getItem(item.key) || '';
              return (
                <div key={item.key} className="bg-white rounded-2xl px-4 py-3 shadow border-2 border-purple-100 flex items-center gap-3">
                  <div className="text-3xl">{item.icon}</div>
                  <div>
                    <p className="font-nunito text-gray-500 text-sm">{item.label}</p>
                    <p className="font-fredoka font-bold text-gray-800 text-lg">{item.format(raw)}</p>
                  </div>
                </div>
              );
            })}
            <div className="bg-white rounded-2xl px-4 py-3 shadow border-2 border-purple-100 flex items-center gap-3">
              <div className="text-3xl">🎯</div>
              <div>
                <p className="font-nunito text-gray-500 text-sm">Current Theme</p>
                <p className="font-fredoka font-bold text-gray-800 text-lg">
                  {THEME_INFO[currentTheme]?.icon} {THEME_INFO[currentTheme]?.name || 'Classic'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AchievementShowcase;
