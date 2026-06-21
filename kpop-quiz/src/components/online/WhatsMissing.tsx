import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin, playUnlock } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Memory game: a tray of objects appears, you memorise it, then it returns
// with one object gone — tap which one vanished. Host is authoritative.

interface Item {
  emoji: string;
  label: string;
}
interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}
type Phase = 'intro' | 'study' | 'quiz' | 'reveal' | 'final';

const POOL: Item[] = [
  { emoji: '🍎', label: 'apple' }, { emoji: '🍌', label: 'banana' }, { emoji: '🍓', label: 'strawberry' },
  { emoji: '🍕', label: 'pizza' }, { emoji: '🍔', label: 'burger' }, { emoji: '🍩', label: 'donut' },
  { emoji: '🍦', label: 'ice cream' }, { emoji: '🎂', label: 'cake' }, { emoji: '🥕', label: 'carrot' },
  { emoji: '🌽', label: 'corn' }, { emoji: '🐶', label: 'dog' }, { emoji: '🐱', label: 'cat' },
  { emoji: '🦁', label: 'lion' }, { emoji: '🐯', label: 'tiger' }, { emoji: '🐸', label: 'frog' },
  { emoji: '🐢', label: 'turtle' }, { emoji: '🐧', label: 'penguin' }, { emoji: '🦋', label: 'butterfly' },
  { emoji: '🐝', label: 'bee' }, { emoji: '🐙', label: 'octopus' }, { emoji: '🦄', label: 'unicorn' },
  { emoji: '🚗', label: 'car' }, { emoji: '🚌', label: 'bus' }, { emoji: '🚀', label: 'rocket' },
  { emoji: '✈️', label: 'plane' }, { emoji: '⛵', label: 'boat' }, { emoji: '🚲', label: 'bicycle' },
  { emoji: '⚽', label: 'ball' }, { emoji: '🏀', label: 'basketball' }, { emoji: '🎸', label: 'guitar' },
  { emoji: '🥁', label: 'drum' }, { emoji: '🎹', label: 'piano' }, { emoji: '🎈', label: 'balloon' },
  { emoji: '🎁', label: 'present' }, { emoji: '👑', label: 'crown' }, { emoji: '💎', label: 'diamond' },
  { emoji: '🔑', label: 'key' }, { emoji: '🌈', label: 'rainbow' }, { emoji: '⭐', label: 'star' },
  { emoji: '🌙', label: 'moon' }, { emoji: '☀️', label: 'sun' }, { emoji: '🌳', label: 'tree' },
  { emoji: '🌸', label: 'flower' }, { emoji: '🍄', label: 'mushroom' }, { emoji: '🌵', label: 'cactus' },
  { emoji: '🔥', label: 'fire' }, { emoji: '❄️', label: 'snowflake' }, { emoji: '🏰', label: 'castle' },
  { emoji: '🤖', label: 'robot' }, { emoji: '👻', label: 'ghost' }, { emoji: '🐉', label: 'dragon' },
  { emoji: '🦖', label: 'dinosaur' }, { emoji: '🧸', label: 'teddy' }, { emoji: '👟', label: 'shoe' },
  { emoji: '👒', label: 'hat' }, { emoji: '🧦', label: 'sock' }, { emoji: '✏️', label: 'pencil' },
  { emoji: '📚', label: 'books' }, { emoji: '✂️', label: 'scissors' }, { emoji: '🕯️', label: 'candle' },
];

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

const DIFF: Record<string, { count: number; viewMs: number }> = {
  easy: { count: 5, viewMs: 5000 },
  medium: { count: 7, viewMs: 6000 },
  hard: { count: 9, viewMs: 7500 },
  expert: { count: 11, viewMs: 8000 },
  master: { count: 13, viewMs: 8500 },
  legend: { count: 15, viewMs: 9000 },
};
const ROUND_MS = 13000;
const TOTAL = 6;

