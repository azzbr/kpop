import React from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import PuzzleRace from './PuzzleRace';
import type { BoardProps, PuzzleDef } from './PuzzleRace';
import { CB_COLORS, cbCheck, cbGenerate, cbGuess, cbInit, cbProgress, cbSolved, cbSpec } from '../../online/codeBreakerLogic';
import type { CbPuzzle, CbState } from '../../online/codeBreakerLogic';
import { playClick } from '../../utils/sounds';

// Whole-class Mastermind: everyone races to crack the SAME secret colour code. Feedback is
// worked out on your own device (instant); the host checks the winning guess.

const Dot: React.FC<{ ci: number; size?: string }> = ({ ci, size = 'w-8 h-8' }) => (
  <span className={`${size} rounded-full inline-block border-2 border-white/30 shrink-0`} style={{ background: CB_COLORS[ci]?.hex || '#334155' }} />
);

function Board({ puzzle, state, setState, locked }: BoardProps<CbPuzzle, CbState>) {
  const { length, palette } = puzzle;
  const cur = state.cur;
  const addColor = (ci: number) => {
    if (locked || cur.length >= length) return;
    playClick();
    setState(s => ({ ...s, cur: [...s.cur, ci] }));
  };
  const removeAt = (i: number) => {
    if (locked || cur[i] === undefined) return;
    playClick();
    setState(s => ({ ...s, cur: s.cur.filter((_, k) => k !== i) }));
  };
  const submit = () => {
    if (locked || cur.length !== length) return;
    playClick();
    setState(s => cbGuess(puzzle, s, s.cur));
  };

  return (
    <div>
      <div className="flex justify-center gap-4 text-base font-nunito text-white/80 mb-3 flex-wrap">
        <span>⚫ right colour, right spot</span>
        <span>⚪ right colour, wrong spot</span>
      </div>

      {!locked && (
        <>
          <div className="flex justify-center items-center gap-2 mb-3" aria-label="Your guess">
            {Array.from({ length }).map((_, i) => (
              <button
                key={i}
                onPointerDown={() => removeAt(i)}
                aria-label={cur[i] !== undefined ? `Remove ${CB_COLORS[cur[i]].name}` : `Empty slot ${i + 1}`}
                className="w-12 h-12 rounded-full border-2 border-dashed border-white/40"
                style={{ background: cur[i] !== undefined ? CB_COLORS[cur[i]].hex : 'transparent' }}
              />
            ))}
          </div>
          <div className="flex justify-center gap-2.5 mb-3 flex-wrap game-surface">
            {CB_COLORS.slice(0, palette).map((c, i) => (
              <button
                key={c.name}
                onPointerDown={() => addColor(i)}
                aria-label={c.name}
                className="w-14 h-14 rounded-full border-4 border-white/50 active:scale-90 transition-transform shadow-lg"
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <button
            onClick={submit}
            disabled={cur.length !== length}
            className={`w-full min-h-[52px] rounded-full font-fredoka font-bold text-xl mb-4 ${
              cur.length === length ? 'bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl active:scale-95 transition-transform' : 'bg-gray-600/40 text-gray-300'
            }`}
          >
            Check guess! 🔍
          </button>
        </>
      )}

      <div className="bg-white/5 rounded-2xl p-3 max-h-72 overflow-y-auto">
        <div className="font-fredoka text-base text-white/70 mb-2">Your guesses ({state.history.length})</div>
        {state.history.length === 0 && <div className="font-nunito text-base text-white/60">No guesses yet — give it a try!</div>}
        {[...state.history].reverse().map((row, ri) => (
          <div key={state.history.length - ri} className="flex items-center justify-between py-1 gap-2">
            <div className="flex gap-1.5">{row.guess.map((ci, gi) => <Dot key={gi} ci={ci} />)}</div>
            <div className="flex gap-0.5 items-center flex-wrap justify-end">
              {Array.from({ length: row.exact }).map((_, k) => <span key={`e${k}`} className="text-lg leading-none">⚫</span>)}
              {Array.from({ length: row.color }).map((_, k) => <span key={`c${k}`} className="text-lg leading-none">⚪</span>)}
              {Array.from({ length: length - row.exact - row.color }).map((_, k) => <span key={`n${k}`} className="text-lg leading-none opacity-40">▫️</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const Reveal: React.FC<{ puzzle: CbPuzzle }> = ({ puzzle }) => (
  <div className="text-center">
    <div className="font-nunito text-base text-white/80 mb-1">The secret code was:</div>
    <div className="flex justify-center gap-2">{puzzle.code.map((ci, i) => <Dot key={i} ci={ci} size="w-10 h-10" />)}</div>
  </div>
);

const codeBreakerDef: PuzzleDef<CbPuzzle, CbState> = {
  id: 'code_breaker',
  title: 'Code Breaker',
  icon: '🔢',
  bg: 'bg-gradient-to-br from-slate-950 via-gray-900 to-zinc-950',
  width: 'max-w-md',
  help: d => {
    const s = cbSpec(d);
    return `Crack the secret ${s.length}-colour code${s.repeats ? ' (colours can repeat!)' : ''}`;
  },
  rounds: () => 3,
  roundMs: () => 150000,
  generate: (d, rng) => cbGenerate(d, rng),
  init: () => cbInit(),
  answer: s => s.history.map(r => r.guess),
  check: cbCheck,
  progress: cbProgress,
  solved: cbSolved,
  Board,
  Reveal,
};

const CodeBreaker: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => (
  <PuzzleRace room={room} config={config} def={codeBreakerDef} />
);

export default CodeBreaker;
