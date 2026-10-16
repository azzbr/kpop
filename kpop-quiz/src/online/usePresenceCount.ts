// "🟢 23 playing now": a live count of devices on the site, with no names.
//
// Every device that shows the count joins one presence channel, `kpop_online`, and tracks only
// `{ r }` (r = 1 while it hosts a Friends Arena room, for the "rooms open" count) under a random
// per-tab id. Nothing else is sent. The channel is joined only while a screen that shows the
// count is open, and left while the page is hidden, to keep realtime traffic small.
import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/realtime-js';
import { openChannel, closeChannel, presenceList, getMyId } from './channel';
import { LOCAL_ROOMS } from './localChannel';

export const ONLINE_CHANNEL = 'kpop_online';
/** A falling count waits this long before it shows (so it doesn't flicker on a reconnect). */
export const DROP_DELAY_MS = 2000;

export interface OnlineCount { online: number; rooms: number }

/** Counts devices and hosted rooms from presence metas. */
export function countPresence(metas: { r?: number }[]): OnlineCount {
  return { online: metas.length, rooms: metas.filter(m => m && m.r === 1).length };
}

let channel: RealtimeChannel | null = null;
let users = 0;
let hosting = false;
let raw: OnlineCount | null = null;
let shown: OnlineCount | null = null;
let dropTimer: number | undefined;
const listeners = new Set<(c: OnlineCount | null) => void>();

const emit = () => listeners.forEach(l => l(shown));

function update(next: OnlineCount) {
  raw = next;
  // Rises show at once; drops wait a moment in case it was just someone reconnecting.
  if (!shown || (next.online >= shown.online && next.rooms >= shown.rooms)) {
    window.clearTimeout(dropTimer);
    dropTimer = undefined;
    shown = next;
    emit();
  } else if (dropTimer === undefined) {
    dropTimer = window.setTimeout(() => { dropTimer = undefined; shown = raw; emit(); }, DROP_DELAY_MS);
  }
}

// Automated test browsers (Playwright, CI) never join the real count — except in ?localroom,
// where the "channel" is just other tabs of the same browser.
const SKIP = typeof navigator !== 'undefined' && navigator.webdriver && !LOCAL_ROOMS;

function connect() {
  if (SKIP || channel || typeof document === 'undefined' || document.hidden) return;
  const ch = openChannel(ONLINE_CHANNEL, getMyId());
  channel = ch;
  ch.on('presence', { event: 'sync' }, () => update(countPresence(presenceList<{ r?: number }>(ch))));
  ch.subscribe((st) => {
    if (st === 'SUBSCRIBED') ch.track({ r: hosting ? 1 : 0 });
  });
}

function disconnect() {
  closeChannel(channel);
  channel = null;
}

function onVisibility() {
  if (document.hidden) disconnect();
  else if (users > 0) connect();
}

/** useRoom calls this when this device starts or stops hosting a room. */
export function setHostingRoom(on: boolean) {
  if (hosting === on) return;
  hosting = on;
  channel?.track({ r: on ? 1 : 0 });
}

/** The live count, or null until the first presence sync. */
export function usePresenceCount(): OnlineCount | null {
  const [count, setCount] = useState<OnlineCount | null>(shown);
  useEffect(() => {
    listeners.add(setCount);
    users++;
    if (users === 1) document.addEventListener('visibilitychange', onVisibility);
    connect();
    setCount(shown);
    return () => {
      listeners.delete(setCount);
      users--;
      if (users === 0) {
        document.removeEventListener('visibilitychange', onVisibility);
        // Leave a moment later, so moving between two screens that both show it stays connected.
        window.setTimeout(() => { if (users === 0) disconnect(); }, 1500);
      }
    };
  }, []);
  return count;
}
