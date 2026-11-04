// 🎄 Advent calendar (advent_calendar) — Winter Wonderland. 24 doors: one opens each day of December
// (local date), missed ones can still be opened until 6 January. Each door pays coins + a surprise.
// Rules: events/advent.ts; door contents: data/adventDoors.ts. Opened from the event banner.
import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScreenFrame from '../ui/ScreenFrame';
import ConfettiBurst from '../ConfettiBurst';
import { useGameStore } from '../../store';
import type { GameState } from '../../store';
import { localDateKey } from '../../utils/dates';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { playClick, playCoin, playNote, playWin } from '../../utils/sounds';
import {
  ADVENT_KEY, ADVENT_START, adventOpen, doorState, doorId, challengeId, missedDoors, readyDoors, openDoors,
} from '../../events/advent';
import type { AdventDeps } from '../../events/advent';
import { ADVENT_DOORS, DOOR_ORDER, CHALLENGE_COINS } from '../../data/adventDoors';
import type { AdventDoor } from '../../data/adventDoors';
import { WINTER_LOCKER_ITEMS } from '../../data/winterLocker';

const EMPTY: string[] = [];
const FLIP_MS = 420;
const dayName = (day: number) => `${day} December`;
/** ADVENT_END in words. */
const END_TEXT = '6 January';

const deps: AdventDeps = {
  collected: () => useGameStore.getState().events[ADVENT_KEY] ?? EMPTY,
  collect: (k, id) => useGameStore.getState().collectEventItem(k, id),
  addCoins: coins => { const s = useGameStore.getState(); s.setUserCurrency(s.userCurrency + coins); },
  unlock: id => useGameStore.getState().addToInventory(id),
};

/** A short rising C-major arpeggio for the golden door. */
function goldenChime() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => playNote(f, 0.35, 'triangle', 0.12), i * 120));
}

