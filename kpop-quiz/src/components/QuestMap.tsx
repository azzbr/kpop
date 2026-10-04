import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, getLevel, DEFAULT_EQUIPPED } from '../store';
import type { GameState } from '../store';
import { QUESTS, questStatuses } from '../data/quests';
import type { QuestState, QuestStatus } from '../data/quests';
import ConfettiBurst from './ConfettiBurst';
import { playClick, playCoin, playWin } from '../utils/sounds';
import { useSafeTimeout } from '../utils/useSafeTimeout';

const CLAIMED_KEY = 'funquest-quests-claimed';
const ROW = 110; // px between nodes on the trail

function loadClaimed(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CLAIMED_KEY) || '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch { return new Set(); }
}
function saveClaimed(s: Set<string>) {
  try { localStorage.setItem(CLAIMED_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

/** Trail x position (% of width) for node i — gently winding left and right. */
const xAt = (i: number) => 50 + Math.sin(i * 0.9) * 30;

const NODE_STYLE: Record<QuestStatus, string> = {
  claimed: 'bg-green-500 border-green-200',
  ready: 'bg-yellow-400 border-yellow-100 text-stone-900',
  current: 'bg-fuchsia-500 border-white',
  locked: 'bg-slate-700 border-slate-500 opacity-70',
};

export default function QuestMap() {
  const store = useGameStore();
  const { setGameState, userCurrency } = store;
  const [claimed, setClaimed] = useState<Set<string>>(loadClaimed);
  const [selected, setSelected] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const later = useSafeTimeout();

  const state: QuestState = {
    userName: store.userName, xp: store.xp, level: getLevel(store.xp), userCurrency: store.userCurrency,
    highScores: store.highScores, rounds: store.rounds, datesPlayed: store.datesPlayed, gameBadges: store.gameBadges,
    pet: store.pet, myQuizzes: store.myQuizzes, equipped: store.equipped, defaultEquipped: DEFAULT_EQUIPPED,
    inventory: store.inventory, dailyDoneDate: store.dailyDoneDate,
  };
  const statuses = questStatuses(state, claimed);
  const doneCount = statuses.filter(s => s === 'claimed').length;
  const firstReady = statuses.indexOf('ready');
  const currentIdx = statuses.indexOf('current');
  const focus = selected ?? (firstReady >= 0 ? firstReady : currentIdx >= 0 ? currentIdx : QUESTS.length - 1);
  const fq = QUESTS[focus];
  const fs = statuses[focus];

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const claim = (i: number) => {
    const q = QUESTS[i];
    if (statuses[i] !== 'ready' || claimed.has(q.id)) return;
    const next = new Set(claimed);
    next.add(q.id);
    saveClaimed(next);
    setClaimed(next);
    const st = useGameStore.getState();
    st.setUserCurrency(st.userCurrency + q.reward);
    playCoin();
    later(playWin, 150);
    setConfetti(true);
    later(() => setConfetti(false), 2500);
    setSelected(null);
    setToast(`+${q.reward} 🪙 — ${q.title} done! Next quest unlocked! 🎉`);
    later(() => setToast(null), 2600);
  };

  const go = (screen: GameState | 'pet_pal') => {
    playClick();
    // pet_pal is a new screen key; App routes it once it's added to GameState.
    setGameState(screen as GameState);
  };

  const height = QUESTS.length * ROW + 40;
  const points = QUESTS.map((_, i) => `${xAt(i)},${i * ROW + 50}`).join(' ');
  const allDone = doneCount === QUESTS.length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="arcade-bg min-h-screen-d text-white px-4 py-5"
      style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => { playClick(); setGameState('game_mode'); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
          <h1 className="font-fredoka text-3xl flex-1">🧭 Quest Map</h1>
          <span className="rounded-full bg-yellow-400 text-stone-900 font-fredoka text-xl px-4 py-2">🪙 {userCurrency}</span>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex justify-between font-nunito text-base text-violet-200 mb-1">
            <span>{doneCount} of {QUESTS.length} quests done</span>
            <span>{Math.round((doneCount / QUESTS.length) * 100)}%</span>
          </div>
          <div className="h-3 rounded-full bg-black/30 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-green-400 to-yellow-300" animate={{ width: `${(doneCount / QUESTS.length) * 100}%` }} />
          </div>
        </div>

        {/* Focused quest card (sticky so it stays in view while scrolling the trail) */}
        <div className="sticky top-2 z-20 mb-4">
          <motion.div key={fq.id + fs} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }}
            className="rounded-3xl bg-indigo-950/95 border-2 border-fuchsia-400 p-4 flex items-center gap-4 shadow-2xl">
            <span className="text-5xl">{allDone ? '🏆' : fq.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-nunito text-base text-violet-200">
                {allDone ? 'Every quest done!' : fs === 'claimed' ? 'Done ✅' : fs === 'ready' ? 'Quest complete!' : fs === 'current' ? 'Your quest' : 'Coming up 🔒'}
              </div>
              <div className="font-fredoka text-xl sm:text-2xl leading-tight">{allDone ? 'You are a Quest Legend! 🌟' : fq.title}</div>
              {!allDone && <div className="font-nunito text-base text-yellow-300">Reward: 🪙 {fq.reward}</div>}
            </div>
            {!allDone && fs === 'ready' && (
              <motion.button onClick={() => claim(focus)} animate={{ scale: [1, 1.07, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                className="min-h-[56px] px-5 rounded-full bg-yellow-400 text-stone-900 font-fredoka text-xl shadow-lg">Claim 🪙</motion.button>
            )}
            {!allDone && fs === 'current' && fq.screen && (
              <button onClick={() => go(fq.screen!)} className="min-h-[56px] px-6 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 font-fredoka text-xl shadow-lg">Go! ▶</button>
            )}
          </motion.div>
        </div>

        {/* Trail */}
        <div className="relative w-full" style={{ height }}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
            <polyline points={points} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={points} fill="none" stroke="rgba(253,224,71,0.7)" strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {QUESTS.map((q, i) => {
            const st = statuses[i];
            const x = xAt(i);
            const labelLeft = x > 50;
            const pulse = st === 'current' || st === 'ready';
            return (
              <div key={q.id} ref={i === (firstReady >= 0 ? firstReady : currentIdx) ? currentRef : undefined}
                className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: i * ROW + 50 }}>
                <motion.button
                  onClick={() => { playClick(); setSelected(i); }}
                  aria-label={`${q.title} — ${st}`}
                  animate={pulse ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  transition={pulse ? { repeat: Infinity, duration: 1.2 } : { duration: 0.2 }}
                  className={`relative w-[72px] h-[72px] rounded-full border-4 flex items-center justify-center text-3xl shadow-lg ${NODE_STYLE[st]} ${focus === i ? 'ring-4 ring-white/70' : ''}`}>
                  {st === 'claimed' ? '✅' : st === 'locked' ? '🔒' : st === 'ready' ? '🎁' : q.icon}
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-950 border-2 border-white/40 font-fredoka text-sm flex items-center justify-center">{i + 1}</span>
                </motion.button>
                <div className={`absolute top-1/2 -translate-y-1/2 w-[38vw] max-w-[220px] font-nunito text-base leading-tight
                  ${labelLeft ? 'right-[84px] text-right' : 'left-[84px]'} ${st === 'locked' ? 'text-white/50' : 'text-white'}`}>
                  {st === 'locked' ? '???' : q.title}
                </div>
              </div>
            );
          })}
        </div>
        <p className="font-nunito text-lg text-center text-violet-200 mt-2">Finish a quest to open the next one. Every step is a win! 🌟</p>
      </div>

      {confetti && <ConfettiBurst count={60} durationMs={2500} />}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-indigo-950 border-2 border-yellow-300 px-6 py-3 font-fredoka text-lg shadow-2xl text-center max-w-[90vw]">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
