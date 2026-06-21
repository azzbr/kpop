import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin, playUnlock } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Digit-span memory: a number sequence flashes up, you memorise it, then type
// it back from memory. It grows one digit longer every round.

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}
type Phase = 'intro' | 'study' | 'input' | 'reveal' | 'final';

const DIFF: Record<string, { start: number; perMs: number }> = {
  easy: { start: 3, perMs: 950 },
  medium: { start: 4, perMs: 800 },
  hard: { start: 5, perMs: 650 },
  expert: { start: 6, perMs: 520 },
  master: { start: 7, perMs: 430 },
};
const TOTAL = 6;

const MemoryDigits: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();
  const diff = DIFF[config?.difficulty || 'medium'] || DIFF.medium;

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [seq, setSeq] = useState<number[]>([]);
  const [len, setLen] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [entry, setEntry] = useState('');
  const [locked, setLocked] = useState(false);
  const [reveal, setReveal] = useState('');
  const [iGot, setIGot] = useState<boolean | null>(null);
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
    answer: '',
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
      h.ended = true;
      h.answered = {};
      const length = diff.start + (r - 1);
      const sequence = Array.from({ length }, () => Math.floor(Math.random() * 10));
      h.answer = sequence.join('');
      const viewMs = length * diff.perMs;
      send({ t: 'md_show', round: r, total: TOTAL, seq: sequence, len: length, studyEndsAt: Date.now() + viewMs });

      h.timer = window.setTimeout(() => {
        h.ended = false;
        const inputMs = 8000 + length * 900;
        h.endsAt = Date.now() + inputMs;
        send({ t: 'md_input', len: length, endsAt: h.endsAt });
        h.timer = window.setTimeout(endRound, inputMs + 300);
      }, viewMs);
    };

    const endRound = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      send({ t: 'md_reveal', answer: h.answer, scores: { ...h.scores } });
      h.timer = window.setTimeout(() => {
        if (h.round < TOTAL) {
          startRound(h.round + 1);
        } else {
          const top: TopEntry[] = Object.entries(h.scores)
            .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
            .sort((a, b) => b.score - a.score);
          send({ t: 'md_final', top });
        }
      }, 3200);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'md_answer' && !h.ended && m.from && !h.answered[m.from]) {
        h.answered[m.from] = true;
        const clean = String(m.text || '').replace(/\D/g, '');
        if (clean === h.answer) {
          // Reward longer sequences — recalling more digits is harder.
          const pts = 100 + h.answer.length * 15;
          h.scores[m.from] = (h.scores[m.from] || 0) + pts;
          send({ t: 'md_correct', playerId: m.from, gained: pts, scores: { ...h.scores } });
        } else {
          send({ t: 'md_wrong', playerId: m.from });
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
      if (m.t === 'md_show') {
        setPhase('study');
        setRound(m.round);
        setSeq(m.seq);
        setLen(m.len);
        setEndsAt(m.studyEndsAt);
        setEntry('');
        setLocked(false);
        setIGot(null);
        playUnlock();
      } else if (m.t === 'md_input') {
        setPhase('input');
        setLen(m.len);
        setEndsAt(m.endsAt);
      } else if (m.t === 'md_correct') {
        setScores(m.scores);
        if (m.playerId === myId) {
          setIGot(true);
          playCorrect();
        }
      } else if (m.t === 'md_wrong') {
        if (m.playerId === myId) setIGot(false);
      } else if (m.t === 'md_reveal') {
        setPhase('reveal');
        setReveal(m.answer);
        setScores(m.scores);
      } else if (m.t === 'md_final') {
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

  // Countdown
  useEffect(() => {
    if (phase !== 'study' && phase !== 'input') return;
    const iv = window.setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const submit = () => {
    if (locked || phase !== 'input' || !entry.replace(/\D/g, '')) return;
    playClick();
    setLocked(true);
    send({ t: 'md_answer', text: entry });
  };

  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-950 via-purple-950 to-indigo-950 text-white px-4 py-6">
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🧠 Memory Digits</h1>
        <p className="text-center font-nunito text-fuchsia-200 text-sm mb-6">
          {phase === 'study'
            ? `👀 Memorise! · ${timeLeft}s`
            : phase === 'input'
            ? `Type them back! · ⏱️ ${timeLeft}s`
            : phase === 'reveal'
            ? 'Reveal!'
            : phase === 'intro'
            ? 'Get ready…'
            : ''}
          {(phase === 'study' || phase === 'input' || phase === 'reveal') && ` · Round ${round}/${TOTAL} · ${len} digits`}
        </p>

        {phase === 'study' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/10 rounded-3xl p-6 mb-4 border border-white/15">
            <div className="flex flex-wrap justify-center gap-2 md:gap-3">
              {seq.map((d, i) => (
                <span key={i} className="w-12 h-14 md:w-14 md:h-16 rounded-2xl bg-white/90 text-gray-800 font-fredoka font-bold text-3xl md:text-4xl flex items-center justify-center shadow">
                  {d}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'input' && (
          <div className="mb-4">
            <div className="text-center font-fredoka text-lg mb-3">What was the sequence? ({len} digits)</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                inputMode="numeric"
                value={entry}
                onChange={(e) => setEntry(e.target.value.replace(/\D/g, '').slice(0, len))}
                disabled={locked}
                placeholder="e.g. 4 7 2 9"
                autoFocus
                className="flex-1 px-4 py-3 rounded-2xl bg-white/90 text-gray-800 font-fredoka font-bold text-2xl tracking-[0.3em] text-center border-2 border-white/40 focus:outline-none focus:ring-4 focus:ring-white/40 disabled:opacity-60"
              />
              <button type="submit" disabled={locked} className="px-6 rounded-2xl font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 disabled:opacity-50">
                Go!
              </button>
            </form>
            {locked && (
              <div className="text-center mt-3">
                <span className="inline-block bg-white/15 rounded-full px-4 py-1 font-fredoka text-sm">Locked in! ⏳</span>
              </div>
            )}
          </div>
        )}

        {phase === 'reveal' && (
          <div className="bg-white/10 rounded-3xl p-6 mb-4 text-center border border-white/15">
            <div className="font-nunito text-fuchsia-200 text-sm mb-1">The sequence was:</div>
            <div className="font-fredoka font-bold text-3xl tracking-[0.25em] text-amber-300">{reveal}</div>
            {iGot !== null && (
              <div className={`font-fredoka mt-2 ${iGot ? 'text-emerald-300' : 'text-rose-300'}`}>
                {iGot ? '✅ You nailed it!' : '❌ So close — keep going!'}
              </div>
            )}
          </div>
        )}

        <div className="bg-white/5 rounded-2xl p-3">
          <div className="font-fredoka text-xs mb-1 text-fuchsia-300">Top scores:</div>
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

export default MemoryDigits;
