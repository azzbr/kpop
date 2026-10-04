import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// 1-vs-1 Dots & Boxes. Draw a line between two dots; complete the 4th side of a
// box to claim it and take another turn. Host owns the board and turn order.

const SIZE: Record<string, { R: number; C: number }> = {
  small: { R: 3, C: 3 },
  medium: { R: 4, C: 4 },
  large: { R: 5, C: 5 },
};
const DISC = ['', '#fb7185', '#38bdf8']; // 1 rose, 2 sky

const DotsBoxes: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [R, setR] = useState(4);
  const [C, setC] = useState(4);
  const [drawn, setDrawn] = useState<Set<number>>(new Set());
  const [owners, setOwners] = useState<Record<number, number>>({});
  const [turn, setTurn] = useState(1);
  const [scores, setScores] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [winner, setWinner] = useState(0);
  const [seats, setSeats] = useState<{ p0: string; p1: string }>({ p0: '', p1: '' });
  const xpGiven = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };
  const gR = 2 * R + 1;
  const gC = 2 * C + 1;
  const myDisc = seats.p0 === myId ? 1 : seats.p1 === myId ? 2 : 0;
  const myTurn = !winner && myDisc !== 0 && turn === myDisc;

  const hd = useRef({
    R: 4,
    C: 4,
    gC: 9,
    gR: 9,
    drawn: new Set<number>(),
    owners: {} as Record<number, number>,
    turn: 1,
    scores: { 1: 0, 2: 0 } as { 1: number; 2: number },
    winner: 0,
    p0: '',
    p1: '',
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    const sz = SIZE[config?.difficulty || 'medium'] || SIZE.medium;
    h.R = sz.R;
    h.C = sz.C;
    h.gR = 2 * sz.R + 1;
    h.gC = 2 * sz.C + 1;
    h.drawn = new Set();
    h.owners = {};
    h.turn = 1;
    h.scores = { 1: 0, 2: 0 };
    h.winner = 0;
    h.p0 = players[0]?.id || '';
    h.p1 = players[1]?.id || '';
    const total = sz.R * sz.C;

    const eid = (gr: number, gc: number) => gr * h.gC + gc;
    const boxDone = (br: number, bc: number) =>
      h.drawn.has(eid(br - 1, bc)) && h.drawn.has(eid(br + 1, bc)) && h.drawn.has(eid(br, bc - 1)) && h.drawn.has(eid(br, bc + 1));
    const broadcast = () =>
      send({ t: 'db_state', R: h.R, C: h.C, drawn: [...h.drawn], owners: h.owners, turn: h.turn, scores: h.scores, winner: h.winner, p0: h.p0, p1: h.p1 });

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'db_edge' && !h.winner && typeof m.edge === 'number') {
        const disc = m.from === h.p0 ? 1 : m.from === h.p1 ? 2 : 0;
        if (disc !== h.turn) return;
        const gr = Math.floor(m.edge / h.gC);
        const gc = m.edge % h.gC;
        const isEdge = (gr % 2 === 0 && gc % 2 === 1) || (gr % 2 === 1 && gc % 2 === 0);
        if (!isEdge || h.drawn.has(m.edge)) return;
        h.drawn.add(m.edge);
        const boxes = gr % 2 === 0 ? [[gr - 1, gc], [gr + 1, gc]] : [[gr, gc - 1], [gr, gc + 1]];
        let claimed = 0;
        for (const [br, bc] of boxes) {
          if (br > 0 && br < h.gR && bc > 0 && bc < h.gC) {
            const bid = br * h.gC + bc;
            if (!h.owners[bid] && boxDone(br, bc)) {
              h.owners[bid] = disc;
              h.scores[disc as 1 | 2]++;
              claimed++;
            }
          }
        }
        if (h.scores[1] + h.scores[2] >= total) h.winner = h.scores[1] > h.scores[2] ? 1 : h.scores[2] > h.scores[1] ? 2 : 3;
        else if (claimed === 0) h.turn = h.turn === 1 ? 2 : 1;
        broadcast();
      } else if (m.t === 'db_again' && h.winner) {
        h.drawn = new Set();
        h.owners = {};
        h.scores = { 1: 0, 2: 0 };
        h.winner = 0;
        h.turn = 1;
        broadcast();
      }
    });

    window.setTimeout(broadcast, 500);
    return () => offMsg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'db_state') {
        setR(m.R);
        setC(m.C);
        setDrawn(new Set(m.drawn));
        setOwners(m.owners);
        setTurn(m.turn);
        setScores(m.scores);
        setWinner(m.winner);
        setSeats({ p0: m.p0, p1: m.p1 });
        if (m.winner && !xpGiven.current) {
          xpGiven.current = true;
          const mine = m.p0 === myId ? 1 : 2;
          if (m.winner === 3) addXP(20);
          else if (m.winner === mine) { addXP(40); playWin(); }
          else addXP(15);
        } else if (!m.winner) xpGiven.current = false;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const clickEdge = (edge: number) => {
    if (!myTurn || drawn.has(edge)) return;
    playClick();
    send({ t: 'db_edge', edge });
  };

  const oppId = myDisc === 1 ? seats.p1 : seats.p0;
  const cols = Array.from({ length: gC }, (_, i) => (i % 2 === 0 ? '11px' : '34px')).join(' ');
  const rows = Array.from({ length: gR }, (_, i) => (i % 2 === 0 ? '11px' : '34px')).join(' ');

  const cellNode = (gr: number, gc: number) => {
    const edge = gr * gC + gc;
    if (gr % 2 === 0 && gc % 2 === 0) return <span className="w-full h-full rounded-full bg-white/80" />;
    if (gr % 2 === 1 && gc % 2 === 1) {
      const owner = owners[gr * gC + gc];
      return (
        <span className="w-full h-full flex items-center justify-center text-xs" style={{ background: owner ? `${DISC[owner]}55` : 'transparent' }}>
          {owner ? (owner === myDisc ? '⭐' : '·') : ''}
        </span>
      );
    }
    // edge
    const isDrawn = drawn.has(edge);
    const horiz = gr % 2 === 0;
    return (
      <button
        onClick={() => clickEdge(edge)}
        disabled={!myTurn || isDrawn}
        className={`rounded-full transition-colors ${isDrawn ? '' : myTurn ? 'bg-white/15 hover:bg-white/40' : 'bg-white/5'}`}
        style={{
          width: horiz ? '30px' : '7px',
          height: horiz ? '7px' : '30px',
          margin: 'auto',
          background: isDrawn ? '#fbbf24' : undefined,
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-cyan-950 text-white px-4 py-6">
      <div className="max-w-md mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">◻️ Dots &amp; Boxes</h1>
        <p className="text-center font-nunito text-sm mb-3">
          {winner ? (
            <span className="text-amber-300">Game over!</span>
          ) : myTurn ? (
            <span className="text-emerald-300 font-bold">🟢 Your turn — draw a line!</span>
          ) : (
            <span className="text-white/60">Waiting for {byId(oppId).emoji} {byId(oppId).name}…</span>
          )}
        </p>

        <div className="flex justify-center gap-6 mb-3 font-fredoka">
          <span style={{ color: DISC[1] }}>{byId(seats.p0).name}{seats.p0 === myId ? ' (you)' : ''}: {scores[1]}</span>
          <span style={{ color: DISC[2] }}>{byId(seats.p1).name}{seats.p1 === myId ? ' (you)' : ''}: {scores[2]}</span>
        </div>

        <div className="flex justify-center mb-4">
          <div className="grid" style={{ gridTemplateColumns: cols, gridTemplateRows: rows }}>
            {Array.from({ length: gR * gC }, (_, k) => {
              const gr = Math.floor(k / gC);
              const gc = k % gC;
              return (
                <div key={k} className="flex items-center justify-center">
                  {cellNode(gr, gc)}
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-center font-nunito text-white/40 text-xs">Complete a box to claim it ⭐ and go again!</p>
      </div>

      <AnimatePresence>
        {winner !== 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            {winner !== 3 && winner === myDisc && <ConfettiBurst count={90} durationMs={4500} />}
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full">
              <div className="text-7xl mb-3">{winner === 3 ? '🤝' : winner === myDisc ? '🏆' : '💪'}</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
                {winner === 3 ? "It's a draw!" : winner === myDisc ? 'You win! 🎉' : `${byId(winner === 1 ? seats.p0 : seats.p1).name} wins!`}
              </h2>
              <p className="font-fredoka text-green-300 mb-5">+{winner === 3 ? 20 : winner === myDisc ? 40 : 15} XP</p>
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={() => { playClick(); send({ t: 'db_again' }); }} className="flex-1 px-4 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-emerald-400 to-teal-500 shadow-xl">
                    Rematch 🔄
                  </button>
                  <button onClick={() => { playClick(); send({ t: 'to_lobby' }); }} className="flex-1 px-4 py-3 rounded-full font-fredoka font-bold bg-white/15">
                    Lobby 🏠
                  </button>
                </div>
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

export default DotsBoxes;
