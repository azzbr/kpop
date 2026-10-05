import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameMsg, RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWrong, playWin } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';
import { useHelloGate, useArenaFinish, msLeft, placeOf } from '../../online/helloGate';
import { CALL_EVERY_MS, buildCalls, dealCard, canMark, findLine, bingoRanking, type Call } from './timesTableBingoLogic';

// Solve the call, find the answer on your own card — first full line wins.
// The host deals and keeps every card and every player's marks, so a device that mounts
// late (or reloads its game) gets its card, the calls so far and its marks back (ttb_sync).

const DEAL_MS = 3000; // look at your card before the first call

interface EndInfo { winnerId: string | null; ranked: (string | string[])[]; marks: Record<string, number> }

// Messages (all prefixed ttb_)
type TtbMsg = { from?: string } & (
  | { t: 'ttb_deal'; cards: Record<string, number[]>; ms: number }
  | { t: 'ttb_call'; n: number; a: number; b: number; answer: number; ms: number }
  | { t: 'ttb_mark'; cell: number }
  | ({ t: 'ttb_end' } & EndInfo)
  | { t: 'ttb_sync'; to: string; card: number[]; marks: number[]; called: Call[]; ms: number; end?: EndInfo }
);

const TimesTableBingo: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { finish, reward } = useArenaFinish(room);

  const [card, setCard] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [called, setCalled] = useState<Call[]>([]);
  const [nextIn, setNextIn] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [end, setEnd] = useState<EndInfo | null>(null);
  const nextCallAt = useRef(0);

  const playersRef = useRef(players);
  playersRef.current = players;

  // Host-side authoritative state
  const hd = useRef({
    calls: [] as Call[],
    idx: -1,
    cards: {} as Record<string, number[]>,
    marks: {} as Record<string, number[]>,
    nextAt: 0,
    end: null as EndInfo | null,
    iv: 0,
    timer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: 'Friend', emoji: '🙂', isHost: false, joinedAt: 0 };

  // ---- HOST ----
  const calledSet = () => {
    const h = hd.current;
    return new Set(h.calls.slice(0, h.idx + 1).map((c) => c.answer));
  };

  const hostEnd = (winnerId: string | null) => {
    const h = hd.current;
    if (h.end) return;
    window.clearInterval(h.iv);
    window.clearTimeout(h.timer);
    const marks: Record<string, number> = {};
    for (const [id, m] of Object.entries(h.marks)) marks[id] = m.length;
    h.end = { winnerId, ranked: bingoRanking(winnerId, h.marks), marks };
    send({ t: 'ttb_end', ...h.end });
  };

  const hostCallNext = () => {
    const h = hd.current;
    if (h.end) return;
    h.idx += 1;
    if (h.idx >= h.calls.length) {
      hostEnd(null);
      return;
    }
    const c = h.calls[h.idx];
    h.nextAt = Date.now() + CALL_EVERY_MS;
    send({ t: 'ttb_call', n: h.idx + 1, a: c.a, b: c.b, answer: c.answer, ms: CALL_EVERY_MS });
  };

  useHelloGate(room, 'ttb', {
    onStart: () => {
      const h = hd.current;
      h.calls = buildCalls();
      playersRef.current.forEach((p) => {
        h.cards[p.id] = dealCard(h.calls);
        h.marks[p.id] = [];
      });
      h.nextAt = Date.now() + DEAL_MS;
      send({ t: 'ttb_deal', cards: { ...h.cards }, ms: DEAL_MS });
      h.timer = window.setTimeout(() => {
        hostCallNext();
        h.iv = window.setInterval(hostCallNext, CALL_EVERY_MS);
      }, DEAL_MS);
    },
    onHello: (from) => {
      const h = hd.current;
      send({
        t: 'ttb_sync', to: from, card: h.cards[from] ?? [], marks: h.marks[from] ?? [],
        called: h.calls.slice(0, h.idx + 1), ms: msLeft(h.nextAt), end: h.end ?? undefined,
      });
    },
  });

  const hostHandle = (m: TtbMsg) => {
    const h = hd.current;
    if (m.t !== 'ttb_mark' || !m.from || h.end) return;
    const card = h.cards[m.from];
    const marks = h.marks[m.from];
    if (!card || !marks || marks.includes(m.cell) || !canMark(card, m.cell, calledSet())) return;
    marks.push(m.cell);
    if (findLine(marks)) hostEnd(m.from);
  };

  // ---- EVERYONE ----
  const showEnd = (e: EndInfo) => {
    setEnd(e);
    if (e.winnerId === myId) playWin();
    else playCorrect();
    finish(e.ranked);
  };

  const handle = (m: TtbMsg) => {
    if (isHost) hostHandle(m);
    switch (m.t) {
      case 'ttb_deal':
        setCard(m.cards[myId] || []);
        setMarked([]);
        nextCallAt.current = Date.now() + m.ms;
        break;
      case 'ttb_call':
        setCalled((c) => [...c.slice(0, m.n - 1), { a: m.a, b: m.b, answer: m.answer }]);
        nextCallAt.current = Date.now() + m.ms;
        playClick();
        break;
      case 'ttb_end':
        showEnd(m);
        break;
      case 'ttb_sync':
        if (m.to !== myId) break;
        setCard(m.card);
        setMarked(m.marks);
        setCalled(m.called);
        nextCallAt.current = Date.now() + m.ms;
        if (m.end) showEnd(m.end);
        break;
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    const off = onMessage((raw: GameMsg) => handleRef.current(raw as unknown as TtbMsg));
    const h = hd.current;
    return () => {
      off();
      window.clearTimeout(h.timer);
      window.clearInterval(h.iv);
    };
  }, [onMessage]);

  // "next call" countdown ticker
  useEffect(() => {
    const iv = window.setInterval(() => {
      setNextIn(Math.max(0, Math.ceil((nextCallAt.current - Date.now()) / 1000)));
    }, 500);
    return () => window.clearInterval(iv);
  }, []);

  const tapCell = (i: number) => {
    if (end || marked.includes(i) || card.length === 0) return;
    if (canMark(card, i, new Set(called.map((c) => c.answer)))) {
      playCorrect();
      setMarked((mk) => [...mk, i]);
      send({ t: 'ttb_mark', cell: i });
    } else {
      playWrong();
      setWrongFlash(i);
      window.setTimeout(() => setWrongFlash(null), 500);
    }
  };

  const currentCall = called.length ? called[called.length - 1] : null;
  const winLine = findLine(marked);
  const flatRank = end ? end.ranked.flatMap((r) => (Array.isArray(r) ? r : [r])) : [];

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-teal-950 via-emerald-950 to-green-950 text-white px-4 py-6 select-none"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">🔢 Times-Table Bingo</h1>
        <p className="text-center font-nunito text-emerald-200 text-lg mb-4">
          Solve the sum, find it on YOUR card — first full line wins!
        </p>

        {/* Current call */}
        <div className="bg-white/10 rounded-3xl border border-white/15 p-5 mb-4 text-center">
          {currentCall ? (
            <>
              <motion.div
                key={called.length}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-fredoka font-bold text-5xl md:text-6xl text-amber-300"
              >
                {currentCall.a} × {currentCall.b} = ?
              </motion.div>
              <div className="font-nunito text-emerald-200 text-lg mt-2">
                Call {called.length} · next in {nextIn}s ⏱️
              </div>
            </>
          ) : (
            <div className="font-fredoka text-2xl">{card.length ? `🎱 First call in ${nextIn}s…` : '🎱 Cards coming up…'}</div>
          )}
        </div>

        {/* My card */}
        {card.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {card.map((v, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.93 }}
                onClick={() => tapCell(i)}
                animate={wrongFlash === i ? { x: [0, -6, 6, -6, 0] } : {}}
                className={`aspect-square min-h-[56px] rounded-2xl font-fredoka font-bold text-2xl md:text-3xl border-2 transition-colors ${
                  marked.includes(i)
                    ? `${winLine?.includes(i) ? 'bg-pink-400 border-pink-200' : 'bg-amber-400 border-amber-300'} text-amber-950 shadow-lg`
                    : wrongFlash === i
                    ? 'bg-red-500/50 border-red-400'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                {v}
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="text-center font-nunito text-lg bg-white/10 rounded-3xl p-5 mb-4 text-emerald-200">
            {currentCall ? '👀 This game started without you — watch and join the next one!' : '🎫 Dealing your bingo card…'}
          </div>
        )}
        {wrongFlash !== null && (
          <div className="text-center font-nunito text-lg text-amber-200 mb-2">Not called yet — keep looking! 🔍</div>
        )}

        {/* Called history */}
        {called.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="font-fredoka text-base text-emerald-300 mb-1.5">Called so far:</div>
            <div className="flex flex-wrap gap-1.5">
              {called.map((c, i) => (
                <span key={i} className="rounded-full bg-white/10 px-2.5 py-0.5 text-base font-nunito">
                  {c.a}×{c.b}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {end && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-emerald-800 to-teal-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full"
            >
              <div className="text-6xl mb-2">🎉</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-3">
                {end.winnerId ? `BINGO! ${byId(end.winnerId).emoji} ${byId(end.winnerId).name}!` : 'All the sums are called!'}
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-44 overflow-y-auto">
                {flatRank.slice(0, 10).map((id) => (
                  <div key={id} className={`flex justify-between font-nunito text-base py-0.5 ${id === myId ? 'text-amber-200 font-bold' : ''}`}>
                    <span>#{placeOf(end.ranked, id)} {byId(id).emoji} {byId(id).name}</span>
                    <span className="text-amber-200">{end.marks[id] ?? 0} marked</span>
                  </div>
                ))}
              </div>
              {reward && <p className="font-fredoka text-lg text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="min-h-[52px] px-8 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-lg text-emerald-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimesTableBingo;
