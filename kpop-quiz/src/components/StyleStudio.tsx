import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playWin, playUnlock } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const MODELS = ['👩', '🧑‍🎤', '👸', '🦸‍♀️', '🧚‍♀️', '👩‍🎤', '🧙‍♀️', '👩‍🦰', '👩‍🦱'];
const HATS = ['—', '👑', '🎀', '🎩', '👒', '🧢', '⛑️', '🪖', '🎓'];
const OUTFITS = ['👗', '👘', '🥻', '👚', '👕', '🎽', '🥋', '🦺', '🥼'];
const SHOES = ['👠', '👟', '🥿', '👢', '🩴', '🥾', '🩰', '👞'];
const ACCESSORIES = ['—', '✨', '💎', '🌹', '🎤', '⭐', '💖', '🎁', '🪄', '🌸', '🦋', '🍭'];
const BACKDROPS = [
  { name: 'Sunset',  grad: 'from-orange-200 via-pink-200 to-purple-300' },
  { name: 'Beach',   grad: 'from-sky-200 via-cyan-200 to-yellow-200' },
  { name: 'Stage',   grad: 'from-purple-900 via-fuchsia-700 to-pink-600' },
  { name: 'Garden',  grad: 'from-green-200 via-emerald-200 to-pink-200' },
  { name: 'Galaxy',  grad: 'from-indigo-900 via-purple-800 to-fuchsia-700' },
  { name: 'Cafe',    grad: 'from-amber-100 via-orange-200 to-rose-200' },
];

// "Vibe" themed combos that grant bonus
const VIBES: { name: string; emoji: string; check: (s: Look) => boolean; bonus: number }[] = [
  { name: 'Royal', emoji: '👑', check: s => s.hat === '👑' && (s.outfit === '👗' || s.outfit === '👘'), bonus: 30 },
  { name: 'Stage Idol', emoji: '🎤', check: s => s.accessory === '🎤' && s.bg === 2, bonus: 35 },
  { name: 'Galaxy Hero', emoji: '🦸‍♀️', check: s => s.model === '🦸‍♀️' && s.bg === 4, bonus: 30 },
  { name: 'Beach Babe', emoji: '🌺', check: s => s.shoes === '🩴' && s.bg === 1, bonus: 25 },
  { name: 'Sparkle Fairy', emoji: '🧚‍♀️', check: s => s.model === '🧚‍♀️' && s.accessory === '✨', bonus: 30 },
  { name: 'Sweetheart', emoji: '💖', check: s => s.accessory === '💖' && (s.outfit === '👗' || s.outfit === '🥻'), bonus: 20 },
];

interface Look {
  model: string; hat: string; outfit: string; shoes: string; accessory: string; bg: number;
}

const defaultLook: Look = {
  model: MODELS[0], hat: HATS[0], outfit: OUTFITS[0], shoes: SHOES[0], accessory: ACCESSORIES[0], bg: 0,
};

