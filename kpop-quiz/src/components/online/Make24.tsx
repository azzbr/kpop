import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { playClick, playCorrect, playWin } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// Combine ALL the numbers with + − × ÷ to hit the target. Players merge two
// numbers at a time (so no typing or operator precedence to worry about).
// Host generates a guaranteed-solvable puzzle and replays each player's steps.

interface TopEntry {
  id: string;
  name: string;
  emoji: string;
  score: number;
}
interface Step {
  a: number;
  b: number;
  op: string;
}
type Phase = 'intro' | 'play' | 'reveal' | 'final';

const ROUNDS = 5;
const ROUND_MS = 75000;
const randInt = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const DIFF: Record<string, { count: number; maxNum: number; tlo: number; thi: number }> = {
  easy: { count: 3, maxNum: 9, tlo: 6, thi: 15 },
  medium: { count: 4, maxNum: 9, tlo: 10, thi: 24 },
  hard: { count: 4, maxNum: 12, tlo: 20, thi: 30 },
  expert: { count: 4, maxNum: 13, tlo: 24, thi: 50 },
  master: { count: 4, maxNum: 15, tlo: 35, thi: 99 },
};

// All single values reachable by combining the numbers two-at-a-time
// (integers only — division must be exact).
function reach(nums: number[]): Set<number> {
  if (nums.length === 1) return new Set([nums[0]]);
  const out = new Set<number>();
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const a = nums[i];
      const b = nums[j];
      const rest = nums.filter((_, k) => k !== i && k !== j);
      const results = [a + b, a * b, a - b];
      if (b !== 0 && a % b === 0) results.push(a / b);
      for (const res of results) for (const v of reach([...rest, res])) out.add(v);
    }
  }
  return out;
}

function genPuzzle(spec: { count: number; maxNum: number; tlo: number; thi: number }): { nums: number[]; target: number } {
  for (let tries = 0; tries < 500; tries++) {
    const nums = Array.from({ length: spec.count }, () => randInt(1, spec.maxNum));
    const rv = reach(nums);
    const cands = [...rv].filter((v) => Number.isInteger(v) && v >= spec.tlo && v <= spec.thi);
    const good = cands.filter((v) => v > 1 && !nums.includes(v));
    const fromList = good.length ? good : cands;
    if (fromList.length) return { nums, target: pick(fromList) };
  }
  return { nums: [2, 3, 4, 6], target: 24 }; // safe fallback
}

function validate(nums: number[], steps: Step[], target: number): boolean {
  const pool = [...nums];
  for (const s of steps) {
    const ia = pool.indexOf(s.a);
    if (ia < 0) return false;
    pool.splice(ia, 1);
    const ib = pool.indexOf(s.b);
    if (ib < 0) return false;
    pool.splice(ib, 1);
    let res: number;
    if (s.op === '+') res = s.a + s.b;
    else if (s.op === '×') res = s.a * s.b;
    else if (s.op === '−') res = s.a - s.b;
    else if (s.op === '÷') {
      if (s.b === 0 || s.a % s.b !== 0) return false;
      res = s.a / s.b;
    } else return false;
    pool.push(res);
  }
  return pool.length === 1 && pool[0] === target;
}

