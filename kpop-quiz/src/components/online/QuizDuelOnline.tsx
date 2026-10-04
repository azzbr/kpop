import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { pickQuestions } from '../../online/schoolQuestions';
import type { PreparedQ } from '../../online/schoolQuestions';
import { playClick, playCorrect, playWrong, playWin, playTick } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const ROUNDS = 7;
const SECS = 12;

type Phase = 'intro' | 'q' | 'result' | 'final';

const QuizDuelOnline: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [q, setQ] = useState<{ text: string; options: string[] } | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECS);
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const [myLocked, setMyLocked] = useState(false);
  const [oppLocked, setOppLocked] = useState(false);
  const [correctIdx, setCorrectIdx] = useState<number | null>(null);
  const [roundWinner, setRoundWinner] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [finalWinner, setFinalWinner] = useState<string | null>(null);
  const xpGiven = useRef(false);
  const lastTick = useRef(-1);

  // Host-side authoritative state
  const hd = useRef({
    qs: [] as PreparedQ[],
    round: 0,
    correct: -1,
    resolved: true,
    locked: {} as Record<string, boolean>,
    scores: {} as Record<string, number>,
    playerIds: [] as string[],
    timer: 0,
  });

  const me = players.find((p) => p.id === myId);
  const opp = players.find((p) => p.id !== myId);

  // ---- HOST: game loop ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.qs = pickQuestions('mix', ROUNDS);
    h.playerIds = players.slice(0, 2).map((p) => p.id);
    h.scores = {};
    h.playerIds.forEach((id) => (h.scores[id] = 0));
    const t = window.setTimeout(() => hostSendRound(1), 1500);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(h.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostSendRound = (r: number) => {
    const h = hd.current;
    if (r > ROUNDS) return;
    const pq = h.qs[r - 1];
    h.round = r;
    h.correct = pq.correct;
    h.resolved = false;
    h.locked = {};
    send({ t: 'q', round: r, text: pq.text, options: pq.options, endsAt: Date.now() + SECS * 1000 });
    h.timer = window.setTimeout(() => hostResolve(null), SECS * 1000 + 400);
  };

  const hostResolve = (winnerId: string | null) => {
    const h = hd.current;
    if (h.resolved) return;
    h.resolved = true;
    window.clearTimeout(h.timer);
    if (winnerId) h.scores[winnerId] = (h.scores[winnerId] || 0) + 100;
    send({ t: 'result', round: h.round, correct: h.correct, winnerId, scores: { ...h.scores } });
    h.timer = window.setTimeout(() => {
      if (h.round < ROUNDS) {
        hostSendRound(h.round + 1);
      } else {
        const [a, b] = h.playerIds;
        const w = (h.scores[a] || 0) > (h.scores[b] || 0) ? a : (h.scores[b] || 0) > (h.scores[a] || 0) ? b : null;
        send({ t: 'final', scores: { ...h.scores }, winnerId: w });
      }
    }, 2800);
  };

  // ---- EVERYONE: message handling ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      const h = hd.current;
      switch (m.t) {
        case 'q':
          if (m.round === 1) xpGiven.current = false;
          setPhase('q');
          setRound(m.round);
          setQ({ text: m.text, options: m.options });
          setEndsAt(m.endsAt);
          setMyChoice(null);
          setMyLocked(false);
          setOppLocked(false);
          setCorrectIdx(null);
          setRoundWinner(null);
          break;
        case 'ans':
          // Host judges answers (first correct wins; wrong = locked out)
          if (isHost && !h.resolved && m.round === h.round && !h.locked[m.from]) {
            if (m.choice === h.correct) {
              hostResolve(m.from);
            } else {
              h.locked[m.from] = true;
              send({ t: 'locked', playerId: m.from, round: h.round });
              if (h.playerIds.every((id) => h.locked[id])) hostResolve(null);
            }
          }
          break;
        case 'locked':
          if (m.playerId === myId) {
            setMyLocked(true);
            playWrong();
          } else {
            setOppLocked(true);
          }
          break;
        case 'result':
          setPhase('result');
          setCorrectIdx(m.correct);
          setRoundWinner(m.winnerId);
          setScores(m.scores);
          if (m.winnerId === myId) playCorrect();
          else if (m.winnerId) playWrong();
          break;
        case 'final':
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

  // Local countdown display
  useEffect(() => {
    if (phase !== 'q') return;
    const iv = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 3 && left > 0 && lastTick.current !== left) {
        lastTick.current = left;
        playTick();
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const answer = (idx: number) => {
    if (phase !== 'q' || myLocked || myChoice !== null) return;
    playClick();
    setMyChoice(idx);
    send({ t: 'ans', round, choice: idx });
  };

  const hostRematch = () => {
    playClick();
    const h = hd.current;
    h.qs = pickQuestions('mix', ROUNDS);
    h.scores = {};
    h.playerIds.forEach((id) => (h.scores[id] = 0));
    xpGiven.current = false;
    hostSendRound(1);
  };

  const myScore = scores[myId] || 0;
  const oppScore = opp ? scores[opp.id] || 0 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-950 via-purple-950 to-indigo-950 text-white px-4 py-6">
      <div className="max-w-2xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-4">⚔️ Quiz Duel</h1>

        {/* Scoreboard */}
        <div className="flex items-center justify-between mb-6 bg-white/10 rounded-3xl px-5 py-3 border border-white/15">
          <div className="font-fredoka">
            <span className="text-2xl mr-1">{me?.emoji}</span>
            <span className="font-bold text-pink-300">{me?.name} (you)</span>
            <span className="ml-2 text-amber-300 font-bold">{myScore}</span>
          </div>
          <div className="font-fredoka text-sm text-purple-300">
            {phase === 'q' || phase === 'result' ? `Round ${round}/${ROUNDS}` : 'VS'}
          </div>
          <div className="font-fredoka text-right">
            <span className="text-amber-300 font-bold mr-2">{oppScore}</span>
            <span className="font-bold text-blue-300">{opp?.name || '…'}</span>
            <span className="text-2xl ml-1">{opp?.emoji}</span>
          </div>
        </div>

        {phase === 'intro' && (
          <div className="text-center bg-white/10 rounded-3xl p-10 border border-white/15">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-6xl mb-4">
              ⚔️
            </motion.div>
            <div className="font-fredoka text-2xl">Get ready to duel!</div>
            <div className="font-nunito text-purple-200 mt-2">First correct answer steals the round. Wrong answer locks you out!</div>
          </div>
        )}

        {(phase === 'q' || phase === 'result') && q && (
          <div>
            {phase === 'q' && (
              <div className="mb-4">
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${timeLeft <= 3 ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-pink-500'}`}
                    style={{ width: `${(timeLeft / SECS) * 100}%` }}
                  />
                </div>
                <div className="text-center font-fredoka text-amber-300 mt-1">{timeLeft}s</div>
              </div>
            )}

            <div className="bg-white/10 rounded-3xl p-6 border border-white/15 mb-5">
              <div className="font-fredoka font-bold text-xl md:text-2xl text-center">{q.text}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {q.options.map((opt, i) => {
                const isCorrect = correctIdx === i;
                const isMine = myChoice === i;
                let cls = 'bg-white/10 border-white/20 hover:bg-white/20';
                if (phase === 'result') {
                  cls = isCorrect
                    ? 'bg-green-500/40 border-green-400'
                    : isMine
                    ? 'bg-red-500/40 border-red-400'
                    : 'bg-white/5 border-white/10 opacity-60';
                } else if (isMine) {
                  cls = 'bg-amber-400/30 border-amber-300';
                }
                return (
                  <motion.button
                    key={i}
                    whileTap={phase === 'q' && !myLocked ? { scale: 0.96 } : {}}
                    onClick={() => answer(i)}
                    disabled={phase !== 'q' || myLocked || myChoice !== null}
                    className={`rounded-2xl border-2 p-4 font-nunito font-bold text-left transition-all ${cls} ${myLocked && phase === 'q' ? 'opacity-40' : ''}`}
                  >
                    {opt}
                    {phase === 'result' && isCorrect && ' ✅'}
                  </motion.button>
                );
              })}
            </div>

            <div className="text-center mt-4 h-8 font-fredoka">
              {phase === 'q' && myLocked && <span className="text-red-300">😬 Wrong! You're locked out this round…</span>}
              {phase === 'q' && !myLocked && oppLocked && <span className="text-green-300">😎 {opp?.name} is locked out — take your time!</span>}
              {phase === 'q' && !myLocked && myChoice !== null && <span className="text-amber-300">⏳ Answer sent…</span>}
              {phase === 'result' && (
                <span className="text-amber-300 text-xl">
                  {roundWinner === myId ? '🔥 You stole the round! +100' : roundWinner ? `💨 ${opp?.name} stole it!` : '😴 Nobody got it!'}
                </span>
              )}
            </div>
          </div>
        )}

        {phase === 'final' && (
          <div className="text-center bg-white/10 rounded-3xl p-8 border border-white/15 relative">
            {finalWinner === myId && <ConfettiBurst count={80} durationMs={4000} />}
            <div className="text-7xl mb-3">{finalWinner === myId ? '🏆' : finalWinner ? '💪' : '🤝'}</div>
            <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
              {finalWinner === myId ? 'YOU WIN THE DUEL!' : finalWinner ? `${opp?.name} wins!` : "It's a TIE!"}
            </h2>
            <p className="font-nunito text-purple-200 mb-1">
              Final score: {myScore} — {oppScore}
            </p>
            <p className="font-fredoka text-green-300 mb-6">+{finalWinner === myId ? 40 : 15} XP</p>
            {isHost ? (
              <div className="flex gap-3 justify-center">
                <button onClick={hostRematch} className="px-6 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl">
                  Rematch! ⚡
                </button>
                <button onClick={() => { playClick(); send({ t: 'to_lobby' }); }} className="px-6 py-3 rounded-full font-fredoka font-bold bg-white/15 border border-white/30">
                  Back to Lobby 🏠
                </button>
              </div>
            ) : (
              <div className="font-nunito text-purple-300">Waiting for the host…</div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'result' && roundWinner === myId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0">
            <ConfettiBurst count={30} durationMs={1500} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuizDuelOnline;
