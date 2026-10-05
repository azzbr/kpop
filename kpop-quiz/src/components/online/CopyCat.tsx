import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameMsg, RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWrong, playWin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';
import { useHelloGate, useArenaFinish, placeOf } from '../../online/helloGate';
import {
  STEP_MS, showTime, inputTime, NET_GRACE_MS, READY_WAIT_MS, extendSeq, judgeRound, isOver, finalists,
  copyCatRanking,
} from './copyCatLogic';

// Watch the pattern, repeat it. One slip = out, last one standing wins.
// Each device plays the sequence with its own timers, then says cat_ready and gets its own
// full answer window from that moment, so a slow device isn't short-changed.

const PADS = [
  { emoji: '🥁', on: 'bg-rose-400', off: 'bg-rose-600/40' },
  { emoji: '🎸', on: 'bg-blue-400', off: 'bg-blue-600/40' },
  { emoji: '🎹', on: 'bg-amber-300', off: 'bg-amber-500/40' },
  { emoji: '🎤', on: 'bg-emerald-400', off: 'bg-emerald-600/40' },
];

type Phase = 'intro' | 'watch' | 'input' | 'submitted' | 'result' | 'final';

// Messages (all prefixed cat_)
type CatMsg = { from?: string } & (
  | { t: 'cat_seq'; round: number; seq: number[]; alive: string[]; to?: string; done?: boolean }
  | { t: 'cat_ready'; round: number }
  | { t: 'cat_input'; round: number; taps: number[] }
  | { t: 'cat_result'; round: number; out: string[]; alive: string[]; to?: string }
  | { t: 'cat_final'; ranked: (string | string[])[]; winners: string[]; round: number; to?: string }
);

