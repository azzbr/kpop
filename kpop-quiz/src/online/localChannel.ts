// A stand-in for a Supabase Realtime channel that works between tabs of the same browser
// using BroadcastChannel. Turned on with `?localroom` in the URL. It lets Playwright tests
// (and offline play on one device) run Friends Arena rooms without the network.
//
// It implements only the small part of the RealtimeChannel API that useRoom.ts uses:
// presence sync + track, broadcast send/receive (with self-delivery), subscribe.

type Meta = Record<string, unknown>;
type PresenceCb = () => void;
type BroadcastCb = (msg: { payload: unknown }) => void;

interface Wire {
  kind: 'hello' | 'presence' | 'leave' | 'msg';
  key: string;
  meta?: Meta;
  payload?: unknown;
}

const HEARTBEAT_MS = 1000;
const EXPIRE_MS = 3500;

export const LOCAL_ROOMS = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('localroom');

export class LocalChannel {
  private bc: BroadcastChannel;
  private members = new Map<string, { meta: Meta; seen: number }>();
  private presenceCbs: PresenceCb[] = [];
  private broadcastCbs: BroadcastCb[] = [];
  private myMeta: Meta | null = null;
  private timer: number | undefined;
  private key: string;

  constructor(name: string, key: string) {
    this.key = key;
    this.bc = new BroadcastChannel(name);
    this.bc.onmessage = (e: MessageEvent<Wire>) => this.receive(e.data);
  }

  on(type: 'presence' | 'broadcast', _filter: { event: string }, cb: PresenceCb | BroadcastCb) {
    if (type === 'presence') this.presenceCbs.push(cb as PresenceCb);
    else this.broadcastCbs.push(cb as BroadcastCb);
    return this;
  }

  subscribe(cb: (status: string) => void) {
    this.timer = window.setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    // Ask everyone already in the room to announce themselves.
    this.post({ kind: 'hello', key: this.key });
    setTimeout(() => cb('SUBSCRIBED'), 0);
    return this;
  }

  async track(meta: Meta) {
    this.myMeta = meta;
    this.members.set(this.key, { meta, seen: Date.now() });
    this.post({ kind: 'presence', key: this.key, meta });
    this.emitPresence();
    return 'ok';
  }

  presenceState(): Record<string, Meta[]> {
    const out: Record<string, Meta[]> = {};
    for (const [k, v] of this.members) out[k] = [v.meta];
    return out;
  }

  send(msg: { type: string; event: string; payload: unknown }) {
    this.post({ kind: 'msg', key: this.key, payload: msg.payload });
    // Supabase is configured with broadcast.self = true, so deliver to ourselves too.
    this.broadcastCbs.forEach(cb => cb({ payload: msg.payload }));
    return Promise.resolve('ok');
  }

  close() {
    window.clearInterval(this.timer);
    this.post({ kind: 'leave', key: this.key });
    this.bc.close();
  }

  private post(w: Wire) {
    try { this.bc.postMessage(w); } catch { /* channel closed */ }
  }

  private heartbeat() {
    if (this.myMeta) this.post({ kind: 'presence', key: this.key, meta: this.myMeta });
    const now = Date.now();
    let changed = false;
    for (const [k, v] of this.members) {
      if (k !== this.key && now - v.seen > EXPIRE_MS) { this.members.delete(k); changed = true; }
    }
    if (changed) this.emitPresence();
  }

  private receive(w: Wire) {
    if (w.kind === 'hello') {
      if (this.myMeta) this.post({ kind: 'presence', key: this.key, meta: this.myMeta });
    } else if (w.kind === 'presence' && w.meta) {
      const isNew = !this.members.has(w.key);
      this.members.set(w.key, { meta: w.meta, seen: Date.now() });
      if (isNew) this.emitPresence();
    } else if (w.kind === 'leave') {
      if (this.members.delete(w.key)) this.emitPresence();
    } else if (w.kind === 'msg') {
      this.broadcastCbs.forEach(cb => cb({ payload: w.payload }));
    }
  }

  private emitPresence() {
    this.presenceCbs.forEach(cb => cb());
  }
}
