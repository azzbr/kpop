import React, { useMemo, useState } from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import PuzzleRace from './PuzzleRace';
import type { BoardProps, PuzzleDef } from './PuzzleRace';
import { conflicts, skCheck, skGenerate, skInit, skProgress, skSolved, skSpec } from '../../online/sudokuRaceLogic';
import type { SkPuzzle, SkState } from '../../online/sudokuRaceLogic';
import { playClick } from '../../utils/sounds';

// Sudoku Race: everyone gets the SAME puzzle (always exactly one solution). Fill it in on your
// own device; the moment the grid is full with no clashes it's sent to the host to check.

function Board({ puzzle, state, setState, locked }: BoardProps<SkPuzzle, SkState>) {
  const { n, boxR, boxC, givens } = puzzle;
  const [sel, setSel] = useState(-1);
  const bad = useMemo(() => conflicts(state.grid, puzzle), [state.grid, puzzle]);
  const cell = n === 4 ? 64 : 52;

  const put = (v: number) => {
    if (locked || sel < 0 || givens[sel] !== 0) return;
    playClick();
    setState(s => {
      const grid = [...s.grid];
      grid[sel] = v;
      return { grid };
    });
  };

  const line = (strong: boolean) => (strong ? '3px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.18)');

  return (
    <div>
      <p className="text-center font-nunito text-lg text-white/80 mb-3">No repeats in a row, column or box!</p>
      <div className="mx-auto mb-4 bg-zinc-800 rounded-2xl p-2 shadow-2xl game-surface" style={{ width: 'fit-content' }}>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, ${cell}px)`, gridAutoRows: `${cell}px` }}>
          {state.grid.map((v, i) => {
            const r = Math.floor(i / n), c = i % n;
            const given = givens[i] !== 0;
            const selected = sel === i;
            return (
              <button
                key={i}
                type="button"
                onPointerDown={() => { if (!given && !locked) { playClick(); setSel(i); } }}
                aria-label={`Row ${r + 1} column ${c + 1}${v ? `: ${v}` : ''}`}
                className={`flex items-center justify-center font-fredoka font-bold text-3xl ${
                  given ? 'text-amber-300 bg-white/[0.03]' : bad.has(i) ? 'text-rose-300 bg-rose-500/25' : selected ? 'bg-sky-500/45 text-white' : 'bg-white/5 text-sky-200'
                }`}
                style={{
                  borderTop: line(r % boxR === 0),
                  borderLeft: line(c % boxC === 0),
                  borderRight: c === n - 1 ? line(true) : 'none',
                  borderBottom: r === n - 1 ? line(true) : 'none',
                }}
              >
                {v !== 0 ? v : ''}
              </button>
            );
          })}
        </div>
      </div>

      {!locked && (
        <div className="flex justify-center gap-2 flex-wrap game-surface">
          {Array.from({ length: n }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              onPointerDown={() => put(num)}
              disabled={sel < 0}
              className="w-14 h-14 rounded-xl font-fredoka font-bold text-2xl bg-white/15 border-2 border-white/25 disabled:opacity-40 active:scale-90 transition-transform"
            >
              {num}
            </button>
          ))}
          <button
            onPointerDown={() => put(0)}
            disabled={sel < 0}
            aria-label="Clear square"
            className="w-14 h-14 rounded-xl font-fredoka text-2xl bg-rose-500/25 border-2 border-rose-400/50 disabled:opacity-40"
          >
            ⌫
          </button>
        </div>
      )}
      {!locked && sel < 0 && <p className="text-center font-nunito text-base text-white/70 mt-3">Tap an empty square, then a number.</p>}
    </div>
  );
}

const sudokuDef: PuzzleDef<SkPuzzle, SkState> = {
  id: 'sudoku_mini',
  title: 'Sudoku Race',
  icon: '🔳',
  bg: 'bg-gradient-to-br from-stone-950 via-neutral-900 to-zinc-950',
  width: 'max-w-md',
  help: d => {
    const { n } = skSpec(d);
    return `Fill the ${n}×${n} grid — first to solve it wins!`;
  },
  rounds: () => 2,
  roundMs: d => skSpec(d).ms,
  generate: (d, rng) => skGenerate(d, rng),
  init: skInit,
  answer: s => s.grid,
  check: skCheck,
  progress: skProgress,
  solved: skSolved,
  Board,
};

const SudokuMini: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => (
  <PuzzleRace room={room} config={config} def={sudokuDef} />
);

export default SudokuMini;
