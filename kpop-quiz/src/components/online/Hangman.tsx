import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import { DOODLE_WORDS } from '../../online/doodleWords';
import ConfettiBurst from '../ConfettiBurst';

// Whole-class Hangman race: everyone guesses letters on the SAME hidden word at
// the same time, racing to reveal it with the fewest wrong guesses. Host keeps
// the word secret and tracks each player's progress.

const ROUNDS = 5;
const ROUND_MS = 60000;
const MAX_WRONG = 6;
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const HM_LEN: Record<string, [number, number]> = {
  easy: [4, 5],
  medium: [5, 6],
  hard: [6, 8],
  expert: [8, 10],
  master: [9, 12],
};

function pickWords(difficulty: string, n: number): string[] {
  const [lo, hi] = HM_LEN[difficulty] || HM_LEN.medium;
  const single = (w: string) => /^[a-z]+$/.test(w);
  let pool = DOODLE_WORDS.filter((w) => single(w) && w.length >= lo && w.length <= hi);
  if (pool.length < n) pool = DOODLE_WORDS.filter((w) => single(w) && w.length >= lo - 1);
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
}

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}
type Phase = 'intro' | 'play' | 'reveal' | 'final';

const Hangman: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();
  const difficulty = config?.difficulty || 'medium';

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [mask, setMask] = useState<string[]>([]);
  const [guessed, setGuessed] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);
  const [meSolved, setMeSolved] = useState(false);
  const [meOut, setMeOut] = useState(false);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [reveal, setReveal] = useState('');
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
    words: [] as string[],
    round: 0,
    word: '',
    pp: {} as Record<string, { correct: Set<string>; guessed: Set<string>; wrong: number; done: boolean }>,
    scores: {} as Record<string, number>,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.words = pickWords(difficulty, ROUNDS);
    players.forEach((p) => (h.scores[p.id] = 0));

    const startRound = (r: number) => {
      h.round = r;
      h.word = h.words[r - 1] || 'star';
      h.ended = false;
      h.pp = {};
      playersRef.current.forEach((p) => (h.pp[p.id] = { correct: new Set(), guessed: new Set(), wrong: 0, done: false }));
      h.endsAt = Date.now() + ROUND_MS;
      send({ t: 'hm_round', round: r, total: ROUNDS, len: h.word.length, endsAt: h.endsAt });
      h.timer = window.setTimeout(endRound, ROUND_MS + 300);
    };

    const endRound = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      send({ t: 'hm_reveal', word: h.word, scores: { ...h.scores } });
      h.timer = window.setTimeout(() => {
        if (h.round < ROUNDS) startRound(h.round + 1);
        else {
          const top: TopEntry[] = Object.entries(h.scores)
            .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
            .sort((a, b) => b.score - a.score);
          send({ t: 'hm_final', top });
        }
      }, 3200);
    };

    const allDone = () => {
      const everyone = playersRef.current;
      return everyone.length > 0 && everyone.every((p) => h.pp[p.id]?.done);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'hm_guess' && !h.ended && m.from && typeof m.letter === 'string') {
        const st = h.pp[m.from];
        if (!st || st.done) return;
        const L = m.letter.toUpperCase();
        if (st.guessed.has(L)) return;
        st.guessed.add(L);
        const upper = h.word.toUpperCase();
        if (upper.includes(L)) {
          st.correct.add(L);
          const positions: number[] = [];
          for (let i = 0; i < upper.length; i++) if (upper[i] === L) positions.push(i);
          const solved = [...new Set(upper.split(''))].every((ch) => st.correct.has(ch));
          if (solved) {
            st.done = true;
            const frac = Math.max(0, h.endsAt - Date.now()) / ROUND_MS;
            const pts = 100 + Math.round(100 * frac) + (MAX_WRONG - st.wrong) * 15;
            h.scores[m.from] = (h.scores[m.from] || 0) + pts;
            send({ t: 'hm_hit', to: m.from, letter: L, positions, wrong: st.wrong, good: true });
            send({ t: 'hm_solved', playerId: m.from, scores: { ...h.scores } });
          } else {
            send({ t: 'hm_hit', to: m.from, letter: L, positions, wrong: st.wrong, good: true });
          }
        } else {
          st.wrong++;
          const out = st.wrong >= MAX_WRONG;
          if (out) st.done = true;
          send({ t: 'hm_hit', to: m.from, letter: L, positions: [], wrong: st.wrong, good: false });
          if (out) send({ t: 'hm_out', playerId: m.from });
        }
        if (allDone()) endRound();
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
      if (m.t === 'hm_round') {
        setPhase('play');
        setRound(m.round);
        setMask(Array(m.len).fill(''));
        setGuessed([]);
        setWrong(0);
        setMeSolved(false);
        setMeOut(false);
        setEndsAt(m.endsAt);
      } else if (m.t === 'hm_hit' && m.to === myId) {
        setGuessed((g) => (g.includes(m.letter) ? g : [...g, m.letter]));
        setWrong(m.wrong);
        if (m.good) {
          playCorrect();
          setMask((mk) => {
            const nm = [...mk];
            (m.positions as number[]).forEach((p) => (nm[p] = m.letter));
            return nm;
          });
        } else if (m.wrong >= MAX_WRONG) {
          setMeOut(true);
        }
      } else if (m.t === 'hm_solved') {
        setScores(m.scores);
        if (m.playerId === myId) setMeSolved(true);
      } else if (m.t === 'hm_out') {
        if (m.playerId === myId) setMeOut(true);
      } else if (m.t === 'hm_reveal') {
        setPhase('reveal');
        setReveal(m.word);
        setScores(m.scores);
      } else if (m.t === 'hm_final') {
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
    const iv = window.setInterval(() => setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 300);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const guess = (L: string) => {
    if (meSolved || meOut || phase !== 'play' || guessed.includes(L)) return;
    playClick();
    send({ t: 'hm_guess', letter: L });
  };

  const lives = MAX_WRONG - wrong;
  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 text-white px-4 py-6">
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🔡 Hangman</h1>
        <p className="text-center font-nunito text-emerald-200 text-sm mb-4">
          {phase === 'play' ? `Round ${round}/${ROUNDS} · ⏱️ ${timeLeft}s · ${'❤️'.repeat(Math.max(0, lives))}` : phase === 'reveal' ? 'Reveal!' : 'Get ready…'}
        </p>

        {(phase === 'play' || phase === 'reveal') && (
          <div className="bg-white/10 rounded-3xl p-6 mb-4 border border-white/15 text-center">
            <div className="flex flex-wrap justify-center gap-2">
              {(phase === 'reveal' ? reveal.toUpperCase().split('') : mask).map((ch, i) => (
                <span key={i} className="w-9 h-12 md:w-11 md:h-14 border-b-4 border-emerald-300 flex items-center justify-center font-fredoka font-bold text-2xl md:text-3xl">
                  {ch || ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {phase === 'play' && !meSolved && !meOut && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-4">
            {ALPHA.map((L) => {
              const used = guessed.includes(L);
              return (
                <button
                  key={L}
                  onClick={() => guess(L)}
                  disabled={used}
                  className={`w-8 h-9 md:w-9 md:h-10 rounded-lg font-fredoka font-bold text-sm md:text-base ${
                    used ? 'bg-white/5 text-white/30' : 'bg-white/15 hover:bg-white/25 active:scale-90 transition-transform'
                  }`}
                >
                  {L}
                </button>
              );
            })}
          </div>
        )}

        {meSolved && phase === 'play' && (
          <div className="bg-emerald-500/15 border-2 border-emerald-400 rounded-2xl p-4 text-center mb-4 font-fredoka text-emerald-200">
            🎉 You revealed the word! Waiting for the others…
          </div>
        )}
        {meOut && phase === 'play' && !meSolved && (
          <div className="bg-rose-500/15 border-2 border-rose-400 rounded-2xl p-4 text-center mb-4 font-fredoka text-rose-200">
            💀 Out of guesses! Sit tight for the next round.
          </div>
        )}

        <div className="bg-white/5 rounded-2xl p-3">
          <div className="font-fredoka text-xs mb-1 text-emerald-300">Top scores:</div>
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

export default Hangman;
