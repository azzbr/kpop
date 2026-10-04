import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// 1-vs-1 Battleship. Fleets are auto-placed (re-shuffle until you like it),
// then players alternate firing on the opponent's grid. Host owns both fleets,
// validates every shot and sends each player their own masked view.

const N = 7;
const SHIPS = [4, 3, 2, 2];
const randInt = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

function randomFleet(): number[][] {
  const occupied = new Set<number>();
  const ships: number[][] = [];
  for (const size of SHIPS) {
    let placed = false;
    let guard = 0;
    while (!placed && guard < 800) {
      guard++;
      const horiz = Math.random() < 0.5;
      const r = randInt(0, N - 1);
      const c = randInt(0, N - 1);
      const cells: number[] = [];
      for (let k = 0; k < size; k++) {
        const rr = horiz ? r : r + k;
        const cc = horiz ? c + k : c;
        if (rr >= N || cc >= N) {
          cells.length = 0;
          break;
        }
        cells.push(rr * N + cc);
      }
      if (cells.length === size && cells.every((x) => !occupied.has(x))) {
        cells.forEach((x) => occupied.add(x));
        ships.push(cells);
        placed = true;
      }
    }
  }
  return ships;
}

type Phase = 'place' | 'wait' | 'battle' | 'over';

const Battleship: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('place');
  const [fleet, setFleet] = useState<number[][]>(() => randomFleet());
  const [mine, setMine] = useState<number[]>(() => Array(N * N).fill(0));
  const [enemy, setEnemy] = useState<number[]>(() => Array(N * N).fill(0));
  const [turn, setTurn] = useState('');
  const [winner, setWinner] = useState('');
  const [shipsLeft, setShipsLeft] = useState<{ me: number; enemy: number }>({ me: SHIPS.length, enemy: SHIPS.length });
  const xpGiven = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  const hd = useRef({
    p0: '',
    p1: '',
    fleet: {} as Record<string, { cells: number[]; hits: number[] }[]>,
    placed: {} as Record<string, boolean>,
    shots: {} as Record<string, Map<number, boolean>>,
    turn: '',
    winner: '',
    started: false,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.p0 = players[0]?.id || '';
    h.p1 = players[1]?.id || '';
    h.shots = { [h.p0]: new Map(), [h.p1]: new Map() };
    h.placed = {};
    h.fleet = {};
    h.turn = h.p0;
    h.winner = '';
    h.started = false;

    const views = (P: string) => {
      const opp = P === h.p0 ? h.p1 : h.p0;
      const m = Array(N * N).fill(0);
      (h.fleet[P] || []).forEach((s) => s.cells.forEach((cell) => (m[cell] = 1)));
      h.shots[P].forEach((hit, cell) => (m[cell] = hit ? 2 : 3));
      const e = Array(N * N).fill(0);
      h.shots[opp].forEach((hit, cell) => (e[cell] = hit ? 2 : 3));
      (h.fleet[opp] || []).forEach((s) => {
        if (s.hits.length === s.cells.length) s.cells.forEach((cell) => (e[cell] = 4));
      });
      const left = (pid: string) => (h.fleet[pid] || []).filter((s) => s.hits.length < s.cells.length).length;
      return { m, e, meLeft: left(P), enemyLeft: left(opp) };
    };
    const sendViews = () => {
      [h.p0, h.p1].forEach((P) => {
        const v = views(P);
        send({ t: 'bs_state', to: P, mine: v.m, enemy: v.e, turn: h.turn, winner: h.winner, meLeft: v.meLeft, enemyLeft: v.enemyLeft });
      });
    };

    const offMsg = onMessage((raw) => {
      const msg = raw as any;
      if (msg.t === 'bs_place' && msg.from && Array.isArray(msg.ships) && !h.started) {
        h.fleet[msg.from] = (msg.ships as number[][]).map((cells) => ({ cells, hits: [] }));
        h.placed[msg.from] = true;
        if (h.placed[h.p0] && h.placed[h.p1]) {
          h.started = true;
          h.turn = h.p0;
          sendViews();
        }
      } else if (msg.t === 'bs_fire' && h.started && !h.winner && msg.from === h.turn && typeof msg.cell === 'number') {
        const target = msg.from === h.p0 ? h.p1 : h.p0;
        if (h.shots[target].has(msg.cell)) return;
        let hit = false;
        for (const s of h.fleet[target] || []) {
          if (s.cells.includes(msg.cell)) {
            hit = true;
            s.hits.push(msg.cell);
            break;
          }
        }
        h.shots[target].set(msg.cell, hit);
        const allSunk = (h.fleet[target] || []).every((s) => s.hits.length === s.cells.length);
        if (allSunk) h.winner = msg.from;
        else h.turn = target;
        sendViews();
      } else if (msg.t === 'bs_again' && h.winner) {
        h.shots = { [h.p0]: new Map(), [h.p1]: new Map() };
        h.placed = {};
        h.fleet = {};
        h.winner = '';
        h.started = false;
        h.turn = h.p0;
        send({ t: 'bs_reset' });
      }
    });

    return () => offMsg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage((raw) => {
      const msg = raw as any;
      if (msg.t === 'bs_state' && msg.to === myId) {
        setMine(msg.mine);
        setEnemy(msg.enemy);
        setTurn(msg.turn);
        setWinner(msg.winner);
        setShipsLeft({ me: msg.meLeft, enemy: msg.enemyLeft });
        if (msg.winner) {
          setPhase('over');
          if (!xpGiven.current) {
            xpGiven.current = true;
            if (msg.winner === myId) {
              addXP(40);
              playWin();
            } else addXP(15);
          }
        } else {
          setPhase('battle');
        }
      } else if (msg.t === 'bs_reset') {
        xpGiven.current = false;
        setFleet(randomFleet());
        setMine(Array(N * N).fill(0));
        setEnemy(Array(N * N).fill(0));
        setWinner('');
        setPhase('place');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  // Show my fleet on the placement board
  const placementGrid = () => {
    const g = Array(N * N).fill(0);
    fleet.forEach((ship) => ship.forEach((c) => (g[c] = 1)));
    return g;
  };

  const ready = () => {
    playClick();
    send({ t: 'bs_place', ships: fleet });
    setPhase('wait');
  };

  const fire = (cell: number) => {
    if (phase !== 'battle' || turn !== myId || winner) return;
    if (enemy[cell] !== 0) return; // already tried
    playClick();
    send({ t: 'bs_fire', cell });
  };

  const myTurn = phase === 'battle' && turn === myId && !winner;
  const oppId = players.find((p) => p.id !== myId)?.id || '';

  const cellMine = (v: number) =>
    v === 1 ? 'bg-slate-400' : v === 2 ? 'bg-red-500' : v === 3 ? 'bg-sky-700' : 'bg-sky-900';
  const cellEnemy = (v: number) =>
    v === 2 ? 'bg-red-500' : v === 3 ? 'bg-sky-700' : v === 4 ? 'bg-red-900' : 'bg-sky-800 hover:bg-sky-600';
  const enemyMark = (v: number) => (v === 2 ? '💥' : v === 3 ? '·' : v === 4 ? '☠️' : '');
  const mineMark = (v: number) => (v === 2 ? '💥' : v === 3 ? '·' : '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-cyan-950 to-slate-950 text-white px-4 py-6">
      <div className="max-w-md mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🚢 Battleship</h1>

        {/* PLACEMENT */}
        {phase === 'place' && (
          <div>
            <p className="text-center font-nunito text-cyan-200 text-sm mb-3">Here's your fleet — shuffle until you're happy, then lock it in!</p>
            <div className="grid grid-cols-7 gap-1 mb-4 mx-auto" style={{ width: 'fit-content' }}>
              {placementGrid().map((v, i) => (
                <span key={i} className={`w-10 h-10 rounded ${v === 1 ? 'bg-slate-400' : 'bg-sky-900'}`} />
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => { playClick(); setFleet(randomFleet()); }} className="px-5 py-3 rounded-full font-fredoka font-bold bg-white/15 hover:bg-white/25">
                🔀 Shuffle
              </button>
              <button onClick={ready} className="px-6 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl">
                ✓ Ready!
              </button>
            </div>
          </div>
        )}

        {phase === 'wait' && (
          <div className="text-center bg-white/10 rounded-3xl p-8 border border-white/15 mt-6">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-6xl mb-3">⚓</motion.div>
            <div className="font-fredoka text-xl">Fleet ready! Waiting for your rival…</div>
          </div>
        )}

        {/* BATTLE */}
        {(phase === 'battle' || phase === 'over') && (
          <>
            <p className="text-center font-nunito text-sm mb-3">
              {winner ? (
                <span className="text-amber-300 font-bold">Battle over!</span>
              ) : myTurn ? (
                <span className="text-emerald-300 font-bold">🎯 Your turn — fire at the enemy waters!</span>
              ) : (
                <span className="text-white/60">Waiting for {byId(oppId).emoji} {byId(oppId).name} to fire…</span>
              )}
            </p>

            <div className="font-fredoka text-sm text-cyan-200 mb-1">🎯 Enemy waters — ships left: {shipsLeft.enemy}</div>
            <div className="grid grid-cols-7 gap-1 mb-4 mx-auto" style={{ width: 'fit-content' }}>
              {enemy.map((v, i) => (
                <button
                  key={i}
                  onClick={() => fire(i)}
                  disabled={!myTurn || v !== 0}
                  className={`w-10 h-10 rounded flex items-center justify-center text-lg ${cellEnemy(v)} ${myTurn && v === 0 ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {enemyMark(v)}
                </button>
              ))}
            </div>

            <div className="font-fredoka text-sm text-cyan-200 mb-1">🛡️ Your fleet — ships left: {shipsLeft.me}</div>
            <div className="grid grid-cols-7 gap-1 mx-auto" style={{ width: 'fit-content' }}>
              {mine.map((v, i) => (
                <span key={i} className={`w-10 h-10 rounded flex items-center justify-center text-lg ${cellMine(v)}`}>
                  {mineMark(v)}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {phase === 'over' && winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-4">
            {winner === myId && <ConfettiBurst count={90} durationMs={4500} />}
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full">
              <div className="text-7xl mb-3">{winner === myId ? '🏆' : '💥'}</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
                {winner === myId ? 'Victory! 🎉' : `${byId(winner).name} wins!`}
              </h2>
              <p className="font-fredoka text-green-300 mb-5">+{winner === myId ? 40 : 15} XP</p>
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={() => { playClick(); send({ t: 'bs_again' }); }} className="flex-1 px-4 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-emerald-400 to-teal-500 shadow-xl">
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

export default Battleship;
