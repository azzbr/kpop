import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, MAX_TOD_CUSTOM } from '../store';
import type { RoundResult } from '../store';
import { TOD_CARDS, TOD_PACKS } from '../data/truthOrDare';
import type { TodCard, TodLevel, TodPack } from '../data/truthOrDare';
import { activeEvent } from '../events/events';
import { localDateKey } from '../utils/dates';
import { createRng } from '../games/engine/rng';
import { isClean } from '../utils/cleanText';
import { playClick, playPop, playTick, playTimeOut, playUnlock, playWin, playCorrect } from '../utils/sounds';
import OnScreenKeyboard from './ui/OnScreenKeyboard';
import ConfettiBurst from './ConfettiBurst';
import DoodleCanvas from './draw/DoodleCanvas';
import { cleanName } from './games/wouldYouRatherLogic';
import {
  MIN_PLAYERS, MAX_PLAYERS, LAP_CHOICES, newPlayer, lapOrder, buildPools, drawCard, customToCards,
  applyTurn, starsFor, places, awards, wheelRotation, type TodPlayer,
} from './games/truthOrDareLogic';

// Truth or Dare for 2–8 players on one iPad. Rules live in games/truthOrDareLogic.ts,
// cards in data/truthOrDare.ts. Kind judging only: "Did it ✅" or "Chicken 🐔" — no thumbs-down.

type Phase = 'setup' | 'cards' | 'spin' | 'choose' | 'card' | 'finale';
type Choice = 'truth' | 'dare' | 'surprise';

const AVATARS = ['🦊', '🐼', '🦄', '🐯', '🐸', '🐙', '🐧', '🦁'];
const COLORS = ['#ec4899', '#8b5cf6', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1'];
const QUICK_NAMES = ['Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Sam', 'Lily', 'Noah'];
const LEVELS: { id: TodLevel; label: string; emoji: string; hint: string }[] = [
  { id: 1, label: 'Easy', emoji: '🌱', hint: 'Gentle and giggly' },
  { id: 2, label: 'Brave', emoji: '🔥', hint: 'Bigger and bolder' },
  { id: 3, label: 'Super brave', emoji: '🤯', hint: 'The silliest of all' },
];
const CARD_EMOJIS = ['🤪', '😂', '🎭', '🎤', '🐾', '🦄', '🚀', '⭐', '🌈', '🐸', '🧠', '💃'];
const MAX_NAME = 10;
const MAX_CARD = 100;
// Score for the reward: all stars earned by the group. A 4-player, 3-lap game is about 18 ⭐.
const XP_SCALE = 0.45;

const pill = 'min-h-[48px] px-4 rounded-full font-fredoka text-lg';
const bigBtn = 'w-full min-h-[60px] rounded-full font-fredoka text-2xl shadow-lg disabled:opacity-40';

function Wheel({ players, rotation, onSpin, spinning }: { players: TodPlayer[]; rotation: number; onSpin: () => void; spinning: boolean }) {
  const n = players.length;
  const r = 150;
  const wedge = (Math.PI * 2) / n;
  // Wedge i spans clockwise from the top: angle 0 = 12 o'clock.
  const pt = (a: number, rad = r) => [160 + rad * Math.sin(a), 160 - rad * Math.cos(a)];
  return (
    <div className="relative mx-auto w-[min(80vw,360px)] aspect-square">
      <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-10 text-5xl drop-shadow-lg" aria-hidden>🔻</div>
      {/* Clip to a circle: the rotating square would otherwise poke out over the buttons below. */}
      <div className="w-full h-full rounded-full overflow-hidden shadow-2xl">
      <motion.svg viewBox="0 0 320 320" className="w-full h-full cursor-pointer" role="button" aria-label="Spin the wheel"
        onClick={() => !spinning && onSpin()} animate={{ rotate: rotation }}
        transition={{ duration: spinning ? 3.2 : 0, ease: [0.12, 0.8, 0.22, 1] }} data-testid="tod-wheel">
        {players.map((p, i) => {
          const a0 = i * wedge, a1 = (i + 1) * wedge;
          const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
          const mid = (a0 + a1) / 2;
          const [tx, ty] = pt(mid, r * 0.62);
          const path = n === 1 ? '' : `M160,160 L${x0},${y0} A${r},${r} 0 ${wedge > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`;
          return (
            <g key={i}>
              <path d={path} fill={p.color} stroke="#fff" strokeWidth={3} />
              <text x={tx} y={ty - 8} textAnchor="middle" dominantBaseline="middle" fontSize={n > 6 ? 26 : 34}
                transform={`rotate(${(mid * 180) / Math.PI} ${tx} ${ty})`}>{p.emoji}</text>
              <text x={tx} y={ty + 22} textAnchor="middle" dominantBaseline="middle" fontSize={n > 6 ? 14 : 18} fill="#fff"
                fontFamily="Fredoka One, sans-serif" transform={`rotate(${(mid * 180) / Math.PI} ${tx} ${ty})`}>{p.name}</text>
            </g>
          );
        })}
        <circle cx="160" cy="160" r="26" fill="#fff" />
        <text x="160" y="161" textAnchor="middle" dominantBaseline="middle" fontSize="26">🎲</text>
      </motion.svg>
      </div>
    </div>
  );
}

function TimerRing({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const l = Math.max(0, seconds - Math.floor((Date.now() - t0) / 1000));
      setLeft(prev => {
        if (l !== prev && l <= 3 && l > 0) playTick();
        return l;
      });
      if (l <= 0) { window.clearInterval(id); playTimeOut(); done.current(); }
    }, 200);
    return () => window.clearInterval(id);
  }, [seconds]);
  const c = 2 * Math.PI * 34;
  return (
    <div className="relative w-24 h-24 mx-auto" role="timer" aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,.2)" strokeWidth="8" fill="none" />
        <circle cx="40" cy="40" r="34" stroke="#facc15" strokeWidth="8" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - left / seconds)} style={{ transition: 'stroke-dashoffset .2s linear' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-fredoka text-3xl">{left}</div>
    </div>
  );
}

