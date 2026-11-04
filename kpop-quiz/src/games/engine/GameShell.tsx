import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoundResult } from '../../store';
import ConfettiBurst from '../../components/ConfettiBurst';
import { playClick, playNote, playWin, playWrong } from '../../utils/sounds';
import { BACK_EVENT } from '../../utils/backGuard';
import { buzz } from '../../utils/haptics';
import { MUSIC_EVENT } from '../../utils/appEvents';
import { MASTERY, nextStarAt, prevStarAt, starsFor } from '../../data/mastery';
import { STAR_COINS } from '../../store';
import type { GameState } from '../../store';

const STAR_STEP_S = 0.18;

export type ShellStatus = 'ready' | 'playing' | 'paused' | 'over';

interface GameShellProps {
  gameId: string;
  title: string;
  icon: string;
  /** Score points per 1 XP. Rewards follow one rule for every game — see store.finishRound. */
  xpScale: number;
  status: ShellStatus;
  /** Final score, read when status becomes 'over'. */
  score: number;
  /** Increments every new round, so the reward is given exactly once per round. */
  round: number;
  formatScore?: (score: number) => string;
  /** Headline on the game-over card, e.g. "Knocked out by Foxy!". */
  overTitle?: string;
  /** Extra lines on the game-over card. */
  overStats?: { label: string; value: string }[];
  /** Shown on the start card (rules, difficulty picker…). */
  readyContent?: ReactNode;
  startLabel?: string;
  /** Party games end on a celebration: always play the win sound, never the 'wrong' one. */
  celebrateEnd?: boolean;
  /** Back (and "Pick another game") go here instead of the game grid — e.g. a game's own menu. */
  onBack?: () => void;
  /** Label of the over card's play-again button (default "🔁 Play again"). */
  againLabel?: string;
  /** Label of the over card's leave button (default "Pick another game"). */
  leaveLabel?: string;
  /** Extra content on the over card, above its buttons (e.g. Robo Quest's "Try for ⭐⭐⭐"). */
  overExtra?: ReactNode;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  children: ReactNode;
}

