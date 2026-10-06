import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi } from '../../online/useRoom';
import { finishArenaGame } from '../../online/arenaRewards';
import { useHelloSync, duelRanking } from '../../online/boardSync';
import { C4_ROWS as ROWS, C4_COLS as COLS, emptyBoard, playMove } from '../../online/connectFourLogic';
import { playClick, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// 1-vs-1 Connect 4. Host owns the board; both players send column drops and the
// host validates turns, applies the move, checks for a win and broadcasts state.

const DISC_COLOR = ['transparent', '#ef4444', '#f4c20d']; // 0 empty, 1 red, 2 yellow

// Messages exchanged over the room channel (all start with 'c4_')
type C4State = {
  board: number[]; turn: number; winner: number; winLine: number[]; p0: string; p1: string;
  round: number; ranked: (string | string[])[] | null;
};
type C4Msg = { from?: string } & (
  | { t: 'c4_drop'; col: number }
  | { t: 'c4_again' }
  | ({ t: 'c4_state' } & C4State)
);

const ConnectFour: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;

  const [board, setBoard] = useState<number[]>(emptyBoard);
  const [turn, setTurn] = useState(1);
  const [winner, setWinner] = useState(0); // 0 playing, 1/2 disc, 3 draw
  const [winLine, setWinLine] = useState<number[]>([]);
  const [seats, setSeats] = useState<{ p0: string; p1: string }>({ p0: '', p1: '' });
  const [started, setStarted] = useState(false);
  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);
  const rewardedRound = useRef(-1);
  const synced = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };
  const myDisc = seats.p0 === myId ? 1 : seats.p1 === myId ? 2 : 0;
  const myTurn = winner === 0 && myDisc !== 0 && turn === myDisc;

  const hostApi = useRef<{ start: () => void; snapshot: () => void } | null>(null);
  useHelloSync(room, 'c4', {
    onStart: () => hostApi.current?.start(),
    onHello: () => hostApi.current?.snapshot(),
    synced: () => synced.current,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h: C4State & { starter: number; live: boolean } = {
      board: emptyBoard(), turn: 1, winner: 0, winLine: [], p0: players[0]?.id || '', p1: players[1]?.id || '',
      round: 0, ranked: null, starter: 1, live: false,
    };
    const broadcast = () => {
      if (!h.live) return;
      send({ t: 'c4_state', board: h.board, turn: h.turn, winner: h.winner, winLine: h.winLine, p0: h.p0, p1: h.p1, round: h.round, ranked: h.ranked });
    };
    hostApi.current = {
      start: () => { h.live = true; broadcast(); },
      snapshot: broadcast,
    };

    const offMsg = onMessage((raw) => {
      const m = raw as unknown as C4Msg;
      if (!h.live) return;
      if (m.t === 'c4_drop' && h.winner === 0 && typeof m.col === 'number') {
        const disc = m.from === h.p0 ? 1 : m.from === h.p1 ? 2 : 0;
        if (disc === 0 || disc !== h.turn) return;
        const res = playMove(h.board, m.col, disc);
        if (!res) return;
        Object.assign(h, res);
        if (h.winner) h.ranked = duelRanking(h.p0, h.p1, h.winner);
        broadcast();
      } else if (m.t === 'c4_again' && m.from === myId && h.winner !== 0) {
        h.board = emptyBoard();
        h.winner = 0;
        h.winLine = [];
        h.ranked = null;
        h.round += 1;
        h.starter = h.starter === 1 ? 2 : 1;
        h.turn = h.starter;
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
      const m = raw as unknown as C4Msg;
      if (m.t !== 'c4_state') return;
      synced.current = true;
      setStarted(true);
      setBoard(m.board);
      setTurn(m.turn);
      setWinner(m.winner);
      setWinLine(m.winLine || []);
      setSeats({ p0: m.p0, p1: m.p1 });
      if (m.winner === 0) setReward(null);
      if (m.winner !== 0 && m.ranked && rewardedRound.current !== m.round) {
        rewardedRound.current = m.round;
        const r = finishArenaGame(room, m.ranked);
        setReward({ xp: r.xp, coins: r.coins });
        const mine = m.p0 === myId ? 1 : m.p1 === myId ? 2 : 0;
        if (m.winner === mine) playWin();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const dropCol = (c: number) => {
    if (!myTurn) return;
    // column full?
    if (board[c] !== 0) return;
    playClick();
    send({ t: 'c4_drop', col: c });
  };

  const oppId = myDisc === 1 ? seats.p1 : seats.p0;

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 text-white px-4 py-6">
      <div className="max-w-xl mx-auto pt-8">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">♟️ Connect 4</h1>
        <p className="text-center font-nunito text-lg mb-3 min-h-[1.75rem]">
          {!started ? (
            <span className="text-white/70">Getting the board ready…</span>
          ) : winner !== 0 ? (
            <span className="text-amber-300">Game over!</span>
          ) : myTurn ? (
            <span className="text-emerald-300 font-bold">🟢 Your turn — tap a column to drop a disc!</span>
          ) : myDisc === 0 ? (
            <span className="text-white/70">👀 Watching {byId(seats.p0).name} vs {byId(seats.p1).name}</span>
          ) : (
            <span className="text-white/70">Waiting for {byId(oppId).emoji} {byId(oppId).name}…</span>
          )}
        </p>

        {/* Seat banner */}
        <div className="flex justify-center gap-5 mb-3 font-fredoka text-lg">
          {[1, 2].map((d) => {
            const id = d === 1 ? seats.p0 : seats.p1;
            return (
              <span key={d} className={`flex items-center gap-2 rounded-full px-3 py-1 ${turn === d && winner === 0 ? 'bg-white/15 opacity-100' : 'opacity-60'}`}>
                <span className="w-6 h-6 rounded-full inline-block border-2 border-white/40" style={{ background: DISC_COLOR[d] }} />
                {byId(id).emoji} {byId(id).name}{id === myId ? ' (you)' : ''}
              </span>
            );
          })}
        </div>

        {/* Board — scales to the screen (wide enough for ≥44px columns on iPad) */}
        <div className="mx-auto bg-blue-800/60 rounded-3xl p-2 md:p-3 shadow-2xl game-surface" style={{ width: 'min(100%, calc((100dvh - 230px) * 7 / 6))', minWidth: 'min(100%, 340px)' }}>
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {Array.from({ length: COLS }).map((_, c) => (
              <button
                key={c}
                onClick={() => dropCol(c)}
                disabled={!myTurn || board[c] !== 0}
                aria-label={`Drop in column ${c + 1}`}
                className={`flex flex-col gap-1 md:gap-2 rounded-xl p-0.5 ${myTurn && board[c] === 0 ? 'active:bg-white/20 cursor-pointer' : 'cursor-default'}`}
              >
                {Array.from({ length: ROWS }).map((_, r) => {
                  const idx = r * COLS + c;
                  const v = board[idx];
                  const win = winLine.includes(idx);
                  return (
                    <span
                      key={r}
                      className={`aspect-square rounded-full border-2 ${win ? 'border-emerald-300 ring-4 ring-emerald-300' : 'border-blue-900/40'}`}
                      style={{ background: v === 0 ? 'rgba(255,255,255,0.12)' : DISC_COLOR[v] }}
                    />
                  );
                })}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center font-nunito text-white/60 text-base mt-3">Line up four in a row — across, down or diagonally!</p>
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
              {winner !== 3 && winner !== myDisc && myDisc !== 0 && <p className="font-nunito text-lg text-slate-200 mb-2">Great game — try again?</p>}
              {reward && <p className="font-fredoka text-lg text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={() => { playClick(); send({ t: 'c4_again' }); }} className="flex-1 min-h-[48px] px-4 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-emerald-400 to-teal-500 shadow-xl">
                    Play again 🔄
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

export default ConnectFour;