export default function AdventCalendar() {
  const later = useSafeTimeout();
  const today = localDateKey();
  const collected = useGameStore(s => s.events[ADVENT_KEY]) ?? EMPTY;
  const setGameState = useGameStore(s => s.setGameState);
  const [flipping, setFlipping] = useState<number[]>([]);
  const [card, setCard] = useState<{ doors: AdventDoor[]; fresh: boolean } | null>(null);
  const [party, setParty] = useState(0);
  const [toast, setToast] = useState('');
  // Tap lock: one opening at a time, until the surprise card is closed.
  const busy = useRef(false);

  const say = (msg: string) => { setToast(msg); later(() => setToast(''), 2400); };

  const open = (days: number[]) => {
    if (busy.current || days.length === 0) return;
    busy.current = true;
    const opened = openDoors(days, today, deps);
    if (opened.length === 0) { busy.current = false; return; }
    playClick();
    setFlipping(opened.map(d => d.day));
    later(() => {
      setFlipping([]);
      setCard({ doors: opened, fresh: true });
      setParty(p => p + 1);
      if (opened.some(d => d.day === 24)) goldenChime(); else { playWin(); later(playCoin, 250); }
    }, FLIP_MS + (opened.length - 1) * 60);
  };

  const tapDoor = (door: AdventDoor) => {
    if (busy.current) return;
    const st = doorState(door.day, today, collected);
    if (st === 'today' || st === 'missed') open([door.day]);
    else if (st === 'opened') { playClick(); busy.current = true; setCard({ doors: [door], fresh: false }); }
    else if (st === 'locked') { playClick(); say(`Door ${door.day} opens on ${dayName(door.day)} — not long now! ⏳`); }
  };

  const closeCard = () => { playClick(); setCard(null); busy.current = false; };

  const go = (screen: string) => { playClick(); busy.current = false; setGameState(screen as GameState); };

  const missed = missedDoors(today, collected);
  const ready = readyDoors(today, collected);
  const openedCount = ADVENT_DOORS.filter(d => collected.includes(doorId(d.day))).length;
  const notYet = today < ADVENT_START;

  return (
    <ScreenFrame title="Advent Calendar" icon="🎄" width="max-w-4xl">
      {party > 0 && <ConfettiBurst key={party} count={card?.doors.some(d => d.day === 24) ? 140 : 70} durationMs={2600} />}
      {!adventOpen(today) ? (
        <p className="font-nunito text-xl text-center text-violet-100 mt-6">
          {notYet ? 'The Advent calendar opens on 1 December — one little door for every day until Christmas Eve! 🎄' : 'The Advent calendar has finished for this winter. See you next December! ❄️'}
        </p>
      ) : (
        <>
          <div className="text-center mb-3">
            <p className="font-fredoka text-xl" data-testid="advent-status">
              {ready.length === 0 ? `🎉 All caught up! ${openedCount} / 24 doors opened`
                : ready.length === 1 ? `🎁 Door ${ready[0]} is ready!` : `🎁 ${ready.length} doors to open`}
            </p>
            <p className="font-nunito text-base text-violet-200">Every door has coins 🪙 and a surprise. Missed a day? You can still open it until {END_TEXT}.</p>
          </div>
          {missed.length >= 2 && (
            <button type="button" onClick={() => open(missed)}
              className="mx-auto mb-4 block min-h-[56px] rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-6 font-fredoka text-xl shadow-lg active:scale-95">
              🎁 Open all missed doors ({missed.length})
            </button>
          )}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3" role="list" aria-label="Advent calendar doors">
            {DOOR_ORDER.map(day => {
              const door = ADVENT_DOORS[day - 1];
              const st = doorState(day, today, collected);
              const golden = day === 24;
              const flip = flipping.includes(day);
              const done = door.surprise.kind === 'challenge' && collected.includes(challengeId(day));
              const label = st === 'locked' ? `Door ${day}, opens on ${dayName(day)}`
                : st === 'opened' ? `Door ${day}, opened` : st === 'today' ? `Door ${day}, open today!` : `Door ${day}, you missed this one — open it now`;
              return (
                <motion.button key={day} type="button" role="listitem" aria-label={label} data-door={day} data-state={st}
                  onClick={() => tapDoor(door)}
                  animate={flip ? { rotateY: [0, 90, 0] } : { rotateY: 0 }}
                  transition={{ duration: FLIP_MS / 1000 }}
                  className={[
                    'relative aspect-square min-h-[56px] rounded-2xl font-fredoka flex flex-col items-center justify-center select-none',
                    golden ? 'advent-golden' : '',
                    st === 'opened' ? 'bg-white/90 text-stone-800' : st === 'locked' ? 'bg-white/10 text-white/70' : 'bg-gradient-to-br from-red-500 to-emerald-600 text-white shadow-lg',
                    st === 'today' ? 'ring-4 ring-yellow-300 event-glow' : '',
                    st === 'missed' ? 'ring-2 ring-sky-200' : '',
                  ].join(' ')}
                  style={{ perspective: 600 }}>
                  {st === 'opened' ? (
                    <>
                      <span className="text-3xl sm:text-4xl leading-none">{door.emoji}</span>
                      <span className="text-xs mt-1">{day}{done ? ' ✅' : ''}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl sm:text-3xl leading-none">{day}</span>
                      <span className="text-[11px] sm:text-xs mt-1">{st === 'locked' ? '🔒' : st === 'today' ? 'Today!' : 'Open me!'}</span>
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>
        </>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[90vw] rounded-full bg-black/75 px-5 py-3 font-nunito text-lg z-50" role="status">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {card && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-label="Advent surprise">
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className={`w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-5 text-center shadow-2xl border-2 ${card.doors.some(d => d.day === 24) ? 'bg-gradient-to-b from-amber-900 to-indigo-950 border-yellow-300' : 'bg-indigo-950 border-sky-300/60'}`}>
              {card.doors.length > 1 && (
                <h2 className="font-fredoka text-2xl mb-1">🎁 {card.doors.length} doors opened!</h2>
              )}
              {card.fresh && (
                <p className="font-fredoka text-xl text-yellow-300 mb-3" data-testid="advent-coins">+{card.doors.reduce((a, d) => a + d.coins, 0)} 🪙</p>
              )}
              <div className="space-y-3">
                {card.doors.map(d => <Surprise key={d.day} door={d} done={collected.includes(challengeId(d.day))} onGo={go} />)}
              </div>
              <button type="button" onClick={closeCard}
                className="mt-4 w-full min-h-[52px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-xl">
                ✨ Yay!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ScreenFrame>
  );
}

function Surprise({ door, done, onGo }: { door: AdventDoor; done: boolean; onGo: (screen: string) => void }) {
  const [reveal, setReveal] = useState(false);
  const s = door.surprise;
  return (
    <div className={`rounded-2xl p-3 ${door.day === 24 ? 'bg-yellow-300/15' : 'bg-white/10'}`} data-testid={`surprise-${door.day}`}>
      <div className="text-5xl mb-1" aria-hidden>{door.emoji}</div>
      <div className="font-fredoka text-lg mb-1">Door {door.day}{door.day === 24 ? ' — the golden door! 🌟' : ''}</div>
      {s.kind === 'joke' && (
        <div className="font-nunito text-lg">
          <p>{s.q}</p>
          {reveal ? <p className="font-bold text-yellow-200 mt-1">{s.a}</p> : (
            <button type="button" onClick={() => { playClick(); setReveal(true); }} className="mt-2 min-h-[48px] rounded-full bg-white/15 px-4 font-fredoka">🤭 Show the answer</button>
          )}
        </div>
      )}
      {s.kind === 'fact' && <p className="font-nunito text-lg">💡 {s.text}</p>}
      {s.kind === 'item' && (
        <div className="font-nunito text-lg">
          <p>🎁 {s.text}</p>
          {WINTER_LOCKER_ITEMS.find(i => i.id === s.itemId)?.emoji !== door.emoji && (
            <p className="text-4xl mt-1" aria-hidden>{WINTER_LOCKER_ITEMS.find(i => i.id === s.itemId)?.emoji}</p>
          )}
          <button type="button" onClick={() => onGo('locker')} className="mt-2 min-h-[48px] rounded-full bg-purple-600 px-4 font-fredoka">🎒 Open the Locker</button>
        </div>
      )}
      {s.kind === 'challenge' && (
        <div className="font-nunito text-lg">
          <p>🏅 Challenge: {s.text}</p>
          {done ? <p className="font-fredoka text-emerald-300 mt-1">✅ Done! You got the +{CHALLENGE_COINS} 🪙</p> : (
            <>
              <p className="text-base text-violet-200 mt-1">Do it before 6 January for +{CHALLENGE_COINS} 🪙</p>
              <button type="button" onClick={() => onGo(s.screen)} className="mt-2 min-h-[48px] rounded-full bg-emerald-600 px-5 font-fredoka text-lg">▶ Play now</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
