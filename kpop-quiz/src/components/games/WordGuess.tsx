import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { createRng } from '../../games/engine/rng';
import { useGameStore } from '../../store';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import ConfettiBurst from '../ConfettiBurst';
import { localDateKey } from '../../utils/dates';
import { playCorrect, playPop, playWin, playWrong } from '../../utils/sounds';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import {
  WORD_LEN, MAX_GUESSES, scoreGuess, keyStates, isAllowed, dailyAnswer, randomAnswer,
  liveStreak, startDailyPatch, finishPatch,
} from './wordGuessLogic';
import type { TileState } from './wordGuessLogic';

type Mode = 'daily' | 'unlimited';

const FLIP_MS = 250; // delay between tiles
const COLOR: Record<TileState | 'empty' | 'typed', string> = {
  correct: '#16a34a',
  present: '#eab308',
  absent: '#334155',
  empty: 'rgba(255,255,255,0.04)',
  typed: 'rgba(255,255,255,0.12)',
};
const SQUARE: Record<TileState, string> = { correct: '🟩', present: '🟨', absent: '⬛' };
const TILE_SIZE = 'min(3.9rem, 15vw, 8dvh)';
const CHEERS = ['Genius! 🤯', 'Amazing! 🌟', 'Brilliant! 🎉', 'Great job! 🥳', 'Nice one! 😎', 'Phew, got it! 😅'];

function Tile({ letter, state, reveal, delay }: { letter: string; state: TileState | 'empty' | 'typed'; reveal: boolean; delay: number }) {
  const bg = COLOR[state];
  const scored = state !== 'empty' && state !== 'typed';
  return (
    <motion.div
      initial={reveal ? { rotateX: 0, backgroundColor: COLOR.typed } : false}
      animate={reveal ? { rotateX: [0, 90, 0], backgroundColor: [COLOR.typed, bg, bg] } : { backgroundColor: bg, scale: state === 'typed' ? [1, 1.08, 1] : 1 }}
      transition={reveal ? { duration: 0.5, delay, times: [0, 0.5, 1] } : { duration: 0.12 }}
      className={`flex items-center justify-center rounded-lg font-fredoka uppercase text-white select-none ${scored ? '' : 'border-2'} ${state === 'typed' ? 'border-white/60' : 'border-white/20'}`}
      style={{ width: TILE_SIZE, height: TILE_SIZE, fontSize: `calc(${TILE_SIZE} * 0.55)` }}
    >
      {letter}
    </motion.div>
  );
}

