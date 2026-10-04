// Seasonal item hunt overlay (Halloween pumpkins, winter snowflakes…). Mounted once in App with
// the current screen. The rules (which screens, where, daily cap, rewards) live in src/events/events.ts.
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import { localDateKey } from '../../utils/dates';
import { playCoin, playPop, playWin } from '../../utils/sounds';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { activeEvent, claimRewards, foundCount, huntItemFor } from '../../events/events';
import type { EventReward, HuntSpot, SeasonEvent } from '../../events/events';
import ConfettiBurst from '../ConfettiBurst';

const EMPTY: string[] = [];
const SIZE = 56; // tap target (≥ 48 px)

function spotStyle(spot: HuntSpot): CSSProperties {
  return spot.anchor === 'left'
    ? { left: 'calc(env(safe-area-inset-left) + 6px)', top: `${spot.pct}%` }
    : { left: `${spot.pct}%`, bottom: 'calc(env(safe-area-inset-bottom) + 10px)' };
}

interface Pop { id: string; spot: HuntSpot; found: number }

export default function PumpkinHunt({ screen }: { screen: string }) {
  const date = localDateKey();
  const event = activeEvent(date);
  const collected = useGameStore(s => (event ? s.events[event.key] : undefined)) ?? EMPTY;
  const [pop, setPop] = useState<Pop | null>(null);
  const [won, setWon] = useState<{ event: SeasonEvent; rewards: EventReward[] } | null>(null);
  const later = useSafeTimeout();

  if (!event) return null;
  const item = huntItemFor(event, screen, date, collected);

  const collect = () => {
    if (!item) return;
    const store = useGameStore.getState();
    if (!store.collectEventItem(event.key, item.id)) return;
    playPop();
    later(playCoin, 120);
    const found = foundCount(useGameStore.getState().events[event.key] ?? EMPTY);
    setPop({ id: item.id, spot: item.spot, found });
    later(() => setPop(p => (p?.id === item.id ? null : p)), 1600);

    const granted = claimRewards(event, {
      collected: () => useGameStore.getState().events[event.key] ?? EMPTY,
      collect: (k, id) => useGameStore.getState().collectEventItem(k, id),
      addCoins: coins => {
        const s = useGameStore.getState();
        s.setUserCurrency(s.userCurrency + coins);
      },
      unlock: id => useGameStore.getState().addToInventory(id),
    });
    if (granted.length) later(() => { playWin(); setWon({ event, rewards: granted }); }, 500);
  };

  return (
    <>
      {item && (
        <motion.button
          key={item.id}
          type="button"
          aria-label={`Hidden ${event.itemName}! Tap to collect it`}
          onClick={collect}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.6 }}
          className="fixed z-40 flex items-center justify-center rounded-full select-none"
          style={{ ...spotStyle(item.spot), width: SIZE, height: SIZE, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <span className="event-bob block text-4xl drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]" aria-hidden>
            {event.itemEmoji}
          </span>
        </motion.button>
      )}

      <AnimatePresence>
        {pop && (
          <motion.div
            key={pop.id}
            className="pointer-events-none fixed z-40 flex flex-col items-start"
            style={spotStyle(pop.spot)}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.span
              className="block text-4xl"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2.2, opacity: 0, rotate: 20 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              {event.itemEmoji}
            </motion.span>
            <motion.span
              className="mt-1 whitespace-nowrap rounded-full bg-orange-500 px-4 py-2 font-fredoka text-lg text-white shadow-xl"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: -30, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              +1 {event.itemEmoji} {pop.found}/{event.totalItems}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {won && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ConfettiBurst count={50} />
            <motion.div
              className="w-full max-w-sm rounded-3xl border-4 border-orange-300 bg-gradient-to-b from-purple-800 to-indigo-950 p-6 text-center text-white shadow-2xl"
              initial={{ scale: 0.7, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <div className="text-6xl">{won.event.emoji}{won.event.id === 'halloween' ? '👻' : '✨'}</div>
              <h2 className="mt-2 font-fredoka text-3xl">{won.event.id === 'halloween' ? 'Boo-tiful!' : 'Amazing!'}</h2>
              <p className="mt-2 text-xl">
                You found {won.rewards[won.rewards.length - 1].at} {won.event.itemPlural}!
              </p>
              <ul className="mt-4 space-y-2">
                {won.rewards.map(r => (
                  <li key={r.at} className="rounded-2xl bg-white/10 px-4 py-2 text-lg">🎁 {r.label}</li>
                ))}
              </ul>
              {won.rewards.some(r => r.unlocks) && (
                <p className="mt-3 text-lg text-orange-200">Your new title is waiting in the Locker 🎒</p>
              )}
              <button
                type="button"
                onClick={() => setWon(null)}
                className="mt-5 min-h-[52px] w-full rounded-full bg-orange-500 font-fredoka text-2xl text-white shadow-lg active:scale-95"
              >
                Yay! 🎉
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
