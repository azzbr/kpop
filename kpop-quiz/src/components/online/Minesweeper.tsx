import React, { useMemo, useRef, useState } from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import PuzzleRace from './PuzzleRace';
import type { BoardProps, PuzzleDef } from './PuzzleRace';
import {
  MW_LIVES, clues, mwCheck, mwDig, mwFailed, mwGenerate, mwInit, mwLives, mwProgress, mwSolved, mwSpec, mwToggleFlag,
} from '../../online/minesweeperLogic';
import type { MwPuzzle, MwState } from '../../online/minesweeperLogic';
import { playClick, playHit, playPop } from '../../utils/sounds';

// Whole-class Minesweeper race. Everyone gets the same field (and the same safe opening) and
// plays it on their own device — digging is instant. 3 lives each. Flags: long-press a square,
// or switch on 🚩 flag mode.

const NUM_COLOR = ['', 'text-sky-300', 'text-emerald-300', 'text-rose-300', 'text-violet-300', 'text-amber-300', 'text-cyan-300', 'text-pink-300', 'text-white'];
const LONG_PRESS_MS = 420;
const MOVE_SLOP = 10;

function Board({ puzzle, state, setState, locked }: BoardProps<MwPuzzle, MwState>) {
  const cl = useMemo(() => clues(puzzle), [puzzle]);
  const [flagMode, setFlagMode] = useState(false);
  const open = useMemo(() => new Set(state.open), [state.open]);
  const flags = useMemo(() => new Set(state.flags), [state.flags]);
  const booms = useMemo(() => new Set(state.booms), [state.booms]);
  const press = useRef<{ i: number; x: number; y: number; timer: number; long: boolean } | null>(null);

  const flag = (i: number) => {
    playPop();
    setState(s => mwToggleFlag(s, i));
  };
  const dig = (i: number) => {
    if (flags.has(i)) return;
    if (cl[i] === -1) playHit();
    else playClick();
    setState(s => mwDig(puzzle, s, i, cl));
  };

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const onDown = (i: number) => (e: React.PointerEvent) => {
    if (locked || open.has(i) || booms.has(i)) return;
    cancel();
    const p = { i, x: e.clientX, y: e.clientY, long: false, timer: 0 };
    p.timer = window.setTimeout(() => {
      p.long = true;
      flag(i);
      try { navigator.vibrate?.(15); } catch { /* not on iPad */ }
    }, LONG_PRESS_MS);
    press.current = p;
  };
  const onMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_SLOP) cancel(); // they're panning
  };
  const onUp = (i: number) => () => {
    const p = press.current;
    if (!p || p.i !== i) return;
    window.clearTimeout(p.timer);
    press.current = null;
    if (p.long || locked) return;
    if (flagMode) flag(i);
    else dig(i);
  };

  const cols = puzzle.cols;
  const cell = cols <= 6 ? 56 : cols <= 8 ? 48 : 42; // never below 40px
  const minesLeft = puzzle.mines.length - state.flags.length;

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-3 flex-wrap">
        <span className="font-fredoka text-lg">💣 {puzzle.mines.length} · 🚩 {minesLeft} left</span>
        {!locked && (
          <button
            onClick={() => { playClick(); setFlagMode(f => !f); }}
            aria-pressed={flagMode}
            className={`min-h-[48px] px-5 rounded-full font-fredoka text-lg border-2 ${flagMode ? 'bg-amber-400/40 border-amber-300' : 'bg-white/10 border-white/25'}`}
          >
            {flagMode ? '🚩 Flag mode ON' : '⛏️ Dig mode'}
          </button>
        )}
      </div>
      <p className="text-center font-nunito text-base text-white/70 mb-2">Tip: press and hold a square to plant a flag 🚩</p>

      {/* Big boards scroll inside this frame (pan with a finger); taps stay on the squares. */}
      <div
        className="game-surface mx-auto max-w-full overflow-auto rounded-2xl bg-zinc-800 p-1.5 shadow-2xl"
        style={{ touchAction: 'pan-x pan-y', maxHeight: '68dvh', width: 'fit-content' }}
        onContextMenu={e => e.preventDefault()}
        onPointerMove={onMove}
        onPointerCancel={cancel}
        onScroll={cancel}
      >
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridAutoRows: `${cell}px` }}>
          {cl.map((v, i) => {
            const isOpen = open.has(i);
            const boom = booms.has(i);
            const flagged = flags.has(i);
            return (
              <button
                key={i}
                type="button"
                aria-label={isOpen ? (v > 0 ? String(v) : 'empty') : boom ? 'mine' : flagged ? 'flag' : 'hidden'}
                onPointerDown={onDown(i)}
                onPointerUp={onUp(i)}
                onPointerLeave={() => press.current?.i === i && cancel()}
                className={`rounded-md font-fredoka font-bold flex items-center justify-center select-none ${
                  boom ? 'bg-red-600' : isOpen ? 'bg-zinc-900' : 'bg-slate-500 active:bg-slate-400'
                } ${isOpen && v > 0 ? NUM_COLOR[v] : ''}`}
                style={{ fontSize: cell >= 48 ? 24 : 20 }}
              >
                {boom ? '💥' : isOpen ? (v > 0 ? v : '') : flagged ? '🚩' : ''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const minesweeperDef: PuzzleDef<MwPuzzle, MwState> = {
  id: 'minesweeper',
  title: 'Minesweeper',
  icon: '💣',
  bg: 'bg-gradient-to-br from-slate-950 via-zinc-900 to-stone-950',
  width: 'max-w-3xl',
  help: d => {
    const s = mwSpec(d);
    return `Clear all the safe squares — ${s.mines} mines hidden, ${MW_LIVES} lives each!`;
  },
  rounds: () => 2,
  roundMs: d => mwSpec(d).ms,
  generate: (d, rng) => mwGenerate(d, rng),
  init: mwInit,
  answer: s => s.open,
  check: mwCheck,
  progress: mwProgress,
  solved: mwSolved,
  failed: mwFailed,
  lives: (_p, s) => mwLives(s),
  Board,
};

const Minesweeper: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => (
  <PuzzleRace room={room} config={config} def={minesweeperDef} />
);

export default Minesweeper;
