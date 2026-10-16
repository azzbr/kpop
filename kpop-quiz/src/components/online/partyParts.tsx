import type { ReactNode } from 'react';
import { ArenaFrame } from './ArenaParts';

// Shared bits for Quip Clash, Emoji Charades, Spy Station and Heads Up Party: the big-screen
// (board) frame, a timer bar, a paused note and the host's Next button. Hooks: partyHooks.ts.

/** ArenaFrame on players' devices; a wide frame with huge text on the board. */
export function PartyFrame({ board, title, icon, subtitle, right, children, tint }: {
  board: boolean; title: string; icon: string; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; tint?: string;
}) {
  if (!board) return <ArenaFrame title={title} icon={icon} subtitle={subtitle} right={right} tint={tint}>{children}</ArenaFrame>;
  return (
    <div className={`min-h-screen-d bg-gradient-to-br ${tint ?? 'from-indigo-950 via-violet-900 to-fuchsia-950'} text-white px-6 select-none`}
      style={{ paddingTop: 'max(4rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      data-testid="party-board">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-fredoka text-5xl md:text-6xl">{icon} {title}</h1>
            {subtitle && <div className="font-nunito text-2xl text-violet-200 mt-1">{subtitle}</div>}
          </div>
          <div className="text-2xl">{right}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TimerBar({ seconds, total }: { seconds: number; total: number }) {
  return (
    <div className="h-3 rounded-full bg-black/30 mb-3 overflow-hidden" aria-hidden>
      <div className={`h-full transition-all duration-300 ${seconds <= 5 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, (seconds / total) * 100)}%` }} />
    </div>
  );
}

export function PausedNote({ paused }: { paused: boolean }) {
  if (!paused) return null;
  return <div className="rounded-2xl bg-amber-400/90 text-stone-900 font-fredoka text-xl text-center py-2 mb-3" role="status">⏸️ Paused — hang on!</div>;
}

export function NextButton({ onClick, label = 'Next ▶' }: { onClick: () => void; label?: string }) {
  return (
    <div className="text-center mt-4">
      <button type="button" onClick={onClick} className="min-h-[52px] px-8 rounded-full font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 active:scale-95">{label}</button>
    </div>
  );
}
