import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Shared "everyone races to type the answer" engine. Emoji Detective, Riddle
// Rush and Word Scramble are all this game with a different prompt — they pass
// `buildRounds` (host-only, answers stay host-side) and `renderPrompt`.

export interface GuessRound {
  prompt: unknown; // serializable payload broadcast to clients (string or object)
  answer: string; // host-only — never broadcast
  alts?: string[]; // host-only accepted variants
  hint?: string;
}

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}

interface GuessRaceProps {
  room: RoomApi;
  gp: string; // message-type prefix, e.g. 'ed' → ed_round, ed_guess, …
  title: string;
  icon: string;
  themeClass: string; // gradient bg classes for the screen
  accent: string; // tailwind text colour for highlights, e.g. 'text-fuchsia-300'
  inputPlaceholder: string;
  roundMs: number;
  rounds: number;
  buildRounds: () => GuessRound[];
  renderPrompt: (args: { prompt: any; hint?: string; len: number }) => React.ReactNode;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const letters = (s: string) => s.replace(/[^a-z0-9]/gi, '').length;

type Phase = 'intro' | 'play' | 'reveal' | 'final';

const GuessRace: React.FC<GuessRaceProps> = ({
  room, gp, title, icon, themeClass, accent, inputPlaceholder, roundMs, rounds, buildRounds, renderPrompt,
}) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [total, setTotal] = useState(rounds);
  const [prompt, setPrompt] = useState<any>(null);
  const [hint, setHint] = useState<string | undefined>(undefined);
  const [len, setLen] = useState(0);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [guess, setGuess] = useState('');
  const [iGuessed, setIGuessed] = useState(false);
  const [feed, setFeed] = useState<{ name: string; text: string; correct: boolean }[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [reveal, setReveal] = useState('');
  const [finalTop, setFinalTop] = useState<TopEntry[] | null>(null);
  const xpGiven = useRef(false);

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  // Host-side authoritative state
  const hd = useRef({
    rounds: [] as GuessRound[],
    round: 0,
    answer: '',
    alts: [] as string[],
    correct: {} as Record<string, boolean>,
    scores: {} as Record<string, number>,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  // ---- HOST: game master ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.rounds = buildRounds().slice(0, rounds);
    players.forEach((p) => (h.scores[p.id] = 0));

    const startRound = (r: number) => {
      const item = h.rounds[r - 1];
      h.round = r;
      h.answer = item.answer;
      h.alts = item.alts || [];
      h.correct = {};
      h.ended = false;
      h.endsAt = Date.now() + roundMs;
      send({
        t: `${gp}_round`, round: r, total: h.rounds.length,
        prompt: item.prompt, hint: item.hint || '', len: letters(item.answer), endsAt: h.endsAt,
      });
      h.timer = window.setTimeout(endRound, roundMs + 300);
    };

    const endRound = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      send({ t: `${gp}_reveal`, round: h.round, answer: h.answer, scores: { ...h.scores } });
      h.timer = window.setTimeout(() => {
        if (h.round < h.rounds.length) {
          startRound(h.round + 1);
        } else {
          const top: TopEntry[] = Object.entries(h.scores)
            .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
            .sort((a, b) => b.score - a.score);
          send({ t: `${gp}_final`, top });
        }
      }, 3200);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === `${gp}_guess` && !h.ended && m.from && !h.correct[m.from]) {
        const accepted = [h.answer, ...h.alts].map(normalize);
        if (accepted.includes(normalize(String(m.text)))) {
          h.correct[m.from] = true;
          const frac = Math.max(0, h.endsAt - Date.now()) / roundMs;
          const pts = 100 + Math.round(100 * frac);
          h.scores[m.from] = (h.scores[m.from] || 0) + pts;
          send({ t: `${gp}_correct`, playerId: m.from, gained: pts, scores: { ...h.scores } });
          const everyone = playersRef.current;
          if (everyone.length > 0 && everyone.every((p) => h.correct[p.id])) endRound();
        } else {
          send({ t: `${gp}_nope`, playerId: m.from, text: String(m.text).slice(0, 24) });
        }
      }
    });

