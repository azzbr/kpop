import { useEffect } from 'react';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export type KeyState = 'correct' | 'present' | 'absent';

interface OnScreenKeyboardProps {
  onKey: (letter: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  /** Optional colouring per letter (Word Guess). */
  states?: Record<string, KeyState>;
  /** Show a space bar (typed quiz answers can have spaces). */
  space?: boolean;
  /** Show 0–9 (typed answers that are numbers). */
  digits?: boolean;
  disabled?: boolean;
  enterLabel?: string;
}

const STATE_CLASS: Record<KeyState, string> = {
  correct: 'bg-green-600 text-white',
  present: 'bg-yellow-500 text-white',
  absent: 'bg-slate-700 text-slate-300',
};

/**
 * Big tap-friendly keyboard drawn by the game itself, so the iPad's own keyboard never pops up
 * and covers the screen. A real keyboard (laptop / Bluetooth) works too.
 */
export default function OnScreenKeyboard({ onKey, onBackspace, onEnter, states = {}, space, digits, disabled, enterLabel = 'Enter' }: OnScreenKeyboardProps) {
  useEffect(() => {
    if (disabled) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Enter') { e.preventDefault(); onEnter(); }
      else if (e.key === 'Backspace') { e.preventDefault(); onBackspace(); }
      else if (/^[a-z]$/i.test(e.key)) onKey(e.key.toUpperCase());
      else if (digits && /^[0-9]$/.test(e.key)) onKey(e.key);
      else if (space && e.key === ' ') { e.preventDefault(); onKey(' '); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onKey, onBackspace, onEnter, disabled, digits, space]);

  const key = (label: string, onPress: () => void, cls = '', aria?: string) => (
    <button
      key={label}
      type="button"
      disabled={disabled}
      aria-label={aria ?? label}
      onPointerDown={e => { e.preventDefault(); onPress(); }}
      className={`h-12 md:h-14 rounded-lg font-fredoka text-lg md:text-xl select-none active:scale-95 transition-transform disabled:opacity-40 ${cls}`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-xl mx-auto space-y-1.5 game-surface" role="group" aria-label="Keyboard">
      {digits && (
        <div className="grid grid-cols-10 gap-1">
          {'1234567890'.split('').map(d => key(d, () => onKey(d), 'bg-slate-500 text-white'))}
        </div>
      )}
      {ROWS.map((row, r) => (
        <div key={row} className="flex gap-1 justify-center">
          {r === 2 && key(enterLabel, onEnter, 'bg-fuchsia-600 text-white px-2 min-w-[64px] text-base', 'Enter')}
          {row.split('').map(l => key(l, () => onKey(l), `flex-1 max-w-[48px] ${states[l] ? STATE_CLASS[states[l]] : 'bg-slate-500 text-white'}`))}
          {r === 2 && key('⌫', onBackspace, 'bg-slate-600 text-white px-2 min-w-[56px]', 'Backspace')}
        </div>
      ))}
      {space && (
        <div className="flex justify-center">
          {key('space', () => onKey(' '), 'bg-slate-500 text-white w-1/2 text-base')}
        </div>
      )}
    </div>
  );
}
