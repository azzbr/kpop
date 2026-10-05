import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameMsg, RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWrong, playWin } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';
import { useHelloGate, useArenaFinish, msLeft } from '../../online/helloGate';
import {
  KICKS, PICK_MS, shooterFor, keeperFor, isGoal, validDir, shootoutResult, penaltyRanking,
} from './penaltyDuelLogic';

const DIR_LABELS = ['⬅️ Left', '⬆️ Middle', '➡️ Right'];
const RESULT_MS = 2800;

type Phase = 'intro' | 'pick' | 'result' | 'final';

interface KickResult { n: number; shooterId: string; shot: number; dive: number; goal: boolean; auto: string[] }
interface FinalInfo { ranked: (string | string[])[]; result: string; scores: Record<string, number> }

// Messages (all prefixed pen_)
type PenMsg = { from?: string } & (
  | { t: 'pen_round'; n: number; shooterId: string; ms: number }
  | { t: 'pen_pick'; n: number; dir: number }
  | ({ t: 'pen_result'; scores: Record<string, number> } & KickResult)
  | ({ t: 'pen_final' } & FinalInfo)
  | {
      t: 'pen_sync'; to: string; ids: string[]; n: number; shooterId: string; ms: number; picked: boolean;
      scores: Record<string, number>; last?: KickResult; final?: FinalInfo;
    }
);

