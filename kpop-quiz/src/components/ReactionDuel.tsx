import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { playClick, playCorrect, playPop, playWin, playTick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { NameSlots } from './games/partyNames';
import { slotName } from './games/partyNamesLogic';
import type { Slot } from './games/partyNamesLogic';
import { addPoint, duelScore, judgeRound, waitMs, GO_TIMEOUT_MS, ROUNDS, SECOND_TAP_MS } from './games/reactionDuelLogic';
import type { RoundOutcome, Tap } from './games/reactionDuelLogic';

type Phase = 'setup' | 'waiting' | 'go' | 'result' | 'final';

// Seat 0 sits at the bottom edge, seat 1 at the top edge (their half is upside-down, facing them).
const SLOTS: Slot[] = [
  { fallback: 'Red', emoji: '🔴', tone: 'bg-rose-500' },
  { fallback: 'Blue', emoji: '🔵', tone: 'bg-sky-500' },
];
const SIGNALS = ['⚡', '🌟', '🚀', '🔥', '💥'];
const DECOYS = ['🐢', '🍌', '🧦', '🐌'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export default function ReactionDuel() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [game, setGame] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [names, setNames] = useState(['', '']);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [round, setRound] = useState(0);
  const [signal, setSignal] = useState(SIGNALS[0]);
  const [decoy, setDecoy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [tapped, setTapped] = useState<[boolean, boolean]>([false, false]);
  const [best, setBest] = useState<number | null>(null);

  // Taps can arrive in the same frame, so the round lives in refs, not state.
  const phaseRef = useRef<Phase>('setup');
  const taps = useRef<Tap[]>([]);
  const goAt = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const roundRef = useRef(0);

  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const name = (i: number) => slotName(names, SLOTS, i);

  useEffect(() => () => clearTimers(), []);

  const advance = () => {
    const next = roundRef.current + 1;
    if (next >= ROUNDS) { playWin(); setP('final'); return; }
    roundRef.current = next;
    setRound(next);
    startRound();
  };

  const finishRound = () => {
    if (phaseRef.current !== 'waiting' && phaseRef.current !== 'go') return;
    clearTimers();
    setDecoy(null);
    const o = judgeRound(taps.current, goAt.current);
    setOutcome(o);
    setScores(s => addPoint(s, o));
    if (o.kind === 'win') {
      playCorrect();
      const t = o.times[o.player];
      if (t !== null) setBest(b => (b === null || t < b ? t : b));
    } else playPop();
    setP('result');
    after(advance, 2000);
  };

  function startRound() {
    clearTimers();
    taps.current = [];
    goAt.current = null;
    setTapped([false, false]);
    setOutcome(null);
    setDecoy(null);
    setP('waiting');
    const wait = waitMs(Math.random());
    if (Math.random() < 0.5) {
      const at = 500 + Math.random() * (wait - 1100);
      after(() => { playTick(); setDecoy(pick(DECOYS)); }, at);
      after(() => setDecoy(null), at + 450);
    }
    after(() => {
      setDecoy(null);
      setSignal(pick(SIGNALS));
      goAt.current = performance.now();
      setP('go');
      after(finishRound, GO_TIMEOUT_MS);
    }, wait);
  }

  const onTap = (player: 0 | 1) => {
    const ph = phaseRef.current;
    if (status !== 'playing' || (ph !== 'waiting' && ph !== 'go')) return;
    if (taps.current.some(t => t.player === player)) return;
    taps.current.push({ player, at: performance.now() });
    setTapped(t => (player === 0 ? [true, t[1]] : [t[0], true]));
    if (ph === 'waiting') { finishRound(); return; }
    if (taps.current.length === 1) {
      playPop();
      clearTimers();
      after(finishRound, SECOND_TAP_MS);
    } else finishRound();
  };

  const pause = () => { clearTimers(); setStatus('paused'); };
  const resume = () => {
    setStatus('playing');
    if (phaseRef.current === 'waiting' || phaseRef.current === 'go') startRound();
    if (phaseRef.current === 'result') after(advance, 800);
  };

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && status === 'playing') { clearTimers(); setStatus('paused'); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [status]);

  const start = () => {
    clearTimers();
    setScores([0, 0]);
    roundRef.current = 0;
    setRound(0);
    setBest(null);
    setOutcome(null);
    setP('setup');
    setGame(g => g + 1);
    setStatus('playing');
  };

  const begin = () => { playClick(); startRound(); };

  const leader = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null;
  const playing = phase === 'waiting' || phase === 'go' || phase === 'result';

  const zoneBg = phase === 'go' ? 'bg-green-500' : decoy ? 'bg-amber-500' : 'bg-slate-900/70';

  const zoneContent = (p: 0 | 1) => {
    if (phase === 'result' && outcome) {
      if (outcome.kind === 'early') {
        return outcome.player === p
          ? <><div className="text-6xl">🙈</div><p className="font-fredoka text-3xl">Too early!</p><p className="font-nunito text-lg">Wait for green next time</p></>
          : <><div className="text-6xl">⭐</div><p className="font-fredoka text-3xl">Point to you!</p></>;
      }
      if (outcome.kind === 'none') return <><div className="text-6xl">😴</div><p className="font-fredoka text-3xl">Nobody tapped!</p></>;
      const t = outcome.times[p];
      return outcome.player === p
        ? <><div className="text-6xl">🏅</div><p className="font-fredoka text-4xl">Fastest!</p><p className="font-fredoka text-2xl">{t} ms</p></>
        : <><div className="text-6xl">💪</div><p className="font-fredoka text-3xl">So close!</p><p className="font-fredoka text-2xl">{t !== null ? `${t} ms` : 'Next one!'}</p></>;
    }
    if (phase === 'go') {
      return tapped[p]
        ? <><div className="text-6xl">✅</div><p className="font-fredoka text-3xl">Got it!</p></>
        : <><div className="text-8xl drop-shadow-lg">{signal}</div><p className="font-fredoka text-5xl drop-shadow">TAP!</p></>;
    }
    if (decoy) return <><div className="text-8xl">{decoy}</div><p className="font-fredoka text-3xl">Not yet! Wait for green</p></>;
    return <><div className="text-5xl opacity-70">👆</div><p className="font-fredoka text-3xl opacity-80">Wait for green…</p></>;
  };

  const zone = (p: 0 | 1) => (
    <div role="button" aria-label={`${name(p)} tap zone`} data-zone={p}
      onPointerDown={e => { e.preventDefault(); onTap(p); }}
      onContextMenu={e => e.preventDefault()}
      className={`relative flex-1 min-h-0 flex flex-col items-center justify-center gap-2 text-center select-none transition-colors duration-75 ${zoneBg} ${p === 1 ? 'rotate-180' : ''}`}
      style={{ touchAction: 'none' }}>
      <div className={`absolute top-3 left-3 rounded-full px-4 py-1 font-fredoka text-xl ${SLOTS[p].tone}`}>{SLOTS[p].emoji} {name(p)} · {scores[p]}</div>
      {zoneContent(p)}
    </div>
  );

  return (
    <GameShell
      celebrateEnd
      gameId="reaction_duel"
      title="Reaction Duel"
      icon="👆"
      xpScale={0.2}
      status={status}
      score={duelScore(scores)}
      round={game}
      formatScore={s => `${s} pts`}
      overTitle={leader === null ? 'A perfect tie! 🤝' : `${name(leader)} wins! 🏆`}
      overStats={[
        { label: `${SLOTS[0].emoji} ${name(0)}`, value: `${scores[0]} pts` },
        { label: `${SLOTS[1].emoji} ${name(1)}`, value: `${scores[1]} pts` },
        ...(best !== null ? [{ label: '⚡ Fastest tap', value: `${best} ms` }] : []),
      ]}
      onStart={start}
      onPause={pause}
      onResume={resume}
      readyContent={
        <div className="space-y-2 font-nunito text-lg text-violet-100">
          <p>2 players sit at opposite ends of the iPad. 📱</p>
          <p>When your half turns <span className="text-green-300 font-bold">GREEN</span>, tap it as fast as you can! ⚡</p>
          <p>Watch out for silly decoys 🍌 — tapping early gives your friend the point.</p>
          <p className="font-fredoka">{ROUNDS} rounds</p>
        </div>
      }
    >
      <div className="absolute inset-0 flex flex-col" style={{ touchAction: phase === 'setup' ? 'pan-y' : 'none' }}>
        {phase === 'final' && leader !== null && <ConfettiBurst count={80} durationMs={3000} />}

        {phase === 'setup' && (
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="max-w-2xl mx-auto flex flex-col gap-3">
              <h2 className="font-fredoka text-3xl text-center">Who's dueling? ⚡</h2>
              <p className="font-nunito text-lg text-violet-200 text-center">🔴 sits at the bottom, 🔵 at the top. Names are optional.</p>
              <NameSlots names={names} slots={SLOTS} onChange={setNames} />
              <button type="button" onClick={begin}
                className="min-h-[60px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                ⚡ Start duel!
              </button>
            </div>
          </div>
        )}

        {playing && (
          <>
            {zone(1)}
            <div className="shrink-0 flex items-center justify-center gap-4 py-2 bg-black/50 font-fredoka text-xl">
              <span>Round {Math.min(round + 1, ROUNDS)}/{ROUNDS}</span>
              <span className="text-violet-300">·</span>
              <span>{SLOTS[0].emoji} {scores[0]} – {scores[1]} {SLOTS[1].emoji}</span>
            </div>
            {zone(0)}
          </>
        )}

        <AnimatePresence>
          {phase === 'final' && status !== 'over' && (
            <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-3xl bg-indigo-900/90 border-2 border-fuchsia-400/60 p-6 text-center flex flex-col gap-3">
                <div className="text-7xl">{leader !== null ? '🏆' : '🤝'}</div>
                <h2 className="font-fredoka text-4xl text-yellow-300">{leader !== null ? `${name(leader)} wins!` : "It's a tie!"}</h2>
                <p className="font-nunito text-lg text-violet-200">Lightning-fast fingers on both sides! ⚡</p>
                <div className="grid grid-cols-2 gap-2">
                  {([0, 1] as const).map(i => (
                    <div key={i} className={`rounded-2xl py-3 font-fredoka ${SLOTS[i].tone}`}>
                      <div className="text-lg truncate px-2">{SLOTS[i].emoji} {name(i)}</div>
                      <div className="text-4xl">{scores[i]}</div>
                    </div>
                  ))}
                </div>
                {best !== null && <p className="font-fredoka text-xl">⚡ Fastest tap: {best} ms</p>}
                <button type="button" onClick={() => { playClick(); setStatus('over'); }}
                  className="min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                  🎉 Finish
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GameShell>
  );
}
