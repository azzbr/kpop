import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import { createRng } from '../games/engine/rng';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playPop, playCoin, playWrong, playUnlock, playTick } from '../utils/sounds';
import {
  SIZE, GAME_SECONDS, POWER_BADGE, freshGrid, shuffleGrid, findMatches, hasValidMove, clearMatches, swap, isAdjacent, swipeTarget,
} from './games/gemMatchLogic';
import type { Grid, Pos } from './games/gemMatchLogic';

const GEM_BG: Record<string, string> = {
  '💖': 'rgba(244,114,182,0.30)', '⭐': 'rgba(250,204,21,0.28)', '🌸': 'rgba(251,207,232,0.25)',
  '👑': 'rgba(251,191,36,0.25)', '🎀': 'rgba(239,68,68,0.25)', '💎': 'rgba(56,189,248,0.30)',
};

export default function SparkleMatch() {
  const later = useSafeTimeout();
  const rng = useRef(createRng((Date.now() ^ (Math.random() * 1e9)) >>> 0));
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [grid, setGrid] = useState<Grid>(() => freshGrid(rng.current));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [matchedKeys, setMatchedKeys] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const floatId = useRef(0);
  const runRef = useRef(0); // bumped by Start over so an old cascade stops
  const boardRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ from: Pos; x: number; y: number; used: boolean } | null>(null);

  const playing = status === 'playing';

  // The clock only runs while you can move — it waits during cascades.
  useEffect(() => {
    if (!playing || busy || timeLeft <= 0) return;
    const t = window.setTimeout(() => {
      setTimeLeft(s => Math.max(0, s - 1));
      if (timeLeft <= 6 && timeLeft > 1) playTick();
    }, 1000);
    return () => window.clearTimeout(t);
  }, [playing, busy, timeLeft]);

  useEffect(() => {
    if (playing && timeLeft <= 0 && !busy) { setSelected(null); setStatus('over'); }
  }, [playing, timeLeft, busy]);

  useEffect(() => {
    const h = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  const start = () => {
    runRef.current++;
    setGrid(freshGrid(rng.current));
    setSelected(null);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeLeft(GAME_SECONDS);
    setMatchedKeys(new Set());
    setBusy(false);
    setFloats([]);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const addFloat = useCallback((r: number, c: number, text: string) => {
    const id = ++floatId.current;
    setFloats(f => [...f, { id, x: (c + 0.5) * 100 / SIZE, y: (r + 0.5) * 100 / SIZE, text }]);
    later(() => setFloats(f => f.filter(fl => fl.id !== id)), 900);
  }, [later]);

  const trySwap = (a: Pos, b: Pos) => {
    if (!playing || busy || timeLeft <= 0) return;
    setSelected(null);
    const swapped = swap(grid, a, b);
    setBusy(true);
    const run = runRef.current;
    if (findMatches(swapped).size === 0) {
      // no match: show the swap, then put it back
      playWrong();
      setGrid(swapped);
      later(() => { if (runRef.current !== run) return; setGrid(grid); setBusy(false); }, 320);
      return;
    }
    playPop();
    setGrid(swapped);
    let cur = swapped;
    let depth = 0;
    let earned = 0;
    const step = () => {
      if (runRef.current !== run) return;
      const res = clearMatches(cur, depth + 1, rng.current);
      if (!res) {
        setMatchedKeys(new Set());
        if (!hasValidMove(cur)) {
          cur = shuffleGrid(cur, rng.current);
          addFloat(Math.floor(SIZE / 2), Math.floor(SIZE / 2), '🔀 Shuffle!');
        }
        setGrid(cur);
        setScore(s => s + earned);
        setCombo(depth);
        setBestCombo(c => Math.max(c, depth));
        addFloat(b[0], b[1], `+${earned}`);
        if (depth >= 2) addFloat(Math.max(0, b[0] - 1), b[1], `COMBO x${depth}!`);
        if (depth >= 3) playUnlock(); else playCoin();
        setBusy(false);
        return;
      }
      depth++;
      earned += res.scored;
      setMatchedKeys(res.cleared);
      // flash the matched gems, then let the new ones fall in
      later(() => {
        if (runRef.current !== run) return;
        cur = res.grid;
        setMatchedKeys(new Set());
        setGrid(cur);
        later(step, 260);
      }, 220);
    };
    later(step, 200);
  };

  const tap = (pos: Pos) => {
    if (!playing || busy) return;
    if (!selected) { playClick(); setSelected(pos); return; }
    if (selected[0] === pos[0] && selected[1] === pos[1]) { setSelected(null); return; }
    if (!isAdjacent(selected, pos)) { playClick(); setSelected(pos); return; }
    trySwap(selected, pos);
  };

  const cellFromEvent = (e: ReactPointerEvent): { pos: Pos; size: number } | null => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null;
    return { pos: [r, c], size: rect.width / SIZE };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!playing) return;
    e.preventDefault();
    const hit = cellFromEvent(e);
    if (!hit) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not supported */ }
    gesture.current = { from: hit.pos, x: e.clientX, y: e.clientY, used: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g || g.used || !playing || busy) return;
    const cell = (boardRef.current?.getBoundingClientRect().width ?? 350) / SIZE;
    const to = swipeTarget(g.from, e.clientX - g.x, e.clientY - g.y, cell * 0.4);
    if (!to) return;
    g.used = true;
    trySwap(g.from, to);
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.used) return;
    const hit = cellFromEvent(e);
    tap(hit ? hit.pos : g.from);
  };

  const timePct = (timeLeft / GAME_SECONDS) * 100;

  return (
    <GameShell
      gameId="sparkle_match"
      title="Gem Match"
      icon="💎"
      xpScale={8}
      status={status}
      score={score}
      round={round}
      overTitle="Time's up! ✨"
      overStats={[
        { label: '🔥 Best combo', value: bestCombo >= 2 ? `x${bestCombo}` : '—' },
        { label: '⏱️ Time', value: `${GAME_SECONDS}s` },
      ]}
      onStart={start}
      onPause={() => { gesture.current = null; setStatus('paused'); }}
      onResume={() => setStatus('playing')}
      readyContent={
        <ul className="font-nunito text-lg text-violet-100 text-left space-y-1 list-none">
          <li>👉 <b>Swipe</b> a gem into its neighbour — or tap one, then tap the one next to it.</li>
          <li>✨ Make lines of 3 or more of the same gem to score.</li>
          <li>⚡ A line of 4 makes a power gem that clears a whole row and column!</li>
          <li>⏱️ {GAME_SECONDS} seconds — the clock waits while gems are falling.</li>
        </ul>
      }
    >
      <div className="absolute inset-0 flex flex-col items-center gap-3 px-3 py-3">
        <div className="w-full flex items-center gap-2 font-fredoka text-lg" style={{ maxWidth: 'min(94vw, calc(100dvh - 230px), 620px)' }}>
          <span className="rounded-full bg-white/10 px-4 py-1 text-yellow-300 tabular-nums">⭐ {score}</span>
          <span className={`rounded-full px-4 py-1 tabular-nums ${timeLeft <= 10 ? 'bg-rose-500/70' : 'bg-white/10'}`}>⏱️ {timeLeft}s{busy && playing ? ' ⏸' : ''}</span>
          <span className="flex-1" />
          <button type="button" onClick={() => { playClick(); start(); }} disabled={!playing}
            className="min-h-[48px] px-4 rounded-2xl bg-white/15 font-fredoka text-lg disabled:opacity-40">🔄 Start over</button>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden" style={{ maxWidth: 'min(94vw, calc(100dvh - 230px), 620px)' }}>
          <div className={`h-2 transition-all duration-1000 ${timeLeft > 30 ? 'bg-green-400' : timeLeft > 10 ? 'bg-yellow-400' : 'bg-rose-400'}`} style={{ width: `${timePct}%` }} />
        </div>
        <div className="h-8 font-fredoka text-2xl text-fuchsia-300">
          <AnimatePresence>
            {combo >= 2 && <motion.div key={`${combo}-${score}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1.1 }} exit={{ opacity: 0 }}>🔥 COMBO x{combo}!</motion.div>}
          </AnimatePresence>
        </div>

        <div className="rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/40 p-2 shadow-2xl">
          <div
            ref={boardRef}
            className="relative game-surface"
            style={{ width: 'min(94vw, calc(100dvh - 250px), 600px)', aspectRatio: '1 / 1' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { gesture.current = null; }}
          >
            <div className="absolute inset-0 grid gap-1" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>
              {grid.map((row, r) => row.map((cell, c) => {
                const key = `${r}-${c}`;
                const isSel = selected?.[0] === r && selected?.[1] === c;
                const isMatched = matchedKeys.has(key);
                return (
                  <motion.div
                    key={cell.id}
                    layout
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: isMatched ? 0.3 : 1, scale: isMatched ? 1.25 : isSel ? 1.12 : 1 }}
                    transition={{ duration: isMatched ? 0.2 : 0.22 }}
                    className={`relative rounded-xl flex items-center justify-center ${isSel ? 'ring-4 ring-yellow-300' : ''} ${cell.isPower ? 'ring-2 ring-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.7)]' : ''}`}
                    style={{ background: GEM_BG[cell.charm] ?? 'rgba(255,255,255,0.1)', fontSize: 'min(8vw, calc((100dvh - 250px) / 9), 3.2rem)' }}
                  >
                    <span className="leading-none select-none">{cell.charm}</span>
                    {cell.isPower && <span className="absolute -top-1 -right-1 text-base leading-none">{POWER_BADGE}</span>}
                  </motion.div>
                );
              }))}
            </div>
            <AnimatePresence>
              {floats.map(f => (
                <motion.div key={f.id}
                  initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -40, scale: 1.3 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.9 }}
                  className="absolute pointer-events-none font-fredoka text-2xl text-yellow-200 drop-shadow -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
                  style={{ left: `${f.x}%`, top: `${f.y}%` }}>
                  {f.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </GameShell>
  );
}
