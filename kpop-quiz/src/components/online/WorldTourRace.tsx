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

const START_COINS = 150;
const PRICE = 40;
const RENT = 25;
const HOME_BONUS = 10;

const TILE_TINT: Record<TileKind, string> = {
  start: 'bg-sky-500/30 border-sky-300/50',
  plain: 'bg-white/10 border-white/15',
  boost: 'bg-emerald-500/30 border-emerald-300/50',
  trap: 'bg-red-500/30 border-red-300/50',
  coin: 'bg-amber-500/30 border-amber-300/50',
  quiz: 'bg-violet-500/30 border-violet-300/50',
  finish: 'bg-amber-400/40 border-amber-300',
};

const OWNER_BG = ['bg-pink-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500'];

const WorldTourRace: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [order, setOrder] = useState<string[]>([]);
  const [posMap, setPosMap] = useState<Record<string, number>>({});
  const [coinsMap, setCoinsMap] = useState<Record<string, number>>({});
  const [owners, setOwners] = useState<Record<number, string>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const [canRoll, setCanRoll] = useState(false);
  const [dice, setDice] = useState<{ value: number; rolling: boolean }>({ value: 6, rolling: false });
  const [feed, setFeed] = useState<string[]>(['✈️ Welcome to World Tour Tycoon!']);
  const [offer, setOffer] = useState<{ tile: number; price: number; endsAt: number } | null>(null);
  const [offerLeft, setOfferLeft] = useState(10);
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
    owners: {} as Record<number, string>,
    offerFor: null as string | null,
    offerTile: -1,
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

  const pushFeed = (line: string) => setFeed((f) => [line, ...f].slice(0, 3));

  // ---- HOST: game master ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.order = players.slice(0, 4).map((p) => p.id);
    h.order.forEach((id) => {
      h.pos[id] = 0;
      h.coins[id] = START_COINS;
    });
    h.qs = pickQuestions('mix', 20);

    const sendTurn = () => {
      if (h.finished) return;
      h.busy = false;
      const pid = h.order[h.turn];
      send({ t: 'turn', playerId: pid, pos: { ...h.pos }, coins: { ...h.coins }, owners: { ...h.owners } });
      h.autoTimer = window.setTimeout(() => doRoll(pid, true), 25000);
    };

    const finish = (pid: string) => {
      h.finished = true;
      h.timer = window.setTimeout(
        () => send({ t: 'final', winnerId: pid, pos: { ...h.pos }, coins: { ...h.coins }, owners: { ...h.owners } }),
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

    const resolveOffer = (pid: string, wantsBuy: boolean) => {
      if (h.offerFor !== pid) return;
      h.offerFor = null;
      window.clearTimeout(h.timer);
      const bought = wantsBuy && h.coins[pid] >= PRICE;
      if (bought) {
        h.coins[pid] -= PRICE;
        h.owners[h.offerTile] = pid;
        send({ t: 'bought', playerId: pid, tile: h.offerTile, owners: { ...h.owners }, coins: { ...h.coins } });
      } else {
        send({ t: 'skip_buy', playerId: pid, tile: h.offerTile });
      }
      h.timer = window.setTimeout(nextTurn, bought ? 1600 : 800);
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

      // Settle ownership effects on the tile actually landed on
      const landKind = BOARD[final].kind;
      let rent: { to: string; amount: number } | null = null;
      let home = 0;
      let canBuy = false;
      if (landKind === 'plain') {
        const owner = h.owners[final];
        if (owner && owner !== pid) {
          const amt = Math.min(RENT, h.coins[pid]);
          h.coins[pid] -= amt;
          h.coins[owner] = (h.coins[owner] || 0) + amt;
          rent = { to: owner, amount: amt };
        } else if (owner === pid) {
          home = HOME_BONUS;
          h.coins[pid] += HOME_BONUS;
        } else if (h.coins[pid] >= PRICE) {
          canBuy = true;
        }
      }

      send({
        t: 'rolled', playerId: pid, dice: d, to, final, kind, auto, rent, home,
        pos: { ...h.pos }, coins: { ...h.coins }, owners: { ...h.owners },
      });

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
        return;
      }
      if (canBuy) {
        h.timer = window.setTimeout(() => {
          h.offerFor = pid;
          h.offerTile = final;
          send({ t: 'offer', playerId: pid, tile: final, price: PRICE, endsAt: Date.now() + 10000 });
          h.timer = window.setTimeout(() => resolveOffer(pid, false), 10400);
        }, 1600);
        return;
      }
      h.timer = window.setTimeout(nextTurn, 2200);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'roll_req') doRoll(m.from, false);
      if (m.t === 'mini_ans' && m.from === h.miniFor) resolveMini(m.from, m.choice === h.miniCorrect);
      if (m.t === 'buy_res') resolveOffer(m.from, !!m.buy);
    });

    const t0 = window.setTimeout(() => {
      send({ t: 'setup', order: h.order, pos: { ...h.pos }, coins: { ...h.coins }, owners: { ...h.owners } });
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
          setOwners(m.owners);
          break;
        case 'turn':
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setOwners(m.owners);
          setCurrent(m.playerId);
          setCanRoll(m.playerId === myId);
          pushFeed(`🎲 ${byId(m.playerId).emoji} ${byId(m.playerId).name}'s turn!`);
          break;
        case 'rolled': {
          setCanRoll(false);
          setDice({ value: m.dice, rolling: true });
          window.setTimeout(() => setDice({ value: m.dice, rolling: false }), 700);
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setOwners(m.owners);
          const nm = byId(m.playerId).name;
          const tile = BOARD[m.final];
          const label =
            m.kind === 'boost' ? `🚀 BOOST → ${tile.label}!`
            : m.kind === 'trap' ? `🕳️ Trap! Back to ${tile.label}!`
            : m.kind === 'coin' ? `💰 +40 coins at ${BOARD[m.to].label}!`
            : m.kind === 'quiz' ? `❓ Pop quiz at ${BOARD[m.to].label}!`
            : m.kind === 'finish' ? '🏟️ Reached the Final Concert!'
            : `→ ${tile.label}`;
          pushFeed(`${m.auto ? '⏰ ' : ''}${nm} rolled ${m.dice} ${label}`);
          if (m.rent) pushFeed(`💸 ${nm} paid ${m.rent.amount} rent to ${byId(m.rent.to).name}!`);
          if (m.home) pushFeed(`🏠 ${nm}'s own venue — +${m.home} coins!`);
          if (m.kind === 'coin') playCoin();
          else playPop();
          break;
        }
        case 'offer':
          if (m.playerId === myId) {
            setOffer({ tile: m.tile, price: m.price, endsAt: m.endsAt });
          } else {
            pushFeed(`🤔 ${byId(m.playerId).name} is deciding to buy ${BOARD[m.tile].label}…`);
          }
          break;
        case 'bought':
          setOwners(m.owners);
          setCoinsMap(m.coins);
          setOffer(null);
          pushFeed(`🏟️ ${byId(m.playerId).emoji} ${byId(m.playerId).name} bought ${BOARD[m.tile].label}!`);
          playCoin();
          break;
        case 'skip_buy':
          setOffer(null);
          pushFeed(`💨 ${byId(m.playerId).name} skipped ${BOARD[m.tile].label}`);
          break;
        case 'mini_q':
          setMiniQ({ forId: m.playerId, text: m.text, options: m.options, endsAt: m.endsAt });
          setMiniChoice(null);
          break;
        case 'mini_res': {
          setMiniQ(null);
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          const nm2 = byId(m.playerId).name;
          pushFeed(m.ok ? `✅ ${nm2} got it right — +2 tiles!` : `❌ ${nm2} missed it — stays put!`);
          if (m.playerId === myId) (m.ok ? playCorrect : playWrong)();
          break;
        }
        case 'final':
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setOwners(m.owners);
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

  // Mini-quiz + offer countdowns
  useEffect(() => {
    if (!miniQ) return;
    const iv = window.setInterval(() => {
      setMiniLeft(Math.max(0, Math.ceil((miniQ.endsAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [miniQ]);

  useEffect(() => {
    if (!offer) return;
    const iv = window.setInterval(() => {
      setOfferLeft(Math.max(0, Math.ceil((offer.endsAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [offer]);

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

  const respondOffer = (buy: boolean) => {
    if (!offer) return;
    playClick();
    send({ t: 'buy_res', buy });
    setOffer(null);
  };

  // Board rows (serpentine path, 6 per row)
  const rows: number[][] = [];
  for (let r = 0; r < BOARD.length / 6; r++) {
    const row = Array.from({ length: 6 }, (_, i) => r * 6 + i);
    rows.push(r % 2 === 1 ? row.reverse() : row);
  }

  const racers = order.length ? order : players.slice(0, 4).map((p) => p.id);
  const ownerIdx = (id: string) => Math.max(0, racers.indexOf(id)) % OWNER_BG.length;
  const venuesOf = (id: string) => Object.values(owners).filter((o) => o === id).length;

  const standings = winner
    ? [winner, ...racers.filter((id) => id !== winner).sort((a, b) => (coinsMap[b] || 0) - (coinsMap[a] || 0))]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-950 via-indigo-950 to-purple-950 text-white px-3 py-6">
      <div className="max-w-3xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">✈️ World Tour Tycoon</h1>
        <p className="text-center font-nunito text-sky-200 text-sm mb-3">
          Race to London — buy venues on the way ({PRICE}💰) and charge rivals {RENT}💰 rent!
        </p>

        {/* Racers strip */}
        <div className="flex flex-wrap justify-center gap-2 mb-3">
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
                <span className={`w-2.5 h-2.5 rounded-full ${OWNER_BG[ownerIdx(id)]}`} />
                <span className="text-lg">{p.emoji}</span>
                <span className={`font-bold ${id === myId ? 'text-amber-300' : ''}`}>{p.name}</span>
                <span className="text-amber-200">💰{coinsMap[id] ?? START_COINS}</span>
                <span className="text-sky-200">🏟️{venuesOf(id)}</span>
              </div>
            );
          })}
        </div>

        {/* Event feed */}
        <div className="mb-3 min-h-[3.6rem] text-center">
          {feed.map((line, i) => (
            <div key={`${i}-${line}`} className={`font-fredoka ${i === 0 ? 'text-amber-300' : 'text-white/40 text-sm'}`}>
              {line}
            </div>
          ))}
        </div>

        {/* Board */}
        <div className="space-y-1.5 mb-5">
          {rows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-6 gap-1.5">
              {row.map((ti) => {
                const tile = BOARD[ti];
                const here = racers.filter((id) => (posMap[id] ?? 0) === ti);
                const curHere = current && here.includes(current);
                const owner = owners[ti];
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
                    {owner && (
                      <span
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-white/70 shadow ${OWNER_BG[ownerIdx(owner)]}`}
                        title={`Owned by ${byId(owner).name}`}
                      >
                        {byId(owner).emoji}
                      </span>
                    )}
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

      <AnimatePresence>
        {/* Buy offer (current player only) */}
        {offer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4">
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gradient-to-br from-sky-800 to-indigo-900 border-4 border-amber-400 rounded-3xl p-6 max-w-sm w-full text-center"
            >
              <div className="text-5xl mb-2">{BOARD[offer.tile].emoji}</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-1">
                Buy a venue in {BOARD[offer.tile].label}?
              </h2>
              <p className="font-nunito text-sky-200 mb-1">
                Price: <span className="font-bold text-amber-300">{offer.price}💰</span> · Rivals landing here pay you <span className="font-bold text-amber-300">{RENT}💰</span>
              </p>
              <p className="font-fredoka text-sky-300 text-sm mb-4">⏱️ {offerLeft}s to decide</p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => respondOffer(true)}
                  className="px-7 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-emerald-400 to-green-500 shadow-xl"
                >
                  🏟️ Buy it!
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => respondOffer(false)}
                  className="px-7 py-3 rounded-full font-fredoka font-bold bg-white/15 border border-white/30"
                >
                  💨 Skip
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Mini pop-quiz overlay */}
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

        {/* Winner */}
        {winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div
              initial={{ scale: 0.6, rotate: -4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="bg-gradient-to-br from-indigo-800 to-purple-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="text-7xl mb-3"
              >
                🏟️
              </motion.div>
              <h2 className="font-fredoka font-bold text-2xl md:text-3xl text-amber-300 mb-3">
                {byId(winner).emoji} {byId(winner).name} headlines the Final Concert!
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left">
                {standings.map((id, i) => (
                  <div key={id} className="flex justify-between font-nunito text-sm py-1 border-b border-white/5 last:border-0">
                    <span>{['🥇', '🥈', '🥉', '4️⃣'][i]} {byId(id).emoji} {byId(id).name}</span>
                    <span className="text-amber-200">💰{coinsMap[id] || 0} · 🏟️{venuesOf(id)}</span>
                  </div>
                ))}
              </div>
              <p className="font-fredoka text-green-300 mb-5">+{winner === myId ? 50 : 15} XP</p>
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
