import { useEffect, useRef, useState } from 'react';
import type { RoomApi } from '../../online/useRoom';
import { everyoneHere } from './raceLogic';

/** `?debug` in the URL: the host exposes `window.__race` (current answer) for Playwright tests. */
export const RACE_DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
export function exposeRaceDebug(api: Record<string, () => unknown>) {
  if (RACE_DEBUG) (window as unknown as { __race?: unknown }).__race = api;
}

/** How long the host waits for every device to say hello before starting anyway. */
export const START_WAIT_MS = 3000;

/**
 * Start-up handshake for the race engines. Games are lazy-loaded, so a device may mount late:
 * every non-host says `<gp>_hello` on mount (and when the host's screen says `<gp>_open`); the host answers each hello (`onHello`, which should
 * send a full snapshot) and calls `start` once everyone has said hello or after 3 s.
 * The callbacks are read through a ref, so they can change every render.
 */
export function useRaceGate(room: RoomApi, gp: string, onHello: (from: string) => void, start: () => void) {
  const { isHost, myId, send, onMessage, players } = room;
  const cb = useRef({ onHello, start });
  useEffect(() => { cb.current = { onHello, start }; });
  const hellos = useRef(new Set<string>());
  const started = useRef(false);
  const ids = players.map(p => p.id);
  const idsRef = useRef(ids);
  useEffect(() => { idsRef.current = ids; });

  const go = () => {
    if (started.current) return;
    started.current = true;
    cb.current.start();
  };
  const goRef = useRef(go);

  // Non-hosts: hello on mount, and again when the host's screen opens (`<gp>_open`) in case the
  // first hello arrived before the host was listening.
  useEffect(() => {
    if (isHost) return;
    send({ t: `${gp}_hello` });
    return onMessage(m => { if (m.t === `${gp}_open`) send({ t: `${gp}_hello` }); });
  }, [isHost, gp, send, onMessage]);

  // Host: listen for hellos, start after everyone or 3 s.
  useEffect(() => {
    if (!isHost) return;
    const off = onMessage(m => {
      if (m.t !== `${gp}_hello` || !m.from) return;
      hellos.current.add(m.from);
      cb.current.onHello(m.from);
      if (everyoneHere(idsRef.current, myId, hellos.current)) goRef.current();
    });
    send({ t: `${gp}_open` });
    const timer = window.setTimeout(() => goRef.current(), START_WAIT_MS);
    return () => { off(); window.clearTimeout(timer); };
  }, [isHost, gp, myId, onMessage, send]);

  // Someone left while we waited: maybe everyone remaining is here now.
  const key = ids.join(',');
  useEffect(() => {
    if (isHost && !started.current && hellos.current.size > 0 && everyoneHere(idsRef.current, myId, hellos.current)) goRef.current();
  }, [key, isHost, myId]);
}

/** Seconds left, counting down from a `leftMs` received at `at` (avoids clock differences between devices). */
export function useCountdown(active: boolean, endsAt: number, stepMs = 250): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setLeft(Math.max(0, endsAt - Date.now()));
    tick();
    const iv = window.setInterval(tick, stepMs);
    return () => window.clearInterval(iv);
  }, [active, endsAt, stepMs]);
  return left / 1000;
}
