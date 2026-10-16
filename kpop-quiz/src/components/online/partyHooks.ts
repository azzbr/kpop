import { useEffect, useRef } from 'react';
import type { GameConfig, GameMsg, RoomApi } from '../../online/useRoom';

// Hooks shared by Quip Clash, Emoji Charades, Spy Station and Heads Up Party.

/** Board mode: `boardMode` for everyone, `isBoard` only on the host's big-screen device. */
export function useBoard(room: RoomApi, config?: GameConfig) {
  const boardMode = config?.board === '1';
  return { boardMode, isBoard: boardMode && room.isHost };
}

/** Messages the host addressed to this device (`{ t: type, to: myId, … }`). */
export function useAddressed(room: RoomApi, type: string, handler: (m: GameMsg) => void) {
  const h = useRef(handler);
  h.current = handler;
  const { onMessage, myId } = room;
  useEffect(() => onMessage(m => { if (m.t === type && m.to === myId) h.current(m); }), [onMessage, myId, type]);
}

/** Repeats `ask` every 2.5 s while `missing` (the host may be paused or the message lost). */
export function useAskUntil(missing: boolean, ask: () => void, key: unknown) {
  const a = useRef(ask);
  a.current = ask;
  useEffect(() => {
    if (!missing) return;
    a.current();
    const iv = window.setInterval(() => a.current(), 2500);
    return () => window.clearInterval(iv);
  }, [missing, key]);
}
