// Compact seasonal-event card for the top of the game grid. Renders nothing when no event is on.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import { localDateKey } from '../../utils/dates';
import { playClick } from '../../utils/sounds';
import { activeEvent, eventLockerItems, foundCount, nextReward, rewardId, DAILY_CAP } from '../../events/events';
import { setArenaSource } from '../games/quizArenaSource';

const EMPTY: string[] = [];

export default function EventBanner() {
  const date = localDateKey();
  const event = activeEvent(date);
  const collected = useGameStore(s => (event ? s.events[event.key] : undefined)) ?? EMPTY;
  const setGameState = useGameStore(s => s.setGameState);
  const [open, setOpen] = useState(false);

  if (!event) return null;
  const found = Math.min(foundCount(collected), event.totalItems);
  const next = nextReward(event, collected);
  const pct = Math.round((found / event.totalItems) * 100);
  const quizId = event.quizBankId;
  const lockerItems = eventLockerItems(date, EMPTY).filter(i => event.lockerItemIds.includes(i.id));

  return (
    <div className="mx-auto mb-4 w-full max-w-3xl rounded-3xl border-2 border-orange-300/70 bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-orange-900/80 text-white shadow-xl">
      <button
        type="button"
        onClick={() => { playClick(); setOpen(o => !o); }}
        aria-expanded={open}
        className="block w-full min-h-[56px] px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden>{event.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="font-fredoka text-xl leading-tight">{event.name}</div>
            <div className="text-base text-orange-100">
              {found}/{event.totalItems} found
              {next ? ` · next reward at ${next.at}` : ' · all rewards won! 🏆'}
            </div>
          </div>
          <span className="text-2xl" aria-hidden>{open ? '▲' : '▼'}</span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-yellow-300"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {event.rewards.map(r => {
            const claimed = collected.includes(rewardId(r.at));
            return (
              <span
                key={r.at}
                className={`rounded-full px-3 py-1 text-sm font-bold ${claimed ? 'bg-green-500/80' : found >= r.at ? 'bg-yellow-400 text-stone-900' : 'bg-white/10'}`}
              >
                {claimed ? '✅' : event.itemEmoji} {r.at} → {r.label}
              </span>
            );
          })}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4 text-lg">
              <p>
                🔍 Little {event.itemPlural} {event.itemEmoji} hide on the edges of menu screens — the game grid,
                the welcome screen, your Locker, Trophy Room and more. Tap one to collect it!
              </p>
              <p>
                📅 Different screens hide one every day, and you can find up to {DAILY_CAP} a day. Come back
                tomorrow for more!
              </p>
              {event.id === 'halloween' && (
                <p>🌙 The arcade has a spooky-cute night sky with friendly bats while the hunt is on.</p>
              )}
              {quizId && (
                <button
                  type="button"
                  onClick={() => { playClick(); setArenaSource(`bank:${quizId}`); setGameState('quiz_arena'); }}
                  className="min-h-[52px] w-full rounded-full bg-orange-500 px-4 font-fredoka text-xl shadow-lg active:scale-95"
                >
                  {event.emoji} Play the {event.quizTitle ?? 'Event Quiz'}
                </button>
              )}
              {lockerItems.length > 0 && (
                <div>
                  <p>🎒 Limited Locker items — only while the event lasts:</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-3xl" aria-hidden>
                    {lockerItems.map(i => <span key={i.id}>{i.emoji}</span>)}
                  </div>
                  <button
                    type="button"
                    onClick={() => { playClick(); setGameState('locker'); }}
                    className="mt-3 min-h-[52px] w-full rounded-full bg-purple-600 px-4 font-fredoka text-xl shadow-lg active:scale-95"
                  >
                    Open the Locker
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
