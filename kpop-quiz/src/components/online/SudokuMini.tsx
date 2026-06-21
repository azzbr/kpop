import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Mini Sudoku race: everyone gets the SAME puzzle and the first to fill it in
// correctly wins. Host generates the puzzle and validates submissions (any
// valid completion that keeps the givens is accepted).

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}
interface Spec {
  n: number;
  boxR: number;
  boxC: number;
  remove: number;
  ms: number;
}
const DIFF: Record<string, Spec> = {
  easy: { n: 4, boxR: 2, boxC: 2, remove: 6, ms: 150000 },
  medium: { n: 4, boxR: 2, boxC: 2, remove: 9, ms: 180000 },
  hard: { n: 6, boxR: 2, boxC: 3, remove: 16, ms: 300000 },
  expert: { n: 6, boxR: 2, boxC: 3, remove: 22, ms: 360000 },
  master: { n: 6, boxR: 2, boxC: 3, remove: 26, ms: 420000 },
};

function genFull(n: number, boxR: number, boxC: number): number[] {
  const grid = Array(n * n).fill(0);
  const at = (r: number, c: number) => grid[r * n + c];
  const ok = (r: number, c: number, v: number) => {
    for (let i = 0; i < n; i++) if (at(r, i) === v || at(i, c) === v) return false;
    const br = Math.floor(r / boxR) * boxR;
    const bc = Math.floor(c / boxC) * boxC;
    for (let i = 0; i < boxR; i++) for (let j = 0; j < boxC; j++) if (at(br + i, bc + j) === v) return false;
    return true;
  };
  const solve = (pos: number): boolean => {
    if (pos === n * n) return true;
    const r = Math.floor(pos / n);
    const c = pos % n;
    const nums = Array.from({ length: n }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    for (const v of nums) {
      if (ok(r, c, v)) {
        grid[r * n + c] = v;
        if (solve(pos + 1)) return true;
        grid[r * n + c] = 0;
      }
    }
    return false;
  };
  solve(0);
  return grid;
}

function isValidGrid(grid: number[], n: number, boxR: number, boxC: number): boolean {
  if (grid.some((v) => v < 1 || v > n)) return false;
  for (let i = 0; i < n; i++) {
    const row = new Set<number>();
    const col = new Set<number>();
    for (let j = 0; j < n; j++) {
      row.add(grid[i * n + j]);
      col.add(grid[j * n + i]);
    }
    if (row.size !== n || col.size !== n) return false;
  }
  for (let br = 0; br < n; br += boxR)
    for (let bc = 0; bc < n; bc += boxC) {
      const s = new Set<number>();
      for (let i = 0; i < boxR; i++) for (let j = 0; j < boxC; j++) s.add(grid[(br + i) * n + (bc + j)]);
      if (s.size !== n) return false;
    }
  return true;
}

const SudokuMini: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<'intro' | 'play' | 'final'>('intro');
  const [spec, setSpec] = useState<Spec>(DIFF.easy);
  const [puzzle, setPuzzle] = useState<number[]>([]);
  const [grid, setGrid] = useState<number[]>([]);
  const [sel, setSel] = useState(-1);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [meSolved, setMeSolved] = useState(false);
  const [flash, setFlash] = useState(false);
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
    puzzle: [] as number[],
    solution: [] as number[],
    spec: DIFF.easy,
    solved: {} as Record<string, boolean>,
    scores: {} as Record<string, number>,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    const sp = DIFF[config?.difficulty || 'easy'] || DIFF.easy;
    h.spec = sp;
    const full = genFull(sp.n, sp.boxR, sp.boxC);
    const puz = [...full];
    const idxs = Array.from({ length: full.length }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let k = 0; k < sp.remove; k++) puz[idxs[k]] = 0;
    h.puzzle = puz;
    h.solution = full;
    h.ended = false;
    players.forEach((p) => (h.scores[p.id] = 0));
    h.endsAt = Date.now() + sp.ms;

    const endGame = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      const top: TopEntry[] = Object.entries(h.scores)
        .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
        .sort((a, b) => b.score - a.score);
      send({ t: 'sk_final', top, solution: h.solution });
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'sk_submit' && !h.ended && m.from && !h.solved[m.from] && Array.isArray(m.grid)) {
        const g = m.grid as number[];
        const keepsGivens = h.puzzle.every((v, i) => v === 0 || g[i] === v);
        const valid = g.length === h.spec.n * h.spec.n && keepsGivens && isValidGrid(g, h.spec.n, h.spec.boxR, h.spec.boxC);
        send({ t: 'sk_result', to: m.from, ok: valid });
        if (valid) {
          h.solved[m.from] = true;
          const frac = Math.max(0, h.endsAt - Date.now()) / h.spec.ms;
          const pts = 100 + Math.round(150 * frac);
          h.scores[m.from] = pts;
          send({ t: 'sk_solved', playerId: m.from, scores: { ...h.scores } });
          const everyone = playersRef.current;
          if (everyone.length > 0 && everyone.every((p) => h.solved[p.id])) window.setTimeout(endGame, 800);
        }
      }
    });

    window.setTimeout(() => send({ t: 'sk_init', spec: sp, puzzle: h.puzzle, endsAt: h.endsAt }), 500);
    h.timer = window.setTimeout(endGame, sp.ms + 300);
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
      if (m.t === 'sk_init') {
        const sp = m.spec as Spec;
        setSpec(sp);
        setPuzzle(m.puzzle);
        setGrid([...m.puzzle]);
        setEndsAt(m.endsAt);
        setPhase('play');
        setSel(-1);
        setMeSolved(false);
      } else if (m.t === 'sk_result' && m.to === myId) {
        if (m.ok) {
          setMeSolved(true);
          playCorrect();
        } else {
          setFlash(true);
          window.setTimeout(() => setFlash(false), 600);
        }
      } else if (m.t === 'sk_solved') {
        setSolvedList((list) => (list.some((x) => x.id === m.playerId) ? list : [...list, { id: m.playerId }]));
      } else if (m.t === 'sk_final') {
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

  // Countdown
  useEffect(() => {
    if (phase !== 'play' || !endsAt) return;
    const iv = window.setInterval(() => setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 400);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const setCell = (v: number) => {
    if (meSolved || sel < 0 || puzzle[sel] !== 0) return;
    playClick();
    setGrid((g) => {
      const ng = [...g];
      ng[sel] = v;
      return ng;
    });
  };

  const submit = () => {
    if (meSolved || grid.some((v) => v === 0)) return;
    playClick();
    send({ t: 'sk_submit', grid });
  };

  const { n, boxR, boxC } = spec;
  const mm = Math.floor(timeLeft / 60);
  const ss = String(timeLeft % 60).padStart(2, '0');
  const full = !grid.some((v) => v === 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-neutral-900 to-zinc-950 text-white px-4 py-6">
      <div className="max-w-sm mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🔳 Sudoku Mini</h1>
        <p className="text-center font-nunito text-zinc-300 text-sm mb-4">
          {phase === 'play' ? `Fill the grid — no repeats in a row, column or box! · ⏱️ ${mm}:${ss}` : 'Get ready…'}
        </p>

        {phase !== 'intro' && grid.length > 0 && !meSolved && (
          <>
            {/* Grid */}
            <motion.div
              animate={flash ? { x: [0, -8, 8, -6, 6, 0] } : {}}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-4 bg-zinc-800 rounded-2xl p-2 shadow-2xl"
              style={{ width: 'fit-content' }}
            >
              <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                {grid.map((v, i) => {
                  const r = Math.floor(i / n);
                  const c = i % n;
                  const given = puzzle[i] !== 0;
                  const selected = sel === i;
                  return (
                    <button
                      key={i}
                      onClick={() => !given && setSel(i)}
                      className={`w-11 h-11 md:w-12 md:h-12 flex items-center justify-center font-fredoka font-bold text-xl ${
                        given ? 'text-amber-300' : selected ? 'bg-sky-500/40 text-white' : 'bg-white/5 text-sky-200 hover:bg-white/10'
                      }`}
                      style={{
                        borderTop: r % boxR === 0 ? '2px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.15)',
                        borderLeft: c % boxC === 0 ? '2px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.15)',
                        borderRight: c === n - 1 ? '2px solid rgba(255,255,255,0.55)' : 'none',
                        borderBottom: r === n - 1 ? '2px solid rgba(255,255,255,0.55)' : 'none',
                      }}
                    >
                      {v !== 0 ? v : ''}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Number pad */}
            <div className="flex justify-center gap-2 mb-3 flex-wrap">
              {Array.from({ length: n }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => setCell(num)}
                  disabled={sel < 0}
                  className="w-11 h-11 rounded-xl font-fredoka font-bold text-xl bg-white/10 border-2 border-white/20 disabled:opacity-40 active:scale-90 transition-transform"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => setCell(0)}
                disabled={sel < 0}
                className="w-11 h-11 rounded-xl font-fredoka text-lg bg-rose-500/20 border-2 border-rose-400/40 disabled:opacity-40"
              >
                ⌫
              </button>
            </div>

            <button
              onClick={submit}
              disabled={!full}
              className={`w-full py-3 rounded-full font-fredoka font-bold text-lg mb-4 ${
                full ? 'bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl' : 'bg-gray-600/40 text-gray-400'
              }`}
            >
              Check my grid! ✅
            </button>
          </>
        )}

        {meSolved && phase === 'play' && (
          <div className="bg-emerald-500/15 border-2 border-emerald-400 rounded-3xl p-5 text-center mb-4">
            <div className="text-4xl mb-1">🎉</div>
            <div className="font-fredoka text-xl text-emerald-200">Solved it!</div>
            <div className="font-nunito text-sm text-emerald-100">Waiting for the others…</div>
          </div>
        )}

        {solvedList.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="font-fredoka text-xs text-amber-300 mb-1">Solved it 🏅</div>
            <div className="grid grid-cols-2 gap-x-4">
              {solvedList.map((s, i) => (
                <div key={s.id} className="font-nunito text-xs py-0.5">
                  #{i + 1} {byId(s.id).emoji} {byId(s.id).name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'final' && finalTop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-4">
            {finalTop[0]?.id === myId && finalTop[0]?.score > 0 && <ConfettiBurst count={90} durationMs={4500} />}
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-zinc-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full">
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-2">
                {finalTop[0] && finalTop[0].score > 0 ? `${finalTop[0].emoji} ${finalTop[0].name} wins!` : 'Time’s up!'}
              </h2>
              <div className="bg-black/30 rounded-2xl p-3 mb-3 text-left max-h-40 overflow-y-auto">
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
                <div className="font-nunito text-zinc-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SudokuMini;
