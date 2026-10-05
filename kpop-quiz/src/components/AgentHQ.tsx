import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, getLevel, LEVEL_NAMES } from '../store';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playPop, playWin, playWrong, playUnlock, playCoin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import OnScreenKeyboard from './ui/OnScreenKeyboard';
import {
  CODE_INFO, EMOJI_KEY, GRID, checkAnswer, hintFor, pickNext, shiftKey, type Puzzle,
} from './secretAgentLogic';

const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

function readNumber(key: string): number {
  try { const n = parseInt(localStorage.getItem(key) || '0', 10); return Number.isFinite(n) ? n : 0; } catch { return 0; }
}

/** One-time move of the old loose keys into the store (old ids were list indexes, so only the count carries over). */
function migrateLegacy() {
  try {
    const oldCount = readNumber('ciphers_solved');
    const hadKeys = localStorage.getItem('ciphers_solved') !== null || localStorage.getItem('cipher_solved_ids') !== null;
    if (!hadKeys) return;
    const { agent, setAgent } = useGameStore.getState();
    if (oldCount > agent.solved) setAgent({ solved: oldCount });
    localStorage.removeItem('ciphers_solved');
    localStorage.removeItem('cipher_solved_ids');
  } catch { /* storage blocked — nothing to migrate */ }
}

const CodedMessage: React.FC<{ p: Puzzle }> = ({ p }) => {
  if (p.type === 'emoji') {
    return <p className="text-4xl md:text-5xl leading-snug tracking-wide">{p.tokens.join(' ')}</p>;
  }
  const text = p.tokens.join(p.sep);
  return (
    <p
      className="font-mono font-bold text-cyan-300 break-all"
      style={{
        fontSize: 'clamp(28px, 7vw, 46px)',
        letterSpacing: p.sep ? '0.05em' : '0.2em',
        transform: p.type === 'mirror' ? 'scaleX(-1)' : undefined,
        display: 'inline-block',
      }}
    >
      {text}
    </p>
  );
};

