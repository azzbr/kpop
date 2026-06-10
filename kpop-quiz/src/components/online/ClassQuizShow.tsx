import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { easyQuestions, normalQuestions, hardQuestions } from '../../quizData';
import { playClick, playCorrect, playWrong, playWin } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const TOTAL_Q = 10;
const SECS = 20;

const ANSWER_STYLES = [
  { shape: '▲', bg: 'from-red-500 to-rose-600' },
  { shape: '◆', bg: 'from-blue-500 to-indigo-600' },
  { shape: '●', bg: 'from-amber-400 to-orange-500' },
  { shape: '■', bg: 'from-emerald-500 to-green-600' },
];

interface PreparedQ {
  text: string;
  options: string[];
  correct: number;
}

function prepareQuestions(): PreparedQ[] {
  return [...easyQuestions, ...normalQuestions, ...hardQuestions]
    .sort(() => Math.random() - 0.5)
    .slice(0, TOTAL_Q)
    .map((q) => {
      const answers = [...q.answers].sort(() => Math.random() - 0.5);
      return {
        text: q.questionText,
        options: answers.map((a) => a.answerText),
        correct: answers.findIndex((a) => a.isCorrect),
      };
    });
}

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}

type Phase = 'intro' | 'q' | 'reveal' | 'podium';

