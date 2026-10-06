import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi } from '../../online/useRoom';
import { finishArenaGame } from '../../online/arenaRewards';
import { useHelloSync } from '../../online/boardSync';
import { pickQuestions } from '../../online/schoolQuestions';
import type { PreparedQ } from '../../online/schoolQuestions';
import { BOARD, FINISH, START_COINS, PRICE, RENT, COIN_TILE, QUIZ_JUMP, resolveRoll, finalRanking, netWorth } from '../../online/worldTourLogic';
import type { TileKind } from '../../online/worldTourLogic';
import { playClick, playCorrect, playWrong, playWin, playCoin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

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

type Money = Record<string, number>;
type Owners = Record<number, string>;
type OfferInfo = { playerId: string; tile: number; price: number; endsAt: number };
type MiniInfo = { playerId: string; text: string; options: string[]; endsAt: number };

// Messages exchanged over the room channel (all start with 'wt_')
type WtMsg = { from?: string } & (
  | { t: 'wt_roll'; from: string }
  | { t: 'wt_ans'; from: string; choice: number }
  | { t: 'wt_buy'; from: string; buy: boolean }
  | {
      t: 'wt_snap'; order: string[]; pos: Money; coins: Money; owners: Owners; current: string | null; canRoll: boolean;
      offer: OfferInfo | null; mini: MiniInfo | null; winnerId: string | null; ranked: (string | string[])[] | null;
    }
  | { t: 'wt_turn'; playerId: string; pos: Money; coins: Money; owners: Owners }
  | {
      t: 'wt_rolled'; playerId: string; dice: number; to: number; final: number; kind: TileKind; auto: boolean;
      rent: { to: string; amount: number } | null; home: number; pos: Money; coins: Money; owners: Owners;
    }
  | ({ t: 'wt_offer' } & OfferInfo)
  | { t: 'wt_bought'; playerId: string; tile: number; owners: Owners; coins: Money }
  | { t: 'wt_skip'; playerId: string; tile: number }
  | ({ t: 'wt_q' } & MiniInfo)
  | { t: 'wt_qres'; playerId: string; ok: boolean; pos: Money; coins: Money }
  | { t: 'wt_final'; winnerId: string; pos: Money; coins: Money; owners: Owners; ranked: (string | string[])[] }
);

const WorldTourRace: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;

  const [order, setOrder] = useState<string[]>([]);
  const [posMap, setPosMap] = useState<Money>({});
  const [coinsMap, setCoinsMap] = useState<Money>({});
  const [owners, setOwners] = useState<Owners>({});
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
  const [ranked, setRanked] = useState<(string | string[])[]>([]);
  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);
  const rewarded = useRef(false);
  const synced = useRef(false);
  const diceTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(diceTimer.current), []);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  const pushFeed = (line: string) => setFeed((f) => [line, ...f].slice(0, 3));

  const hostApi = useRef<{ start: () => void; snapshot: () => void } | null>(null);
  useHelloSync(room, 'wt', {
    onStart: () => hostApi.current?.start(),
    onHello: () => hostApi.current?.snapshot(),
    synced: () => synced.current,
  });

  // ---- HOST: game master ----
  useEffect(() => {
    if (!isHost) return;
    const h = {
      order: players.slice(0, 4).map((p) => p.id),
      turn: 0,
      pos: {} as Money,
      coins: {} as Money,
      owners: {} as Owners,
      offer: null as OfferInfo | null,
      mini: null as (MiniInfo & { correct: number }) | null,
      busy: true,
      live: false,
      qs: pickQuestions('mix', 20) as PreparedQ[],
      qi: 0,
      finished: false,
      winnerId: null as string | null,
      ranked: null as (string | string[])[] | null,
    };
    h.order.forEach((id) => {
      h.pos[id] = 0;
      h.coins[id] = START_COINS;
    });

    // Every host timer goes through `later`, so unmounting clears them all.
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
      return id;
    };
    const cancel = (id: number) => { window.clearTimeout(id); timers.delete(id); };
    let stepTimer = 0; // the one pending game step (next turn / quiz / offer / timeout)
    let autoTimer = 0; // auto-roll if a player doesn't roll
    const step = (fn: () => void, ms: number) => { cancel(stepTimer); stepTimer = later(fn, ms); };

    const snapshot = () => {
      if (!h.live) return;
      const cur = h.order[h.turn];
      send({
        t: 'wt_snap', order: h.order, pos: { ...h.pos }, coins: { ...h.coins }, owners: { ...h.owners },
        current: h.finished ? null : cur, canRoll: !h.busy && !h.finished,
        offer: h.offer, mini: h.mini ? { playerId: h.mini.playerId, text: h.mini.text, options: h.mini.options, endsAt: h.mini.endsAt } : null,
        winnerId: h.winnerId, ranked: h.ranked,
      });
    };

    const sendTurn = () => {
      if (h.finished) return;
      h.busy = false;
      const pid = h.order[h.turn];
      send({ t: 'wt_turn', playerId: pid, pos: { ...h.pos }, coins: { ...h.coins }, owners: { ...h.owners } });
      cancel(autoTimer);
      autoTimer = later(() => doRoll(pid, true), 25000);
    };

    const finish = (pid: string) => {
      h.finished = true;
      h.winnerId = pid;
      h.ranked = finalRanking(h.order, pid, h.coins, h.owners);
      cancel(autoTimer);
      step(() => send({ t: 'wt_final', winnerId: pid, pos: { ...h.pos }, coins: { ...h.coins }, owners: { ...h.owners }, ranked: h.ranked! }), 2000);
    };

    const nextTurn = () => {
      h.turn = (h.turn + 1) % h.order.length;
      step(sendTurn, 600);
    };

    const resolveMini = (pid: string, ok: boolean) => {
      if (!h.mini || h.mini.playerId !== pid) return;
      h.mini = null;
      if (ok) h.pos[pid] = Math.min(h.pos[pid] + QUIZ_JUMP, FINISH);
      send({ t: 'wt_qres', playerId: pid, ok, pos: { ...h.pos }, coins: { ...h.coins } });
      if (h.pos[pid] === FINISH) finish(pid);
      else step(nextTurn, 2000);
    };

    const resolveOffer = (pid: string, wantsBuy: boolean) => {
      if (!h.offer || h.offer.playerId !== pid) return;
      const tile = h.offer.tile;
      h.offer = null;
      const bought = wantsBuy && h.coins[pid] >= PRICE;
      if (bought) {
        h.coins[pid] -= PRICE;
        h.owners[tile] = pid;
        send({ t: 'wt_bought', playerId: pid, tile, owners: { ...h.owners }, coins: { ...h.coins } });
      } else {
        send({ t: 'wt_skip', playerId: pid, tile });
      }
      step(nextTurn, bought ? 1600 : 800);
    };

    const doRoll = (pid: string, auto: boolean) => {
      if (!h.live || h.busy || h.finished || h.order[h.turn] !== pid) return;
      h.busy = true;
      cancel(autoTimer);
      const d = 1 + Math.floor(Math.random() * 6);
      const res = resolveRoll(pid, d, h.pos, h.coins, h.owners);
      send({
        t: 'wt_rolled', playerId: pid, dice: d, to: res.to, final: res.final, kind: res.kind, auto, rent: res.rent, home: res.home,
        pos: { ...h.pos }, coins: { ...h.coins }, owners: { ...h.owners },
      });

      if (res.final === FINISH) {
        finish(pid);
        return;
      }
      if (res.kind === 'quiz') {
        step(() => {
          const q = h.qs[h.qi % h.qs.length];
          h.qi += 1;
          h.mini = { playerId: pid, text: q.text, options: q.options, endsAt: Date.now() + 12000, correct: q.correct };
          send({ t: 'wt_q', playerId: pid, text: q.text, options: q.options, endsAt: h.mini.endsAt });
          step(() => resolveMini(pid, false), 12400);
        }, 1800);
        return;
      }
      if (res.canBuy) {
        step(() => {
          h.offer = { playerId: pid, tile: res.final, price: PRICE, endsAt: Date.now() + 10000 };
          send({ t: 'wt_offer', ...h.offer });
          step(() => resolveOffer(pid, false), 10400);
        }, 1600);
        return;
      }
      step(nextTurn, 2200);
    };

    hostApi.current = {
      start: () => {
        h.live = true;
        snapshot();
        step(sendTurn, 1600);
      },
      snapshot,
    };

    const offMsg = onMessage((raw) => {
      const m = raw as unknown as WtMsg;
      if (m.t === 'wt_roll') doRoll(m.from, false);
      if (m.t === 'wt_ans' && h.mini && m.from === h.mini.playerId) resolveMini(m.from, m.choice === h.mini.correct);
      if (m.t === 'wt_buy') resolveOffer(m.from, !!m.buy);
    });

    return () => {
      offMsg();
      hostApi.current = null;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE: render-state updates ----
  useEffect(() => {
    const endGame = (winnerId: string, rk: (string | string[])[]) => {
      setWinner(winnerId);
      setRanked(rk);
      setCanRoll(false);
      setOffer(null);
      setMiniQ(null);
      if (!rewarded.current) {
        rewarded.current = true;
        const r = finishArenaGame(room, rk);
        setReward({ xp: r.xp, coins: r.coins });
        if (winnerId === myId) playWin();
      }
    };
    return onMessage((raw) => {
      const m = raw as unknown as WtMsg;
      switch (m.t) {
        case 'wt_snap':
          synced.current = true;
          setOrder(m.order);
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setOwners(m.owners);
          setCurrent(m.current);
          setCanRoll(m.canRoll && m.current === myId);
          setOffer(m.offer && m.offer.playerId === myId ? { tile: m.offer.tile, price: m.offer.price, endsAt: m.offer.endsAt } : null);
          if (m.mini) setMiniQ({ forId: m.mini.playerId, text: m.mini.text, options: m.mini.options, endsAt: m.mini.endsAt });
          if (m.winnerId && m.ranked) endGame(m.winnerId, m.ranked);
          break;
        case 'wt_turn':
          synced.current = true;
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setOwners(m.owners);
          setCurrent(m.playerId);
          setCanRoll(m.playerId === myId);
          pushFeed(`🎲 ${byId(m.playerId).emoji} ${byId(m.playerId).name}'s turn!`);
          break;
        case 'wt_rolled': {
          setCanRoll(false);
          setDice({ value: m.dice, rolling: true });
          window.clearTimeout(diceTimer.current);
          diceTimer.current = window.setTimeout(() => setDice({ value: m.dice, rolling: false }), 700);
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setOwners(m.owners);
          const nm = byId(m.playerId).name;
          const tile = BOARD[m.final];
          const label =
            m.kind === 'boost' ? `🚀 Jet boost → ${tile.label}!`
            : m.kind === 'trap' ? `🌧️ Storm delay! Back to ${tile.label}!`
            : m.kind === 'coin' ? `💰 +${COIN_TILE} coins in ${BOARD[m.to].label}!`
            : m.kind === 'quiz' ? `❓ Pop quiz in ${BOARD[m.to].label}!`
            : m.kind === 'finish' ? '🎡 Made it to London!'
            : `→ ${tile.label}`;
          pushFeed(`${m.auto ? '⏰ ' : ''}${nm} rolled ${m.dice} ${label}`);
          if (m.rent) pushFeed(`💸 ${nm} paid ${m.rent.amount} rent to ${byId(m.rent.to).name}!`);
          if (m.home) pushFeed(`🏨 ${nm}'s own hotel — +${m.home} coins!`);
          if (m.kind === 'coin') playCoin();
          else playPop();
          break;
        }
        case 'wt_offer':
          if (m.playerId === myId) {
            setOffer({ tile: m.tile, price: m.price, endsAt: m.endsAt });
          } else {
            pushFeed(`🤔 ${byId(m.playerId).name} is deciding to buy a hotel in ${BOARD[m.tile].label}…`);
          }
          break;
        case 'wt_bought':
          setOwners(m.owners);
          setCoinsMap(m.coins);
          setOffer(null);
          pushFeed(`🏨 ${byId(m.playerId).emoji} ${byId(m.playerId).name} bought a hotel in ${BOARD[m.tile].label}!`);
          playCoin();
          break;
        case 'wt_skip':
          setOffer(null);
          pushFeed(`💨 ${byId(m.playerId).name} skipped ${BOARD[m.tile].label}`);
          break;
        case 'wt_q':
          setMiniQ({ forId: m.playerId, text: m.text, options: m.options, endsAt: m.endsAt });
          setMiniChoice(null);
          break;
        case 'wt_qres': {
          setMiniQ(null);
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          const nm2 = byId(m.playerId).name;
          pushFeed(m.ok ? `✅ ${nm2} got it right — +${QUIZ_JUMP} tiles!` : `💭 Not this time, ${nm2} — stays put!`);
          if (m.playerId === myId) (m.ok ? playCorrect : playWrong)();
          break;
        }
        case 'wt_final':
          setPosMap(m.pos);
          setCoinsMap(m.coins);
          setOwners(m.owners);
          endGame(m.winnerId, m.ranked);
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
    send({ t: 'wt_roll' });
  };

  const answerMini = (i: number) => {
    if (!miniQ || miniQ.forId !== myId || miniChoice !== null) return;
    playClick();
    setMiniChoice(i);
    send({ t: 'wt_ans', choice: i });
  };

  const respondOffer = (buy: boolean) => {
    if (!offer) return;
    playClick();
    send({ t: 'wt_buy', buy });
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

  // Final standings with shared places for ties (from the host's ranking)
  const standings: { id: string; place: number }[] = [];
  ranked.forEach((rung, i) => (Array.isArray(rung) ? rung : [rung]).forEach((id) => standings.push({ id, place: i })));

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-sky-950 via-indigo-950 to-purple-950 text-white px-3 py-6">
      <div className="max-w-3xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">✈️ World Tour Tycoon</h1>
        <p className="text-center font-nunito text-sky-200 text-lg mb-3">
          Race from Home Town to London — buy hotels on the way ({PRICE}💰) and charge rivals {RENT}💰 rent!
        </p>

        {/* Racers strip */}
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {racers.map((id) => {
            const p = byId(id);
            const isCur = current === id;
            return (
              <div
                key={id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-nunito text-base md:text-lg border-2 ${
                  isCur ? 'border-amber-400 bg-amber-400/20 shadow-lg' : 'border-white/10 bg-white/5'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${OWNER_BG[ownerIdx(id)]}`} />
                <span className="text-lg">{p.emoji}</span>
                <span className={`font-bold ${id === myId ? 'text-amber-300' : ''}`}>{p.name}</span>
                <span className="text-amber-200">💰{coinsMap[id] ?? START_COINS}</span>
                <span className="text-sky-200">🏨{venuesOf(id)}</span>
              </div>
            );
          })}
        </div>

        {/* Event feed */}
        <div className="mb-3 min-h-[5rem] text-center">
          {feed.map((line, i) => (
            <div key={`${i}-${line}`} className={`font-fredoka ${i === 0 ? 'text-amber-300 text-lg md:text-xl' : 'text-white/60 text-base'}`}>
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
                    className={`relative aspect-square md:aspect-[5/4] rounded-xl border-2 p-1 flex flex-col items-center justify-center ${TILE_TINT[tile.kind]} ${
                      curHere ? 'ring-2 ring-amber-300' : ''
                    }`}
                  >
                    <div className="text-lg md:text-2xl leading-none">{tile.emoji}</div>
                    <div className="text-[11px] sm:text-sm md:text-base font-nunito font-bold text-white/90 text-center leading-tight mt-0.5 break-words max-w-full">
                      {tile.label}
                    </div>
                    {owner && (
                      <span
                        className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white/80 shadow ${OWNER_BG[ownerIdx(owner)]}`}
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
                            className="text-lg md:text-2xl -ml-1 first:ml-0 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
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
                Buy a hotel in {BOARD[offer.tile].label}?
              </h2>
              <p className="font-nunito text-lg text-sky-200 mb-1">
                Price: <span className="font-bold text-amber-300">{offer.price}💰</span> · Rivals landing here pay you <span className="font-bold text-amber-300">{RENT}💰</span>
              </p>
              <p className="font-fredoka text-sky-300 text-lg mb-4">⏱️ {offerLeft}s to decide</p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => respondOffer(true)}
                  className="min-h-[48px] px-7 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-emerald-400 to-green-500 shadow-xl"
                >
                  🏨 Buy it!
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => respondOffer(false)}
                  className="min-h-[48px] px-7 py-3 rounded-full font-fredoka font-bold text-lg bg-white/15 border border-white/30"
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
              <div className="text-center font-fredoka text-lg text-violet-200 mb-1">
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
                      className={`min-h-[52px] rounded-2xl border-2 p-3 font-nunito font-bold text-lg text-left ${
                        miniChoice === i ? 'bg-amber-400/40 border-amber-300' : 'bg-white/10 border-white/20 active:bg-white/20'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                  <div className="text-center font-nunito text-violet-200 text-base">Answer right → jump {QUIZ_JUMP} tiles ahead! 🚀</div>
                </div>
              ) : (
                <div className="text-center font-nunito text-lg text-violet-200">
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
                🎡
              </motion.div>
              <h2 className="font-fredoka font-bold text-2xl md:text-3xl text-amber-300 mb-3">
                {byId(winner).emoji} {byId(winner).name} reached London first!
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left">
                {standings.map(({ id, place }) => (
                  <div key={id} className="flex justify-between gap-2 font-nunito text-lg py-1 border-b border-white/5 last:border-0">
                    <span>{['🥇', '🥈', '🥉', '4️⃣'][place]} {byId(id).emoji} {byId(id).name}</span>
                    <span className="text-amber-200">{id === winner ? '🎡' : `💰${netWorth(id, coinsMap, owners)}`}</span>
                  </div>
                ))}
              </div>
              <p className="font-nunito text-base text-indigo-200 mb-2">First to London wins — everyone else is ranked by coins + hotels.</p>
              {reward && <p className="font-fredoka text-lg text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="min-h-[48px] px-8 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-lg text-purple-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorldTourRace;
