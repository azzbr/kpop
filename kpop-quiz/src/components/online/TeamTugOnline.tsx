import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const WIN_SCORE = 2; // best of 3
const PULL = 2.2; // % per tap, divided by team size
const LEFT_GOAL = 8;
const RIGHT_GOAL = 92;
const COUNTDOWN_MS = 3500;

const TEAM_INFO = [
  { name: 'Pink Sparks', heart: '💗', text: 'text-pink-300', grad: 'from-pink-500 to-rose-600' },
  { name: 'Blue Thunder', heart: '💙', text: 'text-blue-300', grad: 'from-blue-500 to-indigo-600' },
];

type Phase = 'wait' | 'countdown' | 'battle' | 'round_end' | 'final';

const TeamTugOnline: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('wait');
  const [teams, setTeams] = useState<Record<string, 0 | 1>>({});
  const [pos, setPos] = useState(50);
  const [scores, setScores] = useState([0, 0]);
  const [round, setRound] = useState(1);
  const [startsAt, setStartsAt] = useState(0);
  const [countLeft, setCountLeft] = useState(3);
  const [roundWinner, setRoundWinner] = useState<0 | 1 | null>(null);
  const [matchWinner, setMatchWinner] = useState<0 | 1 | null>(null);
  const xpGiven = useRef(false);
  const tapBuf = useRef(0);

  // Host-side authoritative state
  const hd = useRef({
    teams: {} as Record<string, 0 | 1>,
    sizes: [1, 1],
    pos: 50,
    lastSent: 50,
    buf: [0, 0],
    scores: [0, 0],
    round: 1,
    battling: false,
    startsAt: 0,
    tick: 0,
    timer: 0,
  });

  const myTeam: 0 | 1 | undefined = teams[myId];

  // ---- HOST: setup + tick loop ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    const map: Record<string, 0 | 1> = {};
    players.forEach((p, i) => {
      map[p.id] = (i % 2) as 0 | 1;
    });
    h.teams = map;
    h.sizes = [
      Math.max(1, Object.values(map).filter((t) => t === 0).length),
      Math.max(1, Object.values(map).filter((t) => t === 1).length),
    ];

    const begin = (r: number) => {
      h.round = r;
      h.pos = 50;
      h.lastSent = 50;
      h.buf = [0, 0];
      h.startsAt = Date.now() + COUNTDOWN_MS;
      h.battling = true;
      send({ t: 'round_start', round: r, teams: h.teams, scores: [...h.scores], startsAt: h.startsAt });
    };

    const timer = window.setTimeout(() => begin(1), 1000);

    h.tick = window.setInterval(() => {
      if (!h.battling || Date.now() < h.startsAt) return;
      if (h.buf[0] || h.buf[1]) {
        h.pos -= (h.buf[0] * PULL) / h.sizes[0];
        h.pos += (h.buf[1] * PULL) / h.sizes[1];
        h.pos = Math.max(0, Math.min(100, h.pos));
        h.buf = [0, 0];
      }
      if (Math.abs(h.pos - h.lastSent) > 0.05) {
        h.lastSent = h.pos;
        send({ t: 'pos', pos: h.pos });
      }
      const w: 0 | 1 | null = h.pos <= LEFT_GOAL ? 0 : h.pos >= RIGHT_GOAL ? 1 : null;
      if (w !== null) {
        h.battling = false;
        h.scores[w] += 1;
        send({ t: 'round_end', team: w, scores: [...h.scores], pos: h.pos });
        if (h.scores[w] >= WIN_SCORE) {
          h.timer = window.setTimeout(() => send({ t: 'final', team: w, scores: [...h.scores] }), 2200);
        } else {
          h.timer = window.setTimeout(() => begin(h.round + 1), 2600);
        }
      }
    }, 130);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(h.tick);
      window.clearTimeout(h.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Host rematch (after final)
  const hostRematch = () => {
    playClick();
    const h = hd.current;
    h.scores = [0, 0];
    xpGiven.current = false;
    h.round = 1;
    h.pos = 50;
    h.lastSent = 50;
    h.buf = [0, 0];
    h.startsAt = Date.now() + COUNTDOWN_MS;
    h.battling = true;
    send({ t: 'rematch' });
    send({ t: 'round_start', round: 1, teams: h.teams, scores: [0, 0], startsAt: h.startsAt });
  };

  // ---- EVERYONE: message handling ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      const h = hd.current;
      switch (m.t) {
        case 'round_start':
          setTeams(m.teams);
          setRound(m.round);
          setScores(m.scores);
          setPos(50);
          setRoundWinner(null);
          setStartsAt(m.startsAt);
          setPhase('countdown');
          break;
        case 'pos':
          setPos(m.pos);
          break;
        case 'taps':
          if (isHost && h.battling && Date.now() >= h.startsAt) {
            const team = h.teams[m.from];
            if (team !== undefined) h.buf[team] += m.n;
          }
          break;
        case 'round_end':
          setPos(m.pos);
          setScores(m.scores);
          setRoundWinner(m.team);
          setPhase('round_end');
          playCorrect();
          break;
        case 'rematch':
          setMatchWinner(null);
          break;
        case 'final':
          setScores(m.scores);
          setMatchWinner(m.team);
          setPhase('final');
          playWin();
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown → battle transition (local, synced by startsAt timestamp)
  useEffect(() => {
    if (phase !== 'countdown') return;
    const iv = window.setInterval(() => {
      const left = startsAt - Date.now();
      setCountLeft(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        playCorrect();
        setPhase('battle');
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, [phase, startsAt]);

  // Flush my taps to the host 5×/second
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (tapBuf.current > 0) {
        send({ t: 'taps', n: tapBuf.current });
        tapBuf.current = 0;
      }
    }, 200);
    return () => window.clearInterval(iv);
  }, [send]);

  // XP once per match
  useEffect(() => {
    if (phase === 'final' && matchWinner !== null && !xpGiven.current) {
      xpGiven.current = true;
      addXP(myTeam === matchWinner ? 40 : 15);
    }
  }, [phase, matchWinner, myTeam, addXP]);

  const tap = () => {
    if (phase !== 'battle' || myTeam === undefined) return;
    tapBuf.current += 1;
    if (tapBuf.current % 3 === 0) playPop();
  };

  const roster = (team: 0 | 1) =>
    players.filter((p) => teams[p.id] === team);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 text-white px-4 py-6 select-none">
      <div className="max-w-5xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🪢 Team Tug-of-War</h1>
        <p className="text-center font-nunito text-purple-200 mb-5">
          {phase === 'wait' ? 'Setting up teams…' : `Round ${round} · first team to ${WIN_SCORE} ⭐`}
        </p>

        {/* Team rosters */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {([0, 1] as const).map((team) => (
            <div key={team} className={`rounded-3xl p-3 border ${team === 0 ? 'bg-pink-500/15 border-pink-400/40' : 'bg-blue-500/15 border-blue-400/40'}`}>
              <div className={`font-fredoka font-bold mb-2 ${TEAM_INFO[team].text}`}>
                {TEAM_INFO[team].heart} {TEAM_INFO[team].name} {'⭐'.repeat(scores[team])}
              </div>
              <div className="flex flex-wrap gap-1">
                {roster(team).map((p) => (
                  <span key={p.id} className={`text-xs font-nunito rounded-full px-2 py-1 ${p.id === myId ? 'bg-amber-400/40 font-bold' : 'bg-white/10'}`}>
                    {p.emoji} {p.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Track */}
        <div className="relative h-24 md:h-28 rounded-full bg-white/10 border-2 border-white/20 overflow-hidden mb-6">
          <div className="absolute inset-y-0 left-0 w-[10%] bg-gradient-to-r from-pink-500/80 to-transparent flex items-center justify-center text-2xl">🚩</div>
          <div className="absolute inset-y-0 right-0 w-[10%] bg-gradient-to-l from-blue-500/80 to-transparent flex items-center justify-center text-2xl">🚩</div>
          <div className="absolute inset-y-2 left-1/2 w-0.5 bg-white/30 -translate-x-1/2" />
          <div className="absolute top-1/2 left-[5%] right-[5%] h-2 -translate-y-1/2 bg-gradient-to-r from-pink-400 via-amber-300 to-blue-400 rounded-full opacity-60" />
          <div
            className="absolute top-1/2 text-5xl md:text-6xl"
            style={{
              left: `${pos}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 140ms linear',
              filter: 'drop-shadow(0 0 12px rgba(255, 220, 100, 0.9))',
            }}
          >
            🌟
          </div>
        </div>

        {/* Mash button */}
        {myTeam !== undefined ? (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onPointerDown={(e) => { e.preventDefault(); tap(); }}
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: 'manipulation' }}
            disabled={phase !== 'battle'}
            className={`w-full h-44 md:h-56 rounded-3xl bg-gradient-to-br ${TEAM_INFO[myTeam].grad} shadow-2xl font-fredoka ${phase !== 'battle' ? 'opacity-50' : 'active:brightness-110'}`}
          >
            <div className="text-4xl md:text-5xl mb-2">{myTeam === 0 ? '👈🌟' : '🌟👉'}</div>
            <div className="text-2xl md:text-3xl font-bold">PULL FOR {TEAM_INFO[myTeam].name.toUpperCase()}!</div>
            <div className="text-sm md:text-base opacity-80 font-nunito mt-1">
              {phase === 'battle' ? 'TAP TAP TAP!!!' : 'wait for it…'}
            </div>
          </motion.button>
        ) : (
          <div className="text-center font-nunito text-purple-200 bg-white/10 rounded-3xl p-6">
            👀 You joined after the match started — cheer them on and play next round!
          </div>
        )}
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
              {countLeft > 0 ? countLeft : 'PULL!'}
            </motion.div>
          </motion.div>
        )}

        {phase === 'round_end' && roundWinner !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
            <motion.div
              initial={{ scale: 0.5, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260 }}
              className="bg-gradient-to-br from-purple-800 to-fuchsia-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm mx-4"
            >
              <div className="text-6xl mb-3">{TEAM_INFO[roundWinner].heart}</div>
              <h2 className="font-fredoka font-bold text-3xl mb-2 text-amber-300">
                {TEAM_INFO[roundWinner].name} take the round! ⭐
              </h2>
              <p className="font-nunito text-purple-200">{scores[0]} — {scores[1]} · next round starting…</p>
            </motion.div>
          </motion.div>
        )}

        {phase === 'final' && matchWinner !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
            <ConfettiBurst count={80} durationMs={4000} />
            <motion.div
              initial={{ scale: 0.5, rotate: -4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-purple-800 to-fuchsia-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm mx-4"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.4 }}
                className="text-7xl mb-3"
              >
                🏆
              </motion.div>
              <h2 className="font-fredoka font-bold text-3xl mb-1 text-amber-300">
                {TEAM_INFO[matchWinner].name} WIN!
              </h2>
              <p className="font-nunito text-purple-200 mb-2">{scores[0]} — {scores[1]}</p>
              <p className="font-fredoka text-green-300 mb-6">
                {myTeam === matchWinner ? '+40 XP! 🎉' : myTeam !== undefined ? '+15 XP — so close!' : 'What a match!'}
              </p>
              {isHost ? (
                <div className="flex gap-3 justify-center">
                  <button onClick={hostRematch} className="px-6 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl">
                    Rematch! ⚡
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

export default TeamTugOnline;
