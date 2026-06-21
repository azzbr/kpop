import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Whole-class Mastermind: everyone races to crack the SAME secret colour code.
// After each guess you learn how many pegs are the right colour in the right
// spot (⚫) and how many are the right colour in the wrong spot (⚪). Host keeps
// the code secret and scores by speed + fewest guesses.

const COLORS = [
  { hex: '#ef4444', name: 'red' },
  { hex: '#3b82f6', name: 'blue' },
  { hex: '#22c55e', name: 'green' },
  { hex: '#eab308', name: 'yellow' },
  { hex: '#a855f7', name: 'purple' },
  { hex: '#f97316', name: 'orange' },
  { hex: '#06b6d4', name: 'cyan' },
  { hex: '#ec4899', name: 'pink' },
];

const ROUND_MS = 150000; // 2.5 minutes to crack it

function params(difficulty: string): { length: number; palette: number; repeats: boolean } {
  if (difficulty === 'easy') return { length: 3, palette: 5, repeats: false };
  if (difficulty === 'hard') return { length: 4, palette: 6, repeats: true };
  if (difficulty === 'expert') return { length: 5, palette: 6, repeats: true };
  if (difficulty === 'master') return { length: 5, palette: 8, repeats: true };
  if (difficulty === 'legend') return { length: 6, palette: 8, repeats: true };
  return { length: 4, palette: 6, repeats: false }; // normal
}

function genCode(length: number, palette: number, repeats: boolean): number[] {
  if (repeats) return Array.from({ length }, () => Math.floor(Math.random() * palette));
  const shuffled = Array.from({ length: palette }, (_, i) => i).sort(() => Math.random() - 0.5);
  return shuffled.slice(0, length);
}

function evalGuess(code: number[], guess: number[]): { exact: number; color: number } {
  let exact = 0;
  const cRem: number[] = [];
  const gRem: number[] = [];
  for (let i = 0; i < code.length; i++) {
    if (guess[i] === code[i]) exact++;
    else {
      cRem.push(code[i]);
      gRem.push(guess[i]);
    }
  }
  const counts: Record<number, number> = {};
  for (const c of cRem) counts[c] = (counts[c] || 0) + 1;
  let color = 0;
  for (const g of gRem) {
    if (counts[g] > 0) {
      color++;
      counts[g]--;
    }
  }
  return { exact, color };
}

interface HistRow {
  guess: number[];
  exact: number;
  color: number;
}
interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}

const Dot: React.FC<{ ci: number; size?: string }> = ({ ci, size = 'w-8 h-8' }) => (
  <span className={`${size} rounded-full inline-block border-2 border-white/30`} style={{ background: COLORS[ci]?.hex || '#334155' }} />
);

