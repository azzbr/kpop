import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REACTIONS } from '../../online/useReactions';
import type { Floater } from '../../online/useReactions';

// Emoji reactions on screen; the sending/receiving is online/useReactions.ts.

/** Floating emoji over the whole screen (never blocks taps). */
export function ReactionLayer({ floaters }: { floaters: Floater[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden" aria-hidden>
      <AnimatePresence>
        {floaters.map(f => (
          <motion.div key={f.key} initial={{ y: 0, opacity: 0, scale: 0.6 }} animate={{ y: -420, opacity: [0, 1, 1, 0], scale: 1.2 }}
            exit={{ opacity: 0 }} transition={{ duration: 2.4, ease: 'easeOut' }}
            className="absolute text-5xl" style={{ left: `${f.x}%`, bottom: 90 }}>
            {f.e}{f.who && <span className="text-2xl align-bottom">{f.who}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** A row of reaction buttons. `compact` = a single 😀 button that opens the row (during games). */
export function ReactionBar({ react, compact }: { react: (e: string) => boolean; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const row = (
    <div className="flex gap-1.5 rounded-full bg-black/40 p-1.5 backdrop-blur" role="group" aria-label="Reactions">
      {REACTIONS.map(e => (
        <button key={e} type="button" aria-label={`React ${e}`} onPointerDown={(ev) => { ev.preventDefault(); react(e); }}
          className="w-12 h-12 rounded-full bg-white/10 text-2xl active:scale-90 transition-transform">{e}</button>
      ))}
    </div>
  );
  if (!compact) return row;
  return (
    <div className="fixed z-50 flex items-center gap-2" style={{ left: 'max(8px, env(safe-area-inset-left))', bottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <button type="button" aria-label={open ? 'Close reactions' : 'Reactions'} onClick={() => setOpen(o => !o)}
        className="w-12 h-12 rounded-full bg-black/50 text-2xl shadow-lg">{open ? '✖' : '😀'}</button>
      {open && row}
    </div>
  );
}
