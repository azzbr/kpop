import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWrong, playWin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const MAX_ROUNDS = 12;
const PADS = [
  { emoji: '🥁', on: 'bg-rose-400', off: 'bg-rose-600/40' },
  { emoji: '🎸', on: 'bg-blue-400', off: 'bg-blue-600/40' },
  { emoji: '🎹', on: 'bg-amber-300', off: 'bg-amber-500/40' },
  { emoji: '🎤', on: 'bg-emerald-400', off: 'bg-emerald-600/40' },
];

const showTime = (len: number) => 900 + len * 640;
const inputTime = (len: number) => 4000 + len * 1000;

type Phase = 'intro' | 'watch' | 'input' | 'submitted' | 'result' | 'final';

const CopyCat: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [seq, setSeq] = useState<number[]>([]);
  const [activePad, setActivePad] = useState(-1);
  const [taps, setTaps] = useState<number[]>([]);
  const [aliveIds, setAliveIds] = useState<string[]>([]);
  const [lastOut, setLastOut] = useState<string[]>([]);
  const [winners, setWinners] = useState<string[] | null>(null);
  const xpGiven = useRef(false);

  const iAmAlive = aliveIds.includes(myId);

  // Host-side authoritative state
  const hd = useRef({
    seq: [] as number[],
    round: 0,
    alive: [] as string[],
    inputs: {} as Record<string, number[]>,
    evaluated: true,
    timer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.alive = players.map((p) => p.id);
    h.timer = window.setTimeout(() => hostNextRound(), 1500);
    return () => window.clearTimeout(hd.current.timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostNextRound = () => {
    const h = hd.current;
    h.round += 1;
    h.seq = [...h.seq, Math.floor(Math.random() * 4)];
    h.inputs = {};
    h.evaluated = false;
    send({ t: 'cc_seq', round: h.round, seq: h.seq, alive: [...h.alive] });
    const deadline = showTime(h.seq.length) + inputTime(h.seq.length) + 1800;
    h.timer = window.setTimeout(() => hostEvaluate(), deadline);
  };

  const hostEvaluate = () => {
    const h = hd.current;
    if (h.evaluated) return;
    h.evaluated = true;
    window.clearTimeout(h.timer);
    const out: string[] = [];
    h.alive.forEach((id) => {
      const inp = h.inputs[id];
      const ok = inp && inp.length === h.seq.length && inp.every((v, i) => v === h.seq[i]);
      if (!ok) out.push(id);
    });
    const newAlive = h.alive.filter((id) => !out.includes(id));
    send({ t: 'cc_result', round: h.round, out, alive: newAlive, seq: h.seq });
    const ended = newAlive.length <= 1 || h.round >= MAX_ROUNDS;
    if (ended) {
      const w = newAlive.length > 0 ? newAlive : out;
      h.timer = window.setTimeout(() => send({ t: 'cc_final', winners: w, round: h.round }), 2200);
    } else {
      h.alive = newAlive;
      h.timer = window.setTimeout(() => hostNextRound(), 2800);
    }
  };

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      const h = hd.current;
      switch (m.t) {
        case 'cc_seq':
          setRound(m.round);
          setSeq(m.seq);
          setAliveIds(m.alive);
          setTaps([]);
          setLastOut([]);
          setPhase('watch');
          break;
        case 'cc_input':
          if (isHost && !h.evaluated && m.round === h.round && h.alive.includes(m.from) && !h.inputs[m.from]) {
            h.inputs[m.from] = m.taps;
            if (h.alive.every((id) => h.inputs[id] !== undefined)) hostEvaluate();
          }
          break;
        case 'cc_result':
          setLastOut(m.out);
          setAliveIds(m.alive);
          setPhase('result');
          if (m.out.includes(myId)) playWrong();
          else if (m.alive.includes(myId)) playCorrect();
          break;
        case 'cc_final':
          setWinners(m.winners);
          setPhase('final');
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(m.winners.includes(myId) ? 40 : 15);
          }
          if (m.winners.includes(myId)) playWin();
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch phase: replay the sequence with lights
  useEffect(() => {
    if (phase !== 'watch') return;
    let step = 0;
    setActivePad(-1);
    const iv = window.setInterval(() => {
      if (step >= seq.length * 2) {
        window.clearInterval(iv);
        setActivePad(-1);
        setPhase(aliveIds.includes(myId) ? 'input' : 'submitted');
        return;
      }
      if (step % 2 === 0) {
        setActivePad(seq[step / 2]);
        playPop();
      } else {
        setActivePad(-1);
      }
      step += 1;
    }, 320);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, seq]);

  const tapPad = (i: number) => {
    if (phase !== 'input') return;
    playClick();
    setActivePad(i);
    window.setTimeout(() => setActivePad(-1), 180);
    const next = [...taps, i];
    setTaps(next);
    if (next.length >= seq.length) {
      send({ t: 'cc_input', round, taps: next });
      setPhase('submitted');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-purple-950 to-slate-950 text-white px-4 py-6 select-none">
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🧠 Copy Cat</h1>
        <p className="text-center font-nunito text-violet-200 text-sm mb-4">
          Watch the pattern… then repeat it perfectly. One slip and you're out!
        </p>

        {/* Status bar */}
        <div className="flex items-center justify-between font-fredoka text-sm mb-4 bg-white/10 rounded-full px-4 py-2">
          <span>Round {round || '—'}</span>
          <span className="text-amber-300">
            {phase === 'watch' ? '👀 WATCH…' : phase === 'input' ? '🎯 YOUR TURN!' : phase === 'submitted' ? '⏳ waiting…' : ' '}
          </span>
          <span>💚 {aliveIds.length || players.length} left</span>
        </div>

        {/* Pads */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4">
          {PADS.map((pad, i) => (
            <motion.button
              key={i}
              whileTap={phase === 'input' ? { scale: 0.93 } : {}}
              onPointerDown={(e) => { e.preventDefault(); tapPad(i); }}
              onContextMenu={(e) => e.preventDefault()}
              style={{ touchAction: 'manipulation' }}
              disabled={phase !== 'input'}
              className={`h-32 md:h-40 rounded-3xl text-5xl md:text-6xl shadow-xl transition-all duration-150 ${
                activePad === i ? `${pad.on} scale-105 brightness-125` : pad.off
              } ${phase === 'input' ? '' : 'cursor-default'}`}
            >
              {pad.emoji}
            </motion.button>
          ))}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4 min-h-[1rem]">
          {seq.map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full ${i < taps.length ? 'bg-amber-400' : 'bg-white/20'}`} />
          ))}
        </div>

        {phase === 'intro' && (
          <div className="text-center font-fredoka text-xl bg-white/10 rounded-3xl p-5">🐱 Get ready to copy…</div>
        )}
        {!iAmAlive && aliveIds.length > 0 && phase !== 'final' && phase !== 'intro' && (
          <div className="text-center font-nunito bg-white/10 rounded-3xl p-4 text-violet-200">
            💀 You're out — watching the survivors battle it on!
          </div>
        )}

        {/* Alive chips */}
        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
          {players.map((p) => {
            const alive = aliveIds.length === 0 || aliveIds.includes(p.id);
            return (
              <span key={p.id} className={`rounded-full px-2.5 py-1 text-xs font-nunito ${alive ? 'bg-emerald-500/30' : 'bg-white/5 opacity-40 line-through'}`}>
                {p.emoji} {p.name}
              </span>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {phase === 'result' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-purple-800 to-violet-900 border-4 border-amber-400 rounded-3xl p-7 text-center max-w-sm w-full"
            >
              <div className="text-5xl mb-2">{lastOut.includes(myId) ? '💀' : '✅'}</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-2">
                {lastOut.includes(myId) ? "You're out!" : 'You survived!'}
              </h2>
              {lastOut.length > 0 ? (
                <p className="font-nunito text-violet-200">
                  Eliminated: {lastOut.map((id) => `${byId(id).emoji} ${byId(id).name}`).join(', ')}
                </p>
              ) : (
                <p className="font-nunito text-violet-200">Everyone survived — it gets longer! 😈</p>
              )}
            </motion.div>
          </motion.div>
        )}

        {phase === 'final' && winners && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={80} durationMs={4000} />
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-purple-800 to-violet-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full"
            >
              <div className="text-7xl mb-3">🏆</div>
              <h2 className="font-fredoka font-bold text-2xl md:text-3xl text-amber-300 mb-2">
                {winners.map((id) => `${byId(id).emoji} ${byId(id).name}`).join(' & ')} win{winners.length === 1 ? 's' : ''}!
              </h2>
              <p className="font-nunito text-violet-200 mb-2">Memory of a champion — {round} rounds!</p>
              <p className="font-fredoka text-green-300 mb-6">+{winners.includes(myId) ? 40 : 15} XP</p>
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-violet-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CopyCat;
