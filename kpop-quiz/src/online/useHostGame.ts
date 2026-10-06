// A tiny host-authoritative game loop for simple Friends Arena games (Star Grab, Crowd Pleaser,
// RPS Showdown, Bluff Buster, Category Blitz, Word Chain).
//
// The host keeps the whole game in `S` and broadcasts a PUBLIC view of it (`view(s)`) as
// `<prefix>_state` after every change; everyone renders from the latest view. Players send
// inputs as `<prefix>_in`; only the host applies them (`onInput`). Late or slow devices say
// hello (useHelloGate) and get the current view. Secret info (picks before a reveal, the real
// answer) must stay out of the view until it may be shown.
import { useEffect, useRef, useState } from 'react';
import type { GameMsg, RoomApi } from './useRoom';
import { useHelloGate } from './helloGate';

export interface HostTools<S> {
  /** Replace the state and broadcast its view. */
  set: (next: S) => void;
  /** Current state. */
  get: () => S;
  /** Run `fn` after `ms` (cleared on unmount; one named timer per key). */
  after: (key: string, ms: number, fn: () => void) => void;
  cancel: (key: string) => void;
}

interface Options<S, V> {
  /** Host: the first state, once everyone is here. */
  start: (playerIds: string[], tools: HostTools<S>) => S;
  /** Host: apply a player's input; return the new state or undefined to ignore. */
  onInput: (s: S, from: string, input: Record<string, unknown>, tools: HostTools<S>) => S | undefined;
  /** The part of the state everyone may see. */
  view: (s: S) => V;
  /** Called after the host has started (to kick off timers). */
  onStarted?: (tools: HostTools<S>) => void;
}

export function useHostGame<S, V>(room: RoomApi, prefix: string, opts: Options<S, V>) {
  const { isHost, myId, send, onMessage } = room;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const stateRef = useRef<S | null>(null);
  const timers = useRef(new Map<string, number>());
  const [view, setView] = useState<V | null>(null);

  const tools: HostTools<S> = {
    set: (next: S) => {
      stateRef.current = next;
      const v = optsRef.current.view(next);
      setView(v);
      send({ t: `${prefix}_state`, v: v as unknown as GameMsg[string] });
    },
    get: () => stateRef.current as S,
    after: (key, ms, fn) => {
      window.clearTimeout(timers.current.get(key));
      timers.current.set(key, window.setTimeout(() => { timers.current.delete(key); fn(); }, ms));
    },
    cancel: (key) => {
      window.clearTimeout(timers.current.get(key));
      timers.current.delete(key);
    },
  };
  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  useHelloGate(room, prefix, {
    onStart: () => {
      const t = toolsRef.current;
      t.set(optsRef.current.start(room.players.map(p => p.id), t));
      optsRef.current.onStarted?.(t);
    },
    onHello: () => {
      if (stateRef.current) send({ t: `${prefix}_state`, v: optsRef.current.view(stateRef.current) as unknown as GameMsg[string] });
    },
  });

  useEffect(() => {
    const off = onMessage((m: GameMsg) => {
      if (m.t === `${prefix}_state`) {
        if (!isHost) setView(m.v as V);
        return;
      }
      if (m.t === `${prefix}_in` && isHost && stateRef.current && m.from) {
        const t = toolsRef.current;
        const next = optsRef.current.onInput(stateRef.current, m.from, m as Record<string, unknown>, t);
        if (next !== undefined) t.set(next);
      }
    });
    const ts = timers.current;
    return () => {
      off();
      ts.forEach(id => window.clearTimeout(id));
      ts.clear();
    };
  }, [onMessage, isHost, prefix]);

  /** Send this player's input to the host (the host's own input arrives through the echo too). */
  const input = (data: Record<string, unknown>) => send({ t: `${prefix}_in`, ...data });

  return { view, input, tools, myId };
}

/** A countdown in whole seconds from a "ms left" value sent in a view, re-rendered 4× a second. */
export function useCountdown(msLeftAtSend: number | undefined, key: unknown): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (msLeftAtSend === undefined) { setLeft(0); return; }
    const ends = Date.now() + msLeftAtSend;
    const tick = () => setLeft(Math.max(0, Math.ceil((ends - Date.now()) / 1000)));
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
  }, [msLeftAtSend, key]);
  return left;
}
