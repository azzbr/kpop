import React, { useState } from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import PuzzleRace from './PuzzleRace';
import type { BoardProps, PuzzleDef } from './PuzzleRace';
import { applyOp, mkCheck, mkGenerate, mkInit, mkMerge, mkProgress, mkSolved, solveMake } from '../../online/make24Logic';
import type { MkPuzzle, MkState, Op } from '../../online/make24Logic';
import { playClick } from '../../utils/sounds';

// Combine ALL the numbers with + − × ÷ to hit the target. You merge two numbers at a time
// (no typing, no operator precedence). The host replays your steps to check the solve.

const OPS: Op[] = ['+', '−', '×', '÷'];

function Board({ puzzle, state, setState, locked }: BoardProps<MkPuzzle, MkState>) {
  const [sel, setSel] = useState<number[]>([]);
  const valueOf = (id: number) => state.cards.find(c => c.id === id)?.value ?? 0;
  const a = sel.length === 2 ? valueOf(sel[0]) : 0;
  const b = sel.length === 2 ? valueOf(sel[1]) : 0;

  const tapCard = (id: number) => {
    if (locked) return;
    playClick();
    setSel(s => (s.includes(id) ? s.filter(x => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]));
  };
  const doOp = (op: Op) => {
    if (sel.length !== 2) return;
    const next = mkMerge(state, sel[0], sel[1], op);
    if (!next) return;
    playClick();
    setState(next);
    setSel([]);
  };
  const reset = () => {
    playClick();
    setState(mkInit(puzzle));
    setSel([]);
  };

  return (
    <div>
      <div className="text-center mb-4">
        <div className="inline-block bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-6 py-2 font-fredoka text-xl">
          Make <span className="font-bold text-amber-300 text-4xl align-middle">{puzzle.target}</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-4 min-h-[5rem] game-surface">
        {state.cards.map(c => (
          <button
            key={c.id}
            onPointerDown={() => tapCard(c.id)}
            className={`min-w-[72px] h-[72px] px-2 rounded-2xl font-fredoka font-bold text-3xl border-4 transition-transform ${
              sel.includes(c.id) ? 'bg-sky-400/40 border-sky-300 scale-110' : 'bg-white/10 border-white/25'
            }`}
          >
            {c.value}
          </button>
        ))}
      </div>

      {sel.length === 2 && (
        <p className="text-center font-nunito text-lg text-white/80 mb-2">{a} and {b} — now pick a sign</p>
      )}
      <div className="flex justify-center gap-3 mb-4 game-surface">
        {OPS.map(op => {
          const disabled = locked || sel.length !== 2 || applyOp(a, b, op) === null;
          return (
            <button
              key={op}
              onPointerDown={() => !disabled && doOp(op)}
              disabled={disabled}
              aria-label={op}
              className={`w-16 h-16 rounded-2xl font-fredoka font-bold text-3xl ${
                disabled ? 'bg-white/5 text-white/30' : 'bg-gradient-to-br from-amber-400 to-pink-500 active:scale-90 transition-transform'
              }`}
            >
              {op}
            </button>
          );
        })}
      </div>

      {!locked && (
        <div className="text-center">
          <button onClick={reset} className="min-h-[52px] px-6 rounded-full font-fredoka text-lg bg-white/15 border-2 border-white/25 active:scale-95 transition-transform">
            ↺ Start over
          </button>
        </div>
      )}
      {state.steps.length > 0 && (
        <div className="mt-3 text-center font-nunito text-base text-white/70">
          {state.steps.map((s, i) => <span key={i} className="inline-block mx-1">{s.a} {s.op} {s.b} = {applyOp(s.a, s.b, s.op)}</span>)}
        </div>
      )}
      <p className="text-center font-nunito text-base text-white/70 mt-3">Pick two numbers, then a sign. Use them all to reach the target!</p>
    </div>
  );
}

const Reveal: React.FC<{ puzzle: MkPuzzle }> = ({ puzzle }) => {
  const steps = solveMake(puzzle.nums, puzzle.target);
  if (!steps) return null;
  return (
    <div className="text-center font-nunito text-lg">
      <div className="text-white/80 mb-1">One way to make {puzzle.target}:</div>
      {steps.map((s, i) => <div key={i} className="font-fredoka">{s.a} {s.op} {s.b} = {applyOp(s.a, s.b, s.op)}</div>)}
    </div>
  );
};

const make24Def: PuzzleDef<MkPuzzle, MkState> = {
  id: 'make_24',
  title: 'Make 24',
  icon: '🔢',
  bg: 'bg-gradient-to-br from-cyan-950 via-sky-950 to-blue-950',
  width: 'max-w-md',
  help: () => 'Combine all the numbers with + − × ÷ to hit the target!',
  rounds: () => 5,
  roundMs: () => 75000,
  generate: (d, rng) => mkGenerate(d, rng),
  init: mkInit,
  answer: s => s.steps,
  check: mkCheck,
  progress: mkProgress,
  solved: mkSolved,
  Board,
  Reveal,
};

const Make24: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => (
  <PuzzleRace room={room} config={config} def={make24Def} />
);

export default Make24;
