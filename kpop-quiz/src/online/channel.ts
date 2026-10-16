// One way to open a realtime channel: Supabase Realtime normally, or a BroadcastChannel stand-in
// between tabs with `?localroom` (Playwright tests, offline play). Used by rooms, clubs and the
// live player count.
import type { RealtimeChannel } from '@supabase/realtime-js';
import { realtime } from './supabaseClient';
import { LocalChannel, LOCAL_ROOMS } from './localChannel';

/** Opens `name` with presence keyed by `key`. Broadcasts also reach this device (`self`). */
export function openChannel(name: string, key: string): RealtimeChannel {
  return (LOCAL_ROOMS
    ? new LocalChannel(name, key)
    : realtime.channel(name, { config: { presence: { key }, broadcast: { self: true } } })) as unknown as RealtimeChannel;
}

export function closeChannel(ch: RealtimeChannel | null | undefined) {
  if (!ch) return;
  if ((ch as unknown) instanceof LocalChannel) (ch as unknown as LocalChannel).close();
  else realtime.removeChannel(ch);
}

/** The first meta of every presence key. */
export function presenceList<T>(ch: RealtimeChannel): T[] {
  return Object.values(ch.presenceState()).map(m => m[0] as unknown as T).filter(Boolean);
}

/** A random id for this tab (sessionStorage), used as the presence key everywhere. */
export function getMyId(): string {
  let id = sessionStorage.getItem('kpop_player_id');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionStorage.setItem('kpop_player_id', id);
  }
  return id;
}
