import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { createRng } from '../games/engine/rng';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { quizSources } from '../online/quiz/sources';
import { playClick, playCorrect, playPop, playWin, playTick, playTimeOut } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import { NameSlots } from './games/partyNames';
import { slotName } from './games/partyNamesLogic';
import type { Slot } from './games/partyNamesLogic';
import { battleScore, battleSources, buildDeck, buzz, leader, CHEERS, KIND_MISS, ROUNDS, SECS_PER_Q } from './games/triviaBattleLogic';
import type { Answers, BattleQ } from './games/triviaBattleLogic';

type Phase = 'setup' | 'countdown' | 'battle' | 'reveal' | 'final';

const SLOTS: Slot[] = [
  { fallback: 'Pink', emoji: '💗', tone: 'bg-pink-500' },
  { fallback: 'Blue', emoji: '💙', tone: 'bg-sky-500' },
];
const SIDE = [
  { grad: 'from-pink-500 to-rose-600', ring: 'border-pink-300', text: 'text-pink-200' },
  { grad: 'from-sky-500 to-indigo-600', ring: 'border-sky-300', text: 'text-sky-200' },
];
const LETTERS = ['A', 'B', 'C', 'D'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export default function TriviaBattle() {
  const myQuizzes = useGameStore(s => s.myQuizzes);
  const sources = useMemo(() => battleSources(quizSources(myQuizzes)), [myQuizzes]);
  const later = useSafeTimeout();

  const [status, setStatus] = useState<ShellStatus>('ready');
  const [game, setGame] = useState(0);
  const [sourceId, setSourceId] = useState('bank:mix');
  const [phase, setPhase] = useState<Phase>('setup');
  const [names, setNames] = useState(['', '']);
  const [deck, setDeck] = useState<BattleQ[]>([]);
  const [n, setN] = useState(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [answers, setAnswers] = useState<Answers>([null, null]);
  const [timeLeft, setTimeLeft] = useState(SECS_PER_Q);
  const [countdown, setCountdown] = useState(3);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [cheer, setCheer] = useState('');
  const [missLine, setMissLine] = useState<[string, string]>(['', '']);

  const source = sources.find(s => s.id === sourceId) ?? sources[0];
  const q = deck[n];
  const name = (i: number) => slotName(names, SLOTS, i);

  // Pause when she switches apps.
  useEffect(() => {
    const onVis = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const start = () => {
    const rng = createRng(Date.now() % 1e9);
    setDeck(buildDeck(source.questions(), ROUNDS, rng));
    setN(0);
    setScores([0, 0]);
    setAnswers([null, null]);
    setWinner(null);
    setPhase('setup');
    setGame(g => g + 1);
    setStatus('playing');
  };

  const begin = () => {
    playClick();
    setCountdown(3);
    setPhase('countdown');
  };

  // 3-2-1 before each question
  useEffect(() => {
    if (status !== 'playing' || phase !== 'countdown') return;
    if (countdown <= 0) {
      setTimeLeft(SECS_PER_Q);
      setAnswers([null, null]);
      setMissLine(['', '']);
      setPhase('battle');
      return;
    }
    playTick();
    const t = window.setTimeout(() => setCountdown(c => c - 1), 700);
    return () => clearTimeout(t);
  }, [countdown, phase, status]);

  const reveal = (w: 0 | 1 | null) => {
    setWinner(w);
    if (w !== null) {
      setScores(s => (w === 0 ? [s[0] + 1, s[1]] : [s[0], s[1] + 1]));
      setCheer(pick(CHEERS));
    }
    setPhase('reveal');
    later(() => {
      if (n + 1 >= deck.length) {
        playWin();
        setPhase('final');
      } else {
        setN(n + 1);
        setCountdown(2);
        setPhase('countdown');
      }
    }, 2400);
  };

  // Question timer
  useEffect(() => {
    if (status !== 'playing' || phase !== 'battle') return;
    if (timeLeft <= 0) {
      playTimeOut();
      reveal(null);
      return;
    }
    if (timeLeft <= 3) playTick();
    const t = window.setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
    // reveal is recreated each render; listing it would restart the 1 s tick every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase, status]);

  const onBuzz = (player: 0 | 1, choice: number) => {
    if (status !== 'playing' || phase !== 'battle' || !q) return;
    const r = buzz(q, answers, player, choice);
    if (r.outcome.kind === 'ignored') return;
    setAnswers(r.answers);
    if (r.outcome.kind === 'point') { playCorrect(); reveal(player); }
    else if (r.outcome.kind === 'both_missed') { playPop(); reveal(null); }
    else {
      playPop();
      const line = pick(KIND_MISS);
      setMissLine(m => (player === 0 ? [line, m[1]] : [m[0], line]));
    }
  };

  const finalLeader = leader(scores);

  const side = (p: 0 | 1) => {
    if (!q) return null;
    const mine = answers[p];
    const locked = phase !== 'battle' || mine !== null;
    return (
      <div className="flex flex-col gap-2 min-w-0">
        <div className={`rounded-2xl bg-gradient-to-r ${SIDE[p].grad} px-3 py-2 flex items-center justify-between font-fredoka shadow-lg`}>
          <span className="text-xl truncate">{SLOTS[p].emoji} {name(p)}</span>
          <span className="text-3xl tabular-nums">{scores[p]}</span>
        </div>
        {q.options.map((opt, i) => {
          const isRight = i === q.correct;
          const showRight = phase === 'reveal' && isRight;
          const pickedWrong = mine === i && !isRight;
          return (
            <button key={i} type="button" disabled={locked}
              onPointerDown={e => { e.preventDefault(); onBuzz(p, i); }}
              className={`min-h-[76px] md:min-h-[100px] rounded-2xl border-2 px-3 py-2 flex items-center gap-3 text-left font-fredoka text-lg md:text-xl leading-tight transition-colors select-none
                ${showRight || (mine === i && isRight) ? 'bg-green-500 border-green-200'
                  : pickedWrong ? 'bg-amber-500/70 border-amber-200'
                  : locked ? 'bg-white/5 border-white/10 opacity-60'
                  : `bg-white/10 ${SIDE[p].ring} active:bg-white/25`}`}>
              <span className="shrink-0 w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-base">{q.options.length === 2 ? (i === 0 ? '✔️' : '✖️') : LETTERS[i]}</span>
              <span className="min-w-0 break-words">{opt}</span>
            </button>
          );
        })}
        <div className={`min-h-[32px] text-center font-fredoka text-lg ${SIDE[p].text}`}>{missLine[p]}</div>
      </div>
    );
  };

  return (
    <GameShell
      celebrateEnd
      gameId="trivia_battle"
      title="Buzzer Battle"
      icon="🛎️"
      xpScale={0.2}
      status={status}
      score={battleScore(scores)}
      round={game}
      formatScore={s => `${s} pts`}
      overTitle={finalLeader === null ? 'A tie — great minds! 🤝' : `${name(finalLeader)} wins! 🏆`}
      overStats={[
        { label: `${SLOTS[0].emoji} ${name(0)}`, value: `${scores[0]} pts` },
        { label: `${SLOTS[1].emoji} ${name(1)}`, value: `${scores[1]} pts` },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-3 text-left">
          <p className="font-nunito text-lg text-violet-100 text-center">2 players, 1 iPad. Each side has its own answers — first right answer wins the point! {ROUNDS} questions.</p>
          <p className="font-fredoka text-lg text-center">Pick a category</p>
          <div className="grid grid-cols-2 gap-2 max-h-[38vh] overflow-y-auto pr-1" style={{ touchAction: 'pan-y' }}>
            {sources.map(s => (
              <button key={s.id} type="button" onClick={() => { playClick(); setSourceId(s.id); }}
                className={`min-h-[52px] rounded-2xl px-3 py-2 font-fredoka text-base text-left flex items-center gap-2 ${s.id === source?.id ? 'bg-fuchsia-500 ring-2 ring-yellow-300' : 'bg-white/10'}`}>
                <span className="text-2xl">{s.emoji}</span><span className="min-w-0 leading-tight">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: phase === 'setup' ? 'pan-y' : 'none' }}>
        {phase === 'final' && finalLeader !== null && <ConfettiBurst count={80} durationMs={3000} />}
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          <AnimatePresence mode="wait">
            {phase === 'setup' && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 max-w-2xl mx-auto w-full">
                <h2 className="font-fredoka text-3xl text-center">Who's battling? ⚔️</h2>
                <p className="font-nunito text-lg text-violet-200 text-center">Names are optional — tap a side to change it.</p>
                <NameSlots names={names} slots={SLOTS} onChange={setNames} />
                <button type="button" onClick={begin}
                  className="min-h-[60px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                  ⚔️ Start battle! ({source?.emoji} {source?.title})
                </button>
              </motion.div>
            )}

            {phase === 'countdown' && (
              <motion.div key={`cd-${n}-${countdown}`} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center py-16">
                <div className="font-fredoka text-9xl text-yellow-300 drop-shadow-lg">{countdown === 0 ? 'GO!' : countdown}</div>
                <p className="font-fredoka text-2xl text-violet-200 mt-4">Question {n + 1} of {deck.length}</p>
              </motion.div>
            )}

            {(phase === 'battle' || phase === 'reveal') && q && (
              <motion.div key={`q-${n}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                <div className="flex items-center gap-3 font-fredoka text-lg">
                  <span className="rounded-full bg-white/10 px-3 py-1 shrink-0">❓ {n + 1}/{deck.length}</span>
                  <div className="flex-1 h-4 rounded-full bg-white/10 overflow-hidden">
                    <motion.div className={`h-full rounded-full ${timeLeft <= 3 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      animate={{ width: `${(timeLeft / SECS_PER_Q) * 100}%` }} transition={{ duration: 0.3 }} />
                  </div>
                  <span className={`shrink-0 w-12 text-right tabular-nums ${timeLeft <= 3 ? 'text-amber-300' : ''}`}>{timeLeft}s</span>
                </div>
                <div className="rounded-3xl bg-indigo-900/80 border-2 border-white/20 px-4 py-4 text-center">
                  {q.emoji && <div className="text-5xl mb-1">{q.emoji}</div>}
                  <p className="font-fredoka text-2xl md:text-3xl leading-snug">{q.text}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-6">
                  {side(0)}
                  {side(1)}
                </div>
                <AnimatePresence>
                  {phase === 'reveal' && (
                    <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                      className={`rounded-2xl p-4 text-center font-fredoka text-2xl shadow-xl ${winner !== null ? `bg-gradient-to-r ${SIDE[winner].grad}` : 'bg-indigo-700'}`}>
                      {winner !== null
                        ? `${cheer} ${name(winner)} gets the point!`
                        : `🤔 Tricky one! The answer was: ${q.options[q.correct]}`}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {phase === 'final' && (
              <motion.div key="final" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl mx-auto w-full rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/60 p-6 text-center flex flex-col gap-3">
                <div className="text-7xl">{finalLeader !== null ? '🏆' : '🤝'}</div>
                <h2 className="font-fredoka text-4xl text-yellow-300">{finalLeader !== null ? `${name(finalLeader)} wins!` : "It's a tie!"}</h2>
                <p className="font-nunito text-lg text-violet-200">{finalLeader !== null ? 'What a battle — both of you were brilliant! 🌟' : 'Both players are equally brilliant! 🧠'}</p>
                {([0, 1] as const).map(i => (
                  <div key={i} className={`flex items-center justify-between rounded-2xl px-4 py-3 bg-gradient-to-r ${SIDE[i].grad} font-fredoka`}>
                    <span className="text-xl truncate">{SLOTS[i].emoji} {name(i)}</span>
                    <span className="text-3xl">{scores[i]} / {deck.length}</span>
                  </div>
                ))}
                <button type="button" onClick={() => { playClick(); setStatus('over'); }}
                  className="min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                  🎉 Finish
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GameShell>
  );
}
