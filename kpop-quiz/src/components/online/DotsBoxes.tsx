import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { finishArenaGame } from '../../online/arenaRewards';
import { useHelloSync, duelRanking } from '../../online/boardSync';
import { DB_SIZES, newBoard, drawEdge, isEdge, edgeGeometry } from '../../online/dotsBoxesLogic';
import type { DbBoard } from '../../online/dotsBoxesLogic';
import { playClick, playWin, playCorrect } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// 1-vs-1 Dots & Boxes. Draw a line between two dots; complete the 4th side of a
// box to claim it and take another turn. Host owns the board and turn order.

const DISC = ['', '#fb7185', '#38bdf8']; // 1 rose, 2 sky

// Messages exchanged over the room channel (all start with 'db_')
type DbState = DbBoard & { p0: string; p1: string; round: number; ranked: (string | string[])[] | null; last: number };
type DbMsg = { from?: string } & (
  | { t: 'db_edge'; edge: number }
  | { t: 'db_again' }
  | ({ t: 'db_state' } & DbState)
);

const DotsBoxes: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;

  const [st, setSt] = useState<DbState | null>(null);
  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);
  const rewardedRound = useRef(-1);
  const synced = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  const hostApi = useRef<{ start: () => void; snapshot: () => void } | null>(null);
  useHelloSync(room, 'db', {
    onStart: () => hostApi.current?.start(),
    onHello: () => hostApi.current?.snapshot(),
    synced: () => synced.current,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const sz = DB_SIZES[config?.difficulty || 'medium'] || DB_SIZES.medium;
    let live = false;
    let h: DbState = { ...newBoard(sz.R, sz.C), p0: players[0]?.id || '', p1: players[1]?.id || '', round: 0, ranked: null, last: -1 };
    const broadcast = () => { if (live) send({ t: 'db_state', ...h }); };
    hostApi.current = { start: () => { live = true; broadcast(); }, snapshot: broadcast };

    const offMsg = onMessage((raw) => {
      const m = raw as unknown as DbMsg;
      if (!live) return;
      if (m.t === 'db_edge' && typeof m.edge === 'number') {
        const disc = m.from === h.p0 ? 1 : m.from === h.p1 ? 2 : 0;
        const next = drawEdge(h, m.edge, disc);
        if (!next) return;
        h = { ...h, ...next, last: m.edge };
        if (h.winner) h.ranked = duelRanking(h.p0, h.p1, h.winner);
        broadcast();
      } else if (m.t === 'db_again' && m.from === myId && h.winner) {
        const round = h.round + 1;
        h = { ...newBoard(h.R, h.C, round % 2 === 0 ? 1 : 2), p0: h.p0, p1: h.p1, round, ranked: null, last: -1 };
        broadcast();
      }
    });
    return () => {
      offMsg();
      hostApi.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as unknown as DbMsg;
      if (m.t !== 'db_state') return;
      synced.current = true;
      const { t: _t, from: _f, ...state } = m;
      void _t; void _f;
      setSt((prev) => {
        const mineNow = m.p0 === myId ? 1 : m.p1 === myId ? 2 : 0;
        if (prev && prev.round === m.round && mineNow && m.scores[mineNow as 1 | 2] > prev.scores[mineNow as 1 | 2]) playCorrect();
        return state;
      });
      if (!m.winner) setReward(null);
      if (m.winner && m.ranked && rewardedRound.current !== m.round) {
        rewardedRound.current = m.round;
        const r = finishArenaGame(room, m.ranked);
        setReward({ xp: r.xp, coins: r.coins });
        const mine = m.p0 === myId ? 1 : m.p1 === myId ? 2 : 0;
        if (m.winner === mine) playWin();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  if (!st) {
    return (
      <div className="min-h-screen-d bg-gradient-to-br from-emerald-950 via-teal-950 to-cyan-950 text-white flex items-center justify-center font-fredoka text-2xl">
        ◻️ Getting the dots ready…
      </div>
    );
  }

  const { R, C, owners, turn, scores, winner, p0, p1 } = st;
  const drawn = new Set(st.drawn);
  const myDisc = p0 === myId ? 1 : p1 === myId ? 2 : 0;
  const myTurn = !winner && myDisc !== 0 && turn === myDisc;
  const oppId = myDisc === 1 ? p1 : p0;

  const clickEdge = (edge: number) => {
    if (!myTurn || drawn.has(edge)) return;
    playClick();
    send({ t: 'db_edge', edge });
  };

  // Box size (CSS length): fills the width, never taller than the screen, capped at 120px.
  // Every edge's hit area is a diamond one box across (≥ 44px square inside it on an iPad).
  const S = `min(calc((100vw - 40px) / ${C + 1}), calc((100dvh - 290px) / ${R + 1}), 120px)`;
  const at = (n: number) => `calc(${S} * ${n})`;
  const edges: number[] = [];
  for (let id = 0; id < (2 * R + 1) * (2 * C + 1); id++) if (isEdge(st, id)) edges.push(id);
  const gC = 2 * C + 1;

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-emerald-950 via-teal-950 to-cyan-950 text-white px-4 py-6">
      <div className="max-w-3xl mx-auto pt-8">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">◻️ Dots &amp; Boxes</h1>
        <p className="text-center font-nunito text-lg mb-2 min-h-[1.75rem]">
          {winner ? (
            <span className="text-amber-300">Game over!</span>
          ) : myTurn ? (
            <span className="text-emerald-300 font-bold">🟢 Your turn — tap between two dots!</span>
          ) : myDisc === 0 ? (
            <span className="text-white/70">👀 You're watching this one!</span>
          ) : (
            <span className="text-white/70">Waiting for {byId(oppId).emoji} {byId(oppId).name}…</span>
          )}
        </p>

        <div className="flex justify-center gap-3 mb-3 font-fredoka text-lg">
          {[1, 2].map((d) => {
            const id = d === 1 ? p0 : p1;
            return (
              <span key={d} className={`rounded-full px-4 py-1 border-2 ${turn === d && !winner ? 'border-white/70 bg-white/10' : 'border-transparent'}`} style={{ color: DISC[d] }}>
                {byId(id).emoji} {byId(id).name}{id === myId ? ' (you)' : ''}: {scores[d as 1 | 2]}
              </span>
            );
          })}
        </div>

        <div className="flex justify-center mb-4">
          <div className="relative game-surface" style={{ width: at(C + 1), height: at(R + 1) }}>
            {/* Claimed boxes */}
            {Object.entries(owners).map(([bid, owner]) => {
              const gr = Math.floor(Number(bid) / gC);
              const gc = Number(bid) % gC;
              const x = (gc - 1) / 2 + 0.5;
              const y = (gr - 1) / 2 + 0.5;
              const ownerId = owner === 1 ? p0 : p1;
              return (
                <motion.div
                  key={bid}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute flex items-center justify-center rounded-md"
                  style={{ left: at(x), top: at(y), width: S, height: S, background: `${DISC[owner]}88`, fontSize: `calc(${S} * 0.45)` }}
                >
                  {byId(ownerId).emoji}
                </motion.div>
              );
            })}
            {/* Edges: visible line + invisible diamond hit area */}
            {edges.map((id) => {
              const g = edgeGeometry(st, id);
              const isDrawn = drawn.has(id);
              const isLast = st.last === id;
              return (
                <button
                  key={id}
                  onClick={() => clickEdge(id)}
                  disabled={!myTurn || isDrawn}
                  aria-label={g.horiz ? 'Line across' : 'Line down'}
                  className="absolute flex items-center justify-center group"
                  style={{
                    left: at(g.x), top: at(g.y), width: S, height: S,
                    clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
                    background: 'transparent',
                  }}
                >
                  <span
                    className={`block rounded-full transition-colors ${isDrawn ? (isLast ? 'bg-white' : 'bg-amber-400') : myTurn ? 'bg-white/20 group-active:bg-white/60' : 'bg-white/5'}`}
                    style={{ width: g.horiz ? '78%' : 'max(7px, 9%)', height: g.horiz ? 'max(7px, 9%)' : '78%' }}
                  />
                </button>
              );
            })}
            {/* Dots */}
            {Array.from({ length: (R + 1) * (C + 1) }, (_, k) => {
              const x = (k % (C + 1)) + 0.5;
              const y = Math.floor(k / (C + 1)) + 0.5;
              return (
                <span
                  key={`d${k}`}
                  className="absolute rounded-full bg-white pointer-events-none"
                  style={{ left: at(x), top: at(y), width: 14, height: 14, transform: 'translate(-50%, -50%)' }}
                />
              );
            })}
          </div>
        </div>
        <p className="text-center font-nunito text-white/70 text-base">Finish the 4th side of a box to claim it and go again!</p>
      </div>

      <AnimatePresence>
        {winner !== 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            {winner !== 3 && winner === myDisc && <ConfettiBurst count={90} durationMs={4500} />}
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full">
              <div className="text-7xl mb-3">{winner === 3 ? '🤝' : winner === myDisc ? '🏆' : '💪'}</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
                {winner === 3 ? "It's a draw!" : winner === myDisc ? 'You win! 🎉' : `${byId(winner === 1 ? p0 : p1).name} wins!`}
              </h2>
              <p className="font-fredoka text-xl mb-2">{scores[1]} – {scores[2]}</p>
              {reward && <p className="font-fredoka text-lg text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={() => { playClick(); send({ t: 'db_again' }); }} className="flex-1 min-h-[48px] px-4 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-emerald-400 to-teal-500 shadow-xl">
                    Rematch 🔄
                  </button>
                  <button onClick={() => { playClick(); send({ t: 'to_lobby' }); }} className="flex-1 min-h-[48px] px-4 py-3 rounded-full font-fredoka font-bold text-lg bg-white/15">
                    Lobby 🏠
                  </button>
                </div>
              ) : (
                <div className="font-nunito text-lg text-slate-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DotsBoxes;