export default function TruthOrDare() {
  const { setGameState, todCustom, saveTodCard, deleteTodCard } = useGameStore();
  const eventId = activeEvent(localDateKey())?.id;
  const packChoices = useMemo(() => TOD_PACKS.filter(p => !p.event || p.event === eventId), [eventId]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [names, setNames] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [packs, setPacks] = useState<TodPack[]>(['silly', 'act', 'animals']);
  const [useCustom, setUseCustom] = useState(false);
  const [level, setLevel] = useState<TodLevel>(1);
  const [laps, setLaps] = useState(3);
  const [confirmBack, setConfirmBack] = useState(false);

  // Game state
  const rng = useRef(createRng(Date.now() % 1e9));
  const [players, setPlayers] = useState<TodPlayer[]>([]);
  const [queue, setQueue] = useState<number[]>([]);
  const [lap, setLap] = useState(1);
  const [who, setWho] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [card, setCard] = useState<TodCard | null>(null);
  const [surprise, setSurprise] = useState(false);
  const [partner, setPartner] = useState<number | null>(null);
  const [funny, setFunny] = useState<Set<number>>(new Set());
  const [timerOn, setTimerOn] = useState(false);
  const [toast, setToast] = useState('');
  const [result, setResult] = useState<RoundResult | null>(null);
  const seen = useRef({ truth: new Set<string>(), dare: new Set<string>() });
  const lastPlayer = useRef<number | null>(null);

  const pools = useMemo(() => buildPools(TOD_CARDS, packs, level, useCustom ? customToCards(todCustom) : []), [packs, level, useCustom, todCustom]);
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast(''), 2000); };

  // ---------------------------------------------------------------- setup
  const addName = useCallback((raw: string) => {
    const name = cleanName(raw).slice(0, MAX_NAME);
    if (!name) { setMsg('Type a name first ✏️'); return; }
    if (names.length >= MAX_PLAYERS) { setMsg(`${MAX_PLAYERS} players max!`); return; }
    if (names.some(n => n.toLowerCase() === name.toLowerCase())) { setMsg(`${name} is already playing!`); return; }
    playPop();
    setNames(ns => [...ns, name]);
    setTyped('');
    setMsg(null);
  }, [names]);
  const onKey = useCallback((l: string) => setTyped(t => (t.length < MAX_NAME ? t + l : t)), []);
  const onBackspace = useCallback(() => setTyped(t => t.slice(0, -1)), []);
  const onEnter = useCallback(() => addName(typed), [addName, typed]);

  const canStart = names.length >= MIN_PLAYERS && pools.truths.length > 0 && pools.dares.length > 0;

  const start = () => {
    playUnlock();
    rng.current = createRng(Date.now() % 1e9);
    const ps = names.map((n, i) => newPlayer(n, AVATARS[i % AVATARS.length], COLORS[i % COLORS.length]));
    setPlayers(ps);
    seen.current = { truth: new Set(), dare: new Set() };
    lastPlayer.current = null;
    const order = lapOrder(ps.length, null, rng.current);
    setQueue(order);
    setLap(1);
    setResult(null);
    setPhase('spin');
  };

  // ---------------------------------------------------------------- turns
  const spin = () => {
    if (spinning || queue.length === 0) return;
    playClick();
    const next = queue[0];
    setWho(next);
    setSpinning(true);
    const rot = wheelRotation(rotation, players.length, next, rng.current);
    setRotation(rot);
    // Ticks that slow down with the wheel.
    let t = 0;
    for (let i = 0; i < 14; i++) { t += 60 + i * i * 2.2; window.setTimeout(playTick, t); }
    window.setTimeout(() => { setSpinning(false); playPop(); setPhase('choose'); }, 3300);
  };

  const deal = (kind: 'truth' | 'dare', isSurprise: boolean) => {
    const pool = kind === 'truth' ? pools.truths : pools.dares;
    const { card: c, reshuffled } = drawCard(pool, seen.current[kind], rng.current);
    if (reshuffled) say('Shuffling the deck! 🔀');
    setCard(c);
    setSurprise(isSurprise);
    setPartner(null);
    setFunny(new Set());
    setTimerOn(false);
    setPhase('card');
  };

  const choose = (c: Choice) => {
    playClick();
    if (c === 'surprise') deal(rng.current() < 0.5 ? 'truth' : 'dare', true);
    else deal(c, false);
  };

  const chicken = () => {
    if (!card || players[who].skipsLeft <= 0) return;
    playClick();
    setPlayers(ps => applyTurn(ps, who, card, 'chicken', false, null, 0));
    say('🐔 Bawk! Here’s a new one');
    deal(card.kind === 'truth' ? 'truth' : 'dare', surprise);
  };

  const finish = (ps: TodPlayer[]) => {
    const store = useGameStore.getState();
    // Running totals for the badges, saved before finishRound checks them.
    const dares = ps.reduce((s, p) => s + p.dares, 0);
    store.submitScore('truth_or_dare_dares', (store.highScores.truth_or_dare_dares ?? 0) + dares);
    if (level === 3) store.submitScore('truth_or_dare_super', 1);
    const total = ps.reduce((s, p) => s + p.stars, 0);
    setResult(useGameStore.getState().finishRound('truth_or_dare', total, XP_SCALE));
    playWin();
    setPhase('finale');
  };

  const didIt = () => {
    if (!card) return;
    if (card.kind === 'double' && partner === null) { say('Pick a partner first 👯'); return; }
    playCorrect();
    const ps = applyTurn(players, who, card, 'done', surprise, partner, funny.size);
    const gained = starsFor(card, 'done', surprise);
    say(`+${gained} ⭐ ${card.kind === 'everyone' ? 'for everyone!' : ''}`);
    setPlayers(ps);
    lastPlayer.current = who;
    const rest = queue.slice(1);
    if (rest.length > 0) { setQueue(rest); setPhase('spin'); return; }
    if (lap >= laps) { finish(ps); return; }
    setLap(l => l + 1);
    setQueue(lapOrder(ps.length, who, rng.current));
    setPhase('spin');
  };

  const back = () => {
    playClick();
    if (phase !== 'setup' && phase !== 'cards' && phase !== 'finale' && !confirmBack) {
      setConfirmBack(true);
      window.setTimeout(() => setConfirmBack(false), 3000);
      return;
    }
    setGameState('game_mode');
  };

  const me = players[who];
  const isDraw = card?.pack === 'draw' && card.kind !== 'truth';
  const placeList = places(players);

  return (
    <div className="arcade-bg game-surface fixed inset-0 z-40 flex flex-col text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {phase === 'finale' && <ConfettiBurst count={90} durationMs={3500} />}
      <header className="flex items-center gap-3 px-3 py-2 bg-black/30">
        <button onClick={back} className={`${pill} ${confirmBack ? 'bg-red-500' : 'bg-white/15'}`}>{confirmBack ? 'End the game? Tap again' : '← Back'}</button>
        <h1 className="flex-1 font-fredoka text-xl md:text-2xl truncate">🎭 Truth or Dare</h1>
        {phase !== 'setup' && phase !== 'cards' && phase !== 'finale' && <span className="font-fredoka text-lg rounded-full bg-white/10 px-3 py-1">Lap {lap}/{laps}</span>}
      </header>

      {players.length > 0 && phase !== 'setup' && phase !== 'cards' && (
        <div className="flex gap-2 overflow-x-auto px-3 py-2 bg-black/20" aria-label="Scores">
          {players.map((p, i) => (
            <div key={i} className={`shrink-0 rounded-full px-3 py-1 font-fredoka text-lg flex items-center gap-1 ${i === who && phase !== 'finale' ? 'ring-2 ring-yellow-300' : ''}`} style={{ background: p.color }}>
              {p.emoji} {p.name} <span className="text-yellow-200">⭐{p.stars}</span>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {phase === 'setup' && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                <section className="rounded-3xl bg-white/10 p-4 flex flex-col gap-3">
                  <h2 className="font-fredoka text-2xl">Who's playing? <span className="text-violet-200 text-lg">({names.length}/{MAX_PLAYERS})</span></h2>
                  <div className="flex flex-wrap gap-2 min-h-[52px]">
                    {names.length === 0 && <p className="font-nunito text-lg text-violet-200 self-center">Add 2 to 8 players</p>}
                    {names.map((n, i) => (
                      <button key={n} onClick={() => { playClick(); setNames(ns => ns.filter(x => x !== n)); }}
                        className="min-h-[48px] rounded-full pl-3 pr-2 font-fredoka text-lg flex items-center gap-2" style={{ background: COLORS[i % COLORS.length] }} aria-label={`Remove ${n}`}>
                        {AVATARS[i % AVATARS.length]} {n} <span className="rounded-full bg-black/25 w-8 h-8 flex items-center justify-center">✕</span>
                      </button>
                    ))}
                  </div>
                  {names.length < MAX_PLAYERS && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_NAMES.filter(n => !names.includes(n)).map(n => (
                          <button key={n} onClick={() => addName(n)} className="min-h-[44px] px-4 rounded-full bg-indigo-500/60 font-fredoka text-base">+ {n}</button>
                        ))}
                      </div>
                      <div className="min-h-[56px] rounded-2xl bg-white/10 border-2 border-white/30 px-4 flex items-center justify-center font-fredoka text-2xl">
                        {typed || <span className="text-white/40 font-nunito text-lg">…or type a name</span>}
                      </div>
                      {msg && <div className="text-center font-nunito text-base text-yellow-200">{msg}</div>}
                      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} enterLabel="Add" />
                    </>
                  )}
                </section>

                <section className="rounded-3xl bg-white/10 p-4">
                  <h2 className="font-fredoka text-2xl mb-2">Card packs</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {packChoices.map(p => {
                      const on = packs.includes(p.id);
                      return (
                        <button key={p.id} aria-pressed={on} onClick={() => { playClick(); setPacks(ps => (on ? ps.filter(x => x !== p.id) : [...ps, p.id])); }}
                          className={`min-h-[56px] rounded-2xl px-3 font-fredoka text-lg text-left ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                          {p.emoji} {p.title} {on && '✓'}
                        </button>
                      );
                    })}
                    <button aria-pressed={useCustom} onClick={() => { playClick(); setUseCustom(v => !v); }}
                      className={`min-h-[56px] rounded-2xl px-3 font-fredoka text-lg text-left ${useCustom ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                      ✍️ Our cards ({todCustom.length}) {useCustom && '✓'}
                    </button>
                  </div>
                  <button onClick={() => { playClick(); setPhase('cards'); }} className={`${pill} bg-white/15 mt-3`}>✍️ Write our own cards</button>
                </section>

                <section className="rounded-3xl bg-white/10 p-4">
                  <h2 className="font-fredoka text-2xl mb-2">How brave?</h2>
                  <div className="grid grid-cols-3 gap-2">
                    {LEVELS.map(l => (
                      <button key={l.id} aria-pressed={level === l.id} onClick={() => { playClick(); setLevel(l.id); }}
                        className={`min-h-[72px] rounded-2xl px-2 font-fredoka text-lg ${level === l.id ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                        <div className="text-2xl">{l.emoji}</div>{l.label}
                        <div className="font-nunito text-xs opacity-80">{l.hint}</div>
                      </button>
                    ))}
                  </div>
                  <h2 className="font-fredoka text-2xl mt-4 mb-2">Laps <span className="font-nunito text-base text-violet-200">(everyone goes once per lap)</span></h2>
                  <div className="flex gap-2">
                    {LAP_CHOICES.map(n => (
                      <button key={n} aria-pressed={laps === n} onClick={() => { playClick(); setLaps(n); }}
                        className={`min-h-[52px] min-w-[64px] rounded-2xl font-fredoka text-xl ${laps === n ? 'bg-fuchsia-500' : 'bg-white/10'}`}>{n}</button>
                    ))}
                  </div>
                </section>

                <button disabled={!canStart} onClick={start} className={`${bigBtn} bg-gradient-to-r from-fuchsia-500 to-orange-400`}>
                  {names.length < MIN_PLAYERS ? `Add ${MIN_PLAYERS - names.length} more player${MIN_PLAYERS - names.length > 1 ? 's' : ''} 👆` : !canStart ? 'Pick at least one pack 👆' : `▶ Start with ${names.length} players`}
                </button>
              </motion.div>
            )}

            {phase === 'cards' && <CardWriter key="cards" cards={todCustom} onSave={saveTodCard} onDelete={deleteTodCard} onDone={() => setPhase('setup')} />}

            {phase === 'spin' && (
              <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-2">
                <h2 className="font-fredoka text-3xl text-center">{spinning ? 'Round and round… 🎡' : 'Spin to see who’s next!'}</h2>
                <Wheel players={players} rotation={rotation} onSpin={spin} spinning={spinning} />
                <button onClick={spin} disabled={spinning} className={`${bigBtn} max-w-sm bg-gradient-to-r from-yellow-400 to-orange-500`}>🎡 Spin!</button>
              </motion.div>
            )}

            {phase === 'choose' && me && (
              <motion.div key={`choose-${lap}-${who}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4 text-center">
                <div className="text-7xl">{me.emoji}</div>
                <h2 className="font-fredoka text-4xl" data-testid="tod-turn">{me.name}’s turn!</h2>
                <p className="font-nunito text-xl text-violet-200">Truth or dare?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => choose('truth')} className="min-h-[150px] rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 font-fredoka text-3xl shadow-xl">💬<br />Truth</button>
                  <button onClick={() => choose('dare')} className="min-h-[150px] rounded-3xl bg-gradient-to-br from-orange-400 to-pink-600 font-fredoka text-3xl shadow-xl">⚡<br />Dare</button>
                </div>
                <button onClick={() => choose('surprise')} className={`${bigBtn} bg-gradient-to-r from-violet-500 to-fuchsia-500`}>🎲 Surprise me! <span className="text-lg">(+1 ⭐)</span></button>
              </motion.div>
            )}

            {phase === 'card' && card && me && (
              <motion.div key={`card-${card.id}`} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
                className="flex flex-col gap-3">
                <div className={`rounded-3xl p-6 text-center shadow-2xl ${card.kind === 'truth' ? 'bg-gradient-to-br from-sky-500 to-indigo-700' : 'bg-gradient-to-br from-orange-400 to-pink-600'}`} data-testid="tod-card">
                  <div className="font-fredoka text-lg opacity-90 mb-1">
                    {me.emoji} {me.name} · {card.kind === 'truth' ? '💬 Truth' : card.kind === 'dare' ? '⚡ Dare' : card.kind === 'everyone' ? '🎉 Everyone!' : '👯 Double dare'}
                    {surprise && ' · 🎲'}
                  </div>
                  <div className="text-6xl my-2">{card.emoji}</div>
                  <p className="font-fredoka text-2xl md:text-3xl leading-snug">{card.text}</p>
                  {card.timer && (
                    <div className="mt-4">
                      {timerOn
                        ? <TimerRing seconds={card.timer} onDone={() => setTimerOn(false)} />
                        : <button onClick={() => { playClick(); setTimerOn(true); }} className={`${pill} bg-black/25`}>⏱️ Start {card.timer}s timer</button>}
                    </div>
                  )}
                </div>

                {isDraw && (
                  <div className="h-[min(62dvh,560px)] rounded-3xl bg-black/20 p-2">
                    <DoodleCanvas compact background="#ffffff" />
                  </div>
                )}

                {card.kind === 'double' && (
                  <div>
                    <p className="font-fredoka text-xl mb-2">👯 Pick a partner:</p>
                    <div className="flex flex-wrap gap-2">
                      {players.map((p, i) => i !== who && (
                        <button key={i} aria-pressed={partner === i} aria-label={`Partner ${p.name}`} onClick={() => { playClick(); setPartner(i); }}
                          className={`min-h-[48px] px-4 rounded-full font-fredoka text-lg ${partner === i ? 'ring-4 ring-white' : ''}`} style={{ background: p.color }}>{p.emoji} {p.name}</button>
                      ))}
                    </div>
                  </div>
                )}

                {players.length > 1 && card.kind !== 'everyone' && (
                  <div>
                    <p className="font-nunito text-base text-violet-200 mb-1">Was it funny? Tap your face 😂 (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {players.map((p, i) => i !== who && (
                        <button key={i} aria-pressed={funny.has(i)} aria-label={`${p.name} laughed`}
                          onClick={() => { playPop(); setFunny(f => { const n = new Set(f); if (n.has(i)) n.delete(i); else n.add(i); return n; }); }}
                          className={`min-h-[48px] px-3 rounded-full font-fredoka text-lg ${funny.has(i) ? 'bg-yellow-400 text-slate-900' : 'bg-white/10'}`}>
                          {p.emoji} {funny.has(i) ? '😂' : '🙂'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={chicken} disabled={me.skipsLeft <= 0} className={`${bigBtn} bg-white/15 !text-xl`}>
                    🐔 Chicken <span className="text-base">({me.skipsLeft} left)</span>
                  </button>
                  <button onClick={didIt} className={`${bigBtn} bg-gradient-to-r from-green-500 to-emerald-500`}>✅ Did it!</button>
                </div>
              </motion.div>
            )}

            {phase === 'finale' && (
              <motion.div key="finale" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 text-center">
                <h2 className="font-fredoka text-4xl">🏆 {(() => {
                  const winners = players.filter((_, i) => placeList[i] === 1).map(p => p.name);
                  return winners.length > 1 ? `${winners.join(' & ')} share the win!` : `${winners[0]} wins!`;
                })()}</h2>
                <div className="flex flex-col gap-2">
                  {players.map((p, i) => ({ p, place: placeList[i] })).sort((a, b) => a.place - b.place).map(({ p, place }) => (
                    <div key={p.name} className="flex items-center gap-3 rounded-2xl px-4 py-3 font-fredoka text-2xl" style={{ background: p.color }}>
                      <span className="w-10">{['🥇', '🥈', '🥉'][place - 1] ?? place}</span>
                      <span>{p.emoji}</span><span className="flex-1 text-left">{p.name}</span><span>⭐ {p.stars}</span>
                    </div>
                  ))}
                </div>
                {awards(players).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {awards(players).map(a => (
                      <div key={a.title} className="rounded-2xl bg-white/10 p-3">
                        <div className="text-4xl">{a.emoji}</div>
                        <div className="font-fredoka text-lg">{a.title}</div>
                        <div className="font-nunito text-base text-violet-100">{a.winners.map(i => players[i].name).join(' & ')}</div>
                      </div>
                    ))}
                  </div>
                )}
                {result && <p className="font-fredoka text-xl text-fuchsia-300">+{result.xp} XP · +{result.coins} 🪙</p>}
                <button onClick={start} className={`${bigBtn} bg-gradient-to-r from-fuchsia-500 to-orange-400`}>🔁 Play again</button>
                <button onClick={() => { playClick(); setPhase('setup'); }} className={`${pill} bg-white/15`}>Change players or packs</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} role="status"
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-white text-violet-900 font-fredoka text-xl px-6 py-3 shadow-xl">{toast}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CardWriter({ cards, onSave, onDelete, onDone }: {
  cards: { id: string; kind: 'truth' | 'dare'; text: string; emoji: string }[];
  onSave: (c: { id: string; kind: 'truth' | 'dare'; text: string; emoji: string }) => void;
  onDelete: (id: string) => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<'truth' | 'dare'>('dare');
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState(CARD_EMOJIS[0]);
  const [msg, setMsg] = useState<string | null>(null);
  const onKey = useCallback((l: string) => setText(t => (t.length < MAX_CARD ? t + l : t)), []);
  const onBackspace = useCallback(() => setText(t => t.slice(0, -1)), []);
  const add = useCallback(() => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length < 8) { setMsg('Write a bit more ✏️'); return; }
    if (!isClean(clean)) { setMsg('Let’s keep it kind and friendly 💛'); return; }
    if (cards.length >= MAX_TOD_CUSTOM) { setMsg(`${MAX_TOD_CUSTOM} cards max — delete one first`); return; }
    playPop();
    onSave({ id: Date.now().toString(36), kind, text: clean.charAt(0).toUpperCase() + clean.slice(1), emoji });
    setText('');
    setMsg('Added! ✨');
  }, [text, kind, emoji, cards.length, onSave]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-fredoka text-2xl mr-auto">✍️ Our cards ({cards.length}/{MAX_TOD_CUSTOM})</h2>
        <button onClick={() => { playClick(); onDone(); }} className={`${pill} bg-gradient-to-r from-fuchsia-500 to-orange-400`}>Done</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['truth', 'dare'] as const).map(k => (
          <button key={k} aria-pressed={kind === k} onClick={() => { playClick(); setKind(k); }}
            className={`min-h-[52px] rounded-2xl font-fredoka text-xl ${kind === k ? 'bg-fuchsia-500' : 'bg-white/10'}`}>{k === 'truth' ? '💬 Truth' : '⚡ Dare'}</button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CARD_EMOJIS.map(e => (
          <button key={e} onClick={() => setEmoji(e)} aria-label={`Emoji ${e}`} className={`shrink-0 w-12 h-12 rounded-xl text-2xl ${emoji === e ? 'bg-fuchsia-500' : 'bg-white/10'}`}>{e}</button>
        ))}
      </div>
      <div className="min-h-[72px] rounded-2xl bg-white/10 border-2 border-white/30 px-4 py-3 font-fredoka text-xl">
        {text ? <>{emoji} {text}</> : <span className="text-white/40 font-nunito text-lg">{kind === 'truth' ? 'e.g. What would you name a pet dragon?' : 'e.g. Walk like a penguin to the door and back'}</span>}
      </div>
      {msg && <p className="font-nunito text-base text-yellow-200 text-center">{msg}</p>}
      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={add} enterLabel="Add" space digits />
      <div className="flex flex-col gap-2">
        {cards.map(c => (
          <div key={c.id} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
            <span className="text-2xl">{c.emoji}</span>
            <span className="flex-1 font-nunito text-lg">{c.kind === 'truth' ? '💬' : '⚡'} {c.text}</span>
            <button aria-label="Delete card" onClick={() => { playClick(); onDelete(c.id); }} className="w-11 h-11 rounded-full bg-white/15">🗑️</button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