export default function WordGuess() {
  const wg = useGameStore(s => s.wordGuess);
  const setWordGuess = useGameStore(s => s.setWordGuess);
  const today = localDateKey();
  const dailyDone = wg.daily?.date === today && wg.daily.done;
  const dailyInProgress = wg.daily?.date === today && !wg.daily.done && wg.daily.guesses.length > 0;

  const [mode, setMode] = useState<Mode>(dailyDone ? 'unlimited' : 'daily');
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState('');
  const [playMode, setPlayMode] = useState<Mode>('daily');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(0); // rows whose colours are shown on the keyboard
  const [revealing, setRevealing] = useState(-1); // row currently flipping
  const [current, setCurrent] = useState('');
  const [shake, setShake] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const [locked, setLocked] = useState(false);
  const later = useSafeTimeout();

  const effectiveMode: Mode = mode === 'daily' && dailyDone ? 'unlimited' : mode;

  const say = useCallback((msg: string, ms = 1500) => {
    setToast(msg);
    later(() => setToast(t => (t === msg ? null : t)), ms);
  }, [later]);

  const start = () => {
    const m = effectiveMode;
    let ans: string;
    let restored: string[] = [];
    if (m === 'daily') {
      const st = useGameStore.getState().wordGuess;
      const patch = startDailyPatch(st, today);
      if (Object.keys(patch).length) setWordGuess(patch);
      ans = dailyAnswer(today);
      restored = (patch.daily ?? st.daily)?.guesses ?? [];
    } else {
      ans = randomAnswer(createRng(Date.now() % 1e9), dailyAnswer(today));
    }
    setPlayMode(m);
    setAnswer(ans);
    setGuesses(restored);
    setRevealed(restored.length);
    setRevealing(-1);
    setCurrent('');
    setWon(false);
    setLocked(false);
    setToast(null);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const canType = status === 'playing' && !locked;

  const onKey = useCallback((l: string) => {
    if (!canType) return;
    setCurrent(c => (c.length < WORD_LEN ? c + l.toUpperCase() : c));
  }, [canType]);

  const onBackspace = useCallback(() => {
    if (!canType) return;
    setCurrent(c => c.slice(0, -1));
  }, [canType]);

  const onEnter = useCallback(() => {
    if (!canType) return;
    if (current.length < WORD_LEN) {
      setShake(s => s + 1);
      say('Not enough letters');
      return;
    }
    if (!isAllowed(current)) {
      setShake(s => s + 1);
      playWrong();
      say('Not in word list');
      return;
    }
    const next = [...guesses, current];
    const row = guesses.length;
    const solved = current === answer;
    const finished = solved || next.length >= MAX_GUESSES;
    setGuesses(next);
    setCurrent('');
    setRevealing(row);
    setLocked(true);
    for (let i = 0; i < WORD_LEN; i++) later(playPop, i * FLIP_MS + 250);

    // Save straight away so a reload mid-animation keeps the board.
    const st = useGameStore.getState().wordGuess;
    if (finished) setWordGuess(finishPatch(st, solved, playMode === 'daily', next, today));
    else if (playMode === 'daily') setWordGuess({ daily: { date: today, guesses: next, done: false, won: false } });

    const flipDone = FLIP_MS * (WORD_LEN - 1) + 550;
    later(() => {
      setRevealed(next.length);
      setRevealing(-1);
      if (!finished) { setLocked(false); return; }
      if (solved) {
        setWon(true);
        playWin();
        say(CHEERS[Math.min(row, CHEERS.length - 1)], 2000);
      } else {
        playCorrect();
        say(`The word was ${answer} — so close! 💪`, 2600);
      }
      later(() => setStatus('over'), solved ? 2000 : 2600);
    }, flipDone);
  }, [canType, current, guesses, answer, playMode, today, setWordGuess, say, later]);

  const kb = useMemo(() => keyStates(guesses.slice(0, revealed), answer), [guesses, revealed, answer]);

  const streakNow = liveStreak(wg, today);
  const winPct = wg.played ? Math.round((wg.won / wg.played) * 100) : 0;
  const dailyGrid = dailyDone && wg.daily
    ? wg.daily.guesses.map(g => scoreGuess(g, dailyAnswer(today)).map(s => SQUARE[s]).join('')).join('\n')
    : '';

  const chip = (on: boolean, disabled?: boolean) =>
    `min-h-[56px] rounded-2xl px-3 py-2 font-fredoka text-lg text-left ${on ? 'bg-fuchsia-500' : 'bg-white/10'} ${disabled ? 'opacity-50' : ''}`;

  const stats = (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[['Played', wg.played], ['Win %', winPct], ['🔥 Streak', streakNow], ['Best', wg.bestStreak]].map(([l, v]) => (
        <div key={l} className="rounded-xl bg-white/10 py-2">
          <div className="font-fredoka text-2xl">{v}</div>
          <div className="font-nunito text-xs text-violet-200">{l}</div>
        </div>
      ))}
    </div>
  );

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => {
    if (r < guesses.length) {
      const g = guesses[r];
      const sc = scoreGuess(g, answer);
      const showColour = r < revealed || r === revealing;
      return (
        <div key={r} className="flex gap-1.5 justify-center">
          {g.split('').map((l, i) => (
            <Tile key={i} letter={l} state={showColour ? sc[i] : 'typed'} reveal={r === revealing} delay={(i * FLIP_MS) / 1000} />
          ))}
        </div>
      );
    }
    if (r === guesses.length && status !== 'over' && !won) {
      return (
        <motion.div key={`cur-${shake}`} className="flex gap-1.5 justify-center"
          animate={shake ? { x: [0, -12, 12, -9, 9, -4, 0] } : undefined} transition={{ duration: 0.4 }}>
          {Array.from({ length: WORD_LEN }, (_, i) => (
            <Tile key={i} letter={current[i] ?? ''} state={current[i] ? 'typed' : 'empty'} reveal={false} delay={0} />
          ))}
        </motion.div>
      );
    }
    return (
      <div key={r} className="flex gap-1.5 justify-center">
        {Array.from({ length: WORD_LEN }, (_, i) => <Tile key={i} letter="" state="empty" reveal={false} delay={0} />)}
      </div>
    );
  });

  return (
    <GameShell
      gameId="word_guess"
      title="Word Guess"
      icon="🔤"
      xpScale={0.033}
      status={status}
      score={won ? 1 : 0}
      round={round}
      formatScore={s => (s ? '✅ Solved' : '—')}
      overTitle={won ? `Solved in ${guesses.length}/${MAX_GUESSES}! 🎉` : `The word was ${answer}`}
      overStats={[
        { label: playMode === 'daily' ? '🔥 Daily streak' : 'Mode', value: playMode === 'daily' ? String(useGameStore.getState().wordGuess.streak) : '♾️ Unlimited' },
        { label: 'Guesses', value: `${guesses.length}/${MAX_GUESSES}` },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      startLabel={effectiveMode === 'daily' && dailyInProgress ? '▶ Keep going' : '▶ Play'}
      readyContent={
        <div className="text-left space-y-3">
          <p className="font-nunito text-lg text-violet-100 text-center">
            Guess the secret 5-letter word in 6 tries. 🟩 right spot · 🟨 in the word · ⬛ not in it.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={dailyDone} onClick={() => setMode('daily')} className={chip(effectiveMode === 'daily', dailyDone)}>
              <div>📅 Daily</div>
              <div className="font-nunito text-sm opacity-80">{dailyDone ? 'Done today ✔️' : dailyInProgress ? `In progress · ${wg.daily?.guesses.length}/6` : 'Same word for everyone today'}</div>
            </button>
            <button onClick={() => setMode('unlimited')} className={chip(effectiveMode === 'unlimited')}>
              <div>♾️ Unlimited</div>
              <div className="font-nunito text-sm opacity-80">A new random word every game</div>
            </button>
          </div>
          {dailyDone && wg.daily && (
            <div className="rounded-2xl bg-white/10 p-3 text-center">
              <div className="font-fredoka text-xl">{wg.daily.won ? `Today's word solved in ${wg.daily.guesses.length}/6! 🎉` : `Today's word was ${dailyAnswer(today)} 💪`}</div>
              <pre className="font-sans text-xl leading-tight my-2">{dailyGrid}</pre>
              <div className="font-nunito text-base text-violet-200">Come back tomorrow for a new daily word! 🌅 Try Unlimited now.</div>
            </div>
          )}
          {stats}
        </div>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {won && <ConfettiBurst count={60} durationMs={2500} />}
        <div className="max-w-xl mx-auto flex flex-col items-center gap-3 min-h-full">
          <div className="flex gap-2 font-fredoka text-base">
            <span className="rounded-full bg-white/10 px-3 py-1">{playMode === 'daily' ? '📅 Daily' : '♾️ Unlimited'}</span>
            {playMode === 'daily' && <span className="rounded-full bg-white/10 px-3 py-1">🔥 {wg.streak}</span>}
          </div>
          <div className="relative flex flex-col gap-1.5" style={{ perspective: 600 }}>
            {rows}
            <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
              <AnimatePresence>
                {toast && (
                  <motion.div key={toast} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="w-max max-w-[85vw] text-center rounded-xl bg-white text-slate-900 px-4 py-2 font-fredoka text-lg shadow-xl">
                    {toast}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="w-full mt-auto pb-1">
            <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} states={kb} disabled={status !== 'playing'} />
          </div>
        </div>
      </div>
    </GameShell>
  );
}