const PenaltyDuel: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { finish, reward } = useArenaFinish(room);

  const [phase, setPhase] = useState<Phase>('intro');
  const [n, setN] = useState(0);
  const [shooterId, setShooterId] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(PICK_MS / 1000));
  const [myPick, setMyPick] = useState<number | null>(null); // -1 = picked on an earlier load
  const [result, setResult] = useState<KickResult | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [final, setFinal] = useState<FinalInfo | null>(null);

  const playersRef = useRef(players);
  playersRef.current = players;

  // Host-side authoritative state
  const hd = useRef({
    ids: [] as string[],
    n: 0,
    picks: {} as Record<string, number>,
    scores: {} as Record<string, number>,
    resolved: true,
    endsAt: 0,
    last: undefined as KickResult | undefined,
    final: undefined as FinalInfo | undefined,
    timer: 0,
  });

  const me = players.find((p) => p.id === myId);
  const opp = players.find((p) => p.id !== myId);
  const byId = (id: string | null) => players.find((p) => p.id === id);

  // ---- HOST: referee ----
  const hostSendRound = (round: number) => {
    const h = hd.current;
    h.n = round;
    h.picks = {};
    h.resolved = false;
    h.endsAt = Date.now() + PICK_MS;
    send({ t: 'pen_round', n: round, shooterId: shooterFor(round, h.ids), ms: PICK_MS });
    window.clearTimeout(h.timer);
    h.timer = window.setTimeout(hostResolve, PICK_MS + 500);
  };

  const hostResolve = () => {
    const h = hd.current;
    if (h.resolved) return;
    h.resolved = true;
    window.clearTimeout(h.timer);
    const shooter = shooterFor(h.n, h.ids);
    const keeper = keeperFor(h.n, h.ids);
    const auto = [shooter, keeper].filter((id) => h.picks[id] === undefined);
    const shot = h.picks[shooter] ?? Math.floor(Math.random() * 3);
    const dive = h.picks[keeper] ?? Math.floor(Math.random() * 3);
    const goal = isGoal(shot, dive);
    if (goal) h.scores[shooter] = (h.scores[shooter] || 0) + 1;
    h.last = { n: h.n, shooterId: shooter, shot, dive, goal, auto };
    send({ t: 'pen_result', ...h.last, scores: { ...h.scores } });

    h.timer = window.setTimeout(() => {
      const res = shootoutResult(h.n, h.scores, h.ids);
      if (res) {
        h.final = { ranked: penaltyRanking(res, h.ids), result: res, scores: { ...h.scores } };
        send({ t: 'pen_final', ...h.final });
      } else {
        hostSendRound(h.n + 1);
      }
    }, RESULT_MS);
  };

  useHelloGate(room, 'pen', {
    onStart: () => {
      const h = hd.current;
      h.ids = playersRef.current.slice(0, 2).map((p) => p.id);
      h.ids.forEach((id) => (h.scores[id] = 0));
      hostSendRound(1);
    },
    onHello: (from) => {
      const h = hd.current;
      send({
        t: 'pen_sync', to: from, ids: h.ids, n: h.n, shooterId: shooterFor(h.n, h.ids), ms: h.resolved ? 0 : msLeft(h.endsAt),
        picked: h.picks[from] !== undefined, scores: { ...h.scores }, last: h.resolved ? h.last : undefined, final: h.final,
      });
    },
  });

  const hostHandle = (m: PenMsg) => {
    const h = hd.current;
    if (m.t !== 'pen_pick' || !m.from || h.resolved || m.n !== h.n || !h.ids.includes(m.from)) return;
    if (h.picks[m.from] !== undefined || !validDir(m.dir)) return;
    h.picks[m.from] = m.dir;
    if (h.ids.every((id) => h.picks[id] !== undefined)) hostResolve();
  };

  // ---- EVERYONE: messages ----
  const startPick = (round: number, shooter: string, ms: number, picked: boolean) => {
    setPhase('pick');
    setN(round);
    setShooterId(shooter);
    setEndsAt(Date.now() + ms);
    setTimeLeft(Math.ceil(ms / 1000));
    setMyPick(picked ? -1 : null);
    setResult(null);
  };

  const showResult = (r: KickResult) => {
    setPhase('result');
    setN(r.n);
    setShooterId(r.shooterId);
    setResult(r);
    const iShot = r.shooterId === myId;
    if ((iShot && r.goal) || (!iShot && !r.goal)) playCorrect();
    else playWrong();
  };

  const showFinal = (f: FinalInfo) => {
    setPhase('final');
    setScores(f.scores);
    setFinal(f);
    if (f.result === myId) playWin();
    finish(f.ranked);
  };

  const handle = (m: PenMsg) => {
    if (isHost) hostHandle(m);
    switch (m.t) {
      case 'pen_round':
        startPick(m.n, m.shooterId, m.ms, false);
        break;
      case 'pen_result':
        setScores(m.scores);
        showResult(m);
        break;
      case 'pen_final':
        showFinal(m);
        break;
      case 'pen_sync':
        if (m.to !== myId || m.n === 0) break;
        setScores(m.scores);
        if (m.final) showFinal(m.final);
        else if (m.last) showResult(m.last);
        else startPick(m.n, m.shooterId, m.ms, m.picked);
        break;
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    const off = onMessage((raw: GameMsg) => handleRef.current(raw as unknown as PenMsg));
    const h = hd.current;
    return () => {
      off();
      window.clearTimeout(h.timer);
    };
  }, [onMessage]);

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
    send({ t: 'pen_pick', n, dir });
  };

  const iAmShooter = shooterId === myId;
  const myScore = scores[myId] || 0;
  const oppScore = opp ? scores[opp.id] || 0 : 0;
  const suddenDeath = n > KICKS;
  const iWon = final?.result === myId;
  const draw = final?.result === 'draw';
  const autoMine = !!result?.auto.includes(myId);

  return (
    <div className="min-h-screen-d bg-gradient-to-b from-sky-900 via-emerald-900 to-green-950 text-white px-4 py-6 select-none"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">⚽ Penalty Duel</h1>
        <p className="text-center font-nunito text-emerald-200 text-lg mb-5">
          Shooter picks a corner, keeper guesses — outsmart your rival!
        </p>

        {/* Scoreboard */}
        <div className="flex items-center justify-between mb-6 bg-white/10 rounded-3xl px-5 py-3 border border-white/15 font-fredoka">
          <div>
            <span className="text-2xl mr-1">{me?.emoji}</span>
            <span className="font-bold text-lg text-amber-300">{me?.name}</span>
            <span className="ml-2 text-3xl font-bold">{myScore}</span>
          </div>
          <div className="text-base text-emerald-300 text-center">
            {phase === 'final' ? 'FULL TIME' : suddenDeath ? '⚡ SUDDEN DEATH' : n > 0 ? `Kick ${Math.min(n, KICKS)}/${KICKS}` : 'VS'}
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold mr-2">{oppScore}</span>
            <span className="font-bold text-lg text-cyan-300">{opp?.name || '…'}</span>
            <span className="text-2xl ml-1">{opp?.emoji}</span>
          </div>
        </div>

        {/* Pitch */}
        <div className="relative bg-gradient-to-b from-emerald-700 to-emerald-800 rounded-3xl border border-white/20 p-6 mb-5 overflow-hidden">
          <div className="mx-auto w-64 md:w-80 h-28 border-4 border-white/80 border-b-0 rounded-t-xl relative flex items-end justify-around"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 12px), repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 12px)' }}
          >
            {phase === 'result' && result ? (
              <AnimatePresence>
                <motion.div
                  key={`ball-${result.n}`}
                  initial={{ y: 90, x: 0, scale: 0.6 }}
                  animate={{ y: result.goal ? 8 : 20, x: (result.shot - 1) * 90, scale: 1 }}
                  transition={{ duration: 0.5, type: 'spring' }}
                  className="absolute bottom-0 left-1/2 -ml-4 text-3xl"
                >
                  ⚽
                </motion.div>
                <motion.div
                  key={`keeper-${result.n}`}
                  initial={{ x: 0 }}
                  animate={{ x: (result.dive - 1) * 85, rotate: (result.dive - 1) * 30 }}
                  transition={{ duration: 0.4 }}
                  className="absolute bottom-1 left-1/2 -ml-5 text-4xl"
                >
                  🧤
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="absolute bottom-1 left-1/2 -ml-5 text-4xl">🧤</div>
            )}
          </div>
          <div className="text-center text-3xl mt-3">{phase === 'result' ? '' : '⚽'}</div>

          {/* Result banner */}
          <div className="text-center font-fredoka font-bold text-2xl min-h-[2.25rem] mt-1">
            {phase === 'result' && result && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={result.goal ? 'text-amber-300' : 'text-cyan-300'}>
                {result.goal ? '🥅 GOOOAL!' : '🧤 SAVED!'}
              </motion.span>
            )}
          </div>
          {phase === 'result' && autoMine && (
            <div className="text-center font-nunito text-lg text-amber-100 mt-1">⏰ Time ran out, so we picked a corner for you — be quick next time!</div>
          )}
        </div>

        {phase === 'intro' && (
          <div className="text-center font-fredoka text-2xl bg-white/10 rounded-3xl p-6 border border-white/15">
            ⚽ Warming up… first kick coming!
          </div>
        )}

        {phase === 'pick' && (
          <div className="bg-white/10 rounded-3xl p-5 border border-white/15">
            <div className="text-center font-fredoka text-2xl mb-1">
              {iAmShooter ? '⚽ YOU SHOOT — pick your corner!' : '🧤 YOU DIVE — guess their corner!'}
            </div>
            <div className="text-center font-nunito text-emerald-200 text-lg mb-4">⏱️ {timeLeft}s — pick secretly!</div>
            <div className="grid grid-cols-3 gap-3">
              {DIR_LABELS.map((d, i) => (
                <motion.button
                  key={i}
                  whileTap={myPick === null ? { scale: 0.92 } : {}}
                  onClick={() => pick(i)}
                  disabled={myPick !== null}
                  className={`min-h-[64px] rounded-2xl py-6 font-fredoka font-bold text-xl border-2 ${
                    myPick === i ? 'bg-amber-400/40 border-amber-300' : myPick !== null ? 'bg-white/5 border-white/10 opacity-40' : 'bg-white/10 border-white/25'
                  }`}
                >
                  {d}
                </motion.button>
              ))}
            </div>
            {myPick !== null && (
              <div className="text-center font-fredoka text-lg text-amber-300 mt-3">🤫 Locked in! Waiting for {opp?.name}…</div>
            )}
          </div>
        )}

        {phase === 'final' && final && (
          <div className="text-center bg-white/10 rounded-3xl p-8 border border-white/15 relative">
            <ConfettiBurst count={80} durationMs={4000} />
            <div className="text-7xl mb-3">{iWon ? '🏆' : draw ? '🤝' : '🥈'}</div>
            <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
              {iWon ? 'YOU WIN THE SHOOTOUT!' : draw ? 'It’s a draw — what a battle!' : `${byId(final.result)?.name ?? 'Your rival'} wins — great game!`}
            </h2>
            <p className="font-nunito text-lg text-emerald-200 mb-1">Final score: {myScore} — {oppScore}</p>
            {reward && <p className="font-fredoka text-lg text-green-300 mb-6">+{reward.xp} XP · +{reward.coins} 🪙</p>}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default PenaltyDuel;
