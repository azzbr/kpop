import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi } from '../../online/useRoom';
import { finishArenaGame } from '../../online/arenaRewards';
import { useHelloSync } from '../../online/boardSync';
import { BS_N as N, BS_SHIPS as SHIPS, randomFleet, validFleet, fireAt, playerView } from '../../online/battleshipLogic';
import type { Ship } from '../../online/battleshipLogic';
import { playClick, playWin, playPop, playCorrect } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// 1-vs-1 Battleship. Fleets are auto-placed (re-shuffle until you like it),
// then players alternate firing on the opponent's grid. Host owns both fleets,
// validates every shot and sends each player their own masked view (an enemy
// ship only shows once it's sunk).

type Phase = 'place' | 'wait' | 'battle' | 'over';

// Messages exchanged over the room channel (all start with 'bs_')
type BsMsg = { from?: string } & (
  | { t: 'bs_place'; ships: number[][] }
  | { t: 'bs_fire'; cell: number }
  | { t: 'bs_again' }
  | { t: 'bs_setup'; p0: string; p1: string; round: number; placed: string[] }
  | {
      t: 'bs_state'; to: string; round: number; mine: number[]; enemy: number[]; turn: string; winner: string;
      meLeft: number; enemyLeft: number; ranked: string[] | null; last: { by: string; cell: number; hit: boolean; sunk: boolean } | null;
    }
);

