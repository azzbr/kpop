import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWrong, playWin } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const CALL_EVERY_MS = 8000;

const LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
];

interface Call {
  a: number;
  b: number;
  answer: number;
}

function buildCalls(): Call[] {
  const seen = new Set<number>();
  const calls: Call[] = [];
  const pairs: [number, number][] = [];
  for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) pairs.push([a, b]);
  pairs.sort(() => Math.random() - 0.5);
  pairs.forEach(([a, b]) => {
    if (!seen.has(a * b)) {
      seen.add(a * b);
      calls.push({ a, b, answer: a * b });
    }
  });
  return calls;
}

interface Standing {
  id: string;
  name: string;
  emoji: string;
  marks: number;
}

const TimesTableBingo: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [card, setCard] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [called, setCalled] = useState<Call[]>([]);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [nextIn, setNextIn] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [winner, setWinner] = useState<{ id: string; standings: Standing[] } | null>(null);
  const xpGiven = useRef(false);
  const claimed = useRef(false);
  const nextCallAt = useRef(0);

  // Host-side authoritative state
  const hd = useRef({
    calls: [] as Call[],
    idx: -1,
    cards: {} as Record<string, number[]>,
    winner: null as string | null,
    iv: 0,
    timer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.calls = buildCalls();
    const answers = h.calls.map((c) => c.answer);
    players.forEach((p) => {
      h.cards[p.id] = [...answers].sort(() => Math.random() - 0.5).slice(0, 16);
    });

    const standings = (): Standing[] => {
      const calledAns = new Set(h.calls.slice(0, h.idx + 1).map((c) => c.answer));
      return Object.entries(h.cards)
        .map(([id, c]) => ({
          id,
          name: byId(id).name,
          emoji: byId(id).emoji,
          marks: c.filter((v) => calledAns.has(v)).length,
        }))
        .sort((a, b) => b.marks - a.marks);
    };

    const callNext = () => {
      if (h.winner) return;
      h.idx += 1;
      if (h.idx >= h.calls.length) {
        window.clearInterval(h.iv);
        send({ t: 'tb_final', standings: standings() });
        return;
      }
      const c = h.calls[h.idx];
      send({ t: 'tb_call', n: h.idx + 1, a: c.a, b: c.b, answer: c.answer });
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'tb_claim' && !h.winner) {
        const playerCard = h.cards[m.from];
        const cells = m.cells as number[];
        if (!playerCard || !Array.isArray(cells) || cells.length !== 4) return;
        const calledAns = new Set(h.calls.slice(0, h.idx + 1).map((c) => c.answer));
        const isLine = LINES.some((line) => line.every((c) => cells.includes(c)));
        const allCalled = cells.every((c) => c >= 0 && c < 16 && calledAns.has(playerCard[c]));
        if (isLine && allCalled) {
          h.winner = m.from;
          window.clearInterval(h.iv);
          send({ t: 'tb_winner', playerId: m.from, standings: standings() });
        }
      }
    });

    h.timer = window.setTimeout(() => {
      send({ t: 'tb_setup', cards: { ...h.cards } });
      h.timer = window.setTimeout(() => {
        callNext();
        h.iv = window.setInterval(callNext, CALL_EVERY_MS);
      }, 3000);
    }, 900);

    return () => {
      offMsg();
      window.clearTimeout(h.timer);
      window.clearInterval(h.iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      switch (m.t) {
        case 'tb_setup':
          setCard(m.cards[myId] || []);
          setMarked([]);
          claimed.current = false;
          break;
        case 'tb_call':
          setCurrentCall({ a: m.a, b: m.b, answer: m.answer });
          setCalled((c) => [...c, { a: m.a, b: m.b, answer: m.answer }]);
          nextCallAt.current = Date.now() + CALL_EVERY_MS;
          playClick();
          break;
        case 'tb_winner':
          setWinner({ id: m.playerId, standings: m.standings });
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(m.playerId === myId ? 40 : 15);
          }
          if (m.playerId === myId) playWin();
          break;
        case 'tb_final':
          setWinner({ id: m.standings[0]?.id || '', standings: m.standings });
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(m.standings[0]?.id === myId ? 40 : 15);
          }
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "next call" countdown ticker
  useEffect(() => {
    const iv = window.setInterval(() => {
      setNextIn(Math.max(0, Math.ceil((nextCallAt.current - Date.now()) / 1000)));
    }, 500);
    return () => window.clearInterval(iv);
  }, []);

  const tapCell = (i: number) => {
    if (winner || marked.includes(i) || card.length === 0) return;
    const calledAnswers = new Set(called.map((c) => c.answer));
    if (calledAnswers.has(card[i])) {
      playCorrect();
      const newMarked = [...marked, i];
      setMarked(newMarked);
      if (!claimed.current) {
        const line = LINES.find((l) => l.every((c) => newMarked.includes(c)));
        if (line) {
          claimed.current = true;
          send({ t: 'tb_claim', cells: line });
        }
      }
    } else {
      playWrong();
      setWrongFlash(i);
      window.setTimeout(() => setWrongFlash(null), 500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-950 via-emerald-950 to-green-950 text-white px-4 py-6 select-none">
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🔢 Times-Table Bingo</h1>
        <p className="text-center font-nunito text-emerald-200 text-sm mb-4">
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
              <div className="font-nunito text-emerald-200 text-sm mt-2">
                Call {called.length} · next in {nextIn}s ⏱️
              </div>
            </>
          ) : (
            <div className="font-fredoka text-2xl">🎱 Cards coming up…</div>
          )}
        </div>

        {/* My card */}
        {card.length === 16 ? (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {card.map((v, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.93 }}
                onClick={() => tapCell(i)}
                animate={wrongFlash === i ? { x: [0, -6, 6, -6, 0] } : {}}
                className={`aspect-square rounded-2xl font-fredoka font-bold text-xl md:text-2xl border-2 transition-colors ${
                  marked.includes(i)
                    ? 'bg-amber-400 text-amber-950 border-amber-300 shadow-lg'
                    : wrongFlash === i
                    ? 'bg-red-500/50 border-red-400'
                    : 'bg-white/10 border-white/20 hover:bg-white/20'
                }`}
              >
                {v}
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="text-center font-nunito bg-white/10 rounded-3xl p-5 mb-4 text-emerald-200">
            {currentCall ? '👀 You joined late — watch this round!' : '🎫 Dealing your bingo card…'}
          </div>
        )}

        {/* Called history */}
        {called.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="font-fredoka text-xs text-emerald-300 mb-1.5">Called so far:</div>
            <div className="flex flex-wrap gap-1.5">
              {called.map((c, i) => (
                <span key={i} className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-nunito">
                  {c.a}×{c.b}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            {winner.id === myId && <ConfettiBurst count={90} durationMs={4500} />}
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-emerald-800 to-teal-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full"
            >
              <div className="text-6xl mb-2">🎉</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-3">
                BINGO! {byId(winner.id).emoji} {byId(winner.id).name}!
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-44 overflow-y-auto">
                {winner.standings.slice(0, 8).map((s, i) => (
                  <div key={s.id} className="flex justify-between font-nunito text-sm py-0.5">
                    <span>#{i + 1} {s.emoji} {s.name}</span>
                    <span className="text-amber-200">{s.marks} marked</span>
                  </div>
                ))}
              </div>
              <p className="font-fredoka text-green-300 mb-5">+{winner.id === myId ? 40 : 15} XP</p>
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-emerald-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimesTableBingo;