const Make24: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();
  const difficulty = config?.difficulty || 'medium';

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState(0);
  const [startNums, setStartNums] = useState<number[]>([]);
  const [cards, setCards] = useState<{ id: number; value: number }[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [meSolved, setMeSolved] = useState(false);
  const [endsAt, setEndsAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [solvedList, setSolvedList] = useState<{ id: string }[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [finalTop, setFinalTop] = useState<TopEntry[] | null>(null);
  const idRef = useRef(0);
  const xpGiven = useRef(false);

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  const hd = useRef({
    puzzles: [] as { nums: number[]; target: number }[],
    round: 0,
    nums: [] as number[],
    target: 0,
    solved: {} as Record<string, boolean>,
    scores: {} as Record<string, number>,
    endsAt: 0,
    ended: true,
    timer: 0,
  });

  // ---- HOST ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    const spec = DIFF[difficulty] || DIFF.medium;
    h.puzzles = Array.from({ length: ROUNDS }, () => genPuzzle(spec));
    players.forEach((p) => (h.scores[p.id] = 0));

    const startRound = (r: number) => {
      const pz = h.puzzles[r - 1];
      h.round = r;
      h.nums = pz.nums;
      h.target = pz.target;
      h.solved = {};
      h.ended = false;
      h.endsAt = Date.now() + ROUND_MS;
      send({ t: 'mk_round', round: r, total: ROUNDS, nums: pz.nums, target: pz.target, endsAt: h.endsAt });
      h.timer = window.setTimeout(endRound, ROUND_MS + 300);
    };

    const endRound = () => {
      if (h.ended) return;
      h.ended = true;
      window.clearTimeout(h.timer);
      send({ t: 'mk_reveal', scores: { ...h.scores } });
      h.timer = window.setTimeout(() => {
        if (h.round < ROUNDS) startRound(h.round + 1);
        else {
          const top: TopEntry[] = Object.entries(h.scores)
            .map(([id, score]) => ({ id, name: byId(id).name, emoji: byId(id).emoji, score }))
            .sort((a, b) => b.score - a.score);
          send({ t: 'mk_final', top });
        }
      }, 3200);
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'mk_solved' && !h.ended && m.from && !h.solved[m.from] && Array.isArray(m.steps)) {
        if (validate(h.nums, m.steps as Step[], h.target)) {
          h.solved[m.from] = true;
          const frac = Math.max(0, h.endsAt - Date.now()) / ROUND_MS;
          const pts = 100 + Math.round(120 * frac);
          h.scores[m.from] = (h.scores[m.from] || 0) + pts;
          send({ t: 'mk_correct', playerId: m.from, scores: { ...h.scores } });
          const everyone = playersRef.current;
          if (everyone.length > 0 && everyone.every((p) => h.solved[p.id])) endRound();
        }
      }
    });

    h.timer = window.setTimeout(() => startRound(1), 1400);
    return () => {
      offMsg();
      window.clearTimeout(h.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetCards = (nums: number[]) => {
    setCards(nums.map((value) => ({ id: idRef.current++, value })));
    setSel([]);
    setSteps([]);
  };

  // ---- EVERYONE ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      if (m.t === 'mk_round') {
        setPhase('play');
        setRound(m.round);
        setTarget(m.target);
        setStartNums(m.nums);
        setMeSolved(false);
        setEndsAt(m.endsAt);
        resetCards(m.nums);
      } else if (m.t === 'mk_correct') {
        setScores(m.scores);
        setSolvedList((list) => (list.some((x) => x.id === m.playerId) ? list : [...list, { id: m.playerId }]));
        if (m.playerId === myId) {
          setMeSolved(true);
          playCorrect();
        }
      } else if (m.t === 'mk_reveal') {
        setPhase('reveal');
        setScores(m.scores);
        setSolvedList([]);
      } else if (m.t === 'mk_final') {
        setPhase('final');
        setFinalTop(m.top);
        playWin();
        if (!xpGiven.current) {
          xpGiven.current = true;
          addXP(m.top[0]?.id === myId ? 40 : 15);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  useEffect(() => {
    if (phase !== 'play') return;
    const iv = window.setInterval(() => setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 300);
    return () => window.clearInterval(iv);
  }, [phase, endsAt]);

  const tapCard = (id: number) => {
    if (meSolved) return;
    playClick();
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s));
  };

  const valueOf = (id: number) => cards.find((c) => c.id === id)?.value ?? 0;
  const a = sel.length === 2 ? valueOf(sel[0]) : 0;
  const b = sel.length === 2 ? valueOf(sel[1]) : 0;
  const divOk = sel.length === 2 && b !== 0 && a % b === 0;

  const applyOp = (op: string) => {
    if (sel.length !== 2) return;
    if (op === '÷' && !divOk) return;
    let res: number;
    if (op === '+') res = a + b;
    else if (op === '×') res = a * b;
    else if (op === '−') res = a - b;
    else res = a / b;
    playClick();
    const newCards = cards.filter((c) => !sel.includes(c.id));
    const nc = { id: idRef.current++, value: res };
    newCards.push(nc);
    const newSteps = [...steps, { a, b, op }];
    setCards(newCards);
    setSteps(newSteps);
    setSel([]);
    if (newCards.length === 1 && newCards[0].value === target) {
      setMeSolved(true);
      playCorrect();
      send({ t: 'mk_solved', steps: newSteps });
    }
  };

  const topScores = Object.entries(scores)
    .map(([id, s]) => ({ id, s }))
    .sort((a2, b2) => b2.s - a2.s)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-950 via-sky-950 to-blue-950 text-white px-4 py-6">
      <div className="max-w-md mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1">🔢 Make {phase === 'play' ? target : '24'}</h1>
        <p className="text-center font-nunito text-cyan-200 text-sm mb-4">
          {phase === 'play' ? `Round ${round}/${ROUNDS} · ⏱️ ${timeLeft}s` : phase === 'reveal' ? 'Reveal!' : 'Get ready…'}
        </p>

        {phase === 'play' && !meSolved && (
          <>
            <div className="text-center mb-4">
              <div className="inline-block bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-6 py-2 font-fredoka">
                Target: <span className="font-bold text-amber-300 text-2xl">{target}</span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex flex-wrap justify-center gap-3 mb-5 min-h-[4rem]">
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => tapCard(c.id)}
                  className={`w-16 h-16 rounded-2xl font-fredoka font-bold text-2xl border-4 transition-all ${
                    sel.includes(c.id) ? 'bg-sky-400/40 border-sky-300 scale-110' : 'bg-white/10 border-white/20 hover:bg-white/20'
                  }`}
                >
                  {c.value}
                </button>
              ))}
            </div>

            {/* Operators */}
            <div className="flex justify-center gap-3 mb-4">
              {['+', '−', '×', '÷'].map((op) => {
                const disabled = sel.length !== 2 || (op === '÷' && !divOk);
                return (
                  <button
                    key={op}
                    onClick={() => applyOp(op)}
                    disabled={disabled}
                    className={`w-14 h-14 rounded-2xl font-fredoka font-bold text-2xl ${
                      disabled ? 'bg-white/5 text-white/30' : 'bg-gradient-to-br from-amber-400 to-pink-500 active:scale-90 transition-transform'
                    }`}
                  >
                    {op}
                  </button>
                );
              })}
            </div>

            <div className="text-center">
              <button onClick={() => { playClick(); resetCards(startNums); }} className="px-5 py-2 rounded-full font-fredoka text-sm bg-white/10 hover:bg-white/20">
                ↺ Start over
              </button>
            </div>
            <p className="text-center font-nunito text-white/40 text-xs mt-3">Pick two numbers, then an operation. Use them all to reach the target!</p>
          </>
        )}

        {meSolved && phase === 'play' && (
          <div className="bg-emerald-500/15 border-2 border-emerald-400 rounded-3xl p-5 text-center mb-4">
            <div className="text-4xl mb-1">🎉</div>
            <div className="font-fredoka text-xl text-emerald-200">You hit {target}!</div>
            <div className="font-nunito text-sm text-emerald-100">Waiting for the others…</div>
          </div>
        )}

        {solvedList.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3 mb-3">
            <div className="font-fredoka text-xs text-amber-300 mb-1">Solved it 🏅</div>
            <div className="grid grid-cols-2 gap-x-4">
              {solvedList.map((s, i) => (
                <div key={s.id} className="font-nunito text-xs py-0.5">#{i + 1} {byId(s.id).emoji} {byId(s.id).name}</div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white/5 rounded-2xl p-3">
          <div className="font-fredoka text-xs mb-1 text-cyan-300">Top scores:</div>
          <div className="grid grid-cols-2 gap-x-4">
            {topScores.map((s) => (
              <div key={s.id} className="font-nunito text-xs py-0.5 flex justify-between">
                <span>{byId(s.id).emoji} {byId(s.id).name}</span>
                <span className="text-amber-300 font-bold">{s.s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {phase === 'final' && finalTop && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full">
              <div className="text-7xl mb-3">🏆</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-3">
                {finalTop[0] ? `${finalTop[0].emoji} ${finalTop[0].name} wins!` : 'Game over!'}
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-44 overflow-y-auto">
                {finalTop.slice(0, 8).map((e, i) => (
                  <div key={e.id} className="flex justify-between font-nunito text-sm py-0.5">
                    <span>#{i + 1} {e.emoji} {e.name}</span>
                    <span className="text-amber-200">{e.score}</span>
                  </div>
                ))}
              </div>
              <p className="font-fredoka text-green-300 mb-5">+{finalTop[0]?.id === myId ? 40 : 15} XP</p>
              {isHost ? (
                <button onClick={() => { playClick(); send({ t: 'to_lobby' }); }} className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl">
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-slate-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Make24;