const CodeBreaker: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();
  const { length, palette, repeats } = params(config?.difficulty || 'normal');

  const [phase, setPhase] = useState<'play' | 'final'>('play');
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [cur, setCur] = useState<number[]>([]);
  const [history, setHistory] = useState<HistRow[]>([]);
  const [meSolved, setMeSolved] = useState(false);
  const [solvedList, setSolvedList] = useState<{ id: string; guesses: number }[]>([]);
  const [finalCode, setFinalCode] = useState<number[] | null>(null);
  const [finalTop, setFinalTop] = useState<TopEntry[] | null>(null);
  const xpGiven = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };
  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const hd = useRef({
    code: [] as number[],
    solved: {} as Record<string, boolean>,
    guesses: {} as Record<string, number>,
    scores: {} as Record<string, number>,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.code = genCode(length, palette, repeats);
    h.ended = false;
    players.forEach((p) => (h.scores[p.id] = 0));
    h.endsAt = Date.now() + ROUND_MS;

    const endGame = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      const top: TopEntry[] = Object.entries(h.scores)
        .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
        .sort((a, b) => b.score - a.score);
      send({ t: 'cb_final', code: h.code, top });
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'cb_guess' && !h.ended && m.from && !h.solved[m.from] && Array.isArray(m.guess)) {
        h.guesses[m.from] = (h.guesses[m.from] || 0) + 1;
        const fb = evalGuess(h.code, m.guess as number[]);
        const solved = fb.exact === length;
        send({ t: 'cb_feedback', to: m.from, guess: m.guess, exact: fb.exact, color: fb.color, solved });
        if (solved) {
          h.solved[m.from] = true;
          const frac = Math.max(0, h.endsAt - Date.now()) / ROUND_MS;
          const pts = 120 + Math.round(120 * frac) + Math.max(0, 90 - (h.guesses[m.from] - 1) * 15);
          h.scores[m.from] = pts;
          send({ t: 'cb_solved', playerId: m.from, guesses: h.guesses[m.from], scores: { ...h.scores } });
          const everyone = playersRef.current;
          if (everyone.length > 0 && everyone.every((p) => h.solved[p.id])) {
            window.setTimeout(endGame, 800);
          }
        }
      }
    });

    h.timer = window.setTimeout(endGame, ROUND_MS + 300);
    window.setTimeout(() => send({ t: 'cb_start', endsAt: h.endsAt }), 600);

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
      if (m.t === 'cb_start') {
        setEndsAt(m.endsAt);
      } else if (m.t === 'cb_feedback' && m.to === myId) {
        setHistory((hist) => [{ guess: m.guess, exact: m.exact, color: m.color }, ...hist]);
        if (m.solved) {
          setMeSolved(true);
          playCorrect();
        }
      } else if (m.t === 'cb_solved') {
        setSolvedList((list) =>
          list.some((x) => x.id === m.playerId) ? list : [...list, { id: m.playerId, guesses: m.guesses }]
        );
      } else if (m.t === 'cb_final') {
        setPhase('final');
        setFinalCode(m.code);
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
    if (phase !== 'play' || !endsAt) return;
    const iv = window.setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 400);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const addColor = (ci: number) => {
    if (meSolved || cur.length >= length) return;
    playClick();
    setCur((c) => [...c, ci]);
  };
  const removeAt = (i: number) => setCur((c) => c.filter((_, idx) => idx !== i));
  const submitGuess = () => {
    if (cur.length !== length || meSolved) return;
    playClick();
    send({ t: 'cb_guess', guess: cur });
    setCur([]);
  };

  const mm = Math.floor(timeLeft / 60);
  const ss = String(timeLeft % 60).padStart(2, '0');
  const paletteColors = COLORS.slice(0, palette);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-zinc-950 text-white px-4 py-6">
      <div className="max-w-md mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🔢 Code Breaker</h1>
        <p className="text-center font-nunito text-zinc-300 text-sm mb-4">
          Crack the secret {length}-colour code! · ⏱️ {mm}:{ss}
        </p>

        {/* Peg key */}
        <div className="flex justify-center gap-4 text-xs font-nunito text-zinc-300 mb-4">
          <span>⚫ = right colour, right spot</span>
          <span>⚪ = right colour, wrong spot</span>
        </div>

        {!meSolved ? (
          <>
            {/* Current guess */}
            <div className="flex justify-center items-center gap-2 mb-3">
              {Array.from({ length }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => cur[i] !== undefined && removeAt(i)}
                  className="w-12 h-12 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center"
                  style={{ background: cur[i] !== undefined ? COLORS[cur[i]].hex : 'transparent' }}
                />
              ))}
            </div>

            {/* Palette */}
            <div className="flex justify-center gap-2 mb-3 flex-wrap">
              {paletteColors.map((c, i) => (
                <button
                  key={i}
                  onClick={() => addColor(i)}
                  className="w-11 h-11 rounded-full border-2 border-white/40 active:scale-90 transition-transform"
                  style={{ background: c.hex }}
                  title={c.name}
                />
              ))}
            </div>

            <button
              onClick={submitGuess}
              disabled={cur.length !== length}
              className={`w-full py-3 rounded-full font-fredoka font-bold text-lg mb-5 ${
                cur.length === length ? 'bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl' : 'bg-gray-600/40 text-gray-400'
              }`}
            >
              Check guess! 🔍
            </button>
          </>
        ) : (
          <div className="bg-emerald-500/15 border-2 border-emerald-400 rounded-3xl p-5 text-center mb-5">
            <div className="text-4xl mb-1">🎉</div>
            <div className="font-fredoka text-xl text-emerald-200">You cracked it!</div>
            <div className="font-nunito text-sm text-emerald-100">Hang tight while the others try…</div>
          </div>
        )}

        {/* History */}
        <div className="bg-white/5 rounded-2xl p-3 mb-4 max-h-64 overflow-y-auto">
          <div className="font-fredoka text-xs text-zinc-400 mb-2">Your guesses ({history.length}):</div>
          {history.length === 0 && <div className="font-nunito text-xs text-zinc-500">No guesses yet — give it a try!</div>}
          {history.map((row, ri) => (
            <div key={ri} className="flex items-center justify-between py-1">
              <div className="flex gap-1.5">
                {row.guess.map((ci, gi) => <Dot key={gi} ci={ci} size="w-7 h-7" />)}
              </div>
              <div className="flex gap-0.5 items-center">
                {Array.from({ length: row.exact }).map((_, k) => <span key={`e${k}`} className="text-lg leading-none">⚫</span>)}
                {Array.from({ length: row.color }).map((_, k) => <span key={`c${k}`} className="text-lg leading-none">⚪</span>)}
                {Array.from({ length: length - row.exact - row.color }).map((_, k) => (
                  <span key={`n${k}`} className="text-lg leading-none opacity-40">▫️</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Who solved it */}
        {solvedList.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="font-fredoka text-xs text-amber-300 mb-1">Cracked it 🏅</div>
            {solvedList.map((s) => (
              <div key={s.id} className="font-nunito text-xs py-0.5 flex justify-between">
                <span>{byId(s.id).emoji} {byId(s.id).name}</span>
                <span className="text-emerald-300">{s.guesses} guesses</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'final' && finalTop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-zinc-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full">
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-2">
                {finalTop[0] && finalTop[0].score > 0 ? `${finalTop[0].emoji} ${finalTop[0].name} wins!` : 'Time’s up!'}
              </h2>
              {finalCode && (
                <div className="mb-3">
                  <div className="font-nunito text-xs text-zinc-300 mb-1">The secret code was:</div>
                  <div className="flex justify-center gap-2">
                    {finalCode.map((ci, i) => <Dot key={i} ci={ci} />)}
                  </div>
                </div>
              )}
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-40 overflow-y-auto">
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
                <div className="font-nunito text-zinc-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CodeBreaker;
