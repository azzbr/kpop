import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { createRng } from '../games/engine/rng';
import ConfettiBurst from './ConfettiBurst';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playPop, playCorrect, playWrong, playTick } from '../utils/sounds';
import { MEMORY_LEVELS, makeDeck, memoryScore } from './games/memoryLogic';
import type { MemoryCard } from './games/memoryLogic';

const LEVEL_KEY = 'memory_speed_level';

export default function MemorySpeedRound() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  // Pause when she switches apps
  useEffect(() => {
    const h = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  const [levelIdx, setLevelIdx] = useState(() => {
    try { return Math.min(MEMORY_LEVELS.length - 1, Math.max(0, Number(localStorage.getItem(LEVEL_KEY)) || 0)); } catch { return 0; }
  });
  const level = MEMORY_LEVELS[levelIdx];
  const [deck, setDeck] = useState<MemoryCard[]>([]);
  const [open, setOpen] = useState<number[]>([]); // indices face-up waiting for a pair
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState(level.seconds);
  const [tries, setTries] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [comboLabel, setComboLabel] = useState('');
  const [cleared, setCleared] = useState(false);
  const lock = useRef(false);

  const pairsFound = matched.size / 2;
  const playing = status === 'playing' && !cleared;

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [playing]);

  useEffect(() => {
    if (status !== 'playing' || cleared) return;
    if (secondsLeft <= 0) { lock.current = true; setStatus('over'); }
    else if (secondsLeft <= 5) playTick();
  }, [secondsLeft, status, cleared]);

  const start = () => {
    try { localStorage.setItem(LEVEL_KEY, String(levelIdx)); } catch { /* private mode */ }
    setDeck(makeDeck(level.pairs, createRng((Date.now() ^ (Math.random() * 1e9)) >>> 0)));
    setOpen([]);
    setMatched(new Set());
    setSecondsLeft(level.seconds);
    setTries(0);
    setCombo(0);
    setMaxCombo(0);
    setComboLabel('');
    setCleared(false);
    lock.current = false;
    setRound(r => r + 1);
    setStatus('playing');
  };

  const flip = (idx: number) => {
    if (!playing || lock.current || open.includes(idx) || matched.has(idx)) return;
    playPop();
    const nowOpen = [...open, idx];
    setOpen(nowOpen);
    if (nowOpen.length < 2) return;
    setTries(t => t + 1);
    const [a, b] = nowOpen;
    if (deck[a].emoji === deck[b].emoji) {
      playCorrect();
      const m = new Set(matched).add(a).add(b);
      setMatched(m);
      setOpen([]);
      const c = combo + 1;
      setCombo(c);
      setMaxCombo(x => Math.max(x, c));
      if (c >= 2) {
        setComboLabel(c >= 5 ? '🔥 ON FIRE!' : c >= 3 ? '⚡ COMBO!' : '✨ Nice!');
        later(() => setComboLabel(''), 800);
      }
      if (m.size === deck.length) {
        setCleared(true);
        later(() => setStatus('over'), 1500);
      }
    } else {
      playWrong();
      setCombo(0);
      lock.current = true;
      later(() => { setOpen([]); lock.current = false; }, 700);
    }
  };

  const score = memoryScore(level, pairsFound, cleared ? secondsLeft : 0, tries);
  const chip = (on: boolean) => `min-h-[64px] rounded-2xl px-2 py-2 font-fredoka text-lg ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;
  const rows = Math.ceil(deck.length / level.cols);
  const timePct = (secondsLeft / level.seconds) * 100;

  return (
    <GameShell
      gameId="memory_speed"
      title="Speed Memory"
      icon="🃏"
      xpScale={8}
      status={status}
      score={score}
      round={round}
      overTitle={cleared ? `Board cleared with ${secondsLeft}s to spare!` : `${pairsFound}/${level.pairs} pairs — so close! 💪`}
      overStats={[
        { label: '🃏 Pairs', value: `${pairsFound}/${level.pairs}` },
        { label: '🔥 Best combo', value: `x${maxCombo}` },
        { label: '👆 Tries', value: String(tries) },
        { label: '⏱️ Time left', value: `${secondsLeft}s` },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-3">
          <p className="font-nunito text-lg text-violet-100">Flip two cards at a time and find every pair before the clock runs out. Fewer tries = bonus points!</p>
          <div className="grid grid-cols-3 gap-2">
            {MEMORY_LEVELS.map((l, i) => (
              <button key={l.id} onClick={() => { playClick(); setLevelIdx(i); setSecondsLeft(l.seconds); }} className={chip(i === levelIdx)}>
                <div>{l.name}</div>
                <div className="font-nunito text-sm opacity-80">{l.pairs} pairs · {l.seconds}s</div>
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="absolute inset-0 flex flex-col items-center gap-2 px-3 py-3">
        {cleared && <ConfettiBurst count={70} durationMs={2500} />}
        <div className="w-full max-w-3xl flex items-center justify-between gap-2 font-fredoka text-lg">
          <span className={`rounded-full px-4 py-1 tabular-nums ${secondsLeft <= 10 ? 'bg-rose-500/70' : 'bg-white/10'}`}>⏱️ {secondsLeft}s</span>
          <span className="rounded-full bg-white/10 px-4 py-1">{pairsFound}/{level.pairs} pairs</span>
          <span className="rounded-full bg-white/10 px-4 py-1">🔥 x{combo}</span>
          <span className="rounded-full bg-white/10 px-4 py-1 text-yellow-300 tabular-nums">⭐ {score}</span>
        </div>
        <div className="w-full max-w-3xl h-2 rounded-full bg-white/10 overflow-hidden">
          <div className={`h-2 transition-all duration-1000 ${secondsLeft > level.seconds / 2 ? 'bg-green-400' : secondsLeft > 10 ? 'bg-yellow-400' : 'bg-rose-400'}`}
            style={{ width: `${timePct}%` }} />
        </div>
        <div className="h-8 font-fredoka text-2xl text-orange-300">
          <AnimatePresence>
            {comboLabel && <motion.div key={comboLabel + combo} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}>{comboLabel}</motion.div>}
          </AnimatePresence>
        </div>

        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))`,
              // as big as fits: limited by width and by the height left for the rows
              width: `min(94vw, 760px, calc((100dvh - 220px) * ${level.cols / Math.max(rows, 1)}))`,
            }}
          >
            {deck.map((card, idx) => {
              const up = open.includes(idx) || matched.has(idx);
              const done = matched.has(idx);
              return (
                <motion.button
                  key={`${round}-${card.id}`}
                  type="button"
                  onPointerDown={e => { e.preventDefault(); flip(idx); }}
                  animate={{ scale: done ? 0.92 : 1 }}
                  transition={{ duration: 0.25 }}
                  aria-label={up ? card.emoji : 'Hidden card'}
                  className={`aspect-square rounded-2xl flex items-center justify-center shadow-lg border-2 ${
                    done ? 'bg-green-500/40 border-green-300'
                    : up ? 'bg-indigo-100 border-fuchsia-300'
                    : 'bg-gradient-to-br from-fuchsia-600 to-indigo-700 border-fuchsia-300/40'}`}
                  style={{ fontSize: `min(${level.cols <= 4 ? 9 : 6.5}vw, ${level.cols <= 4 ? 4 : 3}rem)` }}
                >
                  <motion.span key={up ? 'up' : 'down'} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.18 }}>
                    {up ? card.emoji : '❔'}
                  </motion.span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </GameShell>
  );
}
