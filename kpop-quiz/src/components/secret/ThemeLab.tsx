import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, getLevel, LEVEL_NAMES, LEVEL_THRESHOLDS } from '../../store';
import type { Theme } from '../../store';
import { playClick, playUnlock } from '../../utils/sounds';

interface ThemeOption {
  id: Theme;
  name: string;
  emoji: string;
  /** XP level needed (same rules as the old ThemeSwitcher). */
  unlockLevel: number;
  description: string;
}

const THEMES: ThemeOption[] = [
  { id: 'default', name: 'Bubblegum', emoji: '🍬', unlockLevel: 0, description: 'The classic look!' },
  { id: 'neon', name: 'Neon Night', emoji: '⚡', unlockLevel: 1, description: 'Electric & bold!' },
  { id: 'ocean', name: 'Ocean Waves', emoji: '🌊', unlockLevel: 2, description: 'Cool ocean vibes!' },
  { id: 'forest', name: 'Forest Magic', emoji: '🌿', unlockLevel: 3, description: 'Earthy & fresh!' },
  { id: 'sunset', name: 'Sunset Glow', emoji: '🌅', unlockLevel: 4, description: 'Warm golden hour!' },
  { id: 'galaxy', name: 'Galaxy Mode', emoji: '🌌', unlockLevel: 5, description: 'Out of this world!' },
];

export default function ThemeLab() {
  const leaveSecret = useGameStore(s => s.leaveSecret);
  const currentTheme = useGameStore(s => s.currentTheme);
  const setTheme = useGameStore(s => s.setTheme);
  const xp = useGameStore(s => s.xp);
  const huntrxUnlocked = useGameStore(s => s.huntrxUnlocked);
  const level = getLevel(xp);
  const [hint, setHint] = useState<string | null>(null);
  // Seasonal events (e.g. Halloween) paint their night sky on the Bubblegum theme while they run.
  const [eventOn] = useState(() => typeof document !== 'undefined' && !!document.documentElement.dataset.event);

  const isLocked = (t: ThemeOption) => !huntrxUnlocked && level < t.unlockLevel;

  const pick = (t: ThemeOption) => {
    if (isLocked(t)) {
      playClick();
      const left = LEVEL_THRESHOLDS[t.unlockLevel] - xp;
      setHint(`${t.emoji} ${t.name} opens at level ${t.unlockLevel + 1} (${LEVEL_NAMES[t.unlockLevel]}). Only ${left} XP to go — keep playing!`);
      return;
    }
    setHint(null);
    if (t.id === currentTheme) { playClick(); return; }
    playUnlock();
    setTheme(t.id);
  };

  return (
    <div
      className="arcade-bg min-h-screen-d text-white px-4"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => { playClick(); leaveSecret(); }}
            className="min-h-[48px] min-w-[48px] px-4 rounded-full bg-white/15 active:bg-white/25 font-fredoka text-lg"
          >
            ← Back
          </button>
          <h1 className="font-fredoka text-3xl md:text-4xl">🎨 Theme Lab</h1>
        </div>
        <p className="font-nunito text-lg text-violet-100 mb-4">
          {huntrxUnlocked
            ? '👑 Superstar mode — every theme is unlocked!'
            : `Pick a look for your arcade. You're level ${level + 1} (${LEVEL_NAMES[level]}) — level up to unlock more!`}
        </p>

        {eventOn && (
          <p className="font-nunito text-base rounded-2xl bg-orange-500/20 border border-orange-300/40 px-4 py-3 mb-4">
            🎃 A seasonal event is on! Pick Bubblegum to see its special night sky.
          </p>
        )}

        {hint && (
          <motion.p
            key={hint}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="font-nunito text-lg rounded-2xl bg-amber-400/20 border border-amber-300/40 px-4 py-3 mb-4"
            role="status"
          >
            {hint}
          </motion.p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {THEMES.map((t, i) => {
            const locked = isLocked(t);
            const active = currentTheme === t.id;
            return (
              <motion.button
                key={t.id}
                data-theme-card={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => pick(t)}
                aria-pressed={active}
                className={`relative text-left rounded-3xl overflow-hidden border-4 transition-colors ${
                  active ? 'border-yellow-300 shadow-xl shadow-yellow-300/20' : 'border-white/15'
                }`}
              >
                {/* Live preview: the real arcade backdrop for this theme (vars set by data-theme in index.css). */}
                <div data-theme={t.id}>
                  <div className={`theme-swatch h-[130px] flex flex-col items-center justify-center gap-1 ${locked ? 'opacity-50' : ''}`}>
                    <span className="text-5xl">{locked ? '🔒' : t.emoji}</span>
                    <span className="flex gap-1.5 mt-1" aria-hidden>
                      <span className="w-8 h-3 rounded-full bg-white/25" />
                      <span className="w-5 h-3 rounded-full bg-white/15" />
                      <span className="w-6 h-3 rounded-full bg-white/20" />
                    </span>
                  </div>
                </div>
                <div className="bg-black/30 px-3 py-3 min-h-[76px]">
                  <div className="font-fredoka text-xl leading-tight">{t.name}</div>
                  <div className="font-nunito text-base text-violet-100">
                    {locked ? `🔒 Unlock at level ${t.unlockLevel + 1}` : active ? '✅ Using now' : t.description}
                  </div>
                </div>
                {active && (
                  <div className="absolute top-2 right-2 bg-yellow-300 text-indigo-900 rounded-full w-9 h-9 flex items-center justify-center font-fredoka text-lg">
                    ✓
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
