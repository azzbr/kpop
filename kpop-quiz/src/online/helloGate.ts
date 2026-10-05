// Start-up handshake + ranking helpers shared by host-authoritative Friends Arena games
// (Doodle Dash, Picture Telephone, Team Tug, Copy Cat, Times-Table Bingo, Penalty Duel).
//
// Games are lazy-loaded, so devices mount at different moments. Every non-host says
// `<prefix>_hello` when it mounts; the host starts once everyone in the room has said hello
// (or after HELLO_WAIT_MS), and answers every later hello with a snapshot of the game.
import { useEffect, useRef, useState } from 'react';
import type { GameMsg, RoomApi } from './useRoom';
import { finishArenaGame } from './arenaRewards';
import type { RoundResult } from '../store';

export const HELLO_WAIT_MS = 3000;

/** True when every player except the host has said hello. */
export function everyoneSaidHello(playerIds: string[], hostId: string, hellos: ReadonlySet<string>): boolean {
  return playerIds.every(id => id === hostId || hellos.has(id));
}

/**
 * Best-first ranking from scores, players with equal scores sharing a rung.
 * `ids` fixes who is ranked (missing scores count as 0); a single player stays a plain id.
 */
export function rankByScore(scores: Record<string, number>, ids: string[] = Object.keys(scores)): (string | string[])[] {
  const sorted = [...ids].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  const out: (string | string[])[] = [];
  let prev: number | null = null;
  for (const id of sorted) {
    const s = scores[id] ?? 0;
    if (prev !== null && s === prev) {
      const last = out[out.length - 1];
      out[out.length - 1] = Array.isArray(last) ? [...last, id] : [last, id];
    } else out.push(id);
    prev = s;
  }
  return out;
}

/** 1-based place of a player in a ranking with tied rungs (0 if missing). */
export function placeOf(ranked: (string | string[])[], id: string): number {
  const i = ranked.findIndex(r => (Array.isArray(r) ? r.includes(id) : r === id));
  return i + 1;
}

/** Ms left until `endsAt` on the sender's clock — send this (not a timestamp) between devices. */
export const msLeft = (endsAt: number, now = Date.now()) => Math.max(0, endsAt - now);

interface GateHandlers {
  /** Host only: called once, when everyone has said hello or the wait ran out. */
  onStart: () => void;
  /** Host only: a device said hello after the start — send it a snapshot. */
  onHello: (from: string) => void;
}

/**
 * The hello / start handshake. Returns true on the host once the game has started.
 * Handlers may change every render; the latest ones are used.
 */
export function useHelloGate(room: RoomApi, prefix: string, handlers: GateHandlers): boolean {
  const { isHost, myId, send, onMessage } = room;
  const hRef = useRef(handlers);
  hRef.current = handlers;
  const playersRef = useRef(room.players);
  playersRef.current = room.players;
  const started = useRef(false);
  const hellos = useRef(new Set<string>());
  const checkRef = useRef<() => void>(() => {});
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const helloT = `${prefix}_hello`;
    if (!isHost) {
      send({ t: helloT });
      return;
    }
    const start = () => {
      if (started.current) return;
      started.current = true;
      window.clearTimeout(timer);
      setHasStarted(true);
      hRef.current.onStart();
    };
    checkRef.current = () => {
      if (!started.current && everyoneSaidHello(playersRef.current.map(p => p.id), myId, hellos.current)) start();
    };
    const timer = window.setTimeout(start, HELLO_WAIT_MS);
    const off = onMessage((m: GameMsg) => {
      if (m.t !== helloT || !m.from || m.from === myId) return;
      if (started.current) hRef.current.onHello(m.from);
      else {
        hellos.current.add(m.from);
        checkRef.current();
      }
    });
    // Everyone may already be here (a 1-player room, or hellos raced ahead).
    checkRef.current();
    return () => {
      off();
      window.clearTimeout(timer);
    };
    // Mount-time host; a host change sends everyone back to the lobby anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A player leaving can complete the hello set.
  const ids = room.players.map(p => p.id).join(',');
  useEffect(() => { checkRef.current(); }, [ids]);

  return hasStarted;
}

/**
 * Calls finishArenaGame exactly once per game on this device and keeps the reward for the
 * final card. `reset` re-arms it for a rematch.
 */
export function useArenaFinish(room: RoomApi) {
  const done = useRef(false);
  const [reward, setReward] = useState<RoundResult | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const finish = (ranked: (string | string[])[]) => {
    if (done.current) return;
    done.current = true;
    setReward(finishArenaGame(roomRef.current, ranked));
  };
  const reset = () => {
    done.current = false;
    setReward(null);
  };
  return { finish, reward, reset };
}
