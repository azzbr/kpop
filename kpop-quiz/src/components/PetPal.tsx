import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { localDateKey } from '../utils/dates';
import {
  SPECIES, STAGE_NAMES, STAGE_SIZE, PRESET_NAMES, MOOD_FACE, adopt, visit, feed, giveTreat, pat, addDecor,
  canFeed, stageOf, daysToNextStage, moodOf, petEmoji, speciesById, speechLines,
} from '../utils/petLogic';
import type { PetRecord } from '../utils/petLogic';
import { PET_DECOR, PET_TREATS, petDecorById } from '../data/petItems';
import type { PetDecor } from '../data/petItems';
import { isClean } from '../utils/cleanText';
import OnScreenKeyboard from './ui/OnScreenKeyboard';
import ConfettiBurst from './ConfettiBurst';
import { playClick, playPop, playCoin, playUnlock, playWin, playWrong } from '../utils/sounds';
import { useSafeTimeout } from '../utils/useSafeTimeout';

const MAX_NAME = 12;
const tidyName = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME).toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

export default function PetPal() {
  const pet = useGameStore(s => s.pet) as PetRecord | null;
  const setGameState = useGameStore(s => s.setGameState);
  const coins = useGameStore(s => s.userCurrency);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="arcade-bg min-h-screen-d text-white px-4 py-5"
      style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { playClick(); setGameState('game_mode'); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
          <h1 className="font-fredoka text-3xl flex-1">🐾 Pet Pal</h1>
          <span className="rounded-full bg-yellow-400 text-stone-900 font-fredoka text-xl px-4 py-2">🪙 {coins}</span>
        </div>
        {pet ? <PetRoom pet={pet} /> : <Adopt />}
      </div>
    </motion.div>
  );
}

// ─── Adopt ──────────────────────────────────────────────────────────────────