const CopyCat: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { finish, reward } = useArenaFinish(room);

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [seq, setSeq] = useState<number[]>([]);
  const [activePad, setActivePad] = useState(-1);
  const [taps, setTaps] = useState<number[]>([]);
  const [aliveIds, setAliveIds] = useState<string[]>([]);
  const [lastOut, setLastOut] = useState<string[]>([]);
  const [winners, setWinners] = useState<string[] | null>(null);
  const [ranked, setRanked] = useState<(string | string[])[] | null>(null);
  const [answerEnds, setAnswerEnds] = useState(0);
  const [answerLeft, setAnswerLeft] = useState(0);
  const tapsRef = useRef<number[]>([]);
  const roundRef = useRef(0);
  const sentRef = useRef(false);

  const playersRef = useRef(players);
  playersRef.current = players;

  const iAmAlive = aliveIds.includes(myId);

  // Host-side authoritative state
  const hd = useRef({
    seq: [] as number[],
    round: 0,
    alive: [] as string[],
    outRound: {} as Record<string, number>,
    inputs: {} as Record<string, number[]>,
    ready: {} as Record<string, number>,
    readyWaitOver: false,
    deadline: 0,
    evaluated: true,
    stage: 'intro' as 'intro' | 'play' | 'result' | 'final',
    lastOut: [] as string[],
    ranked: null as (string | string[])[] | null,
    winners: [] as string[],
    timer: 0,
    readyTimer: 0,
    evalTimer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: 'Friend', emoji: '🙂', isHost: false, joinedAt: 0 };

  // ---- HOST ----
  const hostNextRound = () => {
    const h = hd.current;
    h.round += 1;
    h.seq = extendSeq(h.seq);
    h.inputs = {};
    h.ready = {};
    h.readyWaitOver = false;
    h.deadline = 0;
    h.evaluated = false;
    h.stage = 'play';
    send({ t: 'cat_seq', round: h.round, seq: h.seq, alive: [...h.alive] });
    window.clearTimeout(h.readyTimer);
    window.clearTimeout(h.evalTimer);
    h.readyTimer = window.setTimeout(() => {
      h.readyWaitOver = true;
      hostNoteReady(Date.now());
    }, showTime(h.seq.length) + READY_WAIT_MS);
  };

  // A device finished showing the sequence (or we stopped waiting for it).
  const hostNoteReady = (at: number) => {
    const h = hd.current;
    if (h.evaluated) return;
    h.deadline = Math.max(h.deadline, at + inputTime(h.seq.length) + NET_GRACE_MS);
    const allReady = h.alive.every((id) => h.ready[id] !== undefined);
    if (!allReady && !h.readyWaitOver) return;
    if (allReady) window.clearTimeout(h.readyTimer);
    window.clearTimeout(h.evalTimer);
    h.evalTimer = window.setTimeout(hostEvaluate, Math.max(0, h.deadline - Date.now()));
  };

  const hostEvaluate = () => {
    const h = hd.current;
    if (h.evaluated) return;
    h.evaluated = true;
    window.clearTimeout(h.evalTimer);
    window.clearTimeout(h.readyTimer);
    const { out, alive } = judgeRound(h.alive, h.inputs, h.seq);
    out.forEach((id) => (h.outRound[id] = h.round));
    h.lastOut = out;
    h.stage = 'result';
    send({ t: 'cat_result', round: h.round, out, alive });
    window.clearTimeout(h.timer);
    if (isOver(alive.length, h.round)) {
      h.winners = finalists(alive, out);
      h.alive = alive;
      h.timer = window.setTimeout(() => {
        h.stage = 'final';
        h.ranked = copyCatRanking(h.winners, h.outRound);
        send({ t: 'cat_final', ranked: h.ranked, winners: h.winners, round: h.round });
      }, 2200);
    } else {
      h.alive = alive;
      h.timer = window.setTimeout(hostNextRound, 2800);
    }
  };

  useHelloGate(room, 'cat', {
    onStart: () => {
      const h = hd.current;
      h.alive = playersRef.current.map((p) => p.id);
      h.alive.forEach((id) => (h.outRound[id] = 0));
      hostNextRound();
    },
    onHello: (from) => {
      const h = hd.current;
      if (h.stage === 'play') send({ t: 'cat_seq', to: from, round: h.round, seq: h.seq, alive: [...h.alive], done: h.inputs[from] !== undefined });
      else if (h.stage === 'result') send({ t: 'cat_result', to: from, round: h.round, out: h.lastOut, alive: h.alive });
      else if (h.stage === 'final' && h.ranked) send({ t: 'cat_final', to: from, ranked: h.ranked, winners: h.winners, round: h.round });
    },
  });

  const hostHandle = (m: CatMsg) => {
    const h = hd.current;
    if (!m.from || h.evaluated || m.round !== h.round || !h.alive.includes(m.from)) return;
    if (m.t === 'cat_ready' && h.ready[m.from] === undefined) {
      h.ready[m.from] = Date.now();
      hostNoteReady(Date.now());
    } else if (m.t === 'cat_input' && h.inputs[m.from] === undefined) {
      h.inputs[m.from] = Array.isArray(m.taps) ? m.taps.map(Number) : [];
      if (h.alive.every((id) => h.inputs[id] !== undefined)) hostEvaluate();
    }
  };

  // ---- EVERYONE ----
  const handle = (m: CatMsg) => {
    if (isHost) hostHandle(m);
    if ('to' in m && m.to && m.to !== myId) return;
    switch (m.t) {
      case 'cat_seq':
        roundRef.current = m.round;
        tapsRef.current = [];
        sentRef.current = !!m.done;
        setRound(m.round);
        setSeq(m.seq);
        setAliveIds(m.alive);
        setTaps([]);
        setLastOut([]);
        setPhase(m.done ? 'submitted' : 'watch');
        break;
      case 'cat_result':
        setRound(m.round);
        setLastOut(m.out);
        setAliveIds(m.alive);
        setPhase('result');
        if (m.out.includes(myId)) playWrong();
        else if (m.alive.includes(myId)) playCorrect();
        break;
      case 'cat_final':
        setRound(m.round);
        setWinners(m.winners);
        setRanked(m.ranked);
        setPhase('final');
        if (m.winners.includes(myId)) playWin();
        finish(m.ranked);
        break;
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    const off = onMessage((raw: GameMsg) => handleRef.current(raw as unknown as CatMsg));
    const h = hd.current;
    return () => {
      off();
      window.clearTimeout(h.timer);
      window.clearTimeout(h.readyTimer);
      window.clearTimeout(h.evalTimer);
    };
  }, [onMessage]);

  const submit = (list: number[]) => {
    if (sentRef.current) return;
    sentRef.current = true;
    send({ t: 'cat_input', round: roundRef.current, taps: list });
    setPhase('submitted');
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Watch phase: replay the sequence with lights, then my own answer window starts
  useEffect(() => {
    if (phase !== 'watch') return;
    let step = 0;
    setActivePad(-1);
    const iv = window.setInterval(() => {
      if (step >= seq.length * 2) {
        window.clearInterval(iv);
        setActivePad(-1);
        if (aliveIds.includes(myId)) {
          send({ t: 'cat_ready', round: roundRef.current });
          const ends = Date.now() + inputTime(seq.length);
          setAnswerEnds(ends);
          setAnswerLeft(Math.ceil(inputTime(seq.length) / 1000));
          setPhase('input');
        } else setPhase('submitted');
        return;
      }
      if (step % 2 === 0) {
        setActivePad(seq[step / 2]);
        playPop();
      } else {
        setActivePad(-1);
      }
      step += 1;
    }, STEP_MS);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, seq]);

  // My answer countdown; when it runs out, send what I have
  useEffect(() => {
    if (phase !== 'input') return;
    const iv = window.setInterval(() => {
      const left = answerEnds - Date.now();
      setAnswerLeft(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) submitRef.current(tapsRef.current);
    }, 200);
    return () => window.clearInterval(iv);
  }, [phase, answerEnds]);

  const tapPad = (i: number) => {
    if (phase !== 'input') return;
    playClick();
    setActivePad(i);
    window.setTimeout(() => setActivePad(-1), 180);
    const next = [...tapsRef.current, i];
    tapsRef.current = next;
    setTaps(next);
    if (next.length >= seq.length) submit(next);
  };

  const flatRank = ranked ? ranked.flatMap((r) => (Array.isArray(r) ? r : [r])) : [];

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-violet-950 via-purple-950 to-slate-950 text-white px-4 py-6 select-none"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">🧠 Copy Cat</h1>
        <p className="text-center font-nunito text-violet-200 text-lg mb-4">
          Watch the pattern… then repeat it perfectly. One slip and you're out!
        </p>

        {/* Status bar */}
        <div className="flex items-center justify-between font-fredoka text-lg mb-4 bg-white/10 rounded-full px-4 py-2">
          <span>Round {round || '—'}</span>
          <span className="text-amber-300">
            {phase === 'watch' ? '👀 WATCH…' : phase === 'input' ? `🎯 YOUR TURN! ${answerLeft}s` : phase === 'submitted' ? '⏳ waiting…' : ' '}
          </span>
          <span>💚 {aliveIds.length || players.length} left</span>
        </div>

        {/* Pads */}
        <div className="game-surface grid grid-cols-2 gap-3 md:gap-4 mb-4">
          {PADS.map((pad, i) => (
            <motion.button
              key={i}
              aria-label={`Pad ${i + 1}`}
              whileTap={phase === 'input' ? { scale: 0.93 } : {}}
              onPointerDown={(e) => { e.preventDefault(); tapPad(i); }}
              onContextMenu={(e) => e.preventDefault()}
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
            <div key={i} className={`w-4 h-4 rounded-full ${i < taps.length ? 'bg-amber-400' : 'bg-white/20'}`} />
          ))}
        </div>

        {phase === 'intro' && (
          <div className="text-center font-fredoka text-2xl bg-white/10 rounded-3xl p-5">🐱 Get ready to copy…</div>
        )}
        {!iAmAlive && aliveIds.length > 0 && phase !== 'final' && phase !== 'intro' && (
          <div className="text-center font-nunito text-lg bg-white/10 rounded-3xl p-4 text-violet-200">
            🙈 You're out this time — cheer on the others!
          </div>
        )}

        {/* Alive chips */}
        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
          {players.map((p) => {
            const alive = aliveIds.length === 0 || aliveIds.includes(p.id);
            return (
              <span key={p.id} className={`rounded-full px-3 py-1 text-base font-nunito ${alive ? 'bg-emerald-500/30' : 'bg-white/5 opacity-50 line-through'}`}>
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
              <div className="text-5xl mb-2">{lastOut.includes(myId) ? '🙈' : iAmAlive ? '✅' : '👀'}</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-2">
                {lastOut.includes(myId) ? 'Oops — you’re out! Great try!' : iAmAlive ? 'You survived!' : `Round ${round} done!`}
              </h2>
              {lastOut.length > 0 ? (
                <p className="font-nunito text-lg text-violet-200">
                  Out this round: {lastOut.map((id) => `${byId(id).emoji} ${byId(id).name}`).join(', ')}
                </p>
              ) : (
                <p className="font-nunito text-lg text-violet-200">Everyone survived — it gets longer! 😈</p>
              )}
            </motion.div>
          </motion.div>
        )}

        {phase === 'final' && winners && ranked && (
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
              <p className="font-nunito text-lg text-violet-200 mb-2">Memory of a champion — {round} rounds!</p>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-44 overflow-y-auto">
                {flatRank.slice(0, 10).map((id) => (
                  <div key={id} className={`font-nunito text-base py-0.5 ${id === myId ? 'text-amber-200 font-bold' : ''}`}>
                    #{placeOf(ranked, id)} {byId(id).emoji} {byId(id).name}
                  </div>
                ))}
              </div>
              {reward && <p className="font-fredoka text-lg text-green-300 mb-6">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="min-h-[52px] px-8 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-lg text-violet-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CopyCat;
