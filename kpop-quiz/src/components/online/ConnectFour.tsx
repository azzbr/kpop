import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// 1-vs-1 Connect 4. Host owns the board; both players send column drops and the
// host validates turns, applies the move, checks for a win and broadcasts state.

const ROWS = 6;
const COLS = 7;
const DISC_COLOR = ['transparent', '#ef4444', '#f4c20d']; // 0 empty, 1 red, 2 yellow

function applyDrop(board: number[], col: number, disc: number): { board: number[]; ok: boolean } {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r * COLS + col] === 0) {
      const nb = [...board];
      nb[r * COLS + col] = disc;
      return { board: nb, ok: true };
    }
  }
  return { board, ok: false };
}

function findWin(board: number[], disc: number): number[] | null {
  const at = (r: number, c: number) => (r >= 0 && r < ROWS && c >= 0 && c < COLS ? board[r * COLS + c] : -1);
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (at(r, c) !== disc) continue;
      for (const [dr, dc] of dirs) {
        const line = [r * COLS + c];
        let rr = r + dr;
        let cc = c + dc;
        while (at(rr, cc) === disc && line.length < 4) {
          line.push(rr * COLS + cc);
          rr += dr;
          cc += dc;
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

const ConnectFour: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [board, setBoard] = useState<number[]>(() => Array(ROWS * COLS).fill(0));
  const [turn, setTurn] = useState(1);
  const [winner, setWinner] = useState(0); // 0 playing, 1/2 disc, 3 draw
  const [winLine, setWinLine] = useState<number[]>([]);
  const [seats, setSeats] = useState<{ p0: string; p1: string }>({ p0: '', p1: '' });
  const xpGiven = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };
  const myDisc = seats.p0 === myId ? 1 : seats.p1 === myId ? 2 : 0;
  const myTurn = winner === 0 && myDisc !== 0 && turn === myDisc;

  const hd = useRef({
    board: Array(ROWS * COLS).fill(0) as number[],
    turn: 1,
    winner: 0,
    starter: 1,
    p0: '',
    p1: '',
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.p0 = players[0]?.id || '';
    h.p1 = players[1]?.id || '';
    h.board = Array(ROWS * COLS).fill(0);
    h.turn = 1;
    h.winner = 0;
    h.starter = 1;

    const broadcast = (winLineArr: number[] = []) =>
      send({ t: 'c4_state', board: h.board, turn: h.turn, winner: h.winner, winLine: winLineArr, p0: h.p0, p1: h.p1 });

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'c4_drop' && h.winner === 0 && typeof m.col === 'number') {
        const disc = m.from === h.p0 ? 1 : m.from === h.p1 ? 2 : 0;
        if (disc !== h.turn) return;
        const res = applyDrop(h.board, m.col, disc);
        if (!res.ok) return;
        h.board = res.board;
        const line = findWin(h.board, disc);
        if (line) {
          h.winner = disc;
          broadcast(line);
        } else if (h.board.every((x) => x !== 0)) {
          h.winner = 3;
          broadcast();
        } else {
          h.turn = h.turn === 1 ? 2 : 1;
          broadcast();
        }
      } else if (m.t === 'c4_again' && h.winner !== 0) {
        h.board = Array(ROWS * COLS).fill(0);
        h.winner = 0;
        h.starter = h.starter === 1 ? 2 : 1;
        h.turn = h.starter;
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
      if (m.t === 'c4_state') {
        setBoard(m.board);
        setTurn(m.turn);
        setWinner(m.winner);
        setWinLine(m.winLine || []);
        setSeats({ p0: m.p0, p1: m.p1 });
        if (m.winner !== 0 && !xpGiven.current) {
          xpGiven.current = true;
          const mine = m.p0 === myId ? 1 : m.p1 === myId ? 2 : 0;
          if (m.winner === 3) addXP(20);
          else if (m.winner === mine) {
            addXP(40);
            playWin();
          } else {
            addXP(15);
          }
        } else if (m.winner === 0) {
          xpGiven.current = false; // allow a fresh award on rematch
        }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 text-white px-4 py-6">
      <div className="max-w-md mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">♟️ Connect 4</h1>
        <p className="text-center font-nunito text-sm mb-4">
          {winner !== 0 ? (
            <span className="text-amber-300">Game over!</span>
          ) : myTurn ? (
            <span className="text-emerald-300 font-bold">🟢 Your turn — drop a disc!</span>
          ) : (
            <span className="text-white/60">Waiting for {byId(oppId).emoji} {byId(oppId).name}…</span>
          )}
        </p>

        {/* Seat banner */}
        <div className="flex justify-center gap-4 mb-3 font-fredoka text-sm">
          <span className={`flex items-center gap-1 ${turn === 1 && winner === 0 ? 'opacity-100' : 'opacity-50'}`}>
            <span className="w-4 h-4 rounded-full inline-block" style={{ background: DISC_COLOR[1] }} />
            {byId(seats.p0).name}{seats.p0 === myId ? ' (you)' : ''}
          </span>
          <span className={`flex items-center gap-1 ${turn === 2 && winner === 0 ? 'opacity-100' : 'opacity-50'}`}>
            <span className="w-4 h-4 rounded-full inline-block" style={{ background: DISC_COLOR[2] }} />
            {byId(seats.p1).name}{seats.p1 === myId ? ' (you)' : ''}
          </span>
        </div>

        {/* Board */}
        <div className="bg-blue-800/60 rounded-3xl p-2 md:p-3 shadow-2xl">
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {Array.from({ length: COLS }).map((_, c) => (
              <button
                key={c}
                onClick={() => dropCol(c)}
                disabled={!myTurn || board[c] !== 0}
                className={`flex flex-col gap-1 md:gap-2 rounded-xl p-0.5 ${myTurn && board[c] === 0 ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default'}`}
              >
                {Array.from({ length: ROWS }).map((_, r) => {
                  const idx = r * COLS + c;
                  const v = board[idx];
                  const win = winLine.includes(idx);
                  return (
                    <span
                      key={r}
                      className={`aspect-square rounded-full border-2 ${win ? 'border-emerald-300 ring-2 ring-emerald-300' : 'border-blue-900/40'}`}
                      style={{ background: v === 0 ? 'rgba(255,255,255,0.12)' : DISC_COLOR[v] }}
                    />
                  );
                })}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center font-nunito text-white/40 text-xs mt-3">Line up four in a row — across, down or diagonally!</p>
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
                  <button onClick={() => { playClick(); send({ t: 'c4_again' }); }} className="flex-1 px-4 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-emerald-400 to-teal-500 shadow-xl">
                    Play again 🔄
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

export default ConnectFour;