function Adopt() {
  const setPet = useGameStore(s => s.setPet);
  const [species, setSpecies] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [typing, setTyping] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onKey = useCallback((l: string) => setName(n => (n.length < MAX_NAME ? n + l : n)), []);
  const onBack = useCallback(() => setName(n => n.slice(0, -1)), []);

  const confirm = () => {
    const clean = tidyName(name);
    if (!species) return;
    if (clean.length < 2) { playWrong(); setMsg('Pick a name with at least 2 letters 😊'); return; }
    if (!isClean(clean)) { playWrong(); setMsg("Let's pick a different name — try one of the chips! 😊"); return; }
    playWin();
    setPet(adopt(clean, species, localDateKey()));
  };
  const onEnter = useCallback(() => setTyping(false), []);

  if (!species) {
    return (
      <div>
        <p className="font-nunito text-xl text-violet-100 mb-4 text-center">Choose a friend to look after! It grows when you play games on different days. 🌱</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SPECIES.map(s => (
            <motion.button key={s.id} whileTap={{ scale: 0.95 }} onClick={() => { playPop(); setSpecies(s.id); }}
              className="rounded-3xl bg-white/10 border-2 border-white/15 p-4 min-h-[150px] flex flex-col items-center justify-center gap-2">
              <span className="text-5xl">{s.stages[1]}</span>
              <span className="font-fredoka text-xl">{s.name}</span>
              <span className="font-nunito text-base text-violet-200">{s.stages.slice(0, 4).join(' → ')}</span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  const sp = speciesById(species);
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}
        className="w-32 h-32 rounded-full flex items-center justify-center text-7xl" style={{ background: sp.colour }}>
        {sp.stages[0]}
      </motion.div>
      <p className="font-fredoka text-2xl text-center">What will you call your {sp.name.toLowerCase()}?</p>
      <div className="min-h-[56px] min-w-[220px] rounded-2xl bg-white text-slate-900 font-fredoka text-3xl px-5 py-2 text-center">
        {name || <span className="text-slate-400 text-xl">Tap a name…</span>}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {PRESET_NAMES.map(n => (
          <button key={n} onClick={() => { playClick(); setName(n); setMsg(null); setTyping(false); }}
            className={`min-h-[48px] px-4 rounded-full font-fredoka text-lg ${name === n ? 'bg-fuchsia-500' : 'bg-white/15'}`}>{n}</button>
        ))}
        <button onClick={() => { playClick(); setTyping(t => !t); if (PRESET_NAMES.includes(name)) setName(''); setMsg(null); }}
          className="min-h-[48px] px-4 rounded-full font-fredoka text-lg bg-indigo-500">⌨️ Type my own</button>
      </div>
      {typing && <OnScreenKeyboard onKey={onKey} onBackspace={onBack} onEnter={onEnter} space enterLabel="Done" />}
      {msg && <p className="font-nunito text-lg text-yellow-200 text-center">{msg}</p>}
      <div className="flex gap-3">
        <button onClick={() => { playClick(); setSpecies(null); }} className="min-h-[56px] px-5 rounded-full bg-white/15 font-fredoka text-xl">← Other pets</button>
        <button onClick={confirm} disabled={!name.trim()}
          className="min-h-[56px] px-6 rounded-full bg-gradient-to-r from-pink-500 to-orange-400 font-fredoka text-2xl shadow-lg disabled:opacity-40">🏡 Adopt!</button>
      </div>
    </div>
  );
}

// ─── Room ───────────────────────────────────────────────────────────────────

type Panel = 'none' | 'treats' | 'shop';

function PetRoom({ pet }: { pet: PetRecord }) {
  const setPet = useGameStore(s => s.setPet);
  const coins = useGameStore(s => s.userCurrency);
  const setUserCurrency = useGameStore(s => s.setUserCurrency);
  const playLog = useGameStore(s => s.playLog);
  const today = localDateKey();
  const later = useSafeTimeout();

  const [missed, setMissed] = useState(0);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [lineIdx, setLineIdx] = useState(0);
  const [hearts, setHearts] = useState<number[]>([]);
  const [hop, setHop] = useState(0);
  const [panel, setPanel] = useState<Panel>('none');
  const [toast, setToast] = useState<string | null>(null);
  const visited = useRef(false);

  const say = (m: string) => { setToast(m); later(() => setToast(null), 2200); };

  // Visit once when the room opens: daily mood + growth.
  useEffect(() => {
    if (visited.current) return;
    visited.current = true;
    const st = useGameStore.getState();
    const cur = st.pet as PetRecord | null;
    if (!cur) return;
    const r = visit(cur, localDateKey(), st.datesPlayed);
    st.setPet(r.pet);
    setMissed(r.missed);
    if (r.newStage) { setCelebrate(`${r.pet.name} grew into a ${STAGE_NAMES[stageOf(r.pet.growth)]}! 🎉`); playWin(); }
    else if (r.grew) setCelebrate(`${r.pet.name} grew a little today! 🌱`);
  }, []);

  useEffect(() => {
    if (!celebrate) return;
    const id = window.setTimeout(() => setCelebrate(null), 3500);
    return () => clearTimeout(id);
  }, [celebrate]);

  const lines = speechLines(pet, today, playLog, missed);
  const line = lines[lineIdx % lines.length];
  useEffect(() => {
    const id = window.setInterval(() => setLineIdx(i => i + 1), 4500);
    return () => clearInterval(id);
  }, []);

  const stage = stageOf(pet.growth);
  const mood = moodOf(pet.happiness);
  const toNext = daysToNextStage(pet.growth);
  const sp = speciesById(pet.species);
  const wallpaper = [...pet.decor].reverse().map(petDecorById).find(d => d?.slot === 'wallpaper');
  const placed = pet.decor.map(petDecorById).filter((d): d is PetDecor => !!d && d.x !== undefined);
  const hasRug = pet.decor.includes('pet_rug');

  const tapPet = () => {
    playPop();
    setPet(pat(pet));
    setHop(h => h + 1);
    const id = Date.now();
    setHearts(h => [...h, id]);
    later(() => setHearts(h => h.filter(x => x !== id)), 1000);
    setLineIdx(i => i + 1);
  };

  const doFeed = () => {
    const fed = feed(pet, today);
    if (!fed) { say(`${pet.name} is full and happy! Come back tomorrow for another meal 🍽️`); return; }
    playCoin();
    setPet(fed);
    setHop(h => h + 1);
    say(`Yum! ${pet.name} loved that! 😋`);
  };

  const buyTreat = (t: typeof PET_TREATS[number]) => {
    if (coins < t.price) { playWrong(); say(`You need ${t.price - coins} more coins — play a game to earn some! 🪙`); return; }
    playCoin();
    setUserCurrency(coins - t.price);
    setPet(giveTreat(pet, t.happiness));
    setHop(h => h + 1);
    say(`${t.emoji} Munch munch! ${pet.name} is smiling!`);
  };

  const tapDecor = (d: PetDecor) => {
    const owned = pet.decor.includes(d.id);
    if (owned) {
      if (d.slot === 'wallpaper') { playClick(); setPet(addDecor(pet, d.id)); say(`${d.emoji} New wallpaper on!`); }
      return;
    }
    if (coins < d.price) { playWrong(); say(`You need ${d.price - coins} more coins — play a game to earn some! 🪙`); return; }
    playUnlock();
    setUserCurrency(coins - d.price);
    setPet(addDecor(pet, d.id));
    say(`${d.emoji} ${d.name} added to ${pet.name}'s room!`);
  };

  return (
    <div>
      {/* Name + stats */}
      <div className="rounded-3xl bg-white/10 p-4 mb-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px]">
          <div className="font-fredoka text-2xl">{pet.name} {MOOD_FACE[mood]}</div>
          <div className="font-nunito text-base text-violet-200">
            {sp.name} · {STAGE_NAMES[stage]} · {toNext === null ? 'Fully grown! 👑' : `grows in ${toNext} more day${toNext === 1 ? '' : 's'} of play`}
          </div>
        </div>
        <div className="w-full sm:w-56">
          <div className="font-nunito text-base mb-1">Happiness 💖</div>
          <div className="h-4 rounded-full bg-black/30 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-pink-400 to-yellow-300" animate={{ width: `${pet.happiness}%` }} transition={{ duration: 0.4 }} />
          </div>
        </div>
      </div>

      {/* Room */}
      <div className="relative w-full aspect-[4/3] max-h-[60vh] rounded-3xl overflow-hidden border-4 border-white/20 game-surface"
        style={{ background: wallpaper?.bg ?? 'linear-gradient(#fef3c7, #fcd34d)' }}>
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-amber-700/60" />
        {hasRug && <div className="absolute left-1/2 -translate-x-1/2 bottom-[6%] w-[46%] h-[14%] rounded-[50%] bg-fuchsia-500/80 border-4 border-fuchsia-300" />}
        {placed.map(d => (
          <span key={d.id} className="absolute text-4xl sm:text-5xl -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none"
            style={{ left: `${d.x}%`, top: `${d.y}%` }}>{d.emoji}</span>
        ))}

        {/* Speech bubble */}
        <AnimatePresence mode="wait">
          <motion.button key={line} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            onClick={() => setLineIdx(i => i + 1)}
            className="absolute left-1/2 -translate-x-1/2 top-[8%] max-w-[80%] min-h-[48px] rounded-2xl bg-white text-slate-900 font-nunito font-bold text-base sm:text-lg px-4 py-2 shadow-lg">
            {line}
          </motion.button>
        </AnimatePresence>

        {/* Pet */}
        <motion.button key={hop} aria-label={`Pat ${pet.name}`} onClick={tapPet}
          className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 select-none leading-none min-w-[96px] min-h-[96px]"
          initial={{ y: 0, scale: 1 }}
          animate={mood === 'sleepy' ? { y: [0, -4, 0], scale: [1, 1.08, 1] } : { y: [0, -24, 0] }}
          transition={{ repeat: Infinity, duration: mood === 'sleepy' ? 2.4 : 1.1, ease: 'easeInOut' }}
          style={{ fontSize: `${STAGE_SIZE[stage]}rem` }}>
          {petEmoji(pet)}
          {stage === 4 && <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl">👑</span>}
          {mood === 'sleepy' && <span className="absolute -top-2 -right-6 text-3xl">💤</span>}
        </motion.button>
        <AnimatePresence>
          {hearts.map(id => (
            <motion.span key={id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -90 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}
              className="absolute left-1/2 top-[42%] text-4xl pointer-events-none">💖</motion.span>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {celebrate && (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-x-4 bottom-4 rounded-2xl bg-indigo-950/90 border-2 border-yellow-300 font-fredoka text-xl text-center p-3">
              {celebrate}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {celebrate && <ConfettiBurst count={50} durationMs={2500} />}

      {/* Actions */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <button onClick={doFeed} className={`min-h-[64px] rounded-2xl font-fredoka text-xl ${canFeed(pet, today) ? 'bg-green-500' : 'bg-white/10'}`}>
          🍽️ {canFeed(pet, today) ? 'Feed (free)' : 'Fed today ✔'}
        </button>
        <button onClick={() => { playClick(); setPanel(p => (p === 'treats' ? 'none' : 'treats')); }}
          className={`min-h-[64px] rounded-2xl font-fredoka text-xl ${panel === 'treats' ? 'bg-fuchsia-500' : 'bg-white/15'}`}>🧁 Treats</button>
        <button onClick={() => { playClick(); setPanel(p => (p === 'shop' ? 'none' : 'shop')); }}
          className={`min-h-[64px] rounded-2xl font-fredoka text-xl ${panel === 'shop' ? 'bg-fuchsia-500' : 'bg-white/15'}`}>🛋️ Room Shop</button>
      </div>
      <p className="font-nunito text-base text-violet-200 mt-2 text-center">Tap {pet.name} for a pat! 🤚</p>

      {panel === 'treats' && (
        <div className="grid grid-cols-3 gap-3 mt-3">
          {PET_TREATS.map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => buyTreat(t)}
              className="rounded-2xl bg-white/10 border-2 border-white/15 p-3 min-h-[110px] flex flex-col items-center justify-center gap-1">
              <span className="text-4xl">{t.emoji}</span>
              <span className="font-fredoka text-lg">{t.name}</span>
              <span className={`font-nunito text-base ${coins >= t.price ? 'text-white' : 'text-white/50'}`}>🪙 {t.price} · +{t.happiness} 💖</span>
            </motion.button>
          ))}
        </div>
      )}

      {panel === 'shop' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
          {PET_DECOR.map(d => {
            const owned = pet.decor.includes(d.id);
            const on = d.slot === 'wallpaper' ? wallpaper?.id === d.id : owned;
            return (
              <motion.button key={d.id} whileTap={{ scale: 0.95 }} onClick={() => tapDecor(d)}
                className={`rounded-2xl p-3 min-h-[120px] flex flex-col items-center justify-center gap-1 border-2
                  ${on ? 'border-yellow-300 bg-yellow-400/20' : owned ? 'border-white/20 bg-white/10' : 'border-white/10 bg-black/20'}`}>
                {d.bg ? <span className="w-12 h-12 rounded-xl border-2 border-white" style={{ background: d.bg }} /> : <span className="text-4xl">{d.emoji}</span>}
                <span className="font-fredoka text-base text-center leading-tight">{d.name}</span>
                <span className={`font-nunito text-sm ${on ? 'text-yellow-300' : owned ? 'text-green-300' : coins >= d.price ? 'text-white' : 'text-white/50'}`}>
                  {on ? '✔ In the room' : owned ? 'Tap to use' : `🪙 ${d.price}`}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-indigo-950 border-2 border-yellow-300 px-6 py-3 font-fredoka text-lg shadow-2xl text-center max-w-[90vw]">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
