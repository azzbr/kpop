import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { createRng } from '../games/engine/rng';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playCorrect, playWrong, playClick, playPop, playTick, playTimeOut } from '../utils/sounds';
import { SCRAMBLE_WORDS, WORDS_PER_ROUND, TIME_PER_WORD, shuffled, scramble, wordPoints, rating } from './games/wordScrambleLogic';
import type { ScrambleWord } from './games/wordScrambleLogic';

type Feedback = 'correct' | 'wrong' | 'timeout' | 'skip' | null;

export default function WordScramble() {
  const later = useSafeTimeout();
  const rng = useRef(createRng((Date.now() ^ (Math.random() * 1e9)) >>> 0));
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  // Pause when she switches apps
  useEffect(() => {
    const h = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  const [pool, setPool] = useState<ScrambleWord[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [letters, setLetters] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_WORD);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [lastPoints, setLastPoints] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const item = pool[wordIndex];
  const active = status === 'playing' && !!item && (feedback === null || feedback === 'wrong');

  const loadWord = (list: ScrambleWord[], idx: number) => {
    setWordIndex(idx);
    setLetters(scramble(list[idx].word, rng.current));
    setSelected([]);
    setTimeLeft(TIME_PER_WORD);
    setFeedback(null);
  };

  const start = () => {
    const list = shuffled(SCRAMBLE_WORDS, rng.current).slice(0, WORDS_PER_ROUND);
    setPool(list);
    loadWord(list, 0);
    setScore(0);
    setStreak(0);
    setSolved(0);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const advance = () => {
    const next = wordIndex + 1;
    if (next >= pool.length) setStatus('over');
    else loadWord(pool, next);
  };

  // Per-word countdown (stops while paused or while a result is showing)
  useEffect(() => {
    if (status !== 'playing' || !item || (feedback && feedback !== 'wrong')) return;
    if (timeLeft <= 0) {
      playTimeOut();
      setFeedback('timeout');
      setStreak(0);
      later(advance, 1600);
      return;
    }
    if (timeLeft <= 4) playTick();
    const id = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => window.clearTimeout(id);
    // advance is recreated every render; adding it would restart the tick on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, feedback, status, item, later]);

  const pick = (idx: number) => {
    if (!active || selected.includes(idx)) return;
    playPop();
    const next = [...selected, idx];
    setSelected(next);
    if (feedback === 'wrong') setFeedback(null);
    if (next.length !== item.word.length) return;
    const guess = next.map(i => letters[i]).join('');
    if (guess === item.word) {
      const pts = wordPoints(timeLeft, streak);
      playCorrect();
      setLastPoints(pts);
      setScore(s => s + pts);
      setStreak(s => s + 1);
      setSolved(s => s + 1);
      setFeedback('correct');
      later(advance, 1200);
    } else {
      playWrong();
      setStreak(0);
      setFeedback('wrong');
      later(() => setSelected([]), 600);
    }
  };

  const unpick = (pos: number) => {
    if (!active) return;
    playClick();
    setSelected(prev => prev.filter((_, i) => i !== pos));
  };

  const skip = () => {
    if (!active) return;
    playClick();
    setStreak(0);
    setFeedback('skip');
    later(advance, 1400);
  };

  const timerColor = timeLeft > 8 ? 'text-green-300' : timeLeft > 4 ? 'text-orange-300' : 'text-rose-400';
  const showAnswer = feedback === 'timeout' || feedback === 'skip';

  return (
    <GameShell
      gameId="word_scramble"
      title="Word Scramble"
      icon="🔤"
      xpScale={40}
      status={status}
      score={score}
      round={round}
      overTitle={rating(solved, pool.length || WORDS_PER_ROUND)}
      overStats={[
        { label: '✅ Words solved', value: `${solved}/${pool.length || WORDS_PER_ROUND}` },
        { label: '🎯 Rating', value: rating(solved, pool.length || WORDS_PER_ROUND).split(' ')[0] },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <p className="font-nunito text-lg text-violet-100">
          {WORDS_PER_ROUND} jumbled words, {TIME_PER_WORD} seconds each. Tap the letters in the right order. Faster answers and streaks score more!
        </p>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {item && (
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between font-fredoka text-lg">
              <span className="rounded-full bg-white/10 px-4 py-1">Word {wordIndex + 1}/{pool.length}</span>
              <span className="rounded-full bg-white/10 px-4 py-1 text-yellow-300 tabular-nums">⭐ {score}</span>
              <span className="rounded-full bg-white/10 px-4 py-1">{streak >= 2 ? `🔥 ${streak} streak` : '🔥 —'}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-fuchsia-500 to-orange-400 transition-all duration-500"
                style={{ width: `${(wordIndex / pool.length) * 100}%` }} />
            </div>

            <motion.div key={wordIndex} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              className={`w-full rounded-3xl p-5 text-center border-2 ${
                feedback === 'correct' ? 'bg-green-600/30 border-green-400'
                : showAnswer ? 'bg-orange-500/20 border-orange-300'
                : 'bg-indigo-900/80 border-fuchsia-400/40'}`}>
              <div className="text-6xl mb-1">{item.emoji}</div>
              <p className="font-nunito text-xl text-violet-100">Hint: {item.hint}</p>
              <div className={`font-fredoka text-4xl mt-2 tabular-nums ${timerColor}`}>⏱ {timeLeft}s</div>
              <div className="min-h-[40px] mt-1">
                <AnimatePresence>
                  {feedback && (
                    <motion.div key={feedback} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                      className="font-fredoka text-2xl">
                      {feedback === 'correct' ? <span className="text-green-300">✅ {item.word}! +{lastPoints}</span>
                        : feedback === 'wrong' ? <span className="text-orange-200">Not quite — try again! 💪</span>
                        : <span className="text-orange-200">The word was {item.word} 🙂</span>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Answer slots */}
            <div className="flex justify-center gap-2 flex-wrap">
              {Array.from({ length: item.word.length }, (_, pos) => {
                const letter = showAnswer ? item.word[pos] : selected[pos] !== undefined ? letters[selected[pos]] : '';
                return (
                  <button key={pos} type="button" onClick={() => letter && !showAnswer && unpick(pos)}
                    aria-label={letter ? `Remove ${letter}` : 'Empty'}
                    className={`w-12 h-14 md:w-14 md:h-16 rounded-xl font-fredoka text-3xl flex items-center justify-center border-2 ${
                      letter ? 'bg-fuchsia-500 border-fuchsia-300' : 'bg-white/5 border-dashed border-white/30'}`}>
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* Letters to pick */}
            <div className="flex justify-center gap-2 flex-wrap">
              {letters.map((letter, idx) => {
                const used = selected.includes(idx);
                return (
                  <motion.button key={`${wordIndex}-${idx}`} type="button" whileTap={!used ? { scale: 0.9 } : undefined}
                    onClick={() => pick(idx)} disabled={used || !active}
                    className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl font-fredoka text-3xl shadow-lg ${
                      used ? 'bg-white/5 text-white/20' : 'bg-yellow-400 text-slate-900'}`}>
                    {letter}
                  </motion.button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => { if (active) { playClick(); setSelected([]); } }} disabled={!active || !selected.length}
                className="min-h-[48px] px-5 rounded-2xl bg-white/15 font-fredoka text-lg disabled:opacity-40">✕ Clear</button>
              <button type="button" onClick={skip} disabled={!active}
                className="min-h-[48px] px-5 rounded-2xl bg-white/15 font-fredoka text-lg disabled:opacity-40">⏭️ Skip</button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
