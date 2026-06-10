import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { pickQuestions } from '../../online/schoolQuestions';
import type { PreparedQ } from '../../online/schoolQuestions';
import { playClick, playCorrect, playWrong, playWin, playCoin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

type TileKind = 'start' | 'plain' | 'boost' | 'trap' | 'coin' | 'quiz' | 'finish';

const BOARD: { kind: TileKind; label: string; emoji: string }[] = [
  { kind: 'start', label: 'Seoul', emoji: '🛫' },
  { kind: 'plain', label: 'Busan', emoji: '🌊' },
  { kind: 'coin', label: 'Tokyo', emoji: '💰' },
  { kind: 'plain', label: 'Osaka', emoji: '🏯' },
  { kind: 'quiz', label: 'Taipei', emoji: '❓' },
  { kind: 'boost', label: 'Manila', emoji: '🚀' },
  { kind: 'plain', label: 'Bangkok', emoji: '🛕' },
  { kind: 'trap', label: 'Jakarta', emoji: '🕳️' },
  { kind: 'plain', label: 'Sydney', emoji: '🦘' },
  { kind: 'coin', label: 'Mumbai', emoji: '💰' },
  { kind: 'quiz', label: 'Dubai', emoji: '❓' },
  { kind: 'plain', label: 'Cairo', emoji: '🐪' },
  { kind: 'boost', label: 'Athens', emoji: '🚀' },
  { kind: 'plain', label: 'Rome', emoji: '🏛️' },
  { kind: 'trap', label: 'Berlin', emoji: '🕳️' },
  { kind: 'coin', label: 'Prague', emoji: '💰' },
  { kind: 'plain', label: 'Vienna', emoji: '🎻' },
  { kind: 'quiz', label: 'Zurich', emoji: '❓' },
  { kind: 'plain', label: 'Madrid', emoji: '💃' },
  { kind: 'boost', label: 'Lisbon', emoji: '🚀' },
  { kind: 'plain', label: 'Paris', emoji: '🗼' },
  { kind: 'trap', label: 'Brussels', emoji: '🕳️' },
  { kind: 'coin', label: 'Amsterdam', emoji: '💰' },
  { kind: 'plain', label: 'Oslo', emoji: '⛷️' },
  { kind: 'quiz', label: 'Stockholm', emoji: '❓' },
  { kind: 'plain', label: 'Helsinki', emoji: '🌌' },
  { kind: 'boost', label: 'Dublin', emoji: '🚀' },
  { kind: 'trap', label: 'Cardiff', emoji: '🕳️' },
  { kind: 'plain', label: 'Manchester', emoji: '⚽' },
  { kind: 'finish', label: 'London 🎤', emoji: '🏟️' },
];
const FINISH = BOARD.length - 1;

const TILE_TINT: Record<TileKind, string> = {
  start: 'bg-sky-500/30 border-sky-300/50',
  plain: 'bg-white/10 border-white/15',
  boost: 'bg-emerald-500/30 border-emerald-300/50',
  trap: 'bg-red-500/30 border-red-300/50',
  coin: 'bg-amber-500/30 border-amber-300/50',
  quiz: 'bg-violet-500/30 border-violet-300/50',
  finish: 'bg-amber-400/40 border-amber-300',
};

const WorldTourRace: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [order, setOrder] = useState<string[]>([]);
  const [posMap, setPosMap] = useState<Record<string, number>>({});
  const [coinsMap, setCoinsMap] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [canRoll, setCanRoll] = useState(false);
  const [dice, setDice] = useState<{ value: number; rolling: boolean }>({ value: 6, rolling: false });
  const [feed, setFeed] = useState('✈️ Welcome to the K-Pop World Tour!');
  const [miniQ, setMiniQ] = useState<{ forId: string; text: string; options: string[]; endsAt: number } | null>(null);
  const [miniChoice, setMiniChoice] = useState<number | null>(null);
  const [miniLeft, setMiniLeft] = useState(12);
  const [winner, setWinner] = useState<string | null>(null);
  const xpGiven = useRef(false);

  // Host-side authoritative state
  const hd = useRef({
    order: [] as string[],
    turn: 0,
    pos: {} as Record<string, number>,
    coins: {} as Record<string, number>,
    busy: false,
    miniFor: null as string | null,
    miniCorrect: -1,
    qs: [] as PreparedQ[],
    qi: 0,
    finished: false,
    timer: 0,
    autoTimer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  // ---- HOST: game master ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.order = players.slice(0, 4).map((p) => p.id);
    h.order.forEach((id) => {
      h.pos[id] = 0;
      h.coins[id] = 0;
    });
    h.qs = pickQuestions('mix', 20);

    const sendTurn = () => {
      if (h.finished) return;
      h.busy = false;
      const pid = h.order[h.turn];
      send({ t: 'turn', playerId: pid, pos: { ...h.pos }, coins: { ...h.coins } });
      h.autoTimer = window.setTimeout(() => doRoll(pid, true), 25000);
    };

    const finish = (pid: string) => {
      h.finished = true;
      h.timer = window.setTimeout(
        () => send({ t: 'final', winnerId: pid, pos: { ...h.pos }, coins: { ...h.coins } }),
        2000
      );
    };

    const nextTurn = () => {
      h.turn = (h.turn + 1) % h.order.length;
      h.timer = window.setTimeout(sendTurn, 600);
    };

    const resolveMini = (pid: string, ok: boolean) => {
      if (h.miniFor !== pid) return;
      h.miniFor = null;
      window.clearTimeout(h.timer);
      if (ok) h.pos[pid] = Math.min(h.pos[pid] + 2, FINISH);
      send({ t: 'mini_res', playerId: pid, ok, pos: { ...h.pos }, coins: { ...h.coins } });
      if (h.pos[pid] === FINISH) finish(pid);
      else h.timer = window.setTimeout(nextTurn, 2000);
    };

    const doRoll = (pid: string, auto: boolean) => {
      if (h.busy || h.finished || h.order[h.turn] !== pid) return;
      h.busy = true;
      window.clearTimeout(h.autoTimer);
      const d = 1 + Math.floor(Math.random() * 6);
      const from = h.pos[pid];
      const to = Math.min(from + d, FINISH);
      const kind = BOARD[to].kind;
      let final = to;
      if (kind === 'boost') final = Math.min(to + 3, FINISH);
      if (kind === 'trap') final = Math.max(to - 3, 0);
      if (kind === 'coin') h.coins[pid] += 40;
      h.pos[pid] = final;
      send({ t: 'rolled', playerId: pid, dice: d, to, final, kind, auto, pos: { ...h.pos }, coins: { ...h.coins } });

      if (final === FINISH) {
        finish(pid);
        return;
      }
      if (kind === 'quiz') {
        h.timer = window.setTimeout(() => {
          const q = h.qs[h.qi % h.qs.length];
          h.qi += 1;
          h.miniFor = pid;
          h.miniCorrect = q.correct;
          send({ t: 'mini_q', playerId: pid, text: q.text, options: q.options, endsAt: Date.now() + 12000 });
          h.timer = window.setTimeout(() => resolveMini(pid, false), 12400);
        }, 1800);
      } else {
        h.timer = window.setTimeout(nextTurn, 2200);
      }
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'roll_req') doRoll(m.from, false);
      if (m.t === 'mini_ans' && m.from === h.miniFor) resolveMini(m.from, m.choice === h.miniCorrect);
    });

    const t0 = window.setTimeout(() => {
      send({ t: 'setup', order: h.order, pos: { ...h.pos }, coins: { ...h.coins } });
      h.timer = window.setTimeout(sendTurn, 1600);
    }, 900);

    return () => {
      offMsg();
      window.clearTimeout(t0);
      window.clearTimeout(h.timer);
      window.clearTimeout(h.autoTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE: render-state updates ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      switch (m.t) {
        case 'setup':
          setOrder(m.order);
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          break;
        case 'turn':
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setCurrent(m.playerId);
          setCanRoll(m.playerId === myId);
          setFeed(`🎲 ${byId(m.playerId).emoji} ${byId(m.playerId).name}'s turn!`);
          break;
        case 'rolled': {
          setCanRoll(false);
          setDice({ value: m.dice, rolling: true });
          window.setTimeout(() => setDice({ value: m.dice, rolling: false }), 700);
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          const nm = byId(m.playerId).name;
          const tile = BOARD[m.final];
          const label =
            m.kind === 'boost' ? `🚀 BOOST! Zoomed ahead to ${tile.label}!`
            : m.kind === 'trap' ? `🕳️ Trap! Sent back to ${tile.label}!`
            : m.kind === 'coin' ? `💰 +40 coins at ${BOARD[m.to].label}!`
            : m.kind === 'quiz' ? `❓ Pop quiz at ${BOARD[m.to].label}!`
            : m.kind === 'finish' ? `🏟️ Reached the Final Concert!`
            : `→ ${tile.label}`;
          setFeed(`${m.auto ? '⏰ (auto-roll) ' : ''}${nm} rolled ${m.dice} ${label}`);
          if (m.kind === 'coin') playCoin();
          else playPop();
          break;
        }
        case 'mini_q':
          setMiniQ({ forId: m.playerId, text: m.text, options: m.options, endsAt: m.endsAt });
          setMiniChoice(null);
          break;
        case 'mini_res': {
          setMiniQ(null);
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          const nm2 = byId(m.playerId).name;
          setFeed(m.ok ? `✅ ${nm2} got it right — +2 tiles!` : `❌ ${nm2} missed it — stays put!`);
          if (m.playerId === myId) (m.ok ? playCorrect : playWrong)();
          break;
        }
        case 'final':
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setWinner(m.winnerId);
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(m.winnerId === myId ? 50 : 15);
          }
          if (m.winnerId === myId) playWin();
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // Mini-quiz countdown
  useEffect(() => {
    if (!miniQ) return;
    const iv = window.setInterval(() => {
      setMiniLeft(Math.max(0, Math.ceil((miniQ.endsAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [miniQ]);

  const rollDice = () => {
    if (!canRoll) return;
    playClick();
    setCanRoll(false);
    send({ t: 'roll_req' });
  };

  const answerMini = (i: number) => {
    if (!miniQ || miniQ.forId !== myId || miniChoice !== null) return;
    playClick();
    setMiniChoice(i);
    send({ t: 'mini_ans', choice: i });
  };

  // Board rows (serpentine path, 6 per row)
  const rows: number[][] = [];
  for (let r = 0; r < BOARD.length / 6; r++) {
    const row = Array.from({ length: 6 }, (_, i) => r * 6 + i);
    rows.push(r % 2 === 1 ? row.reverse() : row);
  }

  const racers = order.length ? order : players.slice(0, 4).map((p) => p.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-950 via-indigo-950 to-purple-950 text-white px-3 py-6">
      <div className="max-w-3xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">✈️ K-Pop World Tour</h1>
        <p className="text-center font-nunito text-sky-200 text-sm mb-4">Race from Seoul to the Final Concert in London!</p>

        {/* Racers strip */}
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {racers.map((id) => {
            const p = byId(id);
            const isCur = current === id;
            return (
              <div
                key={id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-nunito text-sm border-2 ${
                  isCur ? 'border-amber-400 bg-amber-400/20 shadow-lg' : 'border-white/10 bg-white/5'
                }`}
              >
                <span className="text-lg">{p.emoji}</span>
                <span className={`font-bold ${id === myId ? 'text-amber-300' : ''}`}>{p.name}</span>
                <span className="text-amber-200">💰{coinsMap[id] || 0}</span>
              </div>
            );
          })}
        </div>

        {/* Event feed */}
        <div className="text-center font-fredoka text-amber-300 mb-4 min-h-[1.75rem]">{feed}</div>

        {/* Board */}
        <div className="space-y-1.5 mb-5">
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-6 gap-1.5">
              {row.map((ti) => {
                const tile = BOARD[ti];
                const here = racers.filter((id) => (posMap[id] ?? 0) === ti);
                const curHere = current && here.includes(current);
                return (
                  <div
                    key={ti}
                    className={`relative aspect-square rounded-xl border-2 p-1 flex flex-col items-center justify-center ${TILE_TINT[tile.kind]} ${
                      curHere ? 'ring-2 ring-amber-300' : ''
                    }`}
                  >
                    <div className="text-base md:text-xl leading-none">{tile.emoji}</div>
                    <div className="text-[8px] md:text-[10px] font-nunito text-white/80 text-center leading-tight mt-0.5">
                      {tile.label}
                    </div>
                    {here.length > 0 && (
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex">
                        {here.map((id) => (
                          <motion.span
                            key={id}
                            layoutId={`token-${id}`}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            className="text-sm md:text-lg -ml-1 first:ml-0 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                          >
                            {byId(id).emoji}
                          </motion.span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Dice + roll */}
        <div className="flex items-center justify-center gap-5">
          <motion.div
            animate={dice.rolling ? { rotate: [0, 360, 720], scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.7 }}
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white text-gray-900 flex items-center justify-center font-fredoka font-bold text-3xl md:text-4xl shadow-xl"
          >
            {dice.rolling ? '🎲' : dice.value}
          </motion.div>
          {winner === null && (
            <motion.button
              whileHover={{ scale: canRoll ? 1.06 : 1 }}
              whileTap={{ scale: canRoll ? 0.94 : 1 }}
              onClick={rollDice}
              disabled={!canRoll}
              className={`px-8 py-4 rounded-full font-fredoka font-bold text-xl shadow-xl ${
                canRoll ? 'bg-gradient-to-r from-amber-400 to-pink-500 animate-pulse' : 'bg-gray-600/50 text-gray-300 cursor-not-allowed'
              }`}
            >
              {canRoll ? '🎲 ROLL!' : current === myId ? '…' : `${byId(current || '').name} is playing…`}
            </motion.button>
          )}
        </div>
      </div>

      {/* Mini pop-quiz overlay */}
      <AnimatePresence>
        {miniQ && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4">
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gradient-to-br from-violet-800 to-purple-900 border-4 border-violet-400 rounded-3xl p-6 max-w-md w-full"
            >
              <div className="text-center font-fredoka text-violet-200 mb-1">
                ❓ Pop Quiz for {byId(miniQ.forId).emoji} {byId(miniQ.forId).name} · {miniLeft}s
              </div>
              <div className="font-fredoka font-bold text-xl text-center mb-4">{miniQ.text}</div>
              {miniQ.forId === myId ? (
                <div className="grid gap-2">
                  {miniQ.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => answerMini(i)}
                      disabled={miniChoice !== null}
                      className={`rounded-2xl border-2 p-3 font-nunito font-bold text-left ${
                        miniChoice === i ? 'bg-amber-400/40 border-amber-300' : 'bg-white/10 border-white/20 hover:bg-white/20'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <div className="text-center font-nunito text-violet-200 text-sm">Answer right → jump 2 tiles ahead! 🚀</div>
                </div>
              ) : (
                <div className="text-center font-nunito text-violet-200">
                  🤫 No helping! Waiting for their answer…
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div
              initial={{ scale: 0.6, rotate: -4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="bg-gradient-to-br from-indigo-800 to-purple-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="text-7xl mb-3"
              >
                🏟️
              </motion.div>
              <h2 className="font-fredoka font-bold text-2xl md:text-3xl text-amber-300 mb-2">
                {byId(winner).emoji} {byId(winner).name} headlines the Final Concert!
              </h2>
              <p className="font-nunito text-purple-200 mb-2">
                💰 Coins: {racers.map((id) => `${byId(id).emoji} ${coinsMap[id] || 0}`).join(' · ')}
              </p>
              <p className="font-fredoka text-green-300 mb-6">+{winner === myId ? 50 : 15} XP</p>
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-purple-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorldTourRace;
