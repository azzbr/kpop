import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { playClick, playCorrect, playWin, playPop, playTick } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { NameSlots } from './games/partyNames';
import { slotName } from './games/partyNamesLogic';
import type { Slot } from './games/partyNamesLogic';
import { matchScore, pullRope, roundWinner, LEFT_GOAL, RIGHT_GOAL, WIN_SCORE } from './games/tugOfWarLogic';

type Phase = 'setup' | 'countdown' | 'battle' | 'round_result' | 'final';

const SLOTS: Slot[] = [
  { fallback: 'Red', emoji: '🔴', tone: 'bg-rose-500' },
  { fallback: 'Blue', emoji: '🔵', tone: 'bg-sky-500' },
];
const PAD = ['from-rose-500 to-red-600', 'from-sky-500 to-indigo-600'];

export default function TugOfWar() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [game, setGame] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [names, setNames] = useState(['', '']);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [round, setRound] = useState(1);
  const [pos, setPos] = useState(50);
  const [countdown, setCountdown] = useState(3);
  const [lastWinner, setLastWinner] = useState<0 | 1 | null>(null);
  const [pulls, setPulls] = useState<[number, number]>([0, 0]);
  const tapCount = useRef(0);
  const name = (i: number) => slotName(names, SLOTS, i);

  // Pause when she switches apps.
  useEffect(() => {
    const onVis = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 3-2-1 before each round
  useEffect(() => {
    if (status !== 'playing' || phase !== 'countdown') return;
    if (countdown <= 0) { playCorrect(); setPhase('battle'); return; }
    playTick();
    const t = window.setTimeout(() => setCountdown(c => c - 1), 700);
    return () => clearTimeout(t);
  }, [countdown, phase, status]);

  // A round ends when the ribbon reaches a goal.
  useEffect(() => {
    if (phase !== 'battle') return;
    const w = roundWinner(pos);
    if (w === null) return;
    const next: [number, number] = w === 0 ? [scores[0] + 1, scores[1]] : [scores[0], scores[1] + 1];
    setScores(next);
    setLastWinner(w);
    if (next[w] >= WIN_SCORE) { playWin(); setPhase('final'); }
    else { playCorrect(); setPhase('round_result'); }
  }, [pos, phase, scores]);

  const pull = useCallback((player: 0 | 1) => {
    if (status !== 'playing' || phase !== 'battle') return;
    tapCount.current += 1;
    if (tapCount.current % 3 === 0) playPop();
    setPulls(p => (player === 0 ? [p[0] + 1, p[1]] : [p[0], p[1] + 1]));
    setPos(p => pullRope(p, player));
  }, [phase, status]);

  // Keyboard: A = left, L = right (held keys don't auto-repeat)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'a') pull(0);
      else if (k === 'l') pull(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pull]);

  const start = () => {
    setScores([0, 0]);
    setPulls([0, 0]);
    setRound(1);
    setPos(50);
    setLastWinner(null);
    setPhase('setup');
    setGame(g => g + 1);
    setStatus('playing');
  };

  const begin = () => { playClick(); setCountdown(3); setPhase('countdown'); };

  const nextRound = () => {
    playClick();
    setRound(r => r + 1);
    setPos(50);
    setCountdown(3);
    setPhase('countdown');
  };

  const champ = scores[0] >= WIN_SCORE ? 0 : scores[1] >= WIN_SCORE ? 1 : null;
  const inMatch = phase !== 'setup';

  return (
    <GameShell
      celebrateEnd
      gameId="tug_of_war"
      title="Tug-of-War"
      icon="🪢"
      xpScale={6}
      status={status}
      score={matchScore(pulls)}
      round={game}
      formatScore={s => `${s} pulls`}
      overTitle={champ !== null ? `${name(champ)} wins the tug! 🏆` : 'What a tug! 💪'}
      overStats={[
        { label: `${SLOTS[0].emoji} ${name(0)}`, value: `${pulls[0]} pulls` },
        { label: `${SLOTS[1].emoji} ${name(1)}`, value: `${pulls[1]} pulls` },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-2 font-nunito text-lg text-violet-100">
          <p>Tap your pad as fast as you can to pull the rope to <b>your</b> side! 🪢</p>
          <p>Get the 🎀 ribbon into your goal to win the round. Best of 3!</p>
          <p className="text-base text-violet-300">Keyboard: A = left, L = right</p>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: phase === 'setup' ? 'pan-y' : 'none' }}>
        {phase === 'final' && <ConfettiBurst count={80} durationMs={3500} />}
        <div className="max-w-5xl mx-auto flex flex-col gap-4 min-h-full">
          {phase === 'setup' && (
            <div className="max-w-2xl mx-auto w-full flex flex-col gap-3">
              <h2 className="font-fredoka text-3xl text-center">Who's pulling? 💪</h2>
              <p className="font-nunito text-lg text-violet-200 text-center">🔴 pulls left, 🔵 pulls right. Names are optional.</p>
              <NameSlots names={names} slots={SLOTS} onChange={setNames} />
              <button type="button" onClick={begin}
                className="min-h-[60px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                🪢 Start the tug!
              </button>
            </div>
          )}

          {inMatch && (
            <>
              <div className="flex items-center justify-between gap-2 font-fredoka">
                <div className="text-xl md:text-2xl truncate">{SLOTS[0].emoji} {name(0)} {'⭐'.repeat(scores[0])}</div>
                <div className="shrink-0 rounded-full bg-white/10 px-4 py-1 text-base md:text-lg">Round {round} · first to {WIN_SCORE} ⭐</div>
                <div className="text-xl md:text-2xl truncate text-right">{'⭐'.repeat(scores[1])} {name(1)} {SLOTS[1].emoji}</div>
              </div>

              {/* The rope */}
              <div className="relative h-28 md:h-32 rounded-3xl bg-black/30 border-2 border-white/15 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500/70 to-transparent flex items-center pl-2 text-3xl" style={{ width: `${LEFT_GOAL + 4}%` }}>🏁</div>
                <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-sky-500/70 to-transparent flex items-center justify-end pr-2 text-3xl" style={{ width: `${100 - RIGHT_GOAL + 4}%` }}>🏁</div>
                <div className="absolute inset-y-3 left-1/2 w-1 rounded bg-white/40 -translate-x-1/2" />
                <div className="absolute top-1/2 left-0 right-0 h-5 -translate-y-1/2 rounded-full shadow-lg"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(115deg, #d6a35c 0 10px, #b07a35 10px 20px)',
                    backgroundPosition: `${(pos - 50) * 6}px 0`,
                    transition: 'background-position 90ms linear',
                  }} />
                <div className="absolute top-1/2 text-5xl md:text-6xl"
                  style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)', transition: 'left 90ms linear', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.6))' }}>
                  🎀
                </div>
              </div>

              {/* Pull pads */}
              <div className="grid grid-cols-2 gap-4 md:gap-8 flex-1 min-h-[220px]">
                {([0, 1] as const).map(p => (
                  <motion.button key={p} type="button" whileTap={{ scale: 0.94 }}
                    onPointerDown={e => { e.preventDefault(); pull(p); }}
                    onContextMenu={e => e.preventDefault()}
                    style={{ touchAction: 'none' }}
                    className={`min-h-[220px] rounded-3xl bg-gradient-to-br ${PAD[p]} shadow-2xl font-fredoka select-none flex flex-col items-center justify-center gap-2 active:brightness-110
                      ${phase === 'battle' ? '' : 'opacity-70'}`}>
                    <div className="text-5xl md:text-6xl">{p === 0 ? '👈💪' : '💪👉'}</div>
                    <div className="text-3xl md:text-4xl truncate max-w-full px-2">{name(p)}</div>
                    <div className="text-lg md:text-xl opacity-90">PULL! PULL! PULL!</div>
                  </motion.button>
                ))}
              </div>
            </>
          )}
        </div>

        <AnimatePresence>
          {phase === 'countdown' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/55">
              <motion.div key={countdown} initial={{ scale: 2.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="font-fredoka text-9xl text-amber-300" style={{ textShadow: '0 0 30px rgba(255,200,0,0.8)' }}>
                {countdown > 0 ? countdown : 'GO!'}
              </motion.div>
            </motion.div>
          )}

          {phase === 'round_result' && lastWinner !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
              <motion.div initial={{ scale: 0.6, y: 30 }} animate={{ scale: 1, y: 0 }}
                className="w-full max-w-sm rounded-3xl bg-indigo-900/95 border-2 border-amber-400 p-6 text-center flex flex-col gap-3">
                <div className="text-6xl">{SLOTS[lastWinner].emoji}</div>
                <h2 className="font-fredoka text-3xl text-amber-300">{name(lastWinner)} takes round {round}! ⭐</h2>
                <p className="font-fredoka text-2xl">{scores[0]} – {scores[1]}</p>
                <p className="font-nunito text-lg text-violet-200">Great pulling, both of you! 💪</p>
                <button type="button" onClick={nextRound}
                  className="min-h-[56px] rounded-full bg-gradient-to-r from-amber-400 to-pink-500 font-fredoka text-2xl shadow-lg">
                  Next round! 🪢
                </button>
              </motion.div>
            </motion.div>
          )}

          {phase === 'final' && champ !== null && status !== 'over' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
              <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                className="w-full max-w-sm rounded-3xl bg-indigo-900/95 border-2 border-amber-400 p-6 text-center flex flex-col gap-3">
                <motion.div animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.4 }} className="text-7xl">🏆</motion.div>
                <h2 className="font-fredoka text-4xl text-amber-300">{name(champ)} wins!</h2>
                <p className="font-fredoka text-2xl">{scores[0]} – {scores[1]}</p>
                <p className="font-nunito text-lg text-violet-200">{pulls[0] + pulls[1]} pulls together — what a team workout! 💪</p>
                <button type="button" onClick={() => { playClick(); setStatus('over'); }}
                  className="min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                  🎉 Finish
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GameShell>
  );
}
