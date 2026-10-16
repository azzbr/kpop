// A tiny host-authoritative game loop for simple Friends Arena games (Star Grab, Crowd Pleaser,
// RPS Showdown, Bluff Buster, Category Blitz, Word Chain).
//
// The host keeps the whole game in `S` and broadcasts a PUBLIC view of it (`view(s)`) as
// `<prefix>_state` after every change; everyone renders from the latest view. Players send
// inputs as `<prefix>_in`; only the host applies them (`onInput`). Late or slow devices say
// hello (useHelloGate) and get the current view. Secret info (picks before a reveal, the real
// answer) must stay out of the view until it may be shown.
//
// Teacher controls (any host can use them; OnlineHub shows the buttons): the host sends
// ARENA_CTL { op: 'pause' | 'resume' | 'skip' }. Pause freezes every `tools.after` timer and
// ignores inputs; on resume, top-level `…At` timestamps in the state (e.g. `endsAt`) move on by
// the paused time, so countdowns stay right. Skip calls the game's `onSkip`, if it has one.
// Board mode (`board: true`): the host is a big screen that shows the game but doesn't play,
// so it is left out of `playerIds`.
import { useEffect, useRef, useState } from 'react';
import type { GameMsg, RoomApi } from './useRoom';

/** Host → everyone: pause / resume / skip the running game (teacher controls). */
export const ARENA_CTL = 'arena_ctl';
export type ArenaCtlOp = 'pause' | 'resume' | 'skip';

/** Moves every top-level `…At` timestamp on by `ms` (used after a pause). */
export function shiftTimes<S>(s: S, ms: number): S {
  if (!s || typeof s !== 'object' || ms <= 0) return s;
  const out = { ...(s as Record<string, unknown>) };
  for (const [k, v] of Object.entries(out)) if (k.endsWith('At') && typeof v === 'number' && v > 1e12) out[k] = v + ms;
  return out as S;
}
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
  /** Teacher pressed ⏭️ Skip: move on (e.g. end the round now). Return undefined to ignore. */
  onSkip?: (s: S, tools: HostTools<S>) => S | undefined;
  /** The host is a big screen and doesn't play (left out of playerIds). */
  board?: boolean;
}

export function useHostGame<S, V>(room: RoomApi, prefix: string, opts: Options<S, V>) {
  const { isHost, myId, send, onMessage } = room;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const stateRef = useRef<S | null>(null);
  const timers = useRef(new Map<string, { id: number; due: number; fn: () => void }>());
  const paused = useRef<{ at: number; left: Map<string, { ms: number; fn: () => void }> } | null>(null);
  const [view, setView] = useState<V | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const tools: HostTools<S> = {
    set: (next: S) => {
      stateRef.current = next;
      const v = optsRef.current.view(next);
      setView(v);
      send({ t: `${prefix}_state`, v: v as unknown as GameMsg[string] });
    },
    get: () => stateRef.current as S,
    after: (key, ms, fn) => {
      window.clearTimeout(timers.current.get(key)?.id);
      if (paused.current) { paused.current.left.set(key, { ms, fn }); return; }
      timers.current.set(key, { id: window.setTimeout(() => { timers.current.delete(key); fn(); }, ms), due: Date.now() + ms, fn });
    },
    cancel: (key) => {
      window.clearTimeout(timers.current.get(key)?.id);
      timers.current.delete(key);
      paused.current?.left.delete(key);
    },
  };
  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  useHelloGate(room, prefix, {
    onStart: () => {
      const t = toolsRef.current;
      const ids = room.players.filter(p => !(optsRef.current.board && p.id === myId)).map(p => p.id);
      t.set(optsRef.current.start(ids, t));
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
      if (m.t === ARENA_CTL) {
        if (m.op === 'pause' || m.op === 'resume') setIsPaused(m.op === 'pause');
        if (!isHost || !stateRef.current || m.from !== myId) return;
        const t = toolsRef.current;
        if (m.op === 'pause' && !paused.current) {
          const left = new Map<string, { ms: number; fn: () => void }>();
          timers.current.forEach((v, k) => { window.clearTimeout(v.id); left.set(k, { ms: Math.max(0, v.due - Date.now()), fn: v.fn }); });
          timers.current.clear();
          paused.current = { at: Date.now(), left };
        } else if (m.op === 'resume' && paused.current) {
          const p = paused.current;
          paused.current = null;
          t.set(shiftTimes(stateRef.current, Date.now() - p.at));
          p.left.forEach((v, k) => t.after(k, v.ms, v.fn));
        } else if (m.op === 'skip' && !paused.current) {
          const next = optsRef.current.onSkip?.(stateRef.current, t);
          if (next !== undefined) t.set(next);
        }
        return;
      }
      if (m.t === `${prefix}_in` && isHost && stateRef.current && m.from && !paused.current) {
        const t = toolsRef.current;
        const next = optsRef.current.onInput(stateRef.current, m.from, m as Record<string, unknown>, t);
        if (next !== undefined) t.set(next);
      }
    });
    const ts = timers.current;
    return () => {
      off();
      ts.forEach(v => window.clearTimeout(v.id));
      ts.clear();
    };
  }, [onMessage, isHost, prefix, myId]);

  /** Send this player's input to the host (the host's own input arrives through the echo too). */
  const input = (data: Record<string, unknown>) => send({ t: `${prefix}_in`, ...data });

  return { view, input, tools, myId, paused: isPaused };
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
