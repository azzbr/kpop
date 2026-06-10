import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWrong, playWin } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const KICKS = 10; // 5 each, then sudden death
const PICK_SECS = 9;
const DIRS = ['⬅️ Left', '⬆️ Middle', '➡️ Right'];

type Phase = 'intro' | 'pick' | 'result' | 'final';

const PenaltyDuel: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [n, setN] = useState(0);
  const [shooterId, setShooterId] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PICK_SECS);
  const [myPick, setMyPick] = useState<number | null>(null);
  const [result, setResult] = useState<{ shot: number; dive: number; goal: boolean; shooterId: string } | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [finalWinner, setFinalWinner] = useState<string | null>(null);
  const xpGiven = useRef(false);

  // Host-side authoritative state
  const hd = useRef({
    ids: [] as string[],
    n: 0,
    picks: {} as Record<string, number>,
    scores: {} as Record<string, number>,
    resolved: true,
    timer: 0,
  });

  const me = players.find((p) => p.id === myId);
  const opp = players.find((p) => p.id !== myId);
  const byId = (id: string | null) => players.find((p) => p.id === id);

  // ---- HOST: referee ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.ids = players.slice(0, 2).map((p) => p.id);
    h.ids.forEach((id) => (h.scores[id] = 0));
    const t = window.setTimeout(() => hostSendRound(1), 1800);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(hd.current.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostSendRound = (round: number) => {
    const h = hd.current;
    h.n = round;
    h.picks = {};
    h.resolved = false;
    const shooter = h.ids[(round - 1) % 2];
    send({ t: 'pd_round', n: round, shooterId: shooter, endsAt: Date.now() + PICK_SECS * 1000 });
    h.timer = window.setTimeout(() => hostResolve(), PICK_SECS * 1000 + 500);
  };

  const hostResolve = () => {
    const h = hd.current;
    if (h.resolved) return;
    h.resolved = true;
    window.clearTimeout(h.timer);
    const shooter = h.ids[(h.n - 1) % 2];
    const keeper = h.ids[h.n % 2];
    const shot = h.picks[shooter] ?? Math.floor(Math.random() * 3);
    const dive = h.picks[keeper] ?? Math.floor(Math.random() * 3);
    const goal = shot !== dive;
    if (goal) h.scores[shooter] = (h.scores[shooter] || 0) + 1;
    send({ t: 'pd_result', n: h.n, shooterId: shooter, shot, dive, goal, scores: { ...h.scores } });

    h.timer = window.setTimeout(() => {
      const [a, b] = h.ids;
      const done = h.n >= KICKS && h.n % 2 === 0 && h.scores[a] !== h.scores[b];
      if (done) {
        const w = h.scores[a] > h.scores[b] ? a : b;
        send({ t: 'pd_final', winnerId: w, scores: { ...h.scores } });
      } else {
        hostSendRound(h.n + 1);
      }
    }, 2800);
  };

  // ---- EVERYONE: messages ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      const h = hd.current;
      switch (m.t) {
        case 'pd_round':
          setPhase('pick');
          setN(m.n);
          setShooterId(m.shooterId);
          setEndsAt(m.endsAt);
          setMyPick(null);
          setResult(null);
          break;
        case 'pd_pick':
          if (isHost && !h.resolved && m.n === h.n && h.picks[m.from] === undefined) {
            h.picks[m.from] = m.dir;
            if (h.ids.every((id) => h.picks[id] !== undefined)) hostResolve();
          }
          break;
        case 'pd_result': {
          setPhase('result');
          setResult({ shot: m.shot, dive: m.dive, goal: m.goal, shooterId: m.shooterId });
          setScores(m.scores);
          const iShot = m.shooterId === myId;
          if ((iShot && m.goal) || (!iShot && !m.goal)) playCorrect();
          else playWrong();
          break;
        }
        case 'pd_final':
          setPhase('final');
          setScores(m.scores);
          setFinalWinner(m.winnerId);
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(m.winnerId === myId ? 40 : 15);
          }
          if (m.winnerId === myId) playWin();
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== 'pick') return;
    const iv = window.setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const pick = (dir: number) => {
    if (phase !== 'pick' || myPick !== null) return;
    playClick();
    setMyPick(dir);
    send({ t: 'pd_pick', n, dir });
  };

  const iAmShooter = shooterId === myId;
  const myScore = scores[myId] || 0;
  const oppScore = opp ? scores[opp.id] || 0 : 0;
  const suddenDeath = n > KICKS;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-900 via-emerald-900 to-green-950 text-white px-4 py-6 select-none">
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">⚽ Penalty Duel</h1>
        <p className="text-center font-nunito text-emerald-200 text-sm mb-5">
          Shooter picks a corner, keeper guesses — outsmart your rival!
        </p>

        {/* Scoreboard */}
        <div className="flex items-center justify-between mb-6 bg-white/10 rounded-3xl px-5 py-3 border border-white/15 font-fredoka">
          <div>
            <span className="text-2xl mr-1">{me?.emoji}</span>
            <span className="font-bold text-amber-300">{me?.name}</span>
            <span className="ml-2 text-3xl font-bold">{myScore}</span>
          </div>
          <div className="text-sm text-emerald-300">
            {phase === 'final' ? 'FULL TIME' : suddenDeath ? '☠️ SUDDEN DEATH' : n > 0 ? `Kick ${Math.min(n, KICKS)}/${KICKS}` : 'VS'}
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold mr-2">{oppScore}</span>
            <span className="font-bold text-cyan-300">{opp?.name || '…'}</span>
            <span className="text-2xl ml-1">{opp?.emoji}</span>
          </div>
        </div>

        {/* Pitch */}
        <div className="relative bg-gradient-to-b from-emerald-700 to-emerald-800 rounded-3xl border border-white/20 p-6 mb-5 overflow-hidden">
          {/* Goal */}
          <div className="mx-auto w-64 md:w-80 h-28 border-4 border-white/80 border-b-0 rounded-t-xl relative flex items-end justify-around"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 12px), repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 12px)' }}
          >
            {phase === 'result' && result ? (
              <>
                <AnimatePresence>
                  <motion.div
                    key={`ball-${n}`}
                    initial={{ y: 90, x: 0, scale: 0.6 }}
                    animate={{ y: result.goal ? 8 : 20, x: (result.shot - 1) * 90, scale: 1 }}
                    transition={{ duration: 0.5, type: 'spring' }}
                    className="absolute bottom-0 left-1/2 -ml-4 text-3xl"
                  >
                    ⚽
                  </motion.div>
                  <motion.div
                    key={`keeper-${n}`}
                    initial={{ x: 0 }}
                    animate={{ x: (result.dive - 1) * 85, rotate: (result.dive - 1) * 30 }}
                    transition={{ duration: 0.4 }}
                    className="absolute bottom-1 left-1/2 -ml-5 text-4xl"
                  >
                    🧤
                  </motion.div>
                </AnimatePresence>
              </>
            ) : (
              <div className="absolute bottom-1 left-1/2 -ml-5 text-4xl">🧤</div>
            )}
          </div>
          <div className="text-center text-3xl mt-3">{phase === 'result' ? '' : '⚽'}</div>

          {/* Result banner */}
          <div className="text-center font-fredoka font-bold text-2xl h-9 mt-1">
            {phase === 'result' && result && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={result.goal ? 'text-amber-300' : 'text-cyan-300'}>
                {result.goal ? '🥅 GOOOAL!' : '🧤 SAVED!'}
              </motion.span>
            )}
          </div>
        </div>

        {phase === 'intro' && (
          <div className="text-center font-fredoka text-xl bg-white/10 rounded-3xl p-6 border border-white/15">
            ⚽ Warming up… first kick coming!
          </div>
        )}

        {phase === 'pick' && (
          <div className="bg-white/10 rounded-3xl p-5 border border-white/15">
            <div className="text-center font-fredoka text-xl mb-1">
              {iAmShooter ? '⚽ YOU SHOOT — pick your corner!' : '🧤 YOU DIVE — guess their corner!'}
            </div>
            <div className="text-center font-nunito text-emerald-200 text-sm mb-4">⏱️ {timeLeft}s — pick secretly!</div>
            <div className="grid grid-cols-3 gap-3">
              {DIRS.map((d, i) => (
                <motion.button
                  key={i}
                  whileTap={myPick === null ? { scale: 0.92 } : {}}
                  onClick={() => pick(i)}
                  disabled={myPick !== null}
                  className={`rounded-2xl py-6 font-fredoka font-bold text-lg border-2 ${
                    myPick === i ? 'bg-amber-400/40 border-amber-300' : myPick !== null ? 'bg-white/5 border-white/10 opacity-40' : 'bg-white/10 border-white/25 hover:bg-white/20'
                  }`}
                >
                  {d}
                </motion.button>
              ))}
            </div>
            {myPick !== null && (
              <div className="text-center font-fredoka text-amber-300 mt-3">🤫 Locked in! Waiting for {opp?.name}…</div>
            )}
          </div>
        )}

        {phase === 'final' && (
          <div className="text-center bg-white/10 rounded-3xl p-8 border border-white/15 relative">
            {finalWinner === myId && <ConfettiBurst count={80} durationMs={4000} />}
            <div className="text-7xl mb-3">{finalWinner === myId ? '🏆' : '🥈'}</div>
            <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
              {finalWinner === myId ? 'YOU WIN THE SHOOTOUT!' : `${byId(finalWinner)?.name} wins!`}
            </h2>
            <p className="font-nunito text-emerald-200 mb-1">Final score: {myScore} — {oppScore}</p>
            <p className="font-fredoka text-green-300 mb-6">+{finalWinner === myId ? 40 : 15} XP</p>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default PenaltyDuel;