const Battleship: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;

  const [phase, setPhase] = useState<Phase>('place');
  const [fleet, setFleet] = useState<number[][]>(() => randomFleet());
  const [mine, setMine] = useState<number[]>(() => Array(N * N).fill(0));
  const [enemy, setEnemy] = useState<number[]>(() => Array(N * N).fill(0));
  const [turn, setTurn] = useState('');
  const [winner, setWinner] = useState('');
  const [seats, setSeats] = useState<{ p0: string; p1: string }>({ p0: '', p1: '' });
  const [shipsLeft, setShipsLeft] = useState<{ me: number; enemy: number }>({ me: SHIPS.length, enemy: SHIPS.length });
  const [lastShot, setLastShot] = useState<string>('');
  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);
  const roundRef = useRef(0);
  const rewardedRound = useRef(-1);
  const synced = useRef(false);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  const hostApi = useRef<{ start: () => void; hello: (from: string) => void } | null>(null);
  useHelloSync(room, 'bs', {
    onStart: () => hostApi.current?.start(),
    onHello: (from) => hostApi.current?.hello(from),
    synced: () => synced.current,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = {
      p0: players[0]?.id || '',
      p1: players[1]?.id || '',
      fleet: {} as Record<string, Ship[]>,
      shots: {} as Record<string, Map<number, boolean>>, // shots fired AT this player
      turn: '',
      winner: '',
      started: false,
      round: 0,
      last: null as { by: string; cell: number; hit: boolean; sunk: boolean } | null,
    };
    const reset = () => {
      h.shots = { [h.p0]: new Map(), [h.p1]: new Map() };
      h.fleet = {};
      h.turn = h.p0;
      h.winner = '';
      h.started = false;
      h.last = null;
    };
    reset();
    const other = (P: string) => (P === h.p0 ? h.p1 : h.p0);

    const sendView = (P: string) => {
      const opp = other(P);
      const v = playerView(h.fleet[P] || [], h.shots[P], h.fleet[opp] || [], h.shots[opp]);
      send({
        t: 'bs_state', to: P, round: h.round, mine: v.mine, enemy: v.enemy, turn: h.turn, winner: h.winner,
        meLeft: v.meLeft, enemyLeft: v.enemyLeft, ranked: h.winner ? [h.winner, other(h.winner)] : null, last: h.last,
      });
    };
    const sendViews = () => [h.p0, h.p1].forEach(sendView);
    const sendSetup = () => send({ t: 'bs_setup', p0: h.p0, p1: h.p1, round: h.round, placed: Object.keys(h.fleet) });

    hostApi.current = {
      start: sendSetup,
      hello: (from) => {
        if (h.started && (from === h.p0 || from === h.p1)) sendView(from);
        else sendSetup();
      },
    };

    const offMsg = onMessage((raw) => {
      const msg = raw as unknown as BsMsg;
      if (msg.t === 'bs_place' && msg.from && (msg.from === h.p0 || msg.from === h.p1) && !h.started && validFleet(msg.ships)) {
        h.fleet[msg.from] = msg.ships.map((cells) => ({ cells: [...cells], hits: [] }));
        if (h.fleet[h.p0] && h.fleet[h.p1]) {
          h.started = true;
          h.turn = h.round % 2 === 0 ? h.p0 : h.p1;
          sendViews();
        }
      } else if (msg.t === 'bs_fire' && h.started && !h.winner && msg.from === h.turn && typeof msg.cell === 'number') {
        const target = other(msg.from);
        const res = fireAt(h.fleet[target] || [], h.shots[target], msg.cell);
        if (!res) return;
        h.last = { by: msg.from, cell: msg.cell, hit: res.hit, sunk: res.sunk };
        if (res.allSunk) h.winner = msg.from;
        else h.turn = target; // classic rules: always take turns
        sendViews();
      } else if (msg.t === 'bs_again' && msg.from === myId && h.winner) {
        h.round += 1;
        reset();
        sendSetup();
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
      const msg = raw as unknown as BsMsg;
      if (msg.t === 'bs_setup') {
        synced.current = true;
        setSeats({ p0: msg.p0, p1: msg.p1 });
        if (msg.round !== roundRef.current) {
          // Rematch: fresh fleet, back to placing
          roundRef.current = msg.round;
          setFleet(randomFleet());
          setMine(Array(N * N).fill(0));
          setEnemy(Array(N * N).fill(0));
          setWinner('');
          setLastShot('');
          setReward(null);
          setShipsLeft({ me: SHIPS.length, enemy: SHIPS.length });
          setPhase(msg.placed.includes(myId) ? 'wait' : 'place');
        }
      } else if (msg.t === 'bs_state' && msg.to === myId) {
        synced.current = true;
        roundRef.current = msg.round;
        setMine(msg.mine);
        setEnemy(msg.enemy);
        setTurn(msg.turn);
        setWinner(msg.winner);
        setShipsLeft({ me: msg.meLeft, enemy: msg.enemyLeft });
        if (msg.last) {
          const mineShot = msg.last.by === myId;
          setLastShot(
            msg.last.sunk ? (mineShot ? '🎉 You sank a whole ship!' : '⚓ They sank one of your ships!')
            : msg.last.hit ? (mineShot ? '💥 Hit!' : '💥 They hit your ship!')
            : (mineShot ? '🌊 Splash — a miss.' : '🌊 They missed!')
          );
          if (mineShot) (msg.last.hit ? playCorrect : playPop)();
        }
        if (msg.winner) {
          setPhase('over');
          if (msg.ranked && rewardedRound.current !== msg.round) {
            rewardedRound.current = msg.round;
            const r = finishArenaGame(room, msg.ranked);
            setReward({ xp: r.xp, coins: r.coins });
            if (msg.winner === myId) playWin();
          }
        } else {
          setPhase('battle');
        }
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

  const inGame = !seats.p0 || seats.p0 === myId || seats.p1 === myId;

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
  const oppId = seats.p0 === myId ? seats.p1 : seats.p0;

  const cellMine = (v: number) =>
    v === 1 ? 'bg-slate-400' : v === 2 ? 'bg-red-500' : v === 3 ? 'bg-sky-700' : 'bg-sky-900';
  const cellEnemy = (v: number) =>
    v === 2 ? 'bg-red-500' : v === 3 ? 'bg-sky-700' : v === 4 ? 'bg-red-900' : 'bg-sky-800 active:bg-sky-600';
  const enemyMark = (v: number) => (v === 2 ? '💥' : v === 3 ? '·' : v === 4 ? '❌' : '');
  const mineMark = (v: number) => (v === 2 ? '💥' : v === 3 ? '·' : '');

  // A board fills its column but never gets taller than the screen allows; on an iPad each
  // cell is 48px or more.
  const boardStyle = { width: 'min(100%, 30rem, calc(100dvh - 300px))', minWidth: 'min(100%, 22rem)' };
  const gridCls = 'grid grid-cols-7 gap-1 mx-auto game-surface';
  const cellCls = 'aspect-square rounded-md flex items-center justify-center text-xl md:text-2xl';

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-blue-950 via-cyan-950 to-slate-950 text-white px-4 py-6">
      <div className="max-w-5xl mx-auto pt-8">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-2">🚢 Battleship</h1>

        {!inGame && (
          <p className="text-center font-nunito text-lg text-cyan-200 mb-3">👀 {byId(seats.p0).name} vs {byId(seats.p1).name} — you're watching this one!</p>
        )}

        {/* PLACEMENT */}
        {phase === 'place' && inGame && (
          <div>
            <p className="text-center font-nunito text-cyan-200 text-lg mb-3">Here's your fleet — shuffle until you're happy, then lock it in!</p>
            <div className={`${gridCls} mb-4`} style={boardStyle}>
              {placementGrid().map((v, i) => (
                <span key={i} className={`${cellCls} ${v === 1 ? 'bg-slate-400' : 'bg-sky-900'}`} />
              ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { playClick(); setFleet(randomFleet()); }} className="min-h-[48px] px-6 py-3 rounded-full font-fredoka font-bold text-lg bg-white/15 active:bg-white/25">
                🔀 Shuffle
              </button>
              <button onClick={ready} className="min-h-[48px] px-7 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl">
                ✓ Ready!
              </button>
            </div>
          </div>
        )}

        {phase === 'wait' && (
          <div className="text-center bg-white/10 rounded-3xl p-8 border border-white/15 mt-6 max-w-md mx-auto">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-6xl mb-3">⚓</motion.div>
            <div className="font-fredoka text-xl">Fleet ready! Waiting for your rival…</div>
          </div>
        )}

        {/* BATTLE */}
        {(phase === 'battle' || phase === 'over') && (
          <>
            <p className="text-center font-nunito text-lg mb-1">
              {winner ? (
                <span className="text-amber-300 font-bold">Battle over!</span>
              ) : myTurn ? (
                <span className="text-emerald-300 font-bold">🎯 Your turn — tap the enemy waters to fire!</span>
              ) : (
                <span className="text-white/70">Waiting for {byId(oppId).emoji} {byId(oppId).name} to fire…</span>
              )}
            </p>
            <p className="text-center font-fredoka text-lg text-amber-200 mb-3 min-h-[1.75rem]">{lastShot}</p>

            <div className="grid md:grid-cols-2 gap-5 md:gap-6 items-start">
              <div>
                <div className="font-fredoka text-lg text-cyan-200 mb-1 text-center">🎯 Enemy waters — ships left: {shipsLeft.enemy}</div>
                <div className={gridCls} style={boardStyle}>
                  {enemy.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => fire(i)}
                      disabled={!myTurn || v !== 0}
                      aria-label={`Fire at row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}`}
                      className={`${cellCls} ${cellEnemy(v)} ${myTurn && v === 0 ? 'cursor-pointer ring-1 ring-cyan-300/40' : 'cursor-default'}`}
                    >
                      {enemyMark(v)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-fredoka text-lg text-cyan-200 mb-1 text-center">🛡️ Your fleet — ships left: {shipsLeft.me}</div>
                <div className={gridCls} style={boardStyle}>
                  {mine.map((v, i) => (
                    <span key={i} className={`${cellCls} ${cellMine(v)}`}>
                      {mineMark(v)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {phase === 'over' && winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-4">
            {winner === myId && <ConfettiBurst count={90} durationMs={4500} />}
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full">
              <div className="text-7xl mb-3">{winner === myId ? '🏆' : '⚓'}</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
                {winner === myId ? 'Victory! 🎉' : `${byId(winner).name} wins!`}
              </h2>
              {winner !== myId && <p className="font-nunito text-lg text-slate-200 mb-2">Brave sailing, captain — rematch?</p>}
              {reward && <p className="font-fredoka text-lg text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <div className="flex gap-2">
                  <button onClick={() => { playClick(); send({ t: 'bs_again' }); }} className="flex-1 min-h-[48px] px-4 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-emerald-400 to-teal-500 shadow-xl">
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

export default Battleship;
