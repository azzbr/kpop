import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import type { PublicQuestion } from '../../online/quiz/quizLogic';

/** What the player submits, in DISPLAY positions (the host maps them back). */
export interface PadAnswer { choice?: number; order?: number[]; text?: string }

export const TILE_STYLES = [
  { shape: '▲', bg: 'from-red-500 to-rose-600' },
  { shape: '◆', bg: 'from-blue-500 to-indigo-600' },
  { shape: '●', bg: 'from-amber-400 to-orange-500' },
  { shape: '■', bg: 'from-emerald-500 to-green-600' },
];

interface AnswerPadProps {
  question: PublicQuestion;
  onAnswer: (a: PadAnswer) => void;
  disabled?: boolean;
  /** After answering / on reveal: which display option to mark right (null = none). */
  correctDisplay?: number | null;
  /** The player's own pick, to keep it highlighted. */
  picked?: number | null;
  /** Show option text on tiles (big screen shows text; players can show text too). */
  showText?: boolean;
}

export default function AnswerPad({ question, onAnswer, disabled, correctDisplay, picked, showText = true }: AnswerPadProps) {
  const opts = question.options ?? [];

  if (question.type === 'type') return <TypedPad onAnswer={onAnswer} disabled={disabled} />;
  if (question.type === 'order') return <OrderPad options={opts} onAnswer={onAnswer} disabled={disabled} />;

  const twoUp = opts.length <= 2;
  return (
    <div className={`grid gap-3 w-full ${twoUp ? 'grid-cols-2' : 'grid-cols-2'}`}>
      {opts.map((label, i) => {
        const st = question.type === 'truefalse'
          ? (i === 0 ? { shape: '✔', bg: 'from-emerald-500 to-green-600' } : { shape: '✖', bg: 'from-red-500 to-rose-600' })
          : TILE_STYLES[i % 4];
        const revealed = correctDisplay !== undefined;
        const dim = revealed && correctDisplay !== null && correctDisplay !== i;
        const mine = picked === i;
        return (
          <motion.button
            key={i}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            disabled={disabled}
            onClick={() => onAnswer({ choice: i })}
            className={`relative min-h-[88px] md:min-h-[110px] rounded-2xl bg-gradient-to-br ${st.bg} text-white shadow-lg px-4 py-3 flex items-center gap-3 text-left transition-opacity
              ${dim ? 'opacity-30' : ''} ${mine ? 'ring-4 ring-white' : ''} disabled:cursor-default`}
          >
            <span className="text-3xl md:text-4xl drop-shadow">{st.shape}</span>
            {showText && <span className="font-fredoka text-lg md:text-2xl leading-tight">{label}</span>}
            {revealed && correctDisplay === i && <span className="absolute top-2 right-3 text-2xl">✅</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

function TypedPad({ onAnswer, disabled }: { onAnswer: (a: PadAnswer) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const onKey = useCallback((k: string) => setText(t => (t.length < 30 ? t + k : t)), []);
  const onBack = useCallback(() => setText(t => t.slice(0, -1)), []);
  const onEnter = useCallback(() => { if (text.trim()) onAnswer({ text: text.trim() }); }, [text, onAnswer]);
  return (
    <div className="w-full space-y-3">
      <div className="min-h-[60px] rounded-2xl bg-white/10 border-2 border-white/30 px-4 py-3 font-fredoka text-2xl md:text-3xl text-white text-center tracking-wide">
        {text || <span className="text-white/40">Type your answer…</span>}
        {!disabled && <span className="animate-pulse">|</span>}
      </div>
      <OnScreenKeyboard onKey={onKey} onBackspace={onBack} onEnter={onEnter} space digits disabled={disabled} enterLabel="Send" />
    </div>
  );
}

function OrderPad({ options, onAnswer, disabled }: { options: string[]; onAnswer: (a: PadAnswer) => void; disabled?: boolean }) {
  const [order, setOrder] = useState<number[]>([]);
  const tap = (i: number) => {
    if (disabled || order.includes(i)) return;
    const next = [...order, i];
    setOrder(next);
  };
  return (
    <div className="w-full space-y-3">
      <div className="grid gap-2">
        {options.map((label, i) => {
          const pos = order.indexOf(i);
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              disabled={disabled || pos >= 0}
              onClick={() => tap(i)}
              className={`min-h-[60px] rounded-2xl px-4 flex items-center gap-3 font-fredoka text-xl text-white shadow
                ${pos >= 0 ? 'bg-fuchsia-600' : 'bg-white/15'}`}
            >
              <span className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-lg">{pos >= 0 ? pos + 1 : '•'}</span>
              {label}
            </motion.button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button disabled={disabled || order.length === 0} onClick={() => setOrder(order.slice(0, -1))}
          className="min-h-[52px] rounded-full bg-white/15 font-fredoka text-lg text-white disabled:opacity-40">↩ Undo</button>
        <button disabled={disabled || order.length !== options.length} onClick={() => onAnswer({ order })}
          className="min-h-[52px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-lg text-white disabled:opacity-40">Lock it in ✔</button>
      </div>
    </div>
  );
}
