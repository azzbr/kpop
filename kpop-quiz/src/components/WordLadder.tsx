import { useEffect, Fragment, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import OnScreenKeyboard from './ui/OnScreenKeyboard';
import ConfettiBurst from './ConfettiBurst';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playCorrect, playPop, playWrong } from '../utils/sounds';
import { PUZZLES, ladderHint, shortestLadder, checkStep, STEP_MESSAGES, ladderScore, HINT_COST } from '../data/wordLadder';

const SOLVED_KEY = 'wordladder_solved';
const readSolved = (): Set<number> => {
  try { return new Set(JSON.parse(localStorage.getItem(SOLVED_KEY) || '[]') as number[]); } catch { return new Set(); }
};

export default function WordLadder() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  // Pause when she switches apps
  useEffect(() => {
    const h = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  const [solved, setSolved] = useState<Set<number>>(readSolved);
  const [puzzleIdx, setPuzzleIdx] = useState(() => {
    const s = readSolved();
    const i = PUZZLES.findIndex((_, k) => !s.has(k));
    return i < 0 ? 0 : i;
  });
  const puzzle = PUZZLES[puzzleIdx];
  const [chain, setChain] = useState<string[]>([puzzle.start]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [hints, setHints] = useState(0);
  const [won, setWon] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [locked, setLocked] = useState(false);
  const len = puzzle.start.length;
  const last = chain[chain.length - 1];
  const canType = status === 'playing' && !locked;

  const start = (idx = puzzleIdx) => {
    setPuzzleIdx(idx);
    setChain([PUZZLES[idx].start]);
    setInput('');
    setError('');
    setHints(0);
    setWon(false);
    setGaveUp(false);
    setLocked(false);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const finish = () => {
    setLocked(true);
    setWon(true);
    playCorrect();
    const s = new Set(solved).add(puzzleIdx);
    setSolved(s);
    try { localStorage.setItem(SOLVED_KEY, JSON.stringify([...s])); } catch { /* private mode */ }
    later(() => setStatus('over'), 1800);
  };

  const addWord = (word: string, viaHint: boolean) => {
    const problem = checkStep(chain, word, puzzle);
    if (problem) {
      setError(STEP_MESSAGES[problem](puzzle));
      setShake(s => s + 1);
      playWrong();
      return;
    }
    setError('');
    const next = [...chain, word];
    setChain(next);
    setInput('');
    if (word === puzzle.end) finish();
    else if (!viaHint) playPop();
    else playClick();
  };

  const onKey = useCallback((l: string) => {
    if (!canType) return;
    setError('');
    setInput(c => (c.length < len ? c + l.toLowerCase() : c));
  }, [canType, len]);
  const onBackspace = useCallback(() => { if (canType) setInput(c => c.slice(0, -1)); }, [canType]);
  const onEnter = () => {
    if (!canType) return;
    if (input.length < len) { setError(STEP_MESSAGES.length(puzzle)); setShake(s => s + 1); playWrong(); return; }
    addWord(input, false);
  };

  const undo = () => {
    if (!canType || chain.length <= 1) return;
    playClick();
    setChain(c => c.slice(0, -1));
    setError('');
  };

  const hint = () => {
    if (!canType) return;
    const path = shortestLadder(last, puzzle.end);
    if (!path || path.length < 2) return;
    setHints(h => h + 1);
    addWord(path[1], true);
  };

  const showMe = () => {
    if (!canType) return;
    playClick();
    const path = shortestLadder(puzzle.start, puzzle.end) ?? [puzzle.start, puzzle.end];
    setChain(path);
    setInput('');
    setError('');
    setGaveUp(true);
    setLocked(true);
    later(() => setStatus('over'), 2600);
  };

  const steps = chain.length - 1;
  const score = won ? ladderScore(puzzle, steps, hints) : 0;
  const nextIdx = (puzzleIdx + 1) % PUZZLES.length;

  const pickChip = (on: boolean) =>
    `relative min-h-[48px] rounded-2xl px-2 font-fredoka text-lg uppercase ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;

  return (
    <GameShell
      gameId="word_ladder"
      title="Word Ladder"
      icon="🪜"
      xpScale={2.5}
      status={status}
      score={score}
      round={round}
      overTitle={gaveUp ? 'Here’s one way up the ladder 💪' : `${puzzle.start.toUpperCase()} → ${puzzle.end.toUpperCase()} in ${steps} steps!`}
      overStats={[
        { label: '🪜 Your steps', value: gaveUp ? '—' : String(steps) },
        { label: '🎯 Shortest', value: String(puzzle.steps) },
      ]}
      // after a solve, "Play again" moves on to the next ladder
      onStart={() => start(status === 'over' && won ? nextIdx : puzzleIdx)}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      startLabel="▶ Climb!"
      readyContent={
        <div className="space-y-3">
          <p className="font-nunito text-lg text-violet-100">
            Change <b>one letter</b> at a time to make a new word, until you reach the goal. Fewest steps = most points!
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-[40dvh] overflow-y-auto p-1" style={{ touchAction: 'pan-y' }}>
            {PUZZLES.map((p, i) => (
              <button key={i} onClick={() => { playClick(); setPuzzleIdx(i); }} className={pickChip(i === puzzleIdx)}>
                {p.start}→{p.end}
                {solved.has(i) && <span className="absolute -top-1 -right-1 text-base">✅</span>}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {won && <ConfettiBurst count={70} durationMs={2500} />}
        <div className="max-w-xl mx-auto flex flex-col items-center gap-3 min-h-full">
          {/* Goal */}
          <div className="w-full grid grid-cols-3 items-center rounded-2xl bg-black/30 px-4 py-2 text-center">
            <div><div className="font-nunito text-base text-violet-200">Start</div><div className="font-fredoka text-3xl uppercase text-sky-300">{puzzle.start}</div></div>
            <div><div className="font-nunito text-base text-violet-200">Steps</div><div className="font-fredoka text-3xl">{steps}<span className="text-lg text-violet-300"> / {puzzle.steps}</span></div></div>
            <div><div className="font-nunito text-base text-violet-200">Goal</div><div className="font-fredoka text-3xl uppercase text-green-300">{puzzle.end}</div></div>
          </div>

          {/* Ladder so far */}
          <div className="flex flex-wrap gap-2 justify-center items-center">
            {chain.map((w, i) => (
              <Fragment key={i}>
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className={`px-3 py-1 rounded-xl font-fredoka text-2xl uppercase ${i === 0 ? 'bg-sky-500/80' : w === puzzle.end ? 'bg-green-500' : 'bg-violet-500/80'}`}>
                  {w.split('').map((ch, k) => (
                    <span key={k} className={i > 0 && chain[i - 1][k] !== ch ? 'text-yellow-300' : ''}>{ch}</span>
                  ))}
                </motion.div>
                {i < chain.length - 1 && <span className="text-violet-300 text-xl">→</span>}
              </Fragment>
            ))}
            {!won && !gaveUp && <><span className="text-violet-300 text-xl">→ … →</span>
              <div className="px-3 py-1 rounded-xl font-fredoka text-2xl uppercase border-2 border-dashed border-green-300/70 text-green-200">{puzzle.end}</div></>}
          </div>

          {/* Typing row */}
          <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -7, 7, 0] } : undefined} transition={{ duration: 0.35 }}
            className="flex gap-2 justify-center">
            {Array.from({ length: len }, (_, i) => {
              const ch = input[i] ?? '';
              const changed = ch && ch !== last[i];
              return (
                <div key={i}
                  className={`flex items-center justify-center rounded-xl font-fredoka text-4xl uppercase w-16 h-16 border-2 ${ch ? (changed ? 'bg-yellow-400/30 border-yellow-300' : 'bg-white/15 border-white/50') : 'bg-white/5 border-white/20 text-white/30'}`}>
                  {ch || last[i]}
                </div>
              );
            })}
          </motion.div>
          <div className="min-h-[28px] text-center font-nunito text-lg">
            <AnimatePresence>
              {error && <motion.p key={error} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-rose-300">{error}</motion.p>}
              {!error && won && <p className="text-green-300">🎉 You reached {puzzle.end.toUpperCase()}!</p>}
              {!error && !won && !gaveUp && <p className="text-violet-200">💡 {ladderHint(puzzle)}</p>}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={undo} disabled={!canType || chain.length <= 1} className="min-h-[48px] px-4 rounded-2xl bg-white/15 font-fredoka text-lg disabled:opacity-40">↩️ Undo</button>
            <button onClick={hint} disabled={!canType} className="min-h-[48px] px-4 rounded-2xl bg-sky-600 font-fredoka text-lg disabled:opacity-40">💡 Next word (−{HINT_COST})</button>
            <button onClick={showMe} disabled={!canType} className="min-h-[48px] px-4 rounded-2xl bg-white/15 font-fredoka text-lg disabled:opacity-40">🙈 Show me</button>
          </div>

          <div className="w-full mt-auto pb-1">
            <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} enterLabel="Go!" disabled={!canType} />
          </div>
        </div>
      </div>
    </GameShell>
  );
}
