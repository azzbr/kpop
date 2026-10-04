import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { LOCKER_ITEMS, ownsItem } from '../data/lockerItems';
import { eventLockerItems, isRewardOnly } from '../events/events';
import { localDateKey } from '../utils/dates';
import type { LockerItem, LockerKind } from '../data/lockerItems';
import { playClick, playWrong, playUnlock } from '../utils/sounds';
import { useSafeTimeout } from '../utils/useSafeTimeout';

const TABS: { id: LockerKind | 'theme'; label: string }[] = [
  { id: 'avatar', label: '😎 Avatars' },
  { id: 'color', label: '🎨 Colours' },
  { id: 'trail', label: '✨ Trails' },
  { id: 'title', label: '🏷️ Titles' },
  { id: 'theme', label: '🌈 Themes' },
  { id: 'sticker', label: '🖼️ Stickers' },
];

const SLOT: Partial<Record<LockerKind, 'avatar' | 'color' | 'trail' | 'title'>> = { avatar: 'avatar', color: 'color', trail: 'trail', title: 'title' };

export default function Locker() {
  const { userCurrency, inventory, equipped, buyItem, equip, setGameState, userName } = useGameStore();
  const [tab, setTab] = useState<LockerKind | 'theme'>('avatar');
  const [toast, setToast] = useState<string | null>(null);
  const later = useSafeTimeout();

  const say = (msg: string) => { setToast(msg); later(() => setToast(null), 2200); };

  const tap = (item: LockerItem) => {
    const slot = SLOT[item.kind];
    if (ownsItem(inventory, item)) {
      if (slot) { playClick(); equip({ [slot]: item.value }); say(`Equipped ${item.emoji} ${item.name}!`); }
      return;
    }
    if (isRewardOnly(item.id)) { playWrong(); say('Find all 31 pumpkins 🎃 to earn this one!'); return; }
    if (userCurrency < item.price) { playWrong(); say(`You need ${item.price - userCurrency} more coins — play some games! 🪙`); return; }
    if (buyItem(item.id, item.price)) {
      playUnlock();
      if (slot) equip({ [slot]: item.value });
      say(`Unlocked ${item.emoji} ${item.name}!`);
    }
  };

  const isEquipped = (item: LockerItem) => {
    const slot = SLOT[item.kind];
    return !!slot && equipped[slot] === item.value;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="arcade-bg min-h-screen-d text-white px-4 py-5">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { playClick(); setGameState('game_mode'); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
          <h1 className="font-fredoka text-3xl flex-1">🎒 Locker</h1>
          <span className="rounded-full bg-yellow-400 text-stone-900 font-fredoka text-xl px-4 py-2">🪙 {userCurrency}</span>
        </div>

        {/* Preview */}
        <div className="rounded-3xl bg-white/10 p-4 mb-4 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl border-4 border-white" style={{ background: equipped.color }}>
            {equipped.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-fredoka text-2xl truncate">{userName || 'Player'}</div>
            {equipped.title && <div className="font-nunito text-lg text-yellow-300">{equipped.title}</div>}
            <div className="font-nunito text-base text-violet-200">Trail: {equipped.trail ? `${equipped.trail}${equipped.trail}${equipped.trail}` : 'none'}</div>
          </div>
          <p className="hidden sm:block font-nunito text-sm text-violet-300 max-w-[200px]">Your look shows up in Paper Clash, Snake Arena and Friends Arena.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { playClick(); setTab(t.id); }}
              className={`min-h-[48px] px-4 rounded-full font-fredoka text-lg ${tab === t.id ? 'bg-fuchsia-500' : 'bg-white/10'}`}>{t.label}</button>
          ))}
        </div>

        {tab === 'theme' ? (
          <div className="rounded-3xl bg-white/10 p-6 text-center">
            <div className="text-5xl mb-2">🌈</div>
            <p className="font-nunito text-lg text-violet-100 mb-4">Themes change the colours of the whole arcade.</p>
            <button onClick={() => { playClick(); useGameStore.getState().openSecret('theme_lab', 'locker'); }}
              className="min-h-[56px] px-8 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-xl">Open the Theme Lab</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...LOCKER_ITEMS, ...eventLockerItems(localDateKey(), inventory)].filter(i => i.kind === tab).map(item => {
              const owned = ownsItem(inventory, item);
              const on = isEquipped(item);
              return (
                <motion.button key={item.id} whileTap={{ scale: 0.95 }} onClick={() => tap(item)}
                  className={`rounded-2xl p-3 min-h-[120px] flex flex-col items-center justify-center gap-1 border-2
                    ${on ? 'border-yellow-300 bg-yellow-400/20' : owned ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/20'}`}>
                  {item.kind === 'color'
                    ? <span className="w-12 h-12 rounded-xl border-2 border-white" style={{ background: item.value }} />
                    : <span className={`text-4xl ${item.kind === 'title' ? 'text-3xl' : ''}`}>{item.emoji}</span>}
                  <span className="font-fredoka text-base text-center leading-tight">{item.name}</span>
                  {item.id.startsWith('hw26_') && <span className="text-xs font-nunito rounded-full bg-orange-500/80 px-2">Limited 🎃</span>}
                  <span className={`font-nunito text-sm ${on ? 'text-yellow-300' : owned ? 'text-green-300' : userCurrency >= item.price ? 'text-white' : 'text-white/50'}`}>
                    {on ? '✔ Equipped' : owned ? (SLOT[item.kind] ? 'Tap to wear' : '✔ Owned') : isRewardOnly(item.id) ? '🎃 Find all 31' : `🪙 ${item.price}`}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
        {tab === 'sticker' && <p className="font-nunito text-violet-200 mt-3">Stickers appear in the Living Mural (secret menu → Hidden places).</p>}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-indigo-950 border-2 border-yellow-300 px-6 py-3 font-fredoka text-lg shadow-2xl text-center">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
