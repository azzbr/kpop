import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { gameBadgeById } from '../data/gameBadges';
import ConfettiBurst from './ConfettiBurst';
import { playUnlock } from '../utils/sounds';

const SHOW_MS = 3000;

/**
 * Mounted once (in App). Watches the store's gameBadges and, when new ones arrive after a round,
 * shows "🏅 New badge" toasts one after another with confetti and a sound.
 */
export default function BadgeToast() {
  const gameBadges = useGameStore(s => s.gameBadges);
  const prev = useRef<string[]>(gameBadges);
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    const before = prev.current;
    prev.current = gameBadges;
    // Ignore loading the save (and a progress reset): only toast badges earned while playing.
    if (!useGameStore.persist.hasHydrated() || gameBadges.length <= before.length) return;
    const had = new Set(before);
    const fresh = gameBadges.filter(id => !had.has(id) && gameBadgeById(id));
    if (fresh.length) setQueue(q => [...q, ...fresh]);
  }, [gameBadges]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    playUnlock();
    const id = window.setTimeout(() => setQueue(q => q.slice(1)), SHOW_MS);
    return () => clearTimeout(id);
  }, [current]);

  const badge = current ? gameBadgeById(current) : undefined;

  return (
    <>
      <AnimatePresence>
        {badge && (
          <motion.div key={badge.id}
            initial={{ y: -80, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            role="status" aria-live="polite"
            onClick={() => setQueue(q => q.slice(1))}
            className="fixed left-1/2 -translate-x-1/2 z-[200] max-w-[92vw] rounded-3xl bg-gradient-to-r from-indigo-950 to-fuchsia-900 border-4 border-yellow-300 text-white px-5 py-3 shadow-2xl flex items-center gap-3 cursor-pointer"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
            <span className="text-4xl">{badge.icon}</span>
            <div className="min-w-0">
              <div className="font-fredoka text-xl leading-tight">🏅 New badge: {badge.icon} {badge.name} <span className="text-yellow-300">(+10 🪙)</span></div>
              <div className="font-nunito text-base text-violet-200 leading-tight">{badge.description}</div>
            </div>
            {queue.length > 1 && <span className="ml-1 rounded-full bg-yellow-400 text-stone-900 font-fredoka text-base px-2">+{queue.length - 1}</span>}
          </motion.div>
        )}
      </AnimatePresence>
      {badge && <ConfettiBurst key={badge.id} count={40} durationMs={2500} />}
    </>
  );
}
