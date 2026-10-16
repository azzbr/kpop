import { usePresenceCount } from '../../online/usePresenceCount';

/** "🟢 23 playing now" (and "🏠 4 rooms open" with `rooms`). Nothing shows until the first count. */
export default function OnlineCount({ rooms, className = '' }: { rooms?: boolean; className?: string }) {
  const c = usePresenceCount();
  if (!c || c.online < 1) return null;
  return (
    <div className={`inline-flex items-center gap-3 rounded-full bg-black/30 px-4 py-1.5 font-fredoka text-base text-white ${className}`} role="status" aria-label="Players online">
      <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 mr-1.5 animate-pulse" />{c.online} playing now</span>
      {rooms && <span>🏠 {c.rooms} {c.rooms === 1 ? 'room' : 'rooms'} open</span>}
    </div>
  );
}