const StyleStudio: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [look, setLook] = useState<Look>(defaultLook);
  const [savedLooks, setSavedLooks] = useState<Look[]>(() => {
    try { return JSON.parse(localStorage.getItem('style_looks') || '[]'); } catch { return []; }
  });
  const [tab, setTab] = useState<'design' | 'closet'>('design');
  const [strut, setStrut] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [vibeMatched, setVibeMatched] = useState<typeof VIBES[0] | null>(null);
  const [showVibePop, setShowVibePop] = useState(false);

  useEffect(() => {
    const match = VIBES.find(v => v.check(look));
    setVibeMatched(match || null);
  }, [look]);

  const cycle = (key: keyof Look, options: (string | number)[], dir: 1 | -1) => {
    playPop();
    setLook(l => {
      const cur = options.indexOf(l[key] as never);
      const next = (cur + dir + options.length) % options.length;
      return { ...l, [key]: options[next] };
    });
  };

  const randomize = () => {
    playClick();
    setLook({
      model: MODELS[Math.floor(Math.random() * MODELS.length)],
      hat: HATS[Math.floor(Math.random() * HATS.length)],
      outfit: OUTFITS[Math.floor(Math.random() * OUTFITS.length)],
      shoes: SHOES[Math.floor(Math.random() * SHOES.length)],
      accessory: ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)],
      bg: Math.floor(Math.random() * BACKDROPS.length),
    });
  };

  const saveLook = () => {
    const newLooks = [look, ...savedLooks].slice(0, 24);
    setSavedLooks(newLooks);
    localStorage.setItem('style_looks', JSON.stringify(newLooks));
    localStorage.setItem('style_saves', String(newLooks.length));
    playUnlock();
    addXP(10);
  };

  const doStrut = () => {
    playWin();
    setStrut(true);
    setConfetti(true);
    const bonus = vibeMatched ? vibeMatched.bonus : 0;
    addXP(20 + bonus);
    if (vibeMatched) { setShowVibePop(true); setTimeout(() => setShowVibePop(false), 1800); }
    setTimeout(() => { setStrut(false); setConfetti(false); }, 2800);
  };

  const renderModel = (lookData: Look, size: 'big' | 'small' = 'big') => {
    const isSmall = size === 'small';
    const bg = BACKDROPS[lookData.bg];
    return (
      <div className={`relative rounded-3xl overflow-hidden border-2 border-pink-300 shadow-inner bg-gradient-to-b ${bg.grad}`}
           style={{ width: isSmall ? 110 : '100%', height: isSmall ? 140 : 280 }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {lookData.hat !== '—' && (
            <div style={{ fontSize: isSmall ? 24 : 50, lineHeight: 1, marginBottom: -8 }}>{lookData.hat}</div>
          )}
          <div style={{ fontSize: isSmall ? 38 : 80, lineHeight: 1 }}>{lookData.model}</div>
          <div style={{ fontSize: isSmall ? 32 : 64, lineHeight: 1, marginTop: -6 }}>{lookData.outfit}</div>
          <div style={{ fontSize: isSmall ? 20 : 40, lineHeight: 1, marginTop: -4 }}>{lookData.shoes}</div>
        </div>
        {lookData.accessory !== '—' && (
          <div className="absolute" style={{ right: isSmall ? 6 : 14, bottom: isSmall ? 30 : 80, fontSize: isSmall ? 22 : 40 }}>
            {lookData.accessory}
          </div>
        )}
        {!isSmall && (
          <div className="absolute top-2 left-2 bg-white/70 px-2 py-0.5 rounded-full font-nunito text-xs text-pink-700">
            {bg.name}
          </div>
        )}
      </div>
    );
  };

  const slotPicker = (label: string, key: keyof Look, options: (string | number)[]) => (
    <div className="bg-white/70 border-2 border-pink-200 rounded-2xl p-2">
      <div className="text-xs font-fredoka text-pink-600 mb-1">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => cycle(key, options, -1)} className="w-8 h-8 bg-pink-200 hover:bg-pink-300 rounded-full font-fredoka text-pink-700 active:scale-95">◀</button>
        <div className="text-3xl">
          {key === 'bg' ? `🖼️` : look[key] === '—' ? <span className="text-pink-300 text-base">none</span> : (look[key] as string)}
        </div>
        <button onClick={() => cycle(key, options, 1)} className="w-8 h-8 bg-pink-200 hover:bg-pink-300 rounded-full font-fredoka text-pink-700 active:scale-95">▶</button>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center p-4"
      style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)' }}
    >
      {confetti && <ConfettiBurst count={80} durationMs={2800} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('girls_zone'); }}
          className="mb-3 px-4 py-2 bg-white/70 hover:bg-white text-pink-700 rounded-full font-fredoka text-sm border-2 border-pink-200">
          ← Girls Zone
        </button>

        <div className="text-center mb-3">
          <h1 className="text-3xl font-fredoka font-bold text-pink-700">👗 Style Studio</h1>
          <p className="font-nunito text-pink-500 text-sm">Mix, match & strut!</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-white/70 rounded-2xl p-1 border-2 border-pink-200">
          <button onClick={() => { playClick(); setTab('design'); }}
            className={`flex-1 py-2 rounded-xl font-fredoka text-sm ${tab === 'design' ? 'bg-pink-500 text-white' : 'text-pink-600'}`}>
            ✨ Design
          </button>
          <button onClick={() => { playClick(); setTab('closet'); }}
            className={`flex-1 py-2 rounded-xl font-fredoka text-sm ${tab === 'closet' ? 'bg-pink-500 text-white' : 'text-pink-600'}`}>
            👜 Closet ({savedLooks.length})
          </button>
        </div>

        {tab === 'design' && (
          <>
            {/* Preview */}
            <motion.div
              animate={strut ? { x: [0, 20, -20, 15, -15, 0], rotate: [0, -3, 3, -2, 2, 0] } : {}}
              transition={{ duration: 1.8 }}
              className="mb-3"
            >
              {renderModel(look)}
            </motion.div>

            {/* Vibe indicator */}
            <AnimatePresence>
              {vibeMatched && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-yellow-200 border-2 border-yellow-400 rounded-2xl p-2 text-center mb-3"
                >
                  <p className="font-fredoka font-bold text-yellow-800 text-sm">
                    ✨ VIBE MATCH: {vibeMatched.emoji} {vibeMatched.name}! +{vibeMatched.bonus} XP bonus on Strut!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slot pickers */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {slotPicker('Model', 'model', MODELS)}
              {slotPicker('Hat', 'hat', HATS)}
              {slotPicker('Outfit', 'outfit', OUTFITS)}
              {slotPicker('Shoes', 'shoes', SHOES)}
              {slotPicker('Accessory', 'accessory', ACCESSORIES)}
              <div className="bg-white/70 border-2 border-pink-200 rounded-2xl p-2">
                <div className="text-xs font-fredoka text-pink-600 mb-1">Backdrop</div>
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => { playPop(); setLook(l => ({ ...l, bg: (l.bg - 1 + BACKDROPS.length) % BACKDROPS.length })); }}
                    className="w-8 h-8 bg-pink-200 hover:bg-pink-300 rounded-full text-pink-700">◀</button>
                  <span className="font-fredoka text-pink-600 text-sm">{BACKDROPS[look.bg].name}</span>
                  <button onClick={() => { playPop(); setLook(l => ({ ...l, bg: (l.bg + 1) % BACKDROPS.length })); }}
                    className="w-8 h-8 bg-pink-200 hover:bg-pink-300 rounded-full text-pink-700">▶</button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button onClick={randomize} className="py-3 bg-purple-500 text-white rounded-2xl font-fredoka shadow active:scale-95">🎲 Random</button>
              <button onClick={() => { playClick(); saveLook(); }} className="py-3 bg-pink-500 text-white rounded-2xl font-fredoka shadow active:scale-95">💾 Save</button>
              <button onClick={doStrut} className="py-3 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white rounded-2xl font-fredoka font-bold shadow active:scale-95">💃 Strut!</button>
            </div>
          </>
        )}

        {tab === 'closet' && (
          <div>
            {savedLooks.length === 0 ? (
              <div className="bg-white/70 border-2 border-pink-200 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-2">👜</div>
                <p className="font-fredoka text-pink-700">Your closet is empty!</p>
                <p className="font-nunito text-pink-500 text-sm">Design and save looks to fill it up ✨</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {savedLooks.map((l, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setLook(l); setTab('design'); playPop(); }}
                    className="relative"
                  >
                    {renderModel(l, 'small')}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = savedLooks.filter((_, j) => j !== i);
                        setSavedLooks(next);
                        localStorage.setItem('style_looks', JSON.stringify(next));
                        localStorage.setItem('style_saves', String(next.length));
                        playClick();
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vibe pop */}
        <AnimatePresence>
          {showVibePop && vibeMatched && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            >
              <div className="bg-gradient-to-r from-yellow-300 to-pink-400 rounded-3xl p-6 shadow-2xl text-center border-4 border-yellow-500">
                <div className="text-6xl mb-2">{vibeMatched.emoji}</div>
                <p className="font-fredoka font-bold text-white text-2xl">{vibeMatched.name.toUpperCase()}!</p>
                <p className="font-fredoka text-white text-lg">+{vibeMatched.bonus} XP bonus!</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default StyleStudio;
