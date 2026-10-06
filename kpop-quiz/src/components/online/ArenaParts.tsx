import type { ReactNode } from 'react';
import type { RoomApi } from '../../online/useRoom';
import { who } from './arenaHelpers';

// Small shared pieces for the newer Arena games (Star Grab, Crowd Pleaser, RPS Showdown,
// Bluff Buster, Category Blitz, Word Chain). The final standings screen is RaceParts' FinalCard.

export function ArenaFrame({ title, icon, subtitle, right, children, tint = 'from-indigo-950 via-violet-900 to-fuchsia-950' }: {
  title: string; icon: string; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; tint?: string;
}) {
  return (
    <div className={`min-h-screen-d bg-gradient-to-br ${tint} text-white px-4 select-none`}
      style={{ paddingTop: 'max(4rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-fredoka text-3xl md:text-4xl">{icon} {title}</h1>
            {subtitle && <div className="font-nunito text-lg text-violet-200">{subtitle}</div>}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Round + seconds-left pill. */
export function RoundPill({ round, of, seconds }: { round: number; of: number; seconds?: number }) {
  return (
    <div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right">
      <div>Round {round}/{of}</div>
      {seconds !== undefined && <div className={seconds <= 3 ? 'text-amber-300' : 'text-violet-200'}>⏱️ {seconds}s</div>}
    </div>
  );
}

/** Everyone's score, best first, you highlighted. */
export function Scores({ room, scores, note }: { room: RoomApi; scores: Record<string, number>; note?: (id: string) => ReactNode }) {
  const ids = room.players.map(p => p.id).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {ids.map(id => {
        const w = who(room.players, id);
        return (
          <div key={id} className={`rounded-2xl px-3 py-2 font-nunito text-lg flex items-center gap-2 ${id === room.myId ? 'bg-amber-400/25 ring-2 ring-amber-300' : 'bg-white/10'}`}>
            <span className="text-2xl">{w.emoji}</span>
            <span className="flex-1 truncate">{w.name}</span>
            {note?.(id)}
            <span className="font-fredoka text-amber-200">{scores[id] ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Waiting({ text = 'Getting the game ready…' }: { text?: string }) {
  return <div className="text-center font-fredoka text-2xl py-16 animate-pulse">{text} 🎮</div>;
}
