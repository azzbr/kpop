import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Slide the jumbled tiles back into order. Everyone gets the SAME scramble and
// the first to solve wins. Sliding can't reach an unsolvable state, so the
// host just verifies a claimed solve is actually in order.

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}
const DIFF: Record<string, { n: number; scr: number; ms: number }> = {
  easy: { n: 3, scr: 40, ms: 120000 },
  medium: { n: 3, scr: 80, ms: 120000 },
  hard: { n: 4, scr: 130, ms: 180000 },
  expert: { n: 4, scr: 220, ms: 180000 },
  master: { n: 5, scr: 280, ms: 300000 },
  legend: { n: 5, scr: 450, ms: 300000 },
};

function scramble(n: number, k: number): number[] {
  const b = Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n)); // [1,2,...,N²-1,0]
  let blank = n * n - 1;
  for (let i = 0; i < k; i++) {
    const r = Math.floor(blank / n);
    const c = blank % n;
    const nbrs: number[] = [];
    if (r > 0) nbrs.push(blank - n);
    if (r < n - 1) nbrs.push(blank + n);
    if (c > 0) nbrs.push(blank - 1);
    if (c < n - 1) nbrs.push(blank + 1);
    const p = nbrs[Math.floor(Math.random() * nbrs.length)];
    b[blank] = b[p];
    b[p] = 0;
    blank = p;
  }
  return b;
}
function isSolved(b: number[]): boolean {
  for (let i = 0; i < b.length - 1; i++) if (b[i] !== i + 1) return false;
  return b[b.length - 1] === 0;
}