const ClassQuizShow: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [n, setN] = useState(0);
  const [q, setQ] = useState<{ text: string; options: string[] } | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECS);
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [reveal, setReveal] = useState<{ correct: number; counts: number[]; gained: Record<string, number>; scores: Record<string, number>; top: TopEntry[] } | null>(null);
  const [podium, setPodium] = useState<TopEntry[] | null>(null);
  const xpGiven = useRef(false);

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Host-side authoritative state
  const hd = useRef({
    qs: [] as PreparedQ[],
    n: 0,
    correct: -1,
    endsAt: 0,
    answers: {} as Record<string, { choice: number; ms: number }>,
    scores: {} as Record<string, number>,
    revealed: true,
    timer: 0,
  });

  useEffect(() => {
    if (!isHost) return;
    hd.current.qs = prepareQuestions();
    return () => window.clearTimeout(hd.current.timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const students = players.filter((p) => !p.isHost);

  const hostTop = (h: typeof hd.current, limit: number): TopEntry[] =>
    Object.entries(h.scores)
      .map(([id, score]) => {
        const p = playersRef.current.find((x) => x.id === id);
        return { id, name: p?.name || '???', emoji: p?.emoji || '👻', score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

  const hostReveal = () => {
    const h = hd.current;
    if (h.revealed) return;
    h.revealed = true;
    window.clearTimeout(h.timer);
    const counts = [0, 0, 0, 0];
    const gained: Record<string, number> = {};
    Object.entries(h.answers).forEach(([id, a]) => {
      counts[a.choice] += 1;
      if (a.choice === h.correct) {
        const speedFrac = Math.max(0, (SECS * 1000 - a.ms) / (SECS * 1000));
        gained[id] = 500 + Math.round(500 * speedFrac);
        h.scores[id] = (h.scores[id] || 0) + gained[id];
      } else {
        gained[id] = 0;
        h.scores[id] = h.scores[id] || 0;
      }
    });
    send({ t: 'reveal', n: h.n, correct: h.correct, counts, gained, scores: { ...h.scores }, top: hostTop(h, 8) });
  };

  const hostSendQ = (num: number) => {
    const h = hd.current;
    const pq = h.qs[num - 1];
    h.n = num;
    h.correct = pq.correct;
    h.answers = {};
    h.revealed = false;
    h.endsAt = Date.now() + SECS * 1000;
    send({ t: 'q', n: num, total: TOTAL_Q, text: pq.text, options: pq.options, endsAt: h.endsAt });
    h.timer = window.setTimeout(hostReveal, SECS * 1000 + 400);
  };

  const hostNext = () => {
    playClick();
    const h = hd.current;
    if (h.n < TOTAL_Q) hostSendQ(h.n + 1);
    else send({ t: 'podium', top: hostTop(h, 50) });
  };

  // ---- EVERYONE: message handling ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      const h = hd.current;
      switch (m.t) {
        case 'q':
          setPhase('q');
          setN(m.n);
          setQ({ text: m.text, options: m.options });
          setEndsAt(m.endsAt);
          setMyChoice(null);
          setAnsweredIds([]);
          setReveal(null);
          break;
        case 'ans':
          if (isHost && !h.revealed && m.n === h.n && !h.answers[m.from]) {
            const sender = playersRef.current.find((p) => p.id === m.from);
            if (sender && !sender.isHost) {
              const ms = Math.min(SECS * 1000, Math.max(0, Date.now() - (h.endsAt - SECS * 1000)));
              h.answers[m.from] = { choice: m.choice, ms };
              send({ t: 'answered', playerId: m.from, n: h.n });
              const studs = playersRef.current.filter((p) => !p.isHost);
              if (studs.every((p) => h.answers[p.id] !== undefined)) hostReveal();
            }
          }
          break;
        case 'answered':
          setAnsweredIds((ids) => (ids.includes(m.playerId) ? ids : [...ids, m.playerId]));
          break;
        case 'reveal':
          setPhase('reveal');
          setReveal({ correct: m.correct, counts: m.counts, gained: m.gained, scores: m.scores, top: m.top });
          if (!isHost) {
            if ((m.gained[myId] || 0) > 0) playCorrect();
            else playWrong();
          }
          break;
        case 'podium':
          setPhase('podium');
          setPodium(m.top);
          playWin();
          if (!xpGiven.current) {
            xpGiven.current = true;
            if (isHost) {
              addXP(20);
            } else {
              const rank = (m.top as TopEntry[]).findIndex((e) => e.id === myId);
              addXP(rank >= 0 && rank < 3 ? 30 : 15);
            }
          }
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown
  useEffect(() => {
    if (phase !== 'q') return;
    const iv = window.setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const answer = (i: number) => {
    if (phase !== 'q' || myChoice !== null || isHost) return;
    playClick();
    setMyChoice(i);
    send({ t: 'ans', n, choice: i });
  };

  const myScore = reveal?.scores[myId] || 0;
  const myRank = reveal
    ? Object.entries(reveal.scores).sort((a, b) => b[1] - a[1]).findIndex(([id]) => id === myId) + 1
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-950 via-purple-950 to-indigo-950 text-white px-4 py-6">
      <div className="max-w-3xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🎤 Class Quiz Show</h1>
        <p className="text-center font-nunito text-fuchsia-200 text-sm mb-5">
          {isHost ? '👑 You are the Quiz Master!' : 'Answer fast — speed = points!'}
        </p>

        {/* INTRO */}
        {phase === 'intro' && (
          <div className="text-center bg-white/10 rounded-3xl p-8 border border-white/15">
            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-6xl mb-4">
              🎬
            </motion.div>
            {isHost ? (
              <>
                <div className="font-fredoka text-2xl mb-2">{students.length} contestant{students.length === 1 ? '' : 's'} ready!</div>
                <div className="font-nunito text-fuchsia-200 mb-6">{TOTAL_Q} questions · 20 seconds each · fastest correct answers score the most!</div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); hostSendQ(1); }}
                  className="px-10 py-4 rounded-full font-fredoka font-bold text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  🎬 Start the Show!
                </motion.button>
              </>
            ) : (
              <div className="font-fredoka text-2xl">Eyes on the big screen… get ready! 👀</div>
            )}
          </div>
        )}

        {/* QUESTION */}
        {phase === 'q' && q && (
          <div>
            <div className="flex items-center justify-between font-fredoka text-sm text-fuchsia-200 mb-2">
              <span>Question {n}/{TOTAL_Q}</span>
              <span className={timeLeft <= 5 ? 'text-red-400 font-bold text-lg' : ''}>{timeLeft}s ⏱️</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all duration-300 ${timeLeft <= 5 ? 'bg-red-500' : 'bg-gradient-to-r from-amber-400 to-pink-500'}`}
                style={{ width: `${(timeLeft / SECS) * 100}%` }}
              />
            </div>

            <div className="bg-white/10 rounded-3xl p-6 border border-white/15 mb-5">
              <div className="font-fredoka font-bold text-xl md:text-3xl text-center">{q.text}</div>
            </div>

            {isHost ? (
              <div>
                <div className="text-center font-fredoka text-2xl text-amber-300 mb-3">
                  ✋ {answeredIds.length}/{students.length} answered
                </div>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {students.map((p) => (
                    <span
                      key={p.id}
                      className={`rounded-full px-3 py-1 font-nunito text-sm transition-all ${
                        answeredIds.includes(p.id) ? 'bg-emerald-500/40 border border-emerald-300' : 'bg-white/10 opacity-50'
                      }`}
                    >
                      {p.emoji} {p.name}
                    </span>
                  ))}
                </div>
                <div className="text-center">
                  <button onClick={() => { playClick(); hostReveal(); }} className="px-6 py-2 rounded-full font-fredoka bg-white/15 border border-white/30 hover:bg-white/25">
                    Reveal now ⏩
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {q.options.map((opt, i) => (
                  <motion.button
                    key={i}
                    whileTap={myChoice === null ? { scale: 0.95 } : {}}
                    onClick={() => answer(i)}
                    disabled={myChoice !== null}
                    className={`rounded-2xl p-4 md:p-6 font-nunito font-bold text-left bg-gradient-to-br ${ANSWER_STYLES[i].bg} shadow-xl ${
                      myChoice !== null && myChoice !== i ? 'opacity-30' : ''
                    } ${myChoice === i ? 'ring-4 ring-white' : ''}`}
                  >
                    <span className="text-2xl mr-2">{ANSWER_STYLES[i].shape}</span>
                    {opt}
                  </motion.button>
                ))}
                {myChoice !== null && (
                  <div className="col-span-2 text-center font-fredoka text-amber-300 text-lg">
                    🤞 Answer locked in! Watch the screen…
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* REVEAL */}
        {phase === 'reveal' && reveal && q && (
          <div>
            <div className="bg-white/10 rounded-3xl p-5 border border-white/15 mb-4 text-center">
              <div className="font-nunito text-fuchsia-200 text-sm mb-1">The correct answer was:</div>
              <div className="font-fredoka font-bold text-2xl text-green-300">
                {ANSWER_STYLES[reveal.correct].shape} {q.options[reveal.correct]} ✅
              </div>
            </div>

            {isHost ? (
              <>
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {reveal.counts.map((c, i) => (
                    <div key={i} className="text-center">
                      <div className="h-24 flex items-end justify-center mb-1">
                        <div
                          className={`w-10 rounded-t-xl bg-gradient-to-t ${ANSWER_STYLES[i].bg} ${i === reveal.correct ? 'ring-2 ring-white' : 'opacity-60'}`}
                          style={{ height: `${Math.max(8, (c / Math.max(1, students.length)) * 96)}px` }}
                        />
                      </div>
                      <div className="font-fredoka">{ANSWER_STYLES[i].shape} {c}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white/10 rounded-3xl p-4 border border-white/15 mb-5">
                  <div className="font-fredoka text-amber-300 mb-2">🏆 Leaderboard</div>
                  {reveal.top.slice(0, 5).map((e, i) => (
                    <div key={e.id} className="flex justify-between font-nunito py-1 border-b border-white/5 last:border-0">
                      <span>{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} {e.emoji} {e.name}</span>
                      <span className="font-bold text-amber-200">{e.score}</span>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={hostNext}
                    className="px-10 py-4 rounded-full font-fredoka font-bold text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                  >
                    {n < TOTAL_Q ? `Next Question (${n + 1}/${TOTAL_Q}) ➡️` : '🏆 Show the Podium!'}
                  </motion.button>
                </div>
              </>
            ) : (
              <div className="text-center bg-white/10 rounded-3xl p-6 border border-white/15">
                {(reveal.gained[myId] || 0) > 0 ? (
                  <>
                    <div className="text-6xl mb-2">🎉</div>
                    <div className="font-fredoka font-bold text-3xl text-green-300 mb-1">+{reveal.gained[myId]} points!</div>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-2">😅</div>
                    <div className="font-fredoka font-bold text-2xl text-red-300 mb-1">
                      {myChoice === null ? 'Too slow!' : 'Not this time!'}
                    </div>
                  </>
                )}
                <div className="font-nunito text-fuchsia-200">
                  Total: <span className="font-bold text-amber-300">{myScore}</span> · Rank: <span className="font-bold text-amber-300">#{myRank}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PODIUM */}
        {phase === 'podium' && podium && (
          <div className="text-center relative">
            <ConfettiBurst count={100} durationMs={5000} />
            <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-6">🏆 FINAL PODIUM 🏆</h2>
            <div className="flex items-end justify-center gap-3 mb-6">
              {[1, 0, 2].map((rank) => {
                const e = podium[rank];
                if (!e) return <div key={rank} className="w-24" />;
                const heights = ['h-40', 'h-28', 'h-20'];
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <motion.div
                    key={e.id}
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: rank === 0 ? 0.6 : rank === 1 ? 0.3 : 0 }}
                    className="flex flex-col items-center"
                  >
                    <div className="text-4xl mb-1">{e.emoji}</div>
                    <div className="font-fredoka font-bold text-sm mb-1 max-w-24 truncate">{e.name}</div>
                    <div className={`${heights[rank]} w-24 rounded-t-2xl bg-gradient-to-t from-amber-600 to-amber-300 flex flex-col items-center justify-start pt-2`}>
                      <div className="text-3xl">{medals[rank]}</div>
                      <div className="font-fredoka font-bold text-amber-950">{e.score}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {podium.length > 3 && (
              <div className="bg-white/10 rounded-3xl p-4 border border-white/15 mb-6 max-w-sm mx-auto text-left">
                {podium.slice(3, 10).map((e, i) => (
                  <div key={e.id} className="flex justify-between font-nunito py-1">
                    <span>#{i + 4} {e.emoji} {e.name}</span>
                    <span className="font-bold text-amber-200">{e.score}</span>
                  </div>
                ))}
              </div>
            )}
            {isHost ? (
              <button
                onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
              >
                Back to Lobby 🏠
              </button>
            ) : (
              <div className="font-nunito text-fuchsia-300">
                {podium.findIndex((e) => e.id === myId) >= 0 && podium.findIndex((e) => e.id === myId) < 3
                  ? '⭐ YOU MADE THE PODIUM! +30 XP'
                  : 'Great game! +15 XP'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassQuizShow;