const WhatsMissing: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();
  const diff = DIFF[config?.difficulty || 'medium'] || DIFF.medium;

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [tray, setTray] = useState<Item[]>([]);
  const [removeIndex, setRemoveIndex] = useState(-1);
  const [options, setOptions] = useState<Item[]>([]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
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
    players.forEach((p) => (h.scores[p.id] = 0));

    const startRound = (r: number) => {
      h.round = r;
      h.ended = true; // no answers during the study phase
      h.answered = {};
      const tray = shuffle(POOL).slice(0, diff.count);
      const removeIdx = Math.floor(Math.random() * tray.length);
      const missing = tray[removeIdx];
      const decoys = shuffle(POOL.filter((x) => !tray.some((t) => t.label === x.label))).slice(0, 3);
      const opts = shuffle([missing, ...decoys]);
      h.correctIndex = opts.indexOf(missing);
      const studyEndsAt = Date.now() + diff.viewMs;
      send({ t: 'wm_study', round: r, total: TOTAL, tray, studyEndsAt });

      h.timer = window.setTimeout(() => {
        h.ended = false;
        h.endsAt = Date.now() + ROUND_MS;
        send({ t: 'wm_quiz', removeIndex: removeIdx, options: opts, endsAt: h.endsAt });
        h.timer = window.setTimeout(endRound, ROUND_MS + 300);
      }, diff.viewMs);
    };

    const endRound = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      send({ t: 'wm_reveal', correctIndex: h.correctIndex, scores: { ...h.scores } });
      h.timer = window.setTimeout(() => {
        if (h.round < TOTAL) {
          startRound(h.round + 1);
        } else {
          const top: TopEntry[] = Object.entries(h.scores)
            .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
            .sort((a, b) => b.score - a.score);
          send({ t: 'wm_final', top });
        }
      }, 3200);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'wm_pick' && !h.ended && m.from && !h.answered[m.from]) {
        h.answered[m.from] = true;
        if (m.index === h.correctIndex) {
          const frac = Math.max(0, h.endsAt - Date.now()) / ROUND_MS;
          const pts = 100 + Math.round(100 * frac);
          h.scores[m.from] = (h.scores[m.from] || 0) + pts;
          send({ t: 'wm_correct', playerId: m.from, gained: pts, scores: { ...h.scores } });
        } else {
          send({ t: 'wm_wrong', playerId: m.from });
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
      if (m.t === 'wm_study') {
        setPhase('study');
        setRound(m.round);
        setTray(m.tray);
        setRemoveIndex(-1);
        setOptions([]);
        setCorrectIndex(null);
        setPicked(null);
        setEndsAt(m.studyEndsAt);
        playUnlock();
      } else if (m.t === 'wm_quiz') {
        setPhase('quiz');
        setRemoveIndex(m.removeIndex);
        setOptions(m.options);
        setEndsAt(m.endsAt);
      } else if (m.t === 'wm_correct') {
        setScores(m.scores);
        if (m.playerId === myId) playCorrect();
      } else if (m.t === 'wm_reveal') {
        setPhase('reveal');
        setCorrectIndex(m.correctIndex);
        setScores(m.scores);
      } else if (m.t === 'wm_final') {
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
    if (phase !== 'study' && phase !== 'quiz') return;
    const iv = window.setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const tap = (i: number) => {
    if (picked !== null || phase !== 'quiz') return;
    playClick();
    setPicked(i);
    send({ t: 'wm_pick', index: i });
  };

  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  const answer = correctIndex !== null ? options[correctIndex] : null;
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
    <div className="min-h-screen bg-gradient-to-br from-teal-950 via-cyan-950 to-sky-950 text-white px-4 py-6">
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🧠 What’s Missing?</h1>
        <p className="text-center font-nunito text-cyan-200 text-sm mb-5">
          {phase === 'study'
            ? `👀 Memorise! · ${timeLeft}s`
            : phase === 'quiz'
            ? `Which one vanished? · ⏱️ ${timeLeft}s`
            : phase === 'reveal'
            ? 'Reveal!'
            : phase === 'final'
            ? ''
            : 'Get ready…'}
          {(phase === 'study' || phase === 'quiz' || phase === 'reveal') && ` · Round ${round}/${TOTAL}`}
        </p>

        {/* Tray */}
        {(phase === 'study' || phase === 'quiz' || phase === 'reveal') && (
          <div className="bg-white/5 rounded-3xl p-4 mb-4 border border-white/10">
            <div className="flex flex-wrap justify-center gap-3">
              {tray.map((it, i) => {
                const blanked = (phase === 'quiz' || phase === 'reveal') && i === removeIndex;
                return (
                  <div
                    key={i}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-4xl md:text-5xl ${
                      blanked ? 'bg-rose-500/20 border-2 border-dashed border-rose-300' : 'bg-white/10'
                    }`}
                  >
                    {blanked ? (phase === 'reveal' && answer ? answer.emoji : '❓') : it.emoji}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Options */}
        {(phase === 'quiz' || phase === 'reveal') && (
          <>
            <div className="text-center font-fredoka text-lg mb-3 text-cyan-100">Tap the one that’s gone:</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {options.map((o, i) => (
                <button
                  key={i}
                  onClick={() => tap(i)}
                  disabled={picked !== null || phase === 'reveal'}
                  className={`rounded-3xl border-2 p-4 flex items-center justify-center gap-2 transition-all min-h-[5rem] ${optClass(i)}`}
                >
                  <span className="text-4xl">{o.emoji}</span>
                  <span className="font-fredoka">{o.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {picked !== null && phase === 'quiz' && (
          <div className="text-center mb-3">
            <span className="inline-block bg-white/15 rounded-full px-4 py-1 font-fredoka text-sm">Locked in! ⏳</span>
          </div>
        )}

        <div className="bg-white/5 rounded-2xl p-3">
          <div className="font-fredoka text-xs mb-1 text-cyan-300">Top scores:</div>
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

export default WhatsMissing;