const SlidingPuzzle: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<'intro' | 'play' | 'final'>('intro');
  const [n, setN] = useState(3);
  const [board, setBoard] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [meSolved, setMeSolved] = useState(false);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [solvedList, setSolvedList] = useState<{ id: string }[]>([]);
  const [finalTop, setFinalTop] = useState<TopEntry[] | null>(null);
  const xpGiven = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };
  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const hd = useRef({
    solved: {} as Record<string, boolean>,
    scores: {} as Record<string, number>,
    n: 3,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    const spec = DIFF[config?.difficulty || 'easy'] || DIFF.easy;
    h.n = spec.n;
    let b = scramble(spec.n, spec.scr);
    if (isSolved(b)) b = scramble(spec.n, spec.scr + 1);
    players.forEach((p) => (h.scores[p.id] = 0));
    h.ended = false;
    h.endsAt = Date.now() + spec.ms;

    let done = false;
    const endGame = () => {
      if (done) return;
      done = true;
      h.ended = true;
      window.clearTimeout(h.timer);
      const top: TopEntry[] = Object.entries(h.scores)
        .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
        .sort((a, b2) => b2.score - a.score);
      send({ t: 'sld_final', top });
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'sld_solved' && !h.ended && m.from && !h.solved[m.from] && Array.isArray(m.board)) {
        if ((m.board as number[]).length === h.n * h.n && isSolved(m.board)) {
          h.solved[m.from] = true;
          const frac = Math.max(0, h.endsAt - Date.now()) / spec.ms;
          h.scores[m.from] = 100 + Math.round(150 * frac);
          send({ t: 'sld_done', playerId: m.from, scores: { ...h.scores } });
          if (playersRef.current.every((p) => h.solved[p.id])) window.setTimeout(endGame, 600);
        }
      }
    });

    window.setTimeout(() => send({ t: 'sld_init', n: spec.n, board: b, endsAt: h.endsAt }), 500);
    h.timer = window.setTimeout(endGame, spec.ms + 300);
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
      if (m.t === 'sld_init') {
        setN(m.n);
        setBoard(m.board);
        setEndsAt(m.endsAt);
        setMoves(0);
        setMeSolved(false);
        setPhase('play');
      } else if (m.t === 'sld_done') {
        setSolvedList((list) => (list.some((x) => x.id === m.playerId) ? list : [...list, { id: m.playerId }]));
      } else if (m.t === 'sld_final') {
        setPhase('final');
        setFinalTop(m.top);
        playWin();
        if (!xpGiven.current) {
          xpGiven.current = true;
          addXP(m.top[0]?.id === myId && m.top[0]?.score > 0 ? 40 : 15);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  useEffect(() => {
    if (phase !== 'play' || !endsAt) return;
    const iv = window.setInterval(() => setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 400);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const slide = (idx: number) => {
    if (meSolved || phase !== 'play') return;
    const blank = board.indexOf(0);
    const r = Math.floor(idx / n);
    const c = idx % n;
    const br = Math.floor(blank / n);
    const bc = blank % n;
    if (!((r === br && Math.abs(c - bc) === 1) || (c === bc && Math.abs(r - br) === 1))) return;
    playClick();
    const nb = [...board];
    nb[blank] = board[idx];
    nb[idx] = 0;
    setBoard(nb);
    setMoves((mv) => mv + 1);
    if (isSolved(nb)) {
      setMeSolved(true);
      playCorrect();
      send({ t: 'sld_solved', board: nb });
    }
  };

  const mm = Math.floor(timeLeft / 60);
  const ss = String(timeLeft % 60).padStart(2, '0');
  const cellSize = n >= 5 ? 'w-12 h-12 text-lg' : n === 4 ? 'w-14 h-14 text-xl' : 'w-20 h-20 text-3xl';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-950 text-white px-4 py-6">
      <div className="max-w-md mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🧩 Sliding Puzzle</h1>
        <p className="text-center font-nunito text-indigo-200 text-sm mb-4">
          {phase === 'play' ? `Put 1–${n * n - 1} in order! · ⏱️ ${mm}:${ss} · ${moves} moves` : 'Get ready…'}
        </p>

        {phase === 'play' && board.length > 0 && !meSolved && (
          <div className="mx-auto mb-4 bg-indigo-900/60 rounded-2xl p-2 shadow-2xl" style={{ width: 'fit-content' }}>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
              {board.map((v, i) => (
                <button
                  key={i}
                  onClick={() => slide(i)}
                  className={`${cellSize} rounded-xl font-fredoka font-bold flex items-center justify-center ${
                    v === 0 ? 'bg-transparent' : 'bg-gradient-to-br from-sky-400 to-indigo-500 shadow active:scale-95'
                  }`}
                >
                  {v !== 0 ? v : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {meSolved && phase === 'play' && (
          <div className="bg-emerald-500/15 border-2 border-emerald-400 rounded-3xl p-5 text-center mb-4">
            <div className="text-4xl mb-1">🎉</div>
            <div className="font-fredoka text-xl text-emerald-200">Solved in {moves} moves!</div>
            <div className="font-nunito text-sm text-emerald-100">Waiting for the others…</div>
          </div>
        )}

        {solvedList.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="font-fredoka text-xs text-amber-300 mb-1">Solved it 🏅</div>
            <div className="grid grid-cols-2 gap-x-4">
              {solvedList.map((s, i) => (
                <div key={s.id} className="font-nunito text-xs py-0.5">#{i + 1} {byId(s.id).emoji} {byId(s.id).name}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'final' && finalTop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-4">
            {finalTop[0]?.id === myId && finalTop[0]?.score > 0 && <ConfettiBurst count={90} durationMs={4500} />}
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full">
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-2">
                {finalTop[0] && finalTop[0].score > 0 ? `${finalTop[0].emoji} ${finalTop[0].name} wins!` : 'Time’s up!'}
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-40 overflow-y-auto">
                {finalTop.slice(0, 8).map((e, i) => (
                  <div key={e.id} className="flex justify-between font-nunito text-sm py-0.5">
                    <span>#{i + 1} {e.emoji} {e.name}</span>
                    <span className="text-amber-200">{e.score}</span>
                  </div>
                ))}
              </div>
              <p className="font-fredoka text-green-300 mb-5">+{finalTop[0]?.id === myId && finalTop[0]?.score > 0 ? 40 : 15} XP</p>
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

export default SlidingPuzzle;
