// Start-up / resync helper for host-authoritative Friends Arena board games
// (Connect 4, Battleship, Dots & Boxes, World Tour Tycoon, Property Dash).
//
// Games are lazy-loaded, so a device can mount its game a moment after the host. On mount a
// non-host says `<prefix>_hello` (and repeats it until it has the game state); the host starts
// the game once everyone in the room has said hello, or after HELLO_WAIT_MS, whichever comes
// first, and answers every later hello with a full snapshot (`onHello`).
import { useEffect, useRef } from 'react';
import type { RoomApi } from './useRoom';

export const HELLO_WAIT_MS = 3000;
const HELLO_RETRY_MS = 1500;
const HELLO_RETRIES = 6;

/** True when every player id has said hello (the host counts as having said it). */
export function everyoneSaidHello(playerIds: string[], said: ReadonlySet<string>): boolean {
  return playerIds.every((id) => said.has(id));
}

/**
 * Best-first ranking from scores: higher is better, equal scores share one rung
 * (a string[] in the result), single players stay plain strings.
 */
export function rankByScore(ids: string[], score: (id: string) => number): (string | string[])[] {
  const sorted = [...ids].sort((a, b) => score(b) - score(a));
  const out: (string | string[])[] = [];
  let i = 0;
  while (i < sorted.length) {
    const s = score(sorted[i]);
    const rung: string[] = [];
    while (i < sorted.length && score(sorted[i]) === s) rung.push(sorted[i++]);
    out.push(rung.length === 1 ? rung[0] : rung);
  }
  return out;
}

/** 1-vs-1 result: winner 1 = seat p0 won, 2 = seat p1 won, 3 = draw (one shared rung). */
export function duelRanking(p0: string, p1: string, winner: number): (string | string[])[] {
  if (winner === 1) return [p0, p1];
  if (winner === 2) return [p1, p0];
  return [[p0, p1]];
}

export interface HelloHandlers {
  /** Host: begin the game (deal / broadcast the first state). Called once. */
  onStart: () => void;
  /** Host: someone said hello after the start — send them a full snapshot. */
  onHello: (from: string) => void;
  /** Non-host: true once a state message has arrived (stops the hello retries). */
  synced: () => boolean;
}

export function useHelloSync(room: RoomApi, prefix: string, handlers: HelloHandlers) {
  const cb = useRef(handlers);
  const playersRef = useRef(room.players);
  useEffect(() => {
    cb.current = handlers;
    playersRef.current = room.players;
  });

  useEffect(() => {
    const { isHost, myId, send, onMessage } = room;
    const helloType = `${prefix}_hello`;
    if (!isHost) {
      send({ t: helloType });
      let tries = 0;
      const iv = window.setInterval(() => {
        if (cb.current.synced() || ++tries > HELLO_RETRIES) {
          window.clearInterval(iv);
          return;
        }
        send({ t: helloType });
      }, HELLO_RETRY_MS);
      return () => window.clearInterval(iv);
    }

    const said = new Set<string>([myId]);
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      window.clearTimeout(timer);
      cb.current.onStart();
    };
    const timer = window.setTimeout(start, HELLO_WAIT_MS);
    const off = onMessage((m) => {
      if (m.t !== helloType || !m.from) return;
      said.add(m.from);
      if (started) cb.current.onHello(m.from);
      else if (everyoneSaidHello(playersRef.current.map((p) => p.id), said)) start();
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
    // Mount-only: the room's bus doesn't change while a game is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
