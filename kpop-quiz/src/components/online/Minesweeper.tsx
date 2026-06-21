import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Whole-class Minesweeper race. Host keeps the mine layout secret, runs the
// flood-fill and validates every dig. You get 3 lives — clear all the safe
// squares before your friends (and before your lives run out!).

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}
const LIVES = 3;
const NUM_COLOR = ['', 'text-sky-300', 'text-emerald-300', 'text-rose-300', 'text-violet-300', 'text-amber-300', 'text-cyan-300', 'text-pink-300', 'text-white'];
const DIFF: Record<string, { rows: number; cols: number; mines: number; ms: number }> = {
  easy: { rows: 6, cols: 6, mines: 6, ms: 150000 },
  medium: { rows: 8, cols: 8, mines: 10, ms: 210000 },
  hard: { rows: 9, cols: 9, mines: 15, ms: 270000 },
  expert: { rows: 10, cols: 10, mines: 22, ms: 330000 },
  master: { rows: 11, cols: 11, mines: 30, ms: 390000 },
  legend: { rows: 12, cols: 12, mines: 40, ms: 450000 },
};

function neighbors(i: number, rows: number, cols: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  return out;
}

const Minesweeper: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<'intro' | 'play' | 'final'>('intro');
  const [cols, setCols] = useState(6);
  const [mineCount, setMineCount] = useState(0);
  const [cells, setCells] = useState<number[]>([]); // -2 hidden, -1 mine, 0..8 clue
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [flagMode, setFlagMode] = useState(false);
  const [lives, setLives] = useState(LIVES);
  const [dead, setDead] = useState(false);
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
    rows: 6,
    cols: 6,
    mines: new Set<number>(),
    clue: [] as number[],
    safe: 0,
    pp: {} as Record<string, { revealed: Set<number>; lives: number; dead: boolean; solved: boolean }>,
    scores: {} as Record<string, number>,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    const spec = DIFF[config?.difficulty || 'easy'] || DIFF.easy;
    const total = spec.rows * spec.cols;
    h.rows = spec.rows;
    h.cols = spec.cols;

    let guard = 0;
    do {
      guard++;
      h.mines = new Set();
      while (h.mines.size < spec.mines) h.mines.add(Math.floor(Math.random() * total));
      h.clue = Array(total).fill(0);
      for (let i = 0; i < total; i++) {
        if (h.mines.has(i)) { h.clue[i] = -1; continue; }
        h.clue[i] = neighbors(i, spec.rows, spec.cols).filter((j) => h.mines.has(j)).length;
      }
    } while (!h.clue.includes(0) && guard < 60);
    h.safe = total - h.mines.size;

    const flood = (start: number): number[] => {
      const out = new Set<number>();
      const stack = [start];
      while (stack.length) {
        const i = stack.pop() as number;
        if (out.has(i)) continue;
        out.add(i);
        if (h.clue[i] === 0) for (const j of neighbors(i, h.rows, h.cols)) if (!out.has(j) && h.clue[j] !== -1) stack.push(j);
      }
      return [...out];
    };

    // a guaranteed safe opening (a 0-region) shared by everyone
    const zeroIdx = h.clue.findIndex((v) => v === 0);
    const startCells = zeroIdx >= 0 ? flood(zeroIdx) : [];
    players.forEach((p) => (h.scores[p.id] = 0));
    h.pp = {};
    playersRef.current.forEach((p) => (h.pp[p.id] = { revealed: new Set(startCells), lives: LIVES, dead: false, solved: false }));
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
        .sort((a, b) => b.score - a.score);
      send({ t: 'mw_final', top });
    };
    const checkAllOut = () => {
      const everyone = playersRef.current;
      if (everyone.length > 0 && everyone.every((p) => h.pp[p.id]?.solved || h.pp[p.id]?.dead)) window.setTimeout(endGame, 600);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'mw_dig' && !h.ended && m.from && typeof m.cell === 'number') {
        const st = h.pp[m.from];
        if (!st || st.dead || st.solved || st.revealed.has(m.cell)) return;
        if (h.mines.has(m.cell)) {
          st.lives--;
          st.revealed.add(m.cell);
          const isDead = st.lives <= 0;
          if (isDead) st.dead = true;
          send({ t: 'mw_cells', to: m.from, cells: [{ i: m.cell, v: -1 }], lives: st.lives, dead: isDead });
          if (isDead) checkAllOut();
        } else {
          const region = flood(m.cell).filter((c) => !st.revealed.has(c));
          region.forEach((c) => st.revealed.add(c));
          const cellsOut = region.map((c) => ({ i: c, v: h.clue[c] }));
          send({ t: 'mw_cells', to: m.from, cells: cellsOut, lives: st.lives, dead: false });
          const safeRevealed = [...st.revealed].filter((c) => !h.mines.has(c)).length;
          if (safeRevealed >= h.safe) {
            st.solved = true;
            const frac = Math.max(0, h.endsAt - Date.now()) / spec.ms;
            h.scores[m.from] = 100 + Math.round(150 * frac) + st.lives * 20;
            send({ t: 'mw_solved', playerId: m.from, scores: { ...h.scores } });
            checkAllOut();
          }
        }
      }
    });

    window.setTimeout(() => send({ t: 'mw_init', rows: spec.rows, cols: spec.cols, mines: spec.mines, start: startCells.map((c) => ({ i: c, v: h.clue[c] })), endsAt: h.endsAt }), 500);
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
      if (m.t === 'mw_init') {
        setCols(m.cols);
        setMineCount(m.mines);
        const g = Array(m.rows * m.cols).fill(-2);
        (m.start as { i: number; v: number }[]).forEach((c) => (g[c.i] = c.v));
        setCells(g);
        setFlags(new Set());
        setLives(LIVES);
        setDead(false);
        setMeSolved(false);
        setEndsAt(m.endsAt);
        setPhase('play');
      } else if (m.t === 'mw_cells' && m.to === myId) {
        setCells((prev) => {
          const ng = [...prev];
          (m.cells as { i: number; v: number }[]).forEach((c) => (ng[c.i] = c.v));
          return ng;
        });
        setLives(m.lives);
        if (m.dead) setDead(true);
        const hitMine = (m.cells as { i: number; v: number }[]).some((c) => c.v === -1);
        if (!hitMine) playCorrect();
      } else if (m.t === 'mw_solved') {
        setSolvedList((list) => (list.some((x) => x.id === m.playerId) ? list : [...list, { id: m.playerId }]));
        if (m.playerId === myId) setMeSolved(true);
      } else if (m.t === 'mw_final') {
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

  const tapCell = (i: number) => {
    if (dead || meSolved || phase !== 'play' || cells[i] !== -2) return;
    if (flagMode) {
      playClick();
      setFlags((f) => {
        const nf = new Set(f);
        if (nf.has(i)) nf.delete(i);
        else nf.add(i);
        return nf;
      });
      return;
    }
    if (flags.has(i)) return;
    playClick();
    send({ t: 'mw_dig', cell: i });
  };

  const mm = Math.floor(timeLeft / 60);
  const ss = String(timeLeft % 60).padStart(2, '0');
  const cellPx = cols >= 11 ? 'w-7 h-7 text-xs' : cols >= 9 ? 'w-8 h-8 text-sm' : cols >= 8 ? 'w-9 h-9 text-base' : 'w-11 h-11 text-lg';
  const minesLeft = mineCount - flags.size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-stone-950 text-white px-3 py-6">
      <div className="max-w-fit mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">💣 Minesweeper</h1>
        <p className="text-center font-nunito text-zinc-300 text-sm mb-3">
          {phase === 'play' ? `${'❤️'.repeat(Math.max(0, lives))} · 🚩 ${minesLeft} · ⏱️ ${mm}:${ss}` : 'Get ready…'}
        </p>

        {phase === 'play' && !dead && !meSolved && (
          <div className="flex justify-center mb-3">
            <button
              onClick={() => { playClick(); setFlagMode((f) => !f); }}
              className={`px-5 py-2 rounded-full font-fredoka text-sm border-2 ${flagMode ? 'bg-amber-400/30 border-amber-300' : 'bg-white/10 border-white/20'}`}
            >
              {flagMode ? '🚩 Flag mode ON' : '⛏️ Dig mode'}
            </button>
          </div>
        )}

        {phase === 'play' && cells.length > 0 && !dead && !meSolved && (
          <div className="mx-auto bg-zinc-800 rounded-2xl p-1.5 shadow-2xl" style={{ width: 'fit-content' }}>
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {cells.map((v, i) => {
                const flagged = flags.has(i);
                const hidden = v === -2;
                return (
                  <button
                    key={i}
                    onClick={() => tapCell(i)}
                    className={`${cellPx} rounded font-fredoka font-bold flex items-center justify-center ${
                      hidden ? 'bg-slate-600 hover:bg-slate-500 active:scale-95' : v === -1 ? 'bg-red-600' : 'bg-zinc-900'
                    } ${!hidden && v > 0 ? NUM_COLOR[v] : ''}`}
                  >
                    {hidden ? (flagged ? '🚩' : '') : v === -1 ? '💣' : v > 0 ? v : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {dead && phase === 'play' && (
          <div className="bg-rose-500/15 border-2 border-rose-400 rounded-3xl p-5 text-center mb-4 max-w-xs mx-auto">
            <div className="text-4xl mb-1">💥</div>
            <div className="font-fredoka text-xl text-rose-200">Boom! Out of lives.</div>
            <div className="font-nunito text-sm text-rose-100">Cheer the others on!</div>
          </div>
        )}
        {meSolved && phase === 'play' && (
          <div className="bg-emerald-500/15 border-2 border-emerald-400 rounded-3xl p-5 text-center mb-4 max-w-xs mx-auto">
            <div className="text-4xl mb-1">🎉</div>
            <div className="font-fredoka text-xl text-emerald-200">Field cleared!</div>
            <div className="font-nunito text-sm text-emerald-100">Waiting for the others…</div>
          </div>
        )}

        {solvedList.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3 mt-3 max-w-xs mx-auto">
            <div className="font-fredoka text-xs text-amber-300 mb-1">Cleared it 🏅</div>
            {solvedList.map((s, i) => (
              <div key={s.id} className="font-nunito text-xs py-0.5">#{i + 1} {byId(s.id).emoji} {byId(s.id).name}</div>
            ))}
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
                <div className="font-nunito text-zinc-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Minesweeper;
