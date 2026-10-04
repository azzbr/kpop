import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Shared "everyone taps the right option, fastest scores most" engine.
// One tap per round per player (right or wrong locks you in) so it stays a
// race. Powers Odd One Out (and any future spot-the-answer game).

export interface TapOption {
  emoji?: string;
  label: string;
}
export interface TapRound {
  prompt: string;
  options: TapOption[];
  correctIndex: number; // host-only — never broadcast
}

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}

interface TapRaceProps {
  room: RoomApi;
  gp: string;
  title: string;
  icon: string;
  themeClass: string;
  accent: string;
  roundMs: number;
  rounds: number;
  buildRounds: () => TapRound[];
}

type Phase = 'intro' | 'play' | 'reveal' | 'final';

const TapRace: React.FC<TapRaceProps> = ({ room, gp, title, icon, themeClass, accent, roundMs, rounds, buildRounds }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [total, setTotal] = useState(rounds);
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState<TapOption[]>([]);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [finalTop, setFinalTop] = useState<TopEntry[] | null>(null);
  const xpGiven = useRef(false);

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  const hd = useRef({
    rounds: [] as TapRound[],
    round: 0,
    correctIndex: -1,
    answered: {} as Record<string, boolean>,
    scores: {} as Record<string, number>,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.rounds = buildRounds().slice(0, rounds);
    players.forEach((p) => (h.scores[p.id] = 0));

    const startRound = (r: number) => {
      const item = h.rounds[r - 1];
      h.round = r;
      h.correctIndex = item.correctIndex;
      h.answered = {};
      h.ended = false;
      h.endsAt = Date.now() + roundMs;
      send({ t: `${gp}_round`, round: r, total: h.rounds.length, prompt: item.prompt, options: item.options, endsAt: h.endsAt });
      h.timer = window.setTimeout(endRound, roundMs + 300);
    };

    const endRound = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      send({ t: `${gp}_reveal`, round: h.round, correctIndex: h.correctIndex, scores: { ...h.scores } });
      h.timer = window.setTimeout(() => {
        if (h.round < h.rounds.length) {
          startRound(h.round + 1);
        } else {
          const top: TopEntry[] = Object.entries(h.scores)
            .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
            .sort((a, b) => b.score - a.score);
          send({ t: `${gp}_final`, top });
        }
      }, 3000);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === `${gp}_pick` && !h.ended && m.from && !h.answered[m.from]) {
        h.answered[m.from] = true;
        const correct = m.index === h.correctIndex;
        if (correct) {
          const frac = Math.max(0, h.endsAt - Date.now()) / roundMs;
          const pts = 100 + Math.round(100 * frac);
          h.scores[m.from] = (h.scores[m.from] || 0) + pts;
          send({ t: `${gp}_correct`, playerId: m.from, gained: pts, scores: { ...h.scores } });
        } else {
          send({ t: `${gp}_wrong`, playerId: m.from });
        }
        const everyone = playersRef.current;
        if (everyone.length > 0 && everyone.every((p) => h.answered[p.id])) endRound();
      }
    });

    h.timer = window.setTimeout(() => startRound(1), 1400);
    return () => {
      offMsg();
      window.clearTimeout(h.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      if (m.t === `${gp}_round`) {
        setPhase('play');
        setRound(m.round);
        setTotal(m.total);
        setPrompt(m.prompt);
        setOptions(m.options);
        setEndsAt(m.endsAt);
        setPicked(null);
        setCorrectIndex(null);
        setAnsweredCount(0);
      } else if (m.t === `${gp}_correct`) {
        setScores(m.scores);
        setAnsweredCount((c) => c + 1);
        if (m.playerId === myId) playCorrect();
      } else if (m.t === `${gp}_wrong`) {
        setAnsweredCount((c) => c + 1);
      } else if (m.t === `${gp}_reveal`) {
        setPhase('reveal');
        setCorrectIndex(m.correctIndex);
        setScores(m.scores);
      } else if (m.t === `${gp}_final`) {
        setPhase('final');
        setFinalTop(m.top);
        playWin();
        if (!xpGiven.current) {
          xpGiven.current = true;
          addXP(m.top[0]?.id === myId ? 40 : 15);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // Countdown
  useEffect(() => {
    if (phase !== 'play') return;
    const iv = window.setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 300);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const tap = (i: number) => {
    if (picked !== null || phase !== 'play') return;
    playClick();
    setPicked(i);
    send({ t: `${gp}_pick`, index: i });
  };

  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  const optClass = (i: number) => {
    if (phase === 'reveal') {
      if (i === correctIndex) return 'bg-emerald-500/80 border-emerald-300';
      if (i === picked) return 'bg-red-500/70 border-red-300';
      return 'bg-white/10 border-white/15 opacity-60';
    }
    if (picked === i) return 'bg-amber-400/40 border-amber-300 scale-105';
    return 'bg-white/10 border-white/20 hover:bg-white/20';
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themeClass} text-white px-4 py-6`}>
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">{icon} {title}</h1>
        <p className="text-center font-nunito text-white/70 text-sm mb-5">
          {phase === 'intro' ? 'Get ready…' : `Round ${round}/${total} · ⏱️ ${timeLeft}s · ${answeredCount} answered`}
        </p>

        {(phase === 'play' || phase === 'reveal') && (
          <>
            <div className={`text-center font-fredoka text-xl md:text-2xl mb-4 ${accent}`}>{prompt}</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {options.map((o, i) => (
                <button
                  key={i}
                  onClick={() => tap(i)}
                  disabled={picked !== null || phase === 'reveal'}
                  className={`rounded-3xl border-2 p-5 flex flex-col items-center justify-center gap-1 transition-all min-h-[7rem] ${optClass(i)}`}
                >
                  {o.emoji && <span className="text-5xl md:text-6xl">{o.emoji}</span>}
                  <span className="font-fredoka text-base md:text-lg">{o.label}</span>
                </button>
              ))}
            </div>
            {picked !== null && phase === 'play' && (
              <div className="text-center mb-3">
                <span className="inline-block bg-white/15 rounded-full px-4 py-1 font-fredoka text-sm">
                  Locked in! ⏳ Waiting for the round to end…
                </span>
              </div>
            )}
          </>
        )}

        <div className="bg-white/5 rounded-2xl p-3">
          <div className={`font-fredoka text-xs mb-1 ${accent}`}>Top scores:</div>
          <div className="grid grid-cols-2 gap-x-4">
            {topScores.map((s) => (
              <div key={s.id} className="font-nunito text-xs py-0.5 flex justify-between">
                <span>{byId(s.id).emoji} {byId(s.id).name}</span>
                <span className="text-amber-300 font-bold">{s.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {phase === 'final' && finalTop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full">
              <div className="text-7xl mb-3">🏆</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-3">
                {finalTop[0] ? `${finalTop[0].emoji} ${finalTop[0].name} wins!` : 'Game over!'}
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-44 overflow-y-auto">
                {finalTop.slice(0, 8).map((e, i) => (
                  <div key={e.id} className="flex justify-between font-nunito text-sm py-0.5">
                    <span>#{i + 1} {e.emoji} {e.name}</span>
                    <span className="text-amber-200">{e.score}</span>
                  </div>
                ))}
              </div>
              <p className="font-fredoka text-green-300 mb-5">+{finalTop[0]?.id === myId ? 40 : 15} XP</p>
              {isHost ? (
                <button onClick={() => { playClick(); send({ t: 'to_lobby' }); }} className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl">
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-slate-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TapRace;
