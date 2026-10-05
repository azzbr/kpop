import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import GameShell from '../games/engine/GameShell';
import type { ShellStatus } from '../games/engine/GameShell';
import OnScreenKeyboard from './ui/OnScreenKeyboard';
import ConfettiBurst from './ConfettiBurst';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playCorrect, playPop, playWrong } from '../utils/sounds';
import { PUZZLES, clueNumbers, isBlackCell } from '../data/crossword';
import type { Dir } from '../data/crossword';
import {
  emptyEntries, tapCell, typeLetter, backspace, clueAt, cellsOf, nextClue, orderedClues, selectClue,
  isSolved, isFilled, checkCells, hintCell, crosswordScore, HINT_COST,
} from './games/crosswordLogic';
import type { Entries, Pos } from './games/crosswordLogic';

const randomPuzzleIdx = (exclude = -1) => {
  if (PUZZLES.length < 2) return 0;
  let i;
  do { i = Math.floor(Math.random() * PUZZLES.length); } while (i === exclude);
  return i;
};

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function CrosswordMini() {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  // Pause when she switches apps
  useEffect(() => {
    const h = () => { if (document.hidden) setStatus(s => (s === 'playing' ? 'paused' : s)); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  const [puzzleIdx, setPuzzleIdx] = useState(() => randomPuzzleIdx());
  const p = PUZZLES[puzzleIdx];
  const [entries, setEntries] = useState<Entries>(() => emptyEntries(p));
  const [sel, setSel] = useState<Pos | null>(null);
  const [dir, setDir] = useState<Dir>('across');
  const [checked, setChecked] = useState<Map<string, boolean> | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [hints, setHints] = useState(0);
  const [won, setWon] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [locked, setLocked] = useState(false);

  const numbers = useMemo(() => clueNumbers(p), [p]);
  const clue = sel ? clueAt(p, sel, dir) : undefined;
  const clueCells = useMemo(() => new Set(clue ? cellsOf(clue).map(x => `${x.r}-${x.c}`) : []), [clue]);

  useEffect(() => {
    if (status !== 'playing' || locked) return;
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [status, locked]);

  const start = () => {
    const idx = round === 0 ? puzzleIdx : randomPuzzleIdx(puzzleIdx);
    const puz = PUZZLES[idx];
    setPuzzleIdx(idx);
    setEntries(emptyEntries(puz));
    const first = selectClue(orderedClues(puz)[0], emptyEntries(puz));
    setSel(first.sel);
    setDir(first.dir);
    setChecked(null);
    setSeconds(0);
    setHints(0);
    setWon(false);
    setGaveUp(false);
    setLocked(false);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const finishWin = useCallback(() => {
    setLocked(true);
    setWon(true);
    playCorrect();
    later(() => setStatus('over'), 1800);
  }, [later]);

  const update = (next: Entries) => {
    setEntries(next);
    setChecked(null);
    if (isSolved(p, next)) finishWin();
    else if (isFilled(p, next)) {
      // Everything's filled but something's off: show which letters to fix.
      setChecked(checkCells(p, next));
      playWrong();
    }
  };

  const canType = status === 'playing' && !locked;

  const onKey = useCallback((l: string) => {
    if (!canType || !sel || !/^[A-Z]$/.test(l)) return;
    playPop();
    const res = typeLetter(p, entries, sel, dir, l);
    setSel(res.sel);
    update(res.entries);
    // update is recreated every render; the values it reads are listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canType, sel, p, entries, dir]);

  const onBackspace = useCallback(() => {
    if (!canType || !sel) return;
    playClick();
    const res = backspace(p, entries, sel, dir);
    setSel(res.sel);
    setEntries(res.entries);
    setChecked(null);
  }, [canType, sel, p, entries, dir]);

  const onNextClue = useCallback(() => {
    if (!canType) return;
    playClick();
    const next = selectClue(nextClue(p, clue), entries);
    setSel(next.sel);
    setDir(next.dir);
  }, [canType, p, clue, entries]);

  const onCell = (r: number, c: number) => {
    if (!canType || isBlackCell(p, r, c)) return;
    playClick();
    const res = tapCell(p, sel, dir, { r, c });
    setSel(res.sel);
    setDir(res.dir);
  };

  const check = () => {
    if (!canType) return;
    const m = checkCells(p, entries);
    setChecked(m);
    const wrong = [...m.values()].filter(v => !v).length;
    if (wrong) playWrong(); else playCorrect();
  };

  const hint = () => {
    if (!canType) return;
    const cell = hintCell(p, entries, sel);
    if (!cell) return;
    playPop();
    setHints(h => h + 1);
    const next = entries.map(row => [...row]);
    next[cell.r][cell.c] = p.rows[cell.r][cell.c];
    setSel(cell);
    if (!clueAt(p, cell, dir)) setDir(dir === 'across' ? 'down' : 'across');
    update(next);
  };

  const showAnswers = () => {
    if (!canType) return;
    playClick();
    setEntries(p.rows.map(row => row.split('').map(ch => (ch === '#' ? '' : ch))));
    setChecked(null);
    setGaveUp(true);
    setLocked(true);
    later(() => setStatus('over'), 2500);
  };

  const score = won ? crosswordScore(seconds, hints) : 0;
  const filled = entries.flat().filter(Boolean).length;
  const totalWhite = p.rows.join('').replace(/#/g, '').length;
  const SIZE = p.rows.length;

  const actionBtn = 'min-h-[48px] rounded-2xl px-4 font-fredoka text-lg disabled:opacity-40';

  return (
    <GameShell
      gameId="crossword_mini"
      title="Crossword Mini"
      icon="📰"
      xpScale={18}
      status={status}
      score={score}
      round={round}
      overTitle={gaveUp ? 'Answers shown — try the next one! 💪' : `${p.name} solved!`}
      overStats={[
        { label: '⏱️ Time', value: fmtTime(seconds) },
        { label: '💡 Hints', value: String(hints) },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      startLabel={round === 0 ? '▶ Play' : '▶ Next puzzle'}
      readyContent={
        <ul className="font-nunito text-lg text-violet-100 text-left space-y-1 list-none">
          <li>👆 Tap a square or a clue, then type with the letter keys.</li>
          <li>🔁 Tap the same square again to switch → Across / ↓ Down.</li>
          <li>⏱️ Be quick for more points. Each 💡 hint costs {HINT_COST}.</li>
        </ul>
      }
    >
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
        {won && <ConfettiBurst count={70} durationMs={2500} />}
        <div className="max-w-3xl mx-auto flex flex-col gap-3 min-h-full">
          {/* Status row */}
          <div className="flex flex-wrap items-center justify-center gap-2 font-fredoka text-lg">
            <span className="rounded-full bg-white/10 px-4 py-1">{p.name}</span>
            <span className="rounded-full bg-white/10 px-4 py-1 tabular-nums">⏱️ {fmtTime(seconds)}</span>
            <span className="rounded-full bg-white/10 px-4 py-1">{filled}/{totalWhite} letters</span>
            <span className="rounded-full bg-white/10 px-4 py-1 text-yellow-300 tabular-nums">⭐ {crosswordScore(seconds, hints)}</span>
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-center md:items-start justify-center">
            {/* Grid */}
            <div className="shrink-0 rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/40 p-2 shadow-2xl">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, width: 'min(84vw, max(300px, calc(100dvh - 560px)), 440px)' }}>
                {p.rows.map((row, r) => row.split('').map((ch, c) => {
                  const key = `${r}-${c}`;
                  if (ch === '#') return <div key={key} className="aspect-square rounded-lg bg-black/40" />;
                  const num = numbers.get(key);
                  const isSel = sel?.r === r && sel?.c === c;
                  const inWord = clueCells.has(key);
                  const mark = checked?.get(key);
                  const bg = mark === true ? 'bg-green-500 text-white'
                    : mark === false ? 'bg-rose-500 text-white'
                    : won || gaveUp ? 'bg-green-500 text-white'
                    : isSel ? 'bg-yellow-300 text-slate-900'
                    : inWord ? 'bg-sky-200 text-slate-900'
                    : 'bg-white text-slate-900';
                  return (
                    <motion.button
                      key={key}
                      type="button"
                      onPointerDown={e => { e.preventDefault(); onCell(r, c); }}
                      animate={won ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                      transition={{ delay: won ? (r + c) * 0.05 : 0, duration: 0.3 }}
                      aria-label={`Row ${r + 1} column ${c + 1}${entries[r][c] ? `, ${entries[r][c]}` : ''}`}
                      className={`relative aspect-square rounded-lg flex items-center justify-center select-none ${bg} ${isSel ? 'ring-4 ring-fuchsia-400' : ''}`}
                    >
                      {num && <span className="absolute top-0.5 left-1 text-xs font-bold leading-none opacity-80">{num}</span>}
                      <span className="font-fredoka text-3xl leading-none">{entries[r][c]}</span>
                    </motion.button>
                  );
                }))}
              </div>
            </div>

            {/* Clues */}
            <div className="w-full md:max-w-sm grid grid-cols-2 md:grid-cols-1 gap-2">
              {(['across', 'down'] as const).map(d => (
                <div key={d} className="rounded-2xl bg-black/30 p-2">
                  <h3 className="font-fredoka text-lg text-fuchsia-300 px-1">{d === 'across' ? '→ Across' : '↓ Down'}</h3>
                  {orderedClues(p).filter(cl => cl.dir === d).map(cl => {
                    const on = clue?.id === cl.id && clue.dir === cl.dir;
                    return (
                      <button
                        key={`${cl.id}-${cl.dir}`}
                        type="button"
                        onClick={() => { if (!canType) return; playClick(); const s = selectClue(cl, entries); setSel(s.sel); setDir(s.dir); }}
                        className={`w-full min-h-[44px] text-left rounded-xl px-2 py-1 font-nunito text-base ${on ? 'bg-fuchsia-500/80' : ''}`}
                      >
                        <b>{cl.id}.</b> {cl.clue}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Current clue */}
          <div className="rounded-2xl bg-fuchsia-600/30 border border-fuchsia-400/50 px-4 py-2 text-center font-nunito text-lg min-h-[52px] flex items-center justify-center">
            {won ? '🎉 Solved! Brilliant!' : gaveUp ? '🙈 Here are the answers' : clue ? <span><b>{clue.id} {clue.dir === 'across' ? 'Across' : 'Down'}:</b> {clue.clue}</span> : 'Tap a square to start'}
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={check} disabled={!canType} className={`${actionBtn} bg-emerald-600`}>✅ Check</button>
            <button onClick={hint} disabled={!canType} className={`${actionBtn} bg-sky-600`}>💡 Hint (−{HINT_COST})</button>
            <button onClick={showAnswers} disabled={!canType} className={`${actionBtn} bg-white/15`}>🙈 Show answers</button>
          </div>
          {checked && !won && (
            <p className="text-center font-nunito text-lg text-violet-100">
              {[...checked.values()].some(v => !v) ? '🟥 Red letters need another go — you can do it!' : '🟩 Everything so far is right!'}
            </p>
          )}

          <div className="w-full mt-auto pb-1">
            <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onNextClue} enterLabel="Next ➜" disabled={!canType} />
          </div>
        </div>
      </div>
    </GameShell>
  );
}