export default function GameShell(props: GameShellProps) {
  const { gameId, title, icon, xpScale, status, score, round, formatScore = s => s.toLocaleString() } = props;
  const setGameState = useGameStore(s => s.setGameState);
  const best = useGameStore(s => s.highScores[gameId] ?? 0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const rewarded = useRef(-1);

  useEffect(() => {
    if (status !== 'over' || rewarded.current === round) return;
    rewarded.current = round;
    const res = useGameStore.getState().finishRound(gameId, score, xpScale);
    setResult(res);
    if ((res.isBest && score > 0) || props.celebrateEnd) playWin(); else playWrong();
    // Vibrate (Android) for happy moments only — never for a plain loss.
    const great = (res.isBest && score > 0) || (res.starsAfter ?? 0) > (res.starsBefore ?? 0) || res.dailyDone || !!res.newBadges?.length;
    if (great) buzz('great'); else if (props.celebrateEnd) buzz('good');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, round, score, gameId, xpScale]);

  useEffect(() => { if (status === 'playing') setResult(null); }, [status]);

  // A chime for each new star as it pops in on the game-over card.
  useEffect(() => {
    if (!result) return;
    const from = result.starsBefore ?? 0;
    const timers: number[] = [];
    for (let i = from; i < (result.starsAfter ?? 0); i++) {
      timers.push(window.setTimeout(() => playNote(1046.5 + (i - from) * 262, 0.22, 'triangle', 0.12), (0.35 + i * STAR_STEP_S) * 1000));
    }
    return () => timers.forEach(t => clearTimeout(t));
  }, [result]);

  // The music button moves into this header while a game is on screen (MusicPlayer reads inGame).
  useEffect(() => {
    useGameStore.getState().setInGame(true);
    return () => useGameStore.getState().setInGame(false);
  }, []);

  const back = () => {
    playClick();
    if (props.onBack) props.onBack(); else setGameState('game_mode');
  };

  // Installed app: the back gesture pauses a running round first (utils/backGuard.ts).
  const live = useRef({ status, onPause: props.onPause });
  live.current = { status, onPause: props.onPause };
  useEffect(() => {
    const onBack = (e: Event) => {
      if (live.current.status !== 'playing') return;
      e.preventDefault();
      live.current.onPause();
    };
    window.addEventListener(BACK_EVENT, onBack);
    return () => window.removeEventListener(BACK_EVENT, onBack);
  }, []);

  // Switching apps or locking the screen pauses a running round (some games also do this themselves).
  useEffect(() => {
    const onVis = () => { if (document.hidden && live.current.status === 'playing') live.current.onPause(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Keep the screen awake while a round runs (no dimming mid-puzzle). Released on pause, game over
  // and when leaving; the browser drops it by itself when the app is hidden.
  useEffect(() => {
    if (status !== 'playing') return;
    type Lock = { release: () => Promise<void> };
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }).wakeLock;
    let lock: Lock | null = null;
    let done = false;
    wl?.request('screen').then(l => { if (done) l.release().catch(() => {}); else lock = l; }).catch(() => { /* not allowed or unsupported */ });
    return () => { done = true; lock?.release().catch(() => {}); };
  }, [status]);

  const openMusic = () => {
    playClick();
    if (status === 'playing') props.onPause();
    window.dispatchEvent(new Event(MUSIC_EVENT));
  };

  return (
    <div className="arcade-bg game-surface fixed inset-0 z-40 flex flex-col text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {result?.isBest && score > 0 && <ConfettiBurst count={80} durationMs={3000} />}

      <header className="flex items-center gap-3 px-3 py-2 bg-black/30">
        <button data-back onClick={back} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
        <h1 className="flex-1 font-fredoka text-xl md:text-2xl truncate">{icon} {title}</h1>
        <span className="font-nunito text-yellow-300 text-base hidden sm:block">🏅 {formatScore(best)}</span>
        <button onClick={openMusic} className="min-h-[48px] min-w-[48px] rounded-full bg-white/15 text-2xl" aria-label="Music">🎵</button>
        {status === 'playing' && (
          <button onClick={() => { playClick(); props.onPause(); }} className="min-h-[48px] min-w-[48px] rounded-full bg-white/15 text-2xl" aria-label="Pause">⏸️</button>
        )}
      </header>

      <div className="relative flex-1 min-h-0">
        {props.children}

        <AnimatePresence>
          {status !== 'playing' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/55 flex justify-center p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="my-auto w-full max-w-md rounded-3xl bg-indigo-950/95 border-2 border-fuchsia-400/60 p-6 text-center shadow-2xl"
              >
                {status === 'ready' && (
                  <>
                    <div className="text-6xl mb-2">{icon}</div>
                    <h2 className="font-fredoka text-3xl mb-3">{title}</h2>
                    {props.readyContent}
                    <button onClick={() => { playClick(); props.onStart(); }}
                      className="mt-4 w-full min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl shadow-lg">
                      {props.startLabel ?? '▶ Play'}
                    </button>
                  </>
                )}

                {status === 'paused' && (
                  <>
                    <div className="text-6xl mb-2">⏸️</div>
                    <h2 className="font-fredoka text-3xl mb-4">Paused</h2>
                    <button onClick={() => { playClick(); props.onResume(); }}
                      className="w-full min-h-[56px] rounded-full bg-gradient-to-r from-green-500 to-emerald-500 font-fredoka text-2xl mb-3">
                      ▶ Keep playing
                    </button>
                    <button onClick={back} className="w-full min-h-[48px] rounded-full bg-white/15 font-fredoka text-lg">Quit</button>
                  </>
                )}

                {status === 'over' && (
                  <>
                    <div className="text-6xl mb-1">{result?.isBest && score > 0 ? '🏆' : '💥'}</div>
                    <h2 className="font-fredoka text-3xl mb-1">{result?.isBest && score > 0 ? 'New best!' : props.overTitle ?? 'Game over'}</h2>
                    {result?.isBest && score > 0 && props.overTitle && <p className="font-nunito text-violet-200 mb-1">{props.overTitle}</p>}
                    <div className="font-fredoka text-5xl text-yellow-300 my-2">{formatScore(score)}</div>
                    <p className="font-nunito text-violet-200 mb-3">Best: {formatScore(Math.max(best, score))}</p>
                    {props.overStats && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {props.overStats.map(s => (
                          <div key={s.label} className="rounded-xl bg-white/10 py-2">
                            <div className="font-nunito text-sm text-violet-200">{s.label}</div>
                            <div className="font-fredoka text-xl">{s.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {result && gameId in MASTERY && <StarsRow gameId={gameId} score={score} result={result} formatScore={formatScore} />}
                    {result && <p className="font-fredoka text-lg text-fuchsia-300 mb-1">+{result.xp} XP · +{result.coins} 🪙</p>}
                    {result?.weekly && <p className="font-fredoka text-base text-sky-300 mb-1">🌟 2× Game of the week!</p>}
                    <div className="mb-3" />
                    {props.overExtra}
                    <button onClick={() => { playClick(); props.onStart(); }}
                      className="w-full min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl mb-3">
                      {props.againLabel ?? '🔁 Play again'}
                    </button>
                    <button onClick={back} className="w-full min-h-[48px] rounded-full bg-white/15 font-fredoka text-lg">{props.leaveLabel ?? 'Pick another game'}</button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Game-over stars: earned stars pop in one by one, new ones bounce, then how close this round came to the next star. */
function StarsRow({ gameId, score, result, formatScore }: { gameId: string; score: number; result: RoundResult; formatScore: (n: number) => string }) {
  const id = gameId as GameState;
  const now = result.starsAfter ?? starsFor(id, result.best);
  const before = result.starsBefore ?? now;
  const fresh = now - before;
  const next = nextStarAt(id, result.best);
  const from = prevStarAt(id, result.best);
  const progress = next === null ? 1 : Math.max(0, Math.min(1, (score - from) / (next - from)));
  const soClose = next !== null && progress >= 0.85 && score < next;
  return (
    <div className="mb-3" data-testid="round-stars">
      <div className="flex justify-center gap-2 text-4xl" role="img" aria-label={`${now} of 3 stars`}>
        {[0, 1, 2].map(i => {
          const earned = i < now;
          const isNew = earned && i >= before;
          return (
            <motion.span key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: isNew ? [0, 1.6, 1] : 1, opacity: 1 }}
              transition={{ delay: 0.35 + i * STAR_STEP_S, duration: isNew ? 0.5 : 0.25 }}
              className={earned ? '' : 'opacity-40'}
            >
              {earned ? '⭐' : '☆'}
            </motion.span>
          );
        })}
      </div>
      {fresh > 0 && (
        <p className="font-fredoka text-lg text-yellow-300 mt-1">{fresh === 1 ? 'New star!' : `${fresh} new stars!`} +{fresh * STAR_COINS} 🪙</p>
      )}
      {next !== null && (
        <div className="mt-2">
          <div className="h-3 rounded-full bg-white/15 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-400"
              initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ delay: 0.9, duration: 0.6 }} />
          </div>
          <p className="font-nunito text-sm text-violet-200 mt-1">
            {soClose ? `🔥 So close! Only ${formatScore(next - score)} more for the next star!` : `Next star at ${formatScore(next)}`}
          </p>
        </div>
      )}
    </div>
  );
}