const DecoderKey: React.FC<{ p: Puzzle }> = ({ p }) => {
  const cell = 'bg-black/40 rounded-lg text-yellow-100 font-mono text-lg py-1 text-center';
  if (p.type === 'number') {
    return (
      <div className="grid grid-cols-5 sm:grid-cols-7 gap-1 mt-2">
        {Array.from({ length: 26 }, (_, i) => (
          <div key={i} className={cell}>{String.fromCharCode(65 + i)}={i + 1}</div>
        ))}
      </div>
    );
  }
  if (p.type === 'shift1' || p.type === 'caesar') {
    const n = p.type === 'shift1' ? 1 : p.param ?? 0;
    return (
      <div className="grid grid-cols-5 sm:grid-cols-7 gap-1 mt-2">
        {shiftKey(n).map(k => <div key={k.coded} className={cell}>{k.coded}→{k.plain}</div>)}
      </div>
    );
  }
  if (p.type === 'emoji') {
    return (
      <div className="grid grid-cols-5 sm:grid-cols-7 gap-1 mt-2">
        {Object.entries(EMOJI_KEY).map(([l, e]) => (
          <div key={l} className={cell}><span className="text-2xl">{e}</span>={l}</div>
        ))}
      </div>
    );
  }
  if (p.type === 'grid') {
    return (
      <table className="mx-auto mt-2 border-separate" style={{ borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="w-11 h-11" />
            {[1, 2, 3, 4, 5].map(c => <th key={c} className="w-11 h-11 font-fredoka text-lg text-pink-300">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {GRID.map((row, r) => (
            <tr key={r}>
              <th className="w-11 h-11 font-fredoka text-lg text-pink-300">{r + 1}</th>
              {row.map(l => <td key={l} className={`${cell} w-11 h-11`}>{l === 'I' ? 'I/J' : l}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return null;
};

const AgentHQ: React.FC = () => {
  const userName = useGameStore(s => s.userName);
  const xp = useGameStore(s => s.xp);
  const agent = useGameStore(s => s.agent);
  const setAgent = useGameStore(s => s.setAgent);
  const setGameState = useGameStore(s => s.setGameState);
  const later = useSafeTimeout();
  const agentName = userName ? userName.toUpperCase() : 'ROOKIE';
  const [agentID] = useState(() => Math.floor(10000000 + Math.random() * 90000000).toString());
  const level = getLevel(xp);

  useEffect(() => { migrateLegacy(); }, []);

  const [puzzle, setPuzzle] = useState<Puzzle>(() => pickNext(useGameStore.getState().agent.solvedIds, Math.random));
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'' | 'correct' | 'wrong'>('');
  const [hint, setHint] = useState('');
  const [showKey, setShowKey] = useState(true);
  const [confetti, setConfetti] = useState(false);
  const [sessionSolved, setSessionSolved] = useState(0);
  const [reward, setReward] = useState<{ xp: number; coins: number; solved: number } | null>(null);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);
  const [locked, setLocked] = useState(false);

  const info = CODE_INFO[puzzle.type];
  const info2 = puzzle.type === 'caesar' ? `Secret number: ${puzzle.param}` : '';

  const goNext = useCallback((current: Puzzle) => {
    setPuzzle(pickNext(useGameStore.getState().agent.solvedIds, Math.random, current.id));
    setInput('');
    setFeedback('');
    setHint('');
  }, []);

  const onKey = useCallback((l: string) => {
    if (lockRef.current) return;
    setInput(s => (s.length >= puzzle.word.length ? s : s + l));
    setFeedback('');
  }, [puzzle.word.length]);

  const onBackspace = useCallback(() => {
    if (lockRef.current) return;
    setInput(s => s.slice(0, -1));
    setFeedback('');
  }, []);

  const submit = useCallback(() => {
    if (lockRef.current) return;
    if (!input.trim()) { playPop(); return; }
    if (checkAnswer(input, puzzle.word)) {
      lockRef.current = true;
      setLocked(true);
      playWin();
      setFeedback('correct');
      setConfetti(true);
      const a = useGameStore.getState().agent;
      setAgent({
        solved: a.solved + 1,
        solvedIds: a.solvedIds.includes(puzzle.id) ? a.solvedIds : [...a.solvedIds, puzzle.id],
      });
      setSessionSolved(n => n + 1);
      const solvedPuzzle = puzzle;
      later(() => {
        setConfetti(false);
        goNext(solvedPuzzle);
        lockRef.current = false;
        setLocked(false);
      }, 1900);
    } else {
      playWrong();
      setFeedback('wrong');
      later(() => setFeedback(f => (f === 'wrong' ? '' : f)), 1400);
    }
  }, [input, puzzle, setAgent, later, goNext]);

  const skip = () => {
    if (lockRef.current) return;
    playClick();
    goNext(puzzle);
  };

  const getHint = () => {
    if (lockRef.current) return;
    playClick();
    setHint(hintFor(puzzle.word));
  };

  /** Gives the session reward exactly once. 4 codes ≈ 40 XP. */
  const finishMission = () => {
    if (finishedRef.current || sessionSolved < 1) return null;
    finishedRef.current = true;
    const r = useGameStore.getState().finishRound('agent_hq', sessionSolved, 0.1);
    return { xp: r.xp, coins: r.coins, solved: sessionSolved };
  };

  const onFinish = () => {
    const r = finishMission();
    if (!r) return;
    playCoin();
    setConfetti(true);
    later(() => setConfetti(false), 2500);
    setReward(r);
  };

  const leave = () => {
    playClick();
    finishMission();
    useGameStore.getState().leaveSecret();
  };

  const newMission = () => {
    playClick();
    finishedRef.current = false;
    setSessionSolved(0);
    setReward(null);
    goNext(puzzle);
  };

  const missions = useMemo(() => {
    const { highScores, datesPlayed } = useGameStore.getState();
    const arenaWins = highScores.battle_arena ?? 0;
    const styleSaves = readNumber('style_saves');
    const ninjaBest = highScores.ninja_slice ?? 0;
    const days = datesPlayed.length;
    const solved = agent.solved;
    return [
      { id: 'dec3', emoji: '🔓', label: 'Crack 3 secret codes', done: solved >= 3, prog: `${Math.min(solved, 3)}/3` },
      { id: 'dec10', emoji: '🗝️', label: 'Crack 10 secret codes', done: solved >= 10, prog: `${Math.min(solved, 10)}/10` },
      { id: 'lvl1', emoji: '⭐', label: `Reach ${LEVEL_NAMES[1]} rank`, done: level >= 1, prog: `${xp} XP` },
      { id: 'win1', emoji: '🏆', label: 'Win 1 Arena battle', done: arenaWins >= 1, prog: arenaWins >= 1 ? '✓' : '0/1' },
      { id: 'sty1', emoji: '🎨', label: 'Save a Style Studio look', done: styleSaves >= 1, prog: `${styleSaves} saved` },
      { id: 'nin1', emoji: '🥷', label: 'Score 100+ in Ninja Slice', done: ninjaBest >= 100, prog: `Best: ${ninjaBest}` },
      { id: 'day3', emoji: '🔥', label: 'Play on 3 different days', done: days >= 3, prog: `${days} ${days === 1 ? 'day' : 'days'}` },
    ];
  }, [agent.solved, level, xp]);
  const completeCount = missions.filter(m => m.done).length;

  const slots = Array.from({ length: puzzle.word.length }, (_, i) => input[i] ?? '');

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="arcade-bg min-h-screen-d text-white"
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))',
      }}
    >
      {confetti && <ConfettiBurst count={70} durationMs={2500} />}
      {DEBUG && <span data-testid="agent-answer" data-answer={puzzle.word} hidden />}

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            onClick={leave}
            className="min-h-[48px] px-5 bg-white/10 active:bg-white/20 text-cyan-200 rounded-full font-fredoka text-lg border border-cyan-500/40"
          >
            ← Back
          </button>
          <div className="bg-pink-500/20 border border-pink-400/40 rounded-full px-4 py-2">
            <span className="font-fredoka text-pink-100 text-base">This mission: {sessionSolved} 🔓</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-1">🕵️</div>
          <h1 className="text-4xl font-fredoka font-bold text-kid-glow"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AGENT HQ
          </h1>
          <p className="font-nunito text-cyan-100/80 text-lg">Crack the secret codes, agent!</p>
        </div>

        {/* Agent ID card */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 border-2 border-cyan-400/40 rounded-2xl p-4 mb-5 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-black rounded-xl flex items-center justify-center border-2 border-cyan-400/60 flex-shrink-0">
              <span className="text-4xl">🕶️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-nunito text-cyan-200/80 text-base">CODENAME</p>
              <p className="font-fredoka font-bold text-white text-xl truncate">AGENT {agentName}</p>
              <p className="font-nunito text-cyan-200/80 text-base">Rank · {LEVEL_NAMES[level]} · {agent.solved} codes cracked</p>
            </div>
            <div className="text-right flex-shrink-0 hidden sm:block">
              <p className="font-nunito text-cyan-200/80 text-base">ID</p>
              <p className="font-mono text-cyan-300 font-bold">{agentID}</p>
            </div>
          </div>
        </div>

        {/* CODE BREAKER */}
        <div className="bg-slate-900/80 border-2 border-pink-500/40 rounded-3xl p-4 md:p-5 mb-5 shadow-[0_0_24px_rgba(236,72,153,0.15)]">
          <AnimatePresence mode="wait">
            {reward ? (
              <motion.div key="reward" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }} className="text-center py-4">
                <div className="text-6xl mb-2">🏁</div>
                <h2 className="text-3xl font-fredoka font-bold text-yellow-300 mb-2">Mission complete!</h2>
                <p className="font-nunito text-xl text-white mb-1">You cracked {reward.solved} {reward.solved === 1 ? 'code' : 'codes'}. Super sleuthing!</p>
                <p className="font-fredoka text-2xl text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙</p>
                <button onClick={newMission}
                  className="min-h-[56px] px-8 bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-2xl font-fredoka font-bold text-xl text-white shadow-lg active:scale-95">
                  🕵️ New mission
                </button>
              </motion.div>
            ) : (
              <motion.div key={puzzle.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h2 className="text-2xl font-fredoka font-bold text-pink-300">{info.emoji} {info.name}</h2>
                  {info2 && (
                    <span className="bg-yellow-400/20 border border-yellow-300/50 rounded-full px-3 py-1 font-fredoka text-yellow-200 text-lg">{info2}</span>
                  )}
                </div>

                <motion.div
                  animate={feedback === 'wrong' ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
                  transition={{ duration: 0.35 }}
                  className={`bg-black/60 border-2 rounded-2xl p-5 mb-3 text-center transition-colors ${
                    feedback === 'correct' ? 'border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
                      : feedback === 'wrong' ? 'border-orange-400' : 'border-pink-500/40'
                  }`}
                >
                  <p className="font-nunito text-pink-200/80 text-base uppercase tracking-widest mb-2">⚠️ Secret message ⚠️</p>
                  <CodedMessage p={puzzle} />
                </motion.div>

                <button
                  onClick={() => { playClick(); setShowKey(s => !s); }}
                  className="w-full min-h-[48px] mb-3 bg-yellow-500/15 active:bg-yellow-500/25 border border-yellow-400/40 rounded-xl font-fredoka text-yellow-200 text-lg"
                >
                  {showKey ? '🔒 Hide code key' : '🔑 Show code key'}
                </button>

                <AnimatePresence initial={false}>
                  {showKey && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="bg-yellow-500/10 border-2 border-yellow-400/40 rounded-2xl p-3 mb-3 overflow-hidden"
                    >
                      <p className="font-fredoka text-yellow-300 text-lg">📖 How to crack it</p>
                      <p className="font-nunito text-yellow-50 text-lg">{info.rule}</p>
                      <p className="font-mono text-yellow-200 text-base mt-2 bg-black/30 rounded px-2 py-1">
                        Example: {puzzle.type === 'mirror'
                          ? <><span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>OLLEH</span> → HELLO</>
                          : info.example}
                      </p>
                      <DecoderKey p={puzzle} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Answer slots */}
                <div className="flex justify-center gap-1.5 mb-2" aria-label="Your answer">
                  {slots.map((ch, i) => (
                    <div key={i}
                      className={`w-10 h-12 md:w-12 md:h-14 rounded-xl border-2 flex items-center justify-center font-fredoka text-2xl ${
                        feedback === 'correct' ? 'border-green-400 bg-green-500/30'
                          : ch ? 'border-pink-400 bg-pink-500/20' : 'border-white/25 bg-black/30'
                      }`}>
                      {ch}
                    </div>
                  ))}
                </div>

                <div className="min-h-[36px] text-center mb-2">
                  {feedback === 'correct' && (
                    <p className="font-fredoka font-bold text-green-300 text-xl">🎉 Code cracked! Next message coming…</p>
                  )}
                  {feedback === 'wrong' && (
                    <p className="font-fredoka text-orange-300 text-xl">So close! Check the key and try again, agent! 💪</p>
                  )}
                  {!feedback && hint && (
                    <p className="font-mono text-yellow-300 text-xl tracking-widest">💡 {hint}</p>
                  )}
                </div>

                <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={submit} disabled={locked} enterLabel="🔓" />

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button onClick={getHint} disabled={locked}
                    className="min-h-[52px] bg-yellow-500/20 active:bg-yellow-500/30 border-2 border-yellow-400/40 rounded-xl font-fredoka text-yellow-200 text-lg disabled:opacity-40">
                    💡 Hint
                  </button>
                  <button onClick={submit} disabled={locked}
                    className="min-h-[52px] bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-xl font-fredoka font-bold text-white text-lg shadow-lg active:scale-95 disabled:opacity-60">
                    🔓 Decode!
                  </button>
                  <button onClick={skip} disabled={locked}
                    className="min-h-[52px] bg-purple-500/20 active:bg-purple-500/30 border-2 border-purple-400/40 rounded-xl font-fredoka text-purple-200 text-lg disabled:opacity-40">
                    ⏭️ Skip
                  </button>
                </div>

                {sessionSolved > 0 && (
                  <button onClick={onFinish} disabled={locked}
                    className="w-full min-h-[56px] mt-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl font-fredoka font-bold text-white text-xl shadow-lg active:scale-95 disabled:opacity-60">
                    🏁 Finish mission ({sessionSolved} cracked)
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* MISSION BOARD */}
        <div className="bg-slate-900/80 border-2 border-cyan-500/40 rounded-3xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-fredoka font-bold text-cyan-300">🎯 Mission Board</h2>
            <div className="bg-cyan-500/20 border border-cyan-400/40 rounded-full px-3 py-1">
              <span className="font-fredoka text-cyan-100 text-base">{completeCount}/{missions.length} ✓</span>
            </div>
          </div>
          <div className="space-y-2">
            {missions.map(m => (
              <div key={m.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                  m.done ? 'bg-green-500/15 border-green-400/50' : 'bg-black/30 border-slate-700'
                }`}>
                <div className={`text-2xl ${m.done ? '' : 'grayscale opacity-60'}`}>{m.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className={`font-fredoka text-lg ${m.done ? 'text-green-300' : 'text-white/90'}`}>{m.label}</p>
                  <p className="font-nunito text-base text-white/60">{m.prog}</p>
                </div>
                <div className="text-xl">{m.done ? '✅' : '🔒'}</div>
              </div>
            ))}
          </div>
          {completeCount === missions.length && (
            <div className="mt-3 p-3 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-2 border-yellow-400/60 rounded-xl text-center">
              <p className="font-fredoka font-bold text-yellow-300 text-lg">👑 MASTER AGENT! All missions complete!</p>
            </div>
          )}
        </div>

        {/* Treasure Shop */}
        <button
          onClick={() => { playUnlock(); finishMission(); setGameState('locker'); }}
          className="w-full min-h-[64px] bg-gradient-to-r from-green-600 to-emerald-600 active:brightness-110 rounded-2xl p-4 shadow-lg flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛍️</span>
            <div className="text-left">
              <p className="font-fredoka font-bold text-white text-xl">Treasure Shop</p>
              <p className="font-nunito text-green-50 text-base">Spend your coins on avatars &amp; trails</p>
            </div>
          </div>
          <span className="text-white text-2xl">▶</span>
        </button>
      </div>
    </motion.div>
  );
};

export default AgentHQ;
