import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const GOAL = 150; // taps to reach the moon
const COUNTDOWN_MS = 3500;

type Phase = 'wait' | 'countdown' | 'race' | 'final';

const RocketTapRace: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('wait');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [startsAt, setStartsAt] = useState(0);
  const [countLeft, setCountLeft] = useState(3);
  const [winner, setWinner] = useState<string | null>(null);
  const tapBuf = useRef(0);
  const xpGiven = useRef(false);

  // Host-side authoritative state
  const hd = useRef({
    progress: {} as Record<string, number>,
    startsAt: 0,
    racing: false,
    dirty: false,
    winner: null as string | null,
    tick: 0,
    timer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;

    const begin = () => {
      h.progress = {};
      players.forEach((p) => (h.progress[p.id] = 0));
      h.winner = null;
      h.startsAt = Date.now() + COUNTDOWN_MS;
      h.racing = true;
      send({ t: 'rr_start', startsAt: h.startsAt, progress: { ...h.progress } });
    };

    h.timer = window.setTimeout(begin, 1200);

    h.tick = window.setInterval(() => {
      if (!h.racing || !h.dirty) return;
      h.dirty = false;
      send({ t: 'rr_pos', p: { ...h.progress } });
    }, 160);

    return () => {
      window.clearTimeout(h.timer);
      window.clearInterval(h.tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostRematch = () => {
    playClick();
    const h = hd.current;
    xpGiven.current = false;
    h.progress = {};
    players.forEach((p) => (h.progress[p.id] = 0));
    h.winner = null;
    h.startsAt = Date.now() + COUNTDOWN_MS;
    h.racing = true;
    send({ t: 'rr_start', startsAt: h.startsAt, progress: { ...h.progress } });
  };

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      const h = hd.current;
      switch (m.t) {
        case 'rr_start':
          setProgress(m.progress);
          setStartsAt(m.startsAt);
          setWinner(null);
          setPhase('countdown');
          break;
        case 'taps':
          if (isHost && h.racing && Date.now() >= h.startsAt && h.winner === null) {
            if (h.progress[m.from] !== undefined) {
              h.progress[m.from] = Math.min(GOAL, h.progress[m.from] + m.n);
              h.dirty = true;
              if (h.progress[m.from] >= GOAL) {
                h.winner = m.from;
                h.racing = false;
                send({ t: 'rr_final', winnerId: m.from, p: { ...h.progress } });
              }
            }
          }
          break;
        case 'rr_pos':
          setProgress(m.p);
          break;
        case 'rr_final':
          setProgress(m.p);
          setWinner(m.winnerId);
          setPhase('final');
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(m.winnerId === myId ? 40 : 15);
          }
          if (m.winnerId === myId) playWin();
          else playCorrect();
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown → race
  useEffect(() => {
    if (phase !== 'countdown') return;
    const iv = window.setInterval(() => {
      const left = startsAt - Date.now();
      setCountLeft(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        playCorrect();
        setPhase('race');
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, [phase, startsAt]);

  // Flush taps
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (tapBuf.current > 0) {
        send({ t: 'taps', n: tapBuf.current });
        tapBuf.current = 0;
      }
    }, 200);
    return () => window.clearInterval(iv);
  }, [send]);

  const tap = () => {
    if (phase !== 'race') return;
    tapBuf.current += 1;
    if (tapBuf.current % 4 === 0) playPop();
  };

  const myProgress = progress[myId] || 0;
  const racers = Object.keys(progress).length
    ? Object.keys(progress)
    : players.map((p) => p.id);
  const sorted = [...racers].sort((a, b) => (progress[b] || 0) - (progress[a] || 0));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-purple-950 text-white px-4 py-6 select-none">
      <div className="max-w-3xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🚀 Rocket Tap Race</h1>
        <p className="text-center font-nunito text-indigo-200 text-sm mb-5">
          Mash the button — first rocket to the moon wins!
        </p>

        {/* Race track */}
        <div className="bg-white/5 rounded-3xl border border-white/15 p-4 mb-5">
          <div className="flex justify-between items-center mb-2 font-fredoka text-sm text-indigo-200">
            <span>🌍 Launch pad</span>
            <span>🌕 The Moon</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {sorted.map((id) => {
              const p = byId(id);
              const pct = Math.min(100, ((progress[id] || 0) / GOAL) * 100);
              return (
                <div key={id} className="relative h-9 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ${id === myId ? 'bg-amber-400/40' : 'bg-indigo-500/30'}`}
                    style={{ width: `${pct}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 text-xl transition-all duration-200"
                    style={{ left: `calc(${pct}% - ${pct > 5 ? 14 : 0}px)` }}
                  >
                    🚀
                  </div>
                  <div className={`absolute left-2 top-1/2 -translate-y-1/2 font-nunito text-xs ${id === myId ? 'font-bold text-amber-300' : 'text-white/70'}`}>
                    {p.emoji} {p.name}
                  </div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-lg">🌕</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mash button */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onPointerDown={(e) => { e.preventDefault(); tap(); }}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: 'manipulation' }}
          disabled={phase !== 'race'}
          className={`w-full h-44 md:h-52 rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 shadow-2xl font-fredoka ${
            phase !== 'race' ? 'opacity-50' : 'active:brightness-110'
          }`}
        >
          <div className="text-5xl mb-2">🚀🔥</div>
          <div className="text-2xl md:text-3xl font-bold">{phase === 'race' ? 'TAP TO BLAST OFF!!!' : 'Get ready…'}</div>
          <div className="text-sm opacity-80 font-nunito mt-1">{Math.round((myProgress / GOAL) * 100)}% to the moon</div>
        </motion.button>
      </div>

      <AnimatePresence>
        {phase === 'countdown' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
            <motion.div
              key={countLeft}
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-fredoka font-bold text-8xl md:text-9xl text-amber-300"
              style={{ textShadow: '0 0 30px rgba(255,200,0,0.8)' }}
            >
              {countLeft > 0 ? countLeft : 'GO!'}
            </motion.div>
          </motion.div>
        )}

        {phase === 'final' && winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={80} durationMs={4000} />
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-indigo-800 to-purple-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full"
            >
              <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 0.7, repeat: Infinity }} className="text-7xl mb-3">
                🌕🚀
              </motion.div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
                {byId(winner).emoji} {byId(winner).name} reached the moon!
              </h2>
              <p className="font-fredoka text-green-300 mb-6">+{winner === myId ? 40 : 15} XP</p>
              {isHost ? (
                <div className="flex gap-3 justify-center">
                  <button onClick={hostRematch} className="px-6 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl">
                    Race Again! ⚡
                  </button>
                  <button onClick={() => { playClick(); send({ t: 'to_lobby' }); }} className="px-6 py-3 rounded-full font-fredoka font-bold bg-white/15 border border-white/30">
                    Lobby 🏠
                  </button>
                </div>
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

export default RocketTapRace;
