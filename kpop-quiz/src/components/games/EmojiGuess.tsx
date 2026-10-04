import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import { EMOJI_PUZZLES } from '../../online/emojiPuzzles';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import ConfettiBurst from '../ConfettiBurst';
import { playCorrect, playWrong, playClick, playTick, playTimeOut, playPerfect } from '../../utils/sounds';
import { drawFresh } from './drawLogic';
import { ROUND_SIZE, PUZZLE_SECS, choicesFor, checkTyped, hintFor, firstLetters, starsFor } from './emojiGuessLogic';

type Mode = 'choice' | 'type';
const MAX_TYPED = 24;

// Puzzles seen earlier this session, so "Play again" brings new ones.
const seenPuzzles = new Set<number>();

interface Feedback { ok: boolean; timeUp: boolean; picked?: string; stars: number }

export default function EmojiGuess() {
  const [mode, setMode] = useState<Mode>('choice');
  const [playMode, setPlayMode] = useState<Mode>('choice');
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [choices, setChoices] = useState<string[][]>([]);
  const [n, setN] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [stars, setStars] = useState(0);
  const [hint, setHint] = useState(false);
  const [left, setLeft] = useState(PUZZLE_SECS);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [typed, setTyped] = useState('');
  const [shake, setShake] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);

  const start = () => {
    const rng = createRng(Date.now() % 1e9);
    const idx = drawFresh(EMOJI_PUZZLES.length, ROUND_SIZE, seenPuzzles, rng);
    setOrder(idx);
    setChoices(idx.map(i => choicesFor(i, rng)));
    setPlayMode(mode);
    setN(0); setCorrect(0); setStars(0); setHint(false); setTyped(''); setNudge(null);
    setLeft(PUZZLE_SECS);
    setFeedback(null);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const puzzle = order.length ? EMOJI_PUZZLES[order[n]] : undefined;
  const live = status === 'playing' && !feedback && !!puzzle;

  const resolve = useCallback((ok: boolean, timeUp: boolean, picked?: string) => {
    const s = starsFor(ok, hint);
    if (ok) { playCorrect(); setCorrect(c => c + 1); setStars(t => t + s); }
    else if (timeUp) playTimeOut();
    else playWrong();
    setFeedback({ ok, timeUp, picked, stars: s });
  }, [hint]);

  const advance = useCallback(() => {
    if (n + 1 >= order.length) {
      if (correct === order.length) playPerfect();
      setStatus('over');
      return;
    }
    setN(n + 1);
    setFeedback(null);
    setHint(false);
    setTyped('');
    setNudge(null);
    setLeft(PUZZLE_SECS);
  }, [n, order.length, correct]);

  // Countdown — only runs while playing, so pausing freezes it.
  useEffect(() => {
    if (!live) return;
    if (left <= 0) { resolve(false, true); return; }
    const id = window.setTimeout(() => {
      if (left <= 4) playTick();
      setLeft(l => l - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [left, live, resolve]);

  // Move on after the answer is shown (also frozen while paused).
  useEffect(() => {
    if (status !== 'playing' || !feedback) return;
    const id = window.setTimeout(advance, feedback.ok ? 1500 : 2600);
    return () => window.clearTimeout(id);
  }, [status, feedback, advance]);

  const pick = (c: string) => {
    if (!live || !puzzle) return;
    resolve(c === puzzle.answer, false, c);
  };

  const onKey = useCallback((l: string) => {
    if (!live) return;
    setTyped(t => (t.length < MAX_TYPED && !(l === ' ' && (t === '' || t.endsWith(' '))) ? t + l.toUpperCase() : t));
  }, [live]);
  const onBackspace = useCallback(() => { if (live) setTyped(t => t.slice(0, -1)); }, [live]);
  const onEnter = useCallback(() => {
    if (!live || !puzzle || !typed.trim()) return;
    if (checkTyped(typed, puzzle)) { resolve(true, false, typed); return; }
    playWrong();
    setShake(s => s + 1);
    setNudge('Not quite — try again! 💪');
  }, [live, puzzle, typed, resolve]);

  const showHint = () => {
    if (!live || hint) return;
    playClick();
    setHint(true);
  };

  const chip = (on: boolean) => `min-h-[56px] rounded-2xl px-3 py-2 font-fredoka text-lg text-left ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;
  const opts = choices[n] ?? [];

  return (
    <GameShell
      gameId="emoji_guess"
      title="Emoji Guess"
      icon="🧩"
      xpScale={0.25}
      status={status}
      score={correct}
      round={round}
      formatScore={s => `${s}/${ROUND_SIZE}`}
      overTitle={correct === order.length ? 'Perfect round! 🌟' : correct >= 7 ? 'Emoji expert! 😎' : 'Nice decoding! 🕵️'}
      overStats={[
        { label: 'Stars', value: `⭐ ${stars}` },
        { label: 'Mode', value: playMode === 'choice' ? '🔘 Pick' : '⌨️ Type' },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-3 text-left">
          <p className="font-nunito text-lg text-violet-100 text-center">
            What do the emoji spell out? {ROUND_SIZE} puzzles, {PUZZLE_SECS} seconds each. A hint costs stars ⭐ (3 → 1).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('choice')} className={chip(mode === 'choice')}>
              <div>🔘 Pick it</div>
              <div className="font-nunito text-sm opacity-80">Choose from 4 answers</div>
            </button>
            <button onClick={() => setMode('type')} className={chip(mode === 'type')}>
              <div>⌨️ Type it</div>
              <div className="font-nunito text-sm opacity-80">Spell the answer — harder!</div>
            </button>
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {feedback?.ok && <ConfettiBurst key={n} count={30} durationMs={1500} />}
        {puzzle && (
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            <div className="flex justify-between items-center font-fredoka text-lg">
              <span className="rounded-full bg-white/10 px-3 py-1">🧩 {n + 1}/{order.length}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">✅ {correct} · ⭐ {stars}</span>
              <span className={`rounded-full px-3 py-1 ${left <= 5 && live ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`}>⏱️ {left}</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <motion.div className={`h-full ${left <= 5 ? 'bg-red-400' : 'bg-fuchsia-400'}`}
                initial={false} animate={{ width: `${(left / PUZZLE_SECS) * 100}%` }} transition={{ ease: 'linear', duration: live ? 1 : 0.2 }} />
            </div>

            <motion.div key={`p${n}`} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="rounded-3xl bg-white text-slate-900 px-4 py-5 text-center shadow-xl">
              <div className="text-7xl md:text-8xl leading-tight break-words">{puzzle.emoji}</div>
              <div className="mt-2 min-h-[32px] font-nunito text-lg text-slate-600">
                {hint
                  ? <>💡 {hintFor(puzzle)}{playMode === 'type' && <span className="ml-2 font-fredoka tracking-widest text-slate-800">{firstLetters(puzzle.answer)}</span>}</>
                  : 'What is it?'}
              </div>
            </motion.div>

            <AnimatePresence>
              {feedback && (
                <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  className={`rounded-3xl p-4 text-center ${feedback.ok ? 'bg-green-600' : 'bg-indigo-600'}`}>
                  <div className="font-fredoka text-3xl">
                    {feedback.ok ? `🎉 Yes! ${'⭐'.repeat(feedback.stars)}` : feedback.timeUp ? "⏰ Time's up!" : '💪 Good try!'}
                  </div>
                  {!feedback.ok && <div className="font-nunito text-xl mt-1">It was <b className="capitalize">{puzzle.answer}</b></div>}
                </motion.div>
              )}
            </AnimatePresence>

            {playMode === 'choice' ? (
              <div className="grid grid-cols-2 gap-3">
                {opts.map(c => {
                  const isAns = c === puzzle.answer;
                  const tone = !feedback ? 'bg-white/15 active:bg-white/25'
                    : isAns ? 'bg-green-500' : c === feedback.picked ? 'bg-rose-500' : 'bg-white/5 opacity-60';
                  return (
                    <button key={c} disabled={!live} onClick={() => pick(c)}
                      className={`min-h-[72px] rounded-2xl px-3 font-fredoka text-xl md:text-2xl capitalize shadow-md transition-colors ${tone}`}>
                      {c}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <motion.div key={`t${shake}`} animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : undefined} transition={{ duration: 0.35 }}
                  className="min-h-[56px] rounded-2xl bg-white/10 border-2 border-white/30 px-4 flex items-center justify-center font-fredoka text-2xl tracking-wider break-all">
                  {typed || <span className="text-white/40 font-nunito text-lg">Type your answer…</span>}
                </motion.div>
                <div className="min-h-[28px] text-center font-nunito text-lg text-yellow-200">{!feedback && nudge}</div>
                <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={status !== 'playing'} enterLabel="Go" />
              </div>
            )}

            {!feedback && (
              <div className="flex gap-3">
                <button onClick={showHint} disabled={hint || !live}
                  className="flex-1 min-h-[52px] rounded-full bg-yellow-400 text-slate-900 font-fredoka text-lg disabled:opacity-50">
                  {hint ? '💡 Hint shown' : '💡 Hint (⭐3 → ⭐1)'}
                </button>
                {playMode === 'type' && (
                  <button onClick={() => live && resolve(false, false)} disabled={!live}
                    className="min-h-[52px] px-5 rounded-full bg-white/15 font-fredoka text-lg">
                    ⏭️ Skip
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </GameShell>
  );
}
