import { useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { localDateKey } from '../utils/dates';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playPop, playUnlock, playWin, playTick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import ScreenFrame from './ui/ScreenFrame';
import {
  MODELS, HATS, OUTFITS, SHOES, ACCESSORIES, BACKDROPS, DEFAULT_LOOK, JUDGES, MAX_REWARDED_PER_DAY, STYLE_XP_SCALE,
  scoreLook, vibeOf, rewardCheck, recordReward, rewardsLeft, parseLog, sanitizeLook,
  type Look, type RunwayResult, type StrutLog,
} from './styleStudioLogic';

// Style Studio — dress up, then a runway round: Strut → three judges score the look → done.
// Reward: finishRound('style_studio', score, STYLE_XP_SCALE) only for a look never rewarded before,
// at most MAX_REWARDED_PER_DAY times a day (log in STRUT_KEY). Saving a look gives no XP.

const GAME_ID = 'style_studio';
const LOOKS_KEY = 'style_looks';
const SAVES_KEY = 'style_saves'; // read by Agent HQ
const STRUT_KEY = 'funquest-style_studio-struts';

function loadLooks(): Look[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOOKS_KEY) || '[]');
    return Array.isArray(raw) ? raw.map(sanitizeLook).filter((l): l is Look => !!l) : [];
  } catch { return []; }
}
function storeLooks(looks: Look[]) {
  try {
    localStorage.setItem(LOOKS_KEY, JSON.stringify(looks));
    localStorage.setItem(SAVES_KEY, String(looks.length));
  } catch { /* storage blocked */ }
}
function loadLog(today: string): StrutLog {
  try { return parseLog(JSON.parse(localStorage.getItem(STRUT_KEY) || 'null'), today); } catch { return parseLog(null, today); }
}

type Phase = 'design' | 'runway' | 'scored';

