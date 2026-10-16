// Streams one shared drawing (DrawCanvas ops) through the host, for Doodle Dash and Fake Artist.
//
// The drawing device sends its ops as `<prefix>_op` (batched every FLUSH_MS). The host checks
// each op (`accept` — e.g. only the current drawer, only one stroke per turn), keeps the
// picture's log and re-broadcasts what it accepted as `<prefix>_ops` with a sequence number,
// so every device paints the same ops in the same order — undo included. A device that
// missed something, or mounts late, asks (`<prefix>_ask`) and gets the picture so far
// (`<prefix>_pic`, compacted). Messages reach every device ("honest client"), so nothing
// secret goes in here.
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { GameMsg, RoomApi } from '../../online/useRoom';
import type { DrawCanvasHandle } from './DrawCanvas';
import {
  addOp, compactOps, packOps, receiveBatch, unpackOps,
  type Action, type DrawOp, type OpLog,
} from './drawOps';

const FLUSH_MS = 120;
const MAX_OPS = 20_000; // a runaway picture stops growing here

interface Options {
  /** The drawing everyone should be looking at now ('' = none), from the shared view. */
  drawKey: string;
  canvas: RefObject<DrawCanvasHandle | null>;
  /** Host: the drawing currently open for new ops (from the host's own state). */
  hostKey: () => string;
  /** Host: may `from` add this op to the picture? `actions` is the picture so far. */
  accept: (from: string, op: DrawOp, actions: Action[]) => boolean;
}

export function useDrawStream(room: RoomApi, prefix: string, opts: Options) {
  const { isHost, myId, send, onMessage } = room;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const keyRef = useRef(opts.drawKey);
  keyRef.current = opts.drawKey;

  // Host: the authoritative picture.
  const host = useRef<{ key: string; n: number; actions: Action[] }>({ key: '', n: 0, actions: [] });
  // Everyone: what this device has received for the drawing it knows about.
  const log = useRef<OpLog>({ key: '', n: 0, ops: [] });
  const asked = useRef('');
  // Drawer: ops waiting to be sent.
  const buf = useRef<{ key: string; ops: DrawOp[] }>({ key: '', ops: [] });

  const ask = useCallback((key: string) => {
    if (!key) return;
    asked.current = key;
    send({ t: `${prefix}_ask`, key });
  }, [send, prefix]);

  /** Host: the actions of the picture now open for ops (empty until its first op arrives). */
  const hostActions = useCallback(() => (host.current.key === optsRef.current.hostKey() ? host.current.actions : []), []);

  // A new drawing on screen: show what we already have for it (ops can arrive before the view).
  useEffect(() => {
    const key = opts.drawKey;
    if (!key) return;
    if (log.current.key !== key) log.current = { key, n: 0, ops: [] };
    optsRef.current.canvas.current?.load(log.current.ops);
  }, [opts.drawKey]);

  // First drawing this device sees (mounted late / refreshed): ask for the picture so far.
  const firstKey = useRef(true);
  useEffect(() => {
    if (!opts.drawKey || !firstKey.current) return;
    firstKey.current = false;
    ask(opts.drawKey);
  }, [opts.drawKey, ask]);

  useEffect(() => {
    const off = onMessage((m: GameMsg) => {
      const o = optsRef.current;
      if (m.t === `${prefix}_op` && isHost && m.from) {
        const key = String(m.key ?? '');
        if (key !== o.hostKey()) return;
        const h = host.current;
        if (h.key !== key) host.current = { key, n: 0, actions: [] };
        const cur = host.current;
        const ops = unpackOps(m.p);
        const ok: DrawOp[] = [];
        for (const op of ops) {
          if (cur.n + ok.length >= MAX_OPS || !o.accept(m.from, op, cur.actions)) continue;
          addOp(cur.actions, op);
          ok.push(op);
        }
        const i = cur.n;
        cur.n += ok.length;
        if (ok.length || ops.length) send({ t: `${prefix}_ops`, key, i, p: packOps(ok), by: m.from, cut: ok.length < ops.length ? 1 : 0 });
        return;
      }
      if (m.t === `${prefix}_ask` && isHost && m.from) {
        const key = String(m.key ?? '');
        const h = host.current;
        if (key === h.key) send({ t: `${prefix}_pic`, to: m.from, key, n: h.n, p: packOps(compactOps(h.actions)) });
        else if (key === o.hostKey()) send({ t: `${prefix}_pic`, to: m.from, key, n: 0, p: [] });
        return;
      }
      if (m.t === `${prefix}_ops`) {
        const key = String(m.key ?? '');
        const ops = unpackOps(m.p);
        const r = receiveBatch(log.current, key, Number(m.i) || 0, ops);
        log.current = r.log;
        if (r.gap) { if (asked.current !== `${key}:${log.current.n}`) { asked.current = `${key}:${log.current.n}`; send({ t: `${prefix}_ask`, key }); } return; }
        const showing = key === keyRef.current;
        if (m.by === myId) {
          // Our own ops are on our canvas already — unless the host cut some (turn over).
          if (m.cut && showing) ask(key);
          return;
        }
        if (showing && r.fresh.length) o.canvas.current?.applyOps(r.fresh);
        return;
      }
      if (m.t === `${prefix}_pic` && m.to === myId) {
        const key = String(m.key ?? '');
        const n = Number(m.n) || 0;
        if (key !== keyRef.current && key !== log.current.key) return;
        if (log.current.key === key && log.current.n > n) return; // we're already ahead
        const ops = unpackOps(m.p);
        log.current = { key, n, ops };
        asked.current = '';
        if (key === keyRef.current) o.canvas.current?.load(ops);
      }
    });
    return off;
  }, [onMessage, isHost, myId, send, prefix, ask]);

  // Drawer: send batched ops.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const b = buf.current;
      if (!b.ops.length) return;
      send({ t: `${prefix}_op`, key: b.key, p: packOps(b.ops) });
      buf.current = { key: b.key, ops: [] };
    }, FLUSH_MS);
    return () => window.clearInterval(iv);
  }, [send, prefix]);

  /** Give this to the drawer's DrawCanvas as `onOp`. */
  const onOp = useCallback((op: DrawOp) => {
    const key = keyRef.current;
    if (!key) return;
    if (buf.current.key !== key) buf.current = { key, ops: [] };
    buf.current.ops.push(op);
  }, []);

  return { onOp, hostActions };
}
