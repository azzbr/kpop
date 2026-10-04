import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoundResult } from '../../store';
import ConfettiBurst from '../../components/ConfettiBurst';
import { playClick, playWin, playWrong } from '../../utils/sounds';

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
    if (res.isBest && score > 0) playWin(); else playWrong();
  }, [status, round, score, gameId, xpScale]);

  useEffect(() => { if (status === 'playing') setResult(null); }, [status]);

  const back = () => {
    playClick();
    setGameState('game_mode');
  };

  return (
    <div className="arcade-bg game-surface fixed inset-0 z-40 flex flex-col text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {result?.isBest && score > 0 && <ConfettiBurst count={80} durationMs={3000} />}

      <header className="flex items-center gap-3 px-3 py-2 bg-black/30">
        <button onClick={back} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
        <h1 className="flex-1 font-fredoka text-xl md:text-2xl truncate">{icon} {title}</h1>
        <span className="font-nunito text-yellow-300 text-base hidden sm:block">🏅 {formatScore(best)}</span>
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
              className="absolute inset-0 bg-black/55 flex items-center justify-center p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="w-full max-w-md rounded-3xl bg-indigo-950/95 border-2 border-fuchsia-400/60 p-6 text-center shadow-2xl"
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
                    {result && <p className="font-fredoka text-lg text-fuchsia-300 mb-4">+{result.xp} XP · +{result.coins} 🪙</p>}
                    <button onClick={() => { playClick(); props.onStart(); }}
                      className="w-full min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl mb-3">
                      🔁 Play again
                    </button>
                    <button onClick={back} className="w-full min-h-[48px] rounded-full bg-white/15 font-fredoka text-lg">Pick another game</button>
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