function LookView({ look, small = false }: { look: Look; small?: boolean }) {
  const bg = BACKDROPS[look.bg];
  return (
    <div className={`relative rounded-3xl overflow-hidden border-2 border-white/40 bg-gradient-to-b ${bg.grad}`}
      style={{ width: small ? '100%' : '100%', height: small ? 150 : 300 }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {look.hat !== '—' && <div style={{ fontSize: small ? 26 : 54, lineHeight: 1, marginBottom: -8 }}>{look.hat}</div>}
        <div style={{ fontSize: small ? 40 : 84, lineHeight: 1 }}>{look.model}</div>
        <div style={{ fontSize: small ? 34 : 66, lineHeight: 1, marginTop: -6 }}>{look.outfit}</div>
        <div style={{ fontSize: small ? 22 : 42, lineHeight: 1, marginTop: -4 }}>{look.shoes}</div>
      </div>
      {look.accessory !== '—' && (
        <div className="absolute" style={{ right: small ? 8 : 18, bottom: small ? 34 : 84, fontSize: small ? 24 : 44 }}>{look.accessory}</div>
      )}
      {!small && <div className="absolute top-2 left-2 bg-black/40 px-3 py-1 rounded-full font-nunito text-base text-white">{bg.name}</div>}
    </div>
  );
}

export default function StyleStudio() {
  const later = useSafeTimeout();
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [savedLooks, setSavedLooks] = useState<Look[]>(loadLooks);
  const [tab, setTab] = useState<'design' | 'closet'>('design');
  const [phase, setPhase] = useState<Phase>('design');
  const [result, setResult] = useState<RunwayResult | null>(null);
  const [shown, setShown] = useState(0);
  const [reward, setReward] = useState<{ xp: number; coins: number; isBest: boolean } | null>(null);
  const [noReward, setNoReward] = useState<'seen' | 'limit' | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [log, setLog] = useState<StrutLog>(() => loadLog(localDateKey()));
  const [savedMsg, setSavedMsg] = useState(false);
  const runId = useRef(0);

  const vibe = vibeOf(look);
  const today = localDateKey();
  const left = rewardsLeft(log, today);

  const change = (patch: Partial<Look>) => { playPop(); setLook(l => ({ ...l, ...patch })); setSavedMsg(false); };
  const cycle = <K extends 'model' | 'hat' | 'outfit' | 'shoes' | 'accessory'>(key: K, options: string[], dir: 1 | -1) => {
    const i = options.indexOf(look[key]);
    change({ [key]: options[(i + dir + options.length) % options.length] } as Partial<Look>);
  };

  const randomize = () => {
    const r = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    playClick();
    setLook({ model: r(MODELS), hat: r(HATS), outfit: r(OUTFITS), shoes: r(SHOES), accessory: r(ACCESSORIES), bg: Math.floor(Math.random() * BACKDROPS.length) });
    setSavedMsg(false);
  };

  const saveLook = () => {
    playUnlock();
    const next = [look, ...savedLooks].slice(0, 24);
    setSavedLooks(next);
    storeLooks(next);
    setSavedMsg(true);
  };

  const strut = () => {
    if (phase !== 'design') return;
    playClick();
    const res = scoreLook(look);
    const day = localDateKey();
    const fresh = loadLog(day);
    const check = rewardCheck(fresh, look, day);
    setResult(res);
    setShown(0);
    setReward(null);
    setNoReward(check.ok ? null : check.reason ?? null);
    setPhase('runway');
    // The reward is decided and given now (once), so leaving the runway early can't skip or repeat it.
    if (check.ok) {
      const r = useGameStore.getState().finishRound(GAME_ID, res.score, STYLE_XP_SCALE);
      const nextLog = recordReward(fresh, look, day);
      try { localStorage.setItem(STRUT_KEY, JSON.stringify(nextLog)); } catch { /* ignore */ }
      setLog(nextLog);
      setReward({ xp: r.xp, coins: r.coins, isBest: r.isBest });
    }
    // Runway walk, then the judges one by one, then the total.
    const id = ++runId.current;
    JUDGES.forEach((_, i) => later(() => { if (runId.current === id) { playTick(); setShown(i + 1); } }, 1600 + i * 600));
    later(() => {
      if (runId.current !== id) return;
      setPhase('scored');
      playWin();
      setConfetti(true);
      later(() => setConfetti(false), 2500);
    }, 1600 + JUDGES.length * 600 + 300);
  };

  const backToDesign = () => { playClick(); runId.current++; setPhase('design'); setResult(null); setConfetti(false); };

  const picker = (label: string, value: ReactNode, onPrev: () => void, onNext: () => void) => (
    <div className="rounded-2xl bg-white/10 border border-white/15 p-2">
      <div className="font-fredoka text-base text-violet-100 mb-1 text-center">{label}</div>
      <div className="flex items-center justify-between gap-1">
        <button onClick={onPrev} aria-label={`Previous ${label}`}
          className="w-12 h-12 shrink-0 rounded-full bg-white/15 active:bg-white/30 font-fredoka text-xl">◀</button>
        <div className="text-4xl text-center min-w-0 truncate">{value}</div>
        <button onClick={onNext} aria-label={`Next ${label}`}
          className="w-12 h-12 shrink-0 rounded-full bg-white/15 active:bg-white/30 font-fredoka text-xl">▶</button>
      </div>
    </div>
  );
  const none = <span className="font-nunito text-lg text-white/60">none</span>;

  return (
    <ScreenFrame title="Style Studio" icon="👗" width="max-w-4xl"
      onBack={phase !== 'design' ? backToDesign : undefined}
      right={<span className="font-fredoka text-base bg-white/15 rounded-full px-3 py-2 shrink-0" title="Rewarded struts left today">🎟️ {left}/{MAX_REWARDED_PER_DAY}</span>}>
      {confetti && <ConfettiBurst count={80} durationMs={2500} />}

      {phase === 'design' && (
        <div className="grid grid-cols-2 gap-2 mb-4 max-w-md mx-auto">
          {(['design', 'closet'] as const).map(t => (
            <button key={t} onClick={() => { playClick(); setTab(t); }}
              className={`min-h-[52px] rounded-full font-fredoka text-xl ${tab === t ? 'bg-fuchsia-500' : 'bg-white/10 active:bg-white/20'}`}>
              {t === 'design' ? '✨ Design' : `👜 Closet (${savedLooks.length})`}
            </button>
          ))}
        </div>
      )}

      {phase === 'design' && tab === 'design' && (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          <div>
            <LookView look={look} />
            <AnimatePresence>
              {vibe && (
                <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-2 rounded-2xl bg-yellow-300 text-stone-900 font-fredoka text-lg text-center py-2">
                  ✨ Vibe match: {vibe.emoji} {vibe.name}! Bonus on the runway
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {picker('Player', look.model, () => cycle('model', MODELS, -1), () => cycle('model', MODELS, 1))}
              {picker('Hat', look.hat === '—' ? none : look.hat, () => cycle('hat', HATS, -1), () => cycle('hat', HATS, 1))}
              {picker('Outfit', look.outfit, () => cycle('outfit', OUTFITS, -1), () => cycle('outfit', OUTFITS, 1))}
              {picker('Shoes', look.shoes, () => cycle('shoes', SHOES, -1), () => cycle('shoes', SHOES, 1))}
              {picker('Extra', look.accessory === '—' ? none : look.accessory, () => cycle('accessory', ACCESSORIES, -1), () => cycle('accessory', ACCESSORIES, 1))}
              {picker('Backdrop', <span className="font-fredoka text-lg">{BACKDROPS[look.bg].name}</span>,
                () => change({ bg: (look.bg - 1 + BACKDROPS.length) % BACKDROPS.length }),
                () => change({ bg: (look.bg + 1) % BACKDROPS.length }))}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={randomize} className="min-h-[52px] rounded-2xl bg-violet-500 active:bg-violet-600 font-fredoka text-lg">🎲 Random</button>
              <button onClick={saveLook} disabled={savedMsg} className="min-h-[52px] rounded-2xl bg-sky-500 active:bg-sky-600 font-fredoka text-lg disabled:opacity-60">
                {savedMsg ? '✅ Saved' : '💾 Save look'}
              </button>
            </div>
            <button onClick={strut}
              className="w-full min-h-[60px] rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 text-stone-900 font-fredoka text-2xl shadow-lg active:scale-95">
              💃 Strut the runway!
            </button>
            <p className="font-nunito text-base text-violet-100 text-center mt-2">
              {left > 0 ? `New outfits earn XP on the runway (${left} left today).` : 'Runway rewards are done for today. Strut just for fun!'}
            </p>
          </div>
        </div>
      )}

      {phase === 'design' && tab === 'closet' && (
        savedLooks.length === 0 ? (
          <div className="rounded-3xl bg-white/10 p-8 text-center">
            <div className="text-5xl mb-2" aria-hidden>👜</div>
            <p className="font-fredoka text-2xl">Your closet is empty!</p>
            <p className="font-nunito text-lg text-violet-100">Design a look and tap Save look.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {savedLooks.map((l, i) => (
              <div key={i} className="rounded-3xl bg-white/10 p-2">
                <button onClick={() => { playPop(); setLook(l); setTab('design'); setSavedMsg(true); }} className="w-full block" aria-label="Wear this look">
                  <LookView look={l} small />
                </button>
                <button onClick={() => {
                  playClick();
                  const next = savedLooks.filter((_, j) => j !== i);
                  setSavedLooks(next);
                  storeLooks(next);
                }} className="mt-2 w-full min-h-[44px] rounded-full bg-rose-500/70 active:bg-rose-500 font-fredoka text-base">🗑️ Remove</button>
              </div>
            ))}
          </div>
        )
      )}

      {phase !== 'design' && result && (
        <div className="max-w-xl mx-auto text-center">
          <motion.div initial={{ x: -40, opacity: 0 }}
            animate={phase === 'runway' ? { x: [-40, 30, -20, 0], opacity: 1, rotate: [0, -3, 3, 0] } : { x: 0, opacity: 1 }}
            transition={{ duration: 1.5 }}>
            <LookView look={look} />
          </motion.div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {JUDGES.map((j, i) => (
              <div key={j.id} className="rounded-2xl bg-white/10 p-3 min-h-[120px]">
                <div className="text-4xl" aria-hidden>{j.emoji}</div>
                <p className="font-nunito text-base text-violet-100">{j.name}</p>
                {shown > i
                  ? <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="font-fredoka text-3xl text-yellow-200">{result.judges[i]}⭐</motion.p>
                  : <p className="font-fredoka text-3xl text-white/40">…</p>}
              </div>
            ))}
          </div>
          {phase === 'scored' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-3xl bg-white/10 p-4">
              <p className="font-nunito text-lg">
                Judges {result.judges.reduce((a, b) => a + b, 0)}
                {result.complete && ' · complete look +2'}
                {result.vibe && ` · ${result.vibe.emoji} ${result.vibe.name} +5`}
              </p>
              <p className="font-fredoka text-4xl my-1">Runway score: {result.score}</p>
              {reward && (
                <p className="font-fredoka text-xl text-yellow-200">
                  +{reward.xp} XP · +{reward.coins} 🪙{reward.isBest ? ' · New best! 🏆' : ''}
                </p>
              )}
              {noReward === 'seen' && <p className="font-nunito text-lg text-violet-100">This look already walked the runway. Change something to earn XP!</p>}
              {noReward === 'limit' && <p className="font-nunito text-lg text-violet-100">You used today’s {MAX_REWARDED_PER_DAY} runway rewards. Come back tomorrow for more!</p>}
              <button onClick={backToDesign}
                className="mt-3 w-full min-h-[56px] rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 text-stone-900 font-fredoka text-xl">
                ✨ Design a new look
              </button>
            </motion.div>
          )}
        </div>
      )}
    </ScreenFrame>
  );
}