    h.timer = window.setTimeout(() => startRound(1), 1400);

    return () => {
      offMsg();
      window.clearTimeout(h.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE: messages ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      if (m.t === `${gp}_round`) {
        setPhase('play');
        setRound(m.round);
        setTotal(m.total);
        setPrompt(m.prompt);
        setHint(m.hint);
        setLen(m.len);
        setEndsAt(m.endsAt);
        setIGuessed(false);
        setFeed([]);
        setGuess('');
      } else if (m.t === `${gp}_correct`) {
        setScores(m.scores);
        const nm = byId(m.playerId).name;
        setFeed((f) => [{ name: nm, text: `got it! +${m.gained}`, correct: true }, ...f].slice(0, 7));
        if (m.playerId === myId) {
          setIGuessed(true);
          playCorrect();
        }
      } else if (m.t === `${gp}_nope`) {
        const nm = byId(m.playerId).name;
        setFeed((f) => [{ name: nm, text: String(m.text), correct: false }, ...f].slice(0, 7));
      } else if (m.t === `${gp}_reveal`) {
        setPhase('reveal');
        setReveal(m.answer);
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

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || iGuessed || phase !== 'play') return;
    playClick();
    send({ t: `${gp}_guess`, text: guess.trim() });
    setGuess('');
  };

  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${themeClass} text-white px-4 py-6`}>
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">
          {icon} {title}
        </h1>
        <p className="text-center font-nunito text-white/70 text-sm mb-5">
          {phase === 'intro' ? 'Get ready…' : `Round ${round}/${total} · ⏱️ ${timeLeft}s`}
        </p>

        {/* Prompt card */}
        {(phase === 'play' || phase === 'reveal') && (
          <div className="bg-white/10 border border-white/15 rounded-3xl px-4 py-6 mb-4 shadow-xl min-h-[8rem] flex items-center justify-center">
            {renderPrompt({ prompt, hint, len })}
          </div>
        )}

        {/* Guess form */}
        {phase === 'play' && (
          <form onSubmit={submitGuess} className="flex gap-2 mb-3">
            <input
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              disabled={iGuessed}
              placeholder={iGuessed ? 'You got it! 🎉' : inputPlaceholder}
              maxLength={30}
              autoFocus
              className="flex-1 px-4 py-3 rounded-2xl bg-white/90 text-gray-800 font-nunito text-lg border-2 border-white/40 focus:outline-none focus:ring-4 focus:ring-white/40 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={iGuessed || !guess.trim()}
              className={`px-6 rounded-2xl font-fredoka font-bold ${
                iGuessed || !guess.trim() ? 'bg-gray-600/50 text-gray-400' : 'bg-gradient-to-r from-amber-400 to-pink-500'
              }`}
            >
              Go!
            </button>
          </form>
        )}

        {iGuessed && phase === 'play' && (
          <div className="text-center mb-3">
            <span className="inline-block bg-emerald-500 text-white font-fredoka rounded-full px-4 py-1 shadow-lg">
              ✅ Nice! You got it — wait for the others 🤫
            </span>
          </div>
        )}

        {/* Feed + scores */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-2xl p-3 min-h-[6rem]">
            <div className={`font-fredoka text-xs mb-1 ${accent}`}>Guesses:</div>
            {feed.map((f, i) => (
              <div key={i} className={`font-nunito text-xs py-0.5 ${f.correct ? 'text-emerald-300 font-bold' : 'text-white/70'}`}>
                {f.correct ? '✅' : '💬'} {f.name}: {f.text}
              </div>
            ))}
          </div>
          <div className="bg-white/5 rounded-2xl p-3">
            <div className={`font-fredoka text-xs mb-1 ${accent}`}>Top scores:</div>
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
        {phase === 'reveal' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full">
              <div className="text-5xl mb-2">💡</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-1">
                The answer was: <span className="uppercase">{reveal}</span>
              </h2>
              <p className="font-nunito text-slate-300">Next one coming up…</p>
            </motion.div>
          </motion.div>
        )}

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
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
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

export default GuessRace;
