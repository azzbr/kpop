import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import { useGameStore } from '../../store';
import { quizSources, pickFrom } from '../../online/quiz/sources';
import { prepare, publicQuestion, toOriginal, isCorrect, classicPoints, correctText } from '../../online/quiz/quizLogic';
import type { PreparedQuestion } from '../../online/quiz/quizLogic';
import AnswerPad from '../quiz/AnswerPad';
import type { PadAnswer } from '../quiz/AnswerPad';
import { playCorrect, playWrong, startQuizMusic } from '../../utils/sounds';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { takeArenaSource } from './quizArenaSource';

type ArenaMode = 'classic' | 'lightning';
const MODES: Record<ArenaMode, { label: string; emoji: string; secs: number; count: number; blurb: string }> = {
  classic: { label: 'Classic', emoji: '🏆', secs: 20, count: 10, blurb: '10 questions, 20 s each' },
  lightning: { label: 'Lightning', emoji: '⚡', secs: 8, count: 12, blurb: '12 questions, 8 s each — think fast!' },
};

export default function QuizArena() {
  const myQuizzes = useGameStore(s => s.myQuizzes);
  const setIsPlaying = useGameStore(s => s.setIsPlaying);
  const sources = useMemo(() => quizSources(myQuizzes), [myQuizzes]);
  const [sourceId, setSourceId] = useState(() => takeArenaSource() ?? sources[0].id);
  const [mode, setMode] = useState<ArenaMode>('classic');
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [qs, setQs] = useState<PreparedQuestion[]>([]);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [left, setLeft] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean | null; gain: number; answer: string; fact?: string } | null>(null);
  const shownAt = useRef(0);
  const startedAt = useRef(0);
  // advance() runs from a timeout scheduled before the last setState lands, so count in a ref.
  const rightRef = useRef(0);
  const later = useSafeTimeout();
  const source = sources.find(s => s.id === sourceId) ?? sources[0];
  const cfg = MODES[mode];

  useEffect(() => {
    const was = useGameStore.getState().isPlaying;
    setIsPlaying(false);
    return () => { if (was) setIsPlaying(true); };
  }, [setIsPlaying]);

  const start = () => {
    const rng = createRng(Date.now() % 1e9);
    setQs(pickFrom(source, cfg.count, rng).map(q => prepare(q, rng)));
    setN(0); setScore(0); setStreak(0); setCorrectCount(0); setFeedback(null);
    rightRef.current = 0;
    setRound(r => r + 1);
    shownAt.current = Date.now();
    startedAt.current = Date.now();
    setLeft(cfg.secs);
    setStatus('playing');
  };

  const finish = useCallback((rightTotal: number) => {
    const st = useGameStore.getState();
    // Keep the quiz badges (Quiz Master, Brainiac, Perfect Score, Speed Demon) working.
    useGameStore.setState({ totalQuizzesCompleted: st.totalQuizzesCompleted + 1 });
    if (qs.length >= 5 && rightTotal === qs.length) st.unlockBadge('perfect_score');
    if (qs.length >= 10 && (Date.now() - startedAt.current) / 1000 <= 120) st.unlockBadge('speed_demon');
    st.checkAndAwardBadges();
    setStatus('over');
  }, [qs.length]);

  const advance = useCallback(() => {
    setFeedback(null);
    if (n + 1 >= qs.length) { finish(rightRef.current); return; }
    setN(n + 1);
    shownAt.current = Date.now();
    setLeft(cfg.secs);
  }, [n, qs.length, finish, cfg.secs]);

  const submit = useCallback((pad: PadAnswer | null) => {
    if (feedback || status !== 'playing') return;
    const prep = qs[n];
    const ok = pad ? isCorrect(prep.q, toOriginal(prep, pad)) : false;
    const ms = Date.now() - shownAt.current;
    const nextStreak = ok ? streak + 1 : ok === null ? streak : 0;
    const gain = ok ? classicPoints(true, ms, cfg.secs * 1000, nextStreak) : 0;
    if (ok) {
      playCorrect();
      useGameStore.setState(s => ({ totalCorrectAnswers: s.totalCorrectAnswers + 1, currentStreak: nextStreak }));
      useGameStore.getState().checkAndAwardBadges();
    } else if (ok === false) playWrong();
    setStreak(nextStreak);
    setScore(s => s + gain);
    if (ok) { rightRef.current++; setCorrectCount(rightRef.current); }
    setFeedback({ ok, gain, answer: correctText(prep.q), fact: prep.q.fact });
    later(advance, ok ? 1400 : 2600);
  }, [feedback, status, qs, n, streak, cfg.secs, later, advance]);

  // Countdown (pauses with the game).
  useEffect(() => {
    if (status !== 'playing' || feedback) return;
    if (left <= 0) { submit(null); return; }
    const id = window.setTimeout(() => setLeft(l => l - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, status, feedback, submit]);

  useEffect(() => {
    if (status !== 'playing' || feedback) return;
    return startQuizMusic(() => left <= 3);
  }, [status, feedback, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const prep = qs[n];
  const pub = prep ? publicQuestion(prep) : null;
  const chip = (on: boolean) => `min-h-[44px] px-3 rounded-xl font-fredoka text-base ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;

  return (
    <GameShell
      gameId="quiz_arena"
      title="Quiz Arena"
      icon="❓"
      xpScale={180}
      status={status}
      score={score}
      round={round}
      overTitle={`${correctCount}/${qs.length} right · ${source.emoji} ${source.title}`}
      overStats={[{ label: 'Right answers', value: `${correctCount}/${qs.length}` }, { label: 'Mode', value: `${cfg.emoji} ${cfg.label}` }]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => { shownAt.current = Date.now() - (cfg.secs - left) * 1000; setStatus('playing'); }}
      readyContent={
        <div className="text-left space-y-3 max-h-[50dvh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(MODES) as ArenaMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} className={`${chip(mode === m)} text-left py-2`}>
                <div>{MODES[m].emoji} {MODES[m].label}</div>
                <div className="font-nunito text-xs opacity-80">{MODES[m].blurb}</div>
              </button>
            ))}
          </div>
          {(['Topics', 'My quizzes', 'School', 'Music'] as const).map(g => {
            const list = sources.filter(s => s.group === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <div className="font-nunito text-sm text-violet-300 mb-1">{g}</div>
                <div className="flex flex-wrap gap-2">
                  {list.map(s => <button key={s.id} onClick={() => setSourceId(s.id)} className={chip(sourceId === s.id)}>{s.emoji} {s.title}</button>)}
                </div>
              </div>
            );
          })}
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto px-3 py-3">
        {pub && (
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between font-fredoka text-lg mb-2">
              <span className="rounded-full bg-white/10 px-3 py-1">Q {n + 1}/{qs.length}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">⭐ {score.toLocaleString()} {streak >= 2 && `· 🔥${streak}`}</span>
              <span className={`rounded-full px-3 py-1 ${left <= 3 ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`}>⏱️ {left}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 mb-3 overflow-hidden">
              <motion.div className="h-full bg-fuchsia-400" animate={{ width: `${(left / cfg.secs) * 100}%` }} transition={{ ease: 'linear', duration: 1 }} />
            </div>
            <div className="rounded-3xl bg-white text-slate-900 px-5 py-5 mb-4 text-center shadow-xl">
              {pub.emoji && <div className="text-6xl mb-2">{pub.emoji}</div>}
              <h2 className="font-fredoka text-2xl md:text-3xl leading-tight">{pub.text}</h2>
            </div>
            <AnimatePresence mode="wait">
              {feedback ? (
                <motion.div key="fb" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className={`rounded-3xl p-5 text-center ${feedback.ok === null ? 'bg-indigo-600' : feedback.ok ? 'bg-green-600' : 'bg-rose-600'}`}>
                  <div className="text-5xl">{feedback.ok === null ? '🗳️' : feedback.ok ? '🎉' : '💪'}</div>
                  <div className="font-fredoka text-3xl">{feedback.ok === null ? 'Noted!' : feedback.ok ? `+${feedback.gain}` : left <= 0 ? "Time's up!" : 'Not quite!'}</div>
                  {feedback.ok === false && feedback.answer && <div className="font-nunito text-lg">The answer was <b>{feedback.answer}</b></div>}
                  {feedback.fact && <div className="font-nunito text-base mt-2">💡 {feedback.fact}</div>}
                </motion.div>
              ) : (
                <motion.div key={`q${n}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <AnswerPad question={pub} onAnswer={submit} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </GameShell>
  );
}
