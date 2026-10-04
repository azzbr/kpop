import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Stroop test: a colour WORD is printed in a different ink colour — tap the INK
// colour, not the word you read. Brain-bending and fast. Host withholds the
// correct option and validates picks.

interface Swatch {
  name: string;
  hex: string;
}
const PAL: Swatch[] = [
  { name: 'RED', hex: '#ef4444' },
  { name: 'BLUE', hex: '#3b82f6' },
  { name: 'GREEN', hex: '#22c55e' },
  { name: 'YELLOW', hex: '#eab308' },
  { name: 'PURPLE', hex: '#a855f7' },
  { name: 'ORANGE', hex: '#f97316' },
  { name: 'PINK', hex: '#ec4899' },
  { name: 'CYAN', hex: '#06b6d4' },
];
const DIFF: Record<string, { colors: number; ms: number; tricky: boolean }> = {
  easy: { colors: 4, ms: 5500, tricky: false },
  medium: { colors: 5, ms: 5000, tricky: false },
  hard: { colors: 6, ms: 4300, tricky: false },
  expert: { colors: 6, ms: 3600, tricky: true },
  master: { colors: 7, ms: 3000, tricky: true },
  legend: { colors: 8, ms: 2500, tricky: true },
};
const TOTAL = 14;

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}
interface Round {
  word: string;
  inkHex: string;
  options: Swatch[];
  correctIndex: number;
}
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const randInt = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

const ColourClash: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();
  const spec = DIFF[config?.difficulty || 'medium'] || DIFF.medium;

  const [phase, setPhase] = useState<'intro' | 'play' | 'reveal' | 'final'>('intro');
  const [round, setRound] = useState(0);
  const [word, setWord] = useState('');
  const [inkHex, setInkHex] = useState('#fff');
  const [options, setOptions] = useState<Swatch[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
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
    rounds: [] as Round[],
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
    const palette = PAL.slice(0, spec.colors);
    h.rounds = Array.from({ length: TOTAL }, () => {
      const opts = shuffle(palette);
      const wordSwatch = opts[randInt(0, opts.length - 1)];
      let ink = opts[randInt(0, opts.length - 1)];
      // Usually the ink differs from the word; on tricky tiers allow a match.
      let guard = 0;
      while (ink.name === wordSwatch.name && !(spec.tricky && Math.random() < 0.2) && guard < 10) {
        ink = opts[randInt(0, opts.length - 1)];
        guard++;
      }
      return { word: wordSwatch.name, inkHex: ink.hex, options: opts, correctIndex: opts.findIndex((o) => o.hex === ink.hex) };
    });
    players.forEach((p) => (h.scores[p.id] = 0));

    const startRound = (r: number) => {
      const item = h.rounds[r - 1];
      h.round = r;
      h.correctIndex = item.correctIndex;
      h.answered = {};
      h.ended = false;
      h.endsAt = Date.now() + spec.ms;
      send({ t: 'cc_round', round: r, total: TOTAL, word: item.word, inkHex: item.inkHex, options: item.options, endsAt: h.endsAt });
      h.timer = window.setTimeout(endRound, spec.ms + 250);
    };
    const endRound = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      send({ t: 'cc_reveal', correctIndex: h.correctIndex, scores: { ...h.scores } });
      h.timer = window.setTimeout(() => {
        if (h.round < TOTAL) startRound(h.round + 1);
        else {
          const top: TopEntry[] = Object.entries(h.scores)
            .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
            .sort((a, b) => b.score - a.score);
          send({ t: 'cc_final', top });
        }
      }, 2400);
    };
    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'cc_pick' && !h.ended && m.from && !h.answered[m.from]) {
        h.answered[m.from] = true;
        if (m.index === h.correctIndex) {
          const frac = Math.max(0, h.endsAt - Date.now()) / spec.ms;
          const pts = 100 + Math.round(100 * frac);
          h.scores[m.from] = (h.scores[m.from] || 0) + pts;
          send({ t: 'cc_correct', playerId: m.from, gained: pts, scores: { ...h.scores } });
        } else {
          send({ t: 'cc_wrong', playerId: m.from });
        }
        if (playersRef.current.every((p) => h.answered[p.id])) endRound();
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
      if (m.t === 'cc_round') {
        setPhase('play');
        setRound(m.round);
        setWord(m.word);
        setInkHex(m.inkHex);
        setOptions(m.options);
        setEndsAt(m.endsAt);
        setPicked(null);
        setCorrectIndex(null);
      } else if (m.t === 'cc_correct') {
        setScores(m.scores);
        if (m.playerId === myId) playCorrect();
      } else if (m.t === 'cc_reveal') {
        setPhase('reveal');
        setCorrectIndex(m.correctIndex);
        setScores(m.scores);
      } else if (m.t === 'cc_final') {
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
  }, [myId]);

  useEffect(() => {
    if (phase !== 'play') return;
    const iv = window.setInterval(() => setTimeLeft(Math.max(0, ((endsAt - Date.now()) / 1000))), 100);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const tap = (i: number) => {
    if (picked !== null || phase !== 'play') return;
    playClick();
    setPicked(i);
    send({ t: 'cc_pick', index: i });
  };

  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  const swatchClass = (i: number) => {
    if (phase === 'reveal') {
      if (i === correctIndex) return 'ring-4 ring-emerald-300 scale-105';
      if (i === picked) return 'ring-4 ring-red-400 opacity-70';
      return 'opacity-50';
    }
    if (picked === i) return 'ring-4 ring-white scale-105';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-neutral-950 text-white px-4 py-6">
      <div className="max-w-md mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🌈 Colour Clash</h1>
        <p className="text-center font-nunito text-white/60 text-sm mb-2">Tap the <b>colour</b> of the word — not the word!</p>
        <p className="text-center font-nunito text-white/50 text-xs mb-5">
          {phase === 'play' ? `Round ${round}/${TOTAL} · ⏱️ ${Math.max(0, timeLeft).toFixed(1)}s` : phase === 'reveal' ? 'Reveal!' : 'Get ready…'}
        </p>

        {(phase === 'play' || phase === 'reveal') && (
          <>
            <div className="bg-white/5 rounded-3xl p-8 mb-5 flex items-center justify-center min-h-[7rem]">
              <span className="font-fredoka font-black text-5xl md:text-7xl tracking-wider" style={{ color: inkHex }}>
                {word}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {options.map((o, i) => (
                <button
                  key={i}
                  onClick={() => tap(i)}
                  disabled={picked !== null || phase === 'reveal'}
                  className={`h-16 rounded-2xl border-2 border-white/20 font-fredoka font-bold text-white transition-all ${swatchClass(i)}`}
                  style={{ background: o.hex }}
                >
                  {phase === 'reveal' ? o.name : ''}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="bg-white/5 rounded-2xl p-3">
          <div className="font-fredoka text-xs mb-1 text-white/60">Top scores:</div>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-4">
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

export default ColourClash;
