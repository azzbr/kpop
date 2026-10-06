import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import PuzzleRace from './PuzzleRace';
import type { BoardProps, PuzzleDef } from './PuzzleRace';
import { slCheck, slGenerate, slInit, slProgress, slSlide, slSolved, slSpec } from '../../online/slidingPuzzleLogic';
import type { SlPuzzle, SlState } from '../../online/slidingPuzzleLogic';
import { playClick } from '../../utils/sounds';

// Slide the jumbled tiles back into order. Everyone gets the SAME scramble; the host replays
// your moves to check the solve. Tap any tile in the gap's row or column to slide the whole line.

function Board({ puzzle, state, setState, locked }: BoardProps<SlPuzzle, SlState>) {
  const { n } = puzzle;
  const blank = state.board.indexOf(0);
  const tap = (i: number) => {
    if (locked) return;
    const r = Math.floor(i / n), c = i % n;
    if (i === blank || (r !== Math.floor(blank / n) && c !== blank % n)) return;
    playClick();
    setState(s => slSlide(n, s, i));
  };
  const size = n >= 5 ? 60 : n === 4 ? 72 : 92;

  return (
    <div>
      <p className="text-center font-nunito text-lg text-white/80 mb-3">Put 1–{n * n - 1} in order · {state.moves.length} moves</p>
      <div className="mx-auto bg-indigo-900/60 rounded-2xl p-2 shadow-2xl game-surface" style={{ width: 'fit-content' }}>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, ${size}px)`, gridAutoRows: `${size}px` }}>
          {state.board.map((v, i) => (
            <button
              key={i}
              type="button"
              onPointerDown={() => tap(i)}
              aria-label={v === 0 ? 'gap' : String(v)}
              className={`rounded-xl font-fredoka font-bold flex items-center justify-center ${
                v === 0 ? 'bg-transparent' : v === i + 1 ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow' : 'bg-gradient-to-br from-sky-400 to-indigo-500 shadow active:scale-95'
              }`}
              style={{ fontSize: size >= 72 ? 32 : 26 }}
            >
              {v !== 0 ? v : ''}
            </button>
          ))}
        </div>
      </div>
      <p className="text-center font-nunito text-base text-white/70 mt-3">Green tiles are already in the right spot ✅</p>
    </div>
  );
}

const slidingPuzzleDef: PuzzleDef<SlPuzzle, SlState> = {
  id: 'sliding_puzzle',
  title: 'Sliding Puzzle',
  icon: '🧩',
  bg: 'bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-950',
  width: 'max-w-md',
  help: d => {
    const { n } = slSpec(d);
    return `Slide the ${n}×${n} tiles back into order — first to finish wins!`;
  },
  rounds: () => 2,
  roundMs: d => slSpec(d).ms,
  generate: (d, rng) => slGenerate(d, rng),
  init: slInit,
  answer: s => s.moves,
  check: slCheck,
  progress: slProgress,
  solved: slSolved,
  Board,
};

const SlidingPuzzle: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => (
  <PuzzleRace room={room} config={config} def={slidingPuzzleDef} />
);

export default SlidingPuzzle;
