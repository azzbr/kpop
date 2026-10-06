import React, { useCallback, useMemo } from 'react';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import PuzzleRace from './PuzzleRace';
import type { BoardProps, PuzzleDef } from './PuzzleRace';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import type { KeyState } from '../ui/OnScreenKeyboard';
import { HM_MAX_WRONG, hmCheck, hmFailed, hmGenerate, hmGuess, hmInit, hmLives, hmProgress, hmSolved } from '../../online/hangmanLogic';
import type { HmPuzzle, HmState } from '../../online/hangmanLogic';
import { playClick, playWrong } from '../../utils/sounds';

// Whole-class Hangman race: everyone guesses letters on the SAME hidden word, each with their
// own 6 lives. Guesses are checked on your own device; the host checks the finished word.

const noop = () => {};

function Board({ puzzle, state, setState, locked }: BoardProps<HmPuzzle, HmState>) {
  const lives = hmLives(puzzle, state);
  const states = useMemo(() => {
    const out: Record<string, KeyState> = {};
    for (const l of state.guessed) out[l] = puzzle.word.includes(l) ? 'correct' : 'absent';
    return out;
  }, [state.guessed, puzzle.word]);

  const onKey = useCallback((letter: string) => {
    const L = letter.toUpperCase();
    if (locked || !/^[A-Z]$/.test(L) || state.guessed.includes(L)) return;
    if (puzzle.word.includes(L)) playClick();
    else playWrong();
    setState(s => hmGuess(puzzle, s, L));
  }, [locked, state.guessed, puzzle, setState]);

  const showAll = locked && hmFailed(puzzle, state);
  return (
    <div>
      <div className="bg-white/10 rounded-3xl p-5 mb-3 border border-white/15 text-center">
        <div className="flex flex-wrap justify-center gap-2">
          {puzzle.word.split('').map((ch, i) => {
            const shown = state.guessed.includes(ch);
            return (
              <span key={i} className={`w-10 h-14 md:w-12 md:h-16 border-b-4 border-emerald-300 flex items-center justify-center font-fredoka font-bold text-3xl md:text-4xl ${!shown && showAll ? 'text-white/40' : ''}`}>
                {shown || showAll ? ch : ''}
              </span>
            );
          })}
        </div>
        <div className="mt-3 font-nunito text-lg">
          {lives > 0 ? '❤️'.repeat(lives) : '💔'}<span className="opacity-40">{'🤍'.repeat(HM_MAX_WRONG - lives)}</span>
        </div>
      </div>
      {/* Enter / ⌫ do nothing in Hangman, so they're hidden (kept in place for the layout). */}
      <div className="[&_button[aria-label='Enter']]:invisible [&_button[aria-label='Backspace']]:invisible">
        <OnScreenKeyboard onKey={onKey} onBackspace={noop} onEnter={noop} states={states} disabled={locked} />
      </div>
    </div>
  );
}

const Reveal: React.FC<{ puzzle: HmPuzzle }> = ({ puzzle }) => (
  <div className="text-center">
    <div className="font-nunito text-base text-white/80 mb-1">The word was</div>
    <div className="font-fredoka text-4xl tracking-widest text-emerald-200">{puzzle.word}</div>
  </div>
);

const hangmanDef: PuzzleDef<HmPuzzle, HmState> = {
  id: 'hangman',
  title: 'Hangman',
  icon: '🔡',
  bg: 'bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950',
  width: 'max-w-xl',
  help: () => `Reveal the hidden word letter by letter — ${HM_MAX_WRONG} lives each!`,
  rounds: () => 5,
  roundMs: () => 60000,
  generate: hmGenerate,
  init: hmInit,
  answer: s => s.guessed,
  check: hmCheck,
  progress: hmProgress,
  solved: hmSolved,
  failed: hmFailed,
  lives: hmLives,
  Board,
  Reveal,
};

const Hangman: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => (
  <PuzzleRace room={room} config={config} def={hangmanDef} />
);

export default Hangman;
