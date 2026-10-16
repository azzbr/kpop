import { useState } from 'react';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { playClick } from '../../utils/sounds';

// A text box typed with the on-screen keyboard (so the iPad keyboard never covers the lobby).
// Used for the player name, room codes and club codes.

interface Props {
  label: string;
  initial?: string;
  placeholder?: string;
  max: number;
  /** Allow spaces / digits. */
  space?: boolean;
  digits?: boolean;
  /** Big spaced letters (codes). */
  code?: boolean;
  enterLabel?: string;
  /** Return an error message to stay open, or null to accept. */
  onDone: (text: string) => string | null | Promise<string | null>;
  onCancel?: () => void;
}

export default function TypeBox({ label, initial = '', placeholder, max, space, digits, code, enterLabel = 'Done ✓', onDone, onCancel }: Props) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    const err = await onDone(text.trim());
    setBusy(false);
    setError(err ?? '');
  };

  return (
    <div className="rounded-3xl bg-white/10 border border-white/20 p-4">
      <div className="font-fredoka text-lg text-teal-200 mb-2">{label}</div>
      <div aria-live="polite" aria-label={label}
        className={`min-h-[60px] rounded-2xl bg-white/90 text-gray-800 px-4 py-2 mb-2 flex items-center justify-center ${code ? 'font-fredoka font-bold text-3xl tracking-[0.25em]' : 'font-nunito text-2xl'}`}>
        {text || <span className="text-gray-400 tracking-normal">{placeholder}</span>}
        <span className="inline-block w-0.5 h-7 bg-gray-500 ml-0.5 animate-pulse" />
      </div>
      {error && <div className="mb-2 rounded-2xl bg-amber-400/20 border border-amber-300 p-2 text-center font-nunito text-lg text-amber-100" role="alert">{error}</div>}
      <OnScreenKeyboard
        space={space}
        digits={digits}
        disabled={busy}
        enterLabel={busy ? '…' : enterLabel}
        onKey={(k) => { setError(''); setText(t => (t.length >= max ? t : t + (code ? k.toUpperCase() : t.length && t[t.length - 1] !== ' ' ? k.toLowerCase() : k))); }}
        onBackspace={() => setText(t => t.slice(0, -1))}
        onEnter={submit}
      />
      {onCancel && (
        <button type="button" onClick={() => { playClick(); onCancel(); }} className="mt-3 w-full min-h-[48px] rounded-full bg-white/10 font-fredoka text-lg">Cancel</button>
      )}
    </div>
  );
}
