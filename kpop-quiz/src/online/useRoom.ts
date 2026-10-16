import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/realtime-js';
import { openChannel, closeChannel, presenceList, getMyId } from './channel';
import { setHostingRoom } from './usePresenceCount';

export type GameId =
  | 'team_tug'
  | 'world_tour'
  | 'copy_cat'
  | 'tt_bingo'
  | 'doodle_dash'
  | 'penalty_duel'
  | 'monopoly_deal'
  | 'emoji_detective'
  | 'word_scramble'
  | 'riddle_rush'
  | 'picture_phone'
  | 'math_sprint'
  | 'code_breaker'
  | 'odd_one_out'
  | 'whats_missing'
  | 'pattern_quest'
  | 'connect_four'
  | 'memory_digits'
  | 'sudoku_mini'
  | 'battleship'
  | 'make_24'
  | 'hangman'
  | 'brain_buzzer'
  | 'minesweeper'
  | 'dots_boxes'
  | 'colour_clash'
  | 'sliding_puzzle'
  | 'quiz_party'
  | 'imposter'
  | 'bluff_buster'
  | 'category_blitz'
  | 'word_chain'
  | 'star_grab'
  | 'crowd_pleaser'
  | 'fake_artist'
  | 'quip_clash'
  | 'doodle_decoy'
  | 'emoji_charades'
  | 'heads_up_party'
  | 'monster_mash'
  | 'spy_station'
  | 'rps_showdown';

// Optional per-game setup chosen by the host in the lobby (difficulty, etc.),
// broadcast to everyone in the `start` message.
export type GameConfig = Record<string, string>;

export interface RoomPlayer {
  id: string;
  name: string;
  emoji: string;
  isHost: boolean;
  joinedAt: number;
  /** A teacher (set up in the Grown-ups corner) is always the host. */
  role?: 'teacher';
}

/** 'closed' = this device was turned away or removed (see `closedReason`). */
export type RoomStatus = 'idle' | 'connecting' | 'lobby' | 'not_found' | 'closed' | 'error';

/** Why a join didn't work, or 'ok'. */
export type JoinResult = 'ok' | 'not_found' | 'error' | 'locked' | 'removed';

/**
 * Room settings the host keeps and broadcasts (`room_meta`). Every device keeps the latest copy,
 * so a new host carries on with it.
 * - locked: only players already in (or let in through a club knock / invite) may join.
 * - removed: players the host removed; they're turned away if they come back.
 * - allowed: players who may join a locked room.
 */
export interface RoomMeta { locked: boolean; removed: string[]; allowed: string[] }
export const EMPTY_META: RoomMeta = { locked: false, removed: [], allowed: [] };

export const ROOM_META = 'room_meta';
export const ROOM_REFUSE = 'room_refuse';
export const ROOM_HOST = 'room_host';

/** May this player be in the room? */
export function admission(meta: RoomMeta, id: string): 'ok' | 'locked' | 'removed' {
  if (meta.removed.includes(id)) return 'removed';
  if (meta.locked && !meta.allowed.includes(id)) return 'locked';
  return 'ok';
}

export interface GameMsg {
  t: string;
  from?: string;
  [key: string]: unknown;
}

// The bundle each online game component receives
export interface RoomApi {
  code: string;
  players: RoomPlayer[];
  isHost: boolean;
  myId: string;
  send: (msg: GameMsg) => void;
  onMessage: (handler: (msg: GameMsg) => void) => () => void;
  /** Host only: report a finished game's ranking (best first) for the lobby's session leaderboard. */
  reportResult: (ranked: (string | string[])[]) => void;
}

export const SESSION_RESULT = 'session_result';

// No I/O — they look like 1 and 0 on a whiteboard
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeCode(): string {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

export { getMyId };

// The room this tab is in, so a refresh (or iPad Safari reloading a sleeping tab) rejoins it
// with the same seat. `joinedAt` decides who is host, so keeping it keeps the host the host.
const ROOM_KEY = 'kpop_room';
export interface SavedRoom { code: string; name: string; emoji: string; joinedAt: number }
export function savedRoom(): SavedRoom | null {
  try { return JSON.parse(sessionStorage.getItem(ROOM_KEY) || 'null'); } catch { return null; }
}
const META_KEY = 'kpop_room_meta';
function savedMeta(): RoomMeta | null {
  try { return JSON.parse(sessionStorage.getItem(META_KEY) || 'null'); } catch { return null; }
}
const saveRoom = (r: SavedRoom | null) => {
  try { if (r) sessionStorage.setItem(ROOM_KEY, JSON.stringify(r)); else sessionStorage.removeItem(ROOM_KEY); } catch { /* ignore */ }
};

/** How long everyone waits for a vanished host to come back before someone else takes over. */
export const HOST_GRACE_MS = 20000;

type Rankable = { id: string; joinedAt: number; role?: string };
/** Host order: teachers first, then whoever has been in the room longest, then by id (so every device agrees). */
export function hostOrder(a: Rankable, b: Rankable): number {
  return (a.role === 'teacher' ? 0 : 1) - (b.role === 'teacher' ? 0 : 1) || a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1);
}

/** The host: a teacher if one is here, else whoever has been in the room longest. */
export function pickHost(list: Rankable[]): string | null {
  if (!list.length) return null;
  return [...list].sort(hostOrder)[0].id;
}

export interface Me { name: string; emoji: string; role?: 'teacher' }

/** How long a joiner waits for the host's welcome (room_meta) before going in anyway. */
const WELCOME_WAIT_MS = 2500;
/** A new room's creator waits this long to check nobody is already using the code. */
const CODE_CHECK_MS = 900;

export function useRoom() {
  const [status, setStatus] = useState<RoomStatus>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  /** True while the host has vanished and we're waiting HOST_GRACE_MS for them to come back. */
  const [hostAway, setHostAway] = useState(false);
  const [meta, setMetaState] = useState<RoomMeta>(EMPTY_META);
  const [closedReason, setClosedReason] = useState<'locked' | 'removed' | null>(null);
  const myId = useRef(getMyId()).current;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlersRef = useRef<Set<(msg: GameMsg) => void>>(new Set());
  const hostRef = useRef<string | null>(null);
  const metaRef = useRef<RoomMeta>(EMPTY_META);
  const meRef = useRef<{ me: Me; joinedAt: number; code: string } | null>(null);
  const graceTimer = useRef<number | undefined>(undefined);
  const isHost = hostId === myId;

  useEffect(() => { setHostingRoom(isHost && status === 'lobby'); }, [isHost, status]);
  useEffect(() => () => setHostingRoom(false), []);

  const cleanup = useCallback(() => {
    window.clearTimeout(graceTimer.current);
    closeChannel(channelRef.current);
    channelRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const rawSend = useCallback((msg: GameMsg) => {
    channelRef.current?.send({ type: 'broadcast', event: 'msg', payload: { ...msg, from: myId } });
  }, [myId]);

  const setMeta = useCallback((m: RoomMeta) => {
    metaRef.current = m;
    setMetaState(m);
    // Kept per tab, so a refreshing host doesn't forget that the room was locked.
    try { if (m === EMPTY_META) sessionStorage.removeItem(META_KEY); else sessionStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* ignore */ }
  }, []);

  /** Host: change the room settings and tell everyone. */
  const updateMeta = useCallback((patch: Partial<RoomMeta>) => {
    if (hostRef.current !== myId) return;
    const next = { ...metaRef.current, ...patch };
    setMeta(next);
    rawSend({ t: ROOM_META, meta: next });
  }, [myId, rawSend, setMeta]);

  const connect = useCallback(
    (roomCode: string, me: Me, mode: 'create' | 'join' | 'reopen', joinedAt = Date.now()): Promise<JoinResult | 'taken'> => {
      cleanup();
      setStatus('connecting');
      setCode(roomCode);
      setPlayers([]);
      setHostId(null);
      setHostAway(false);
      setClosedReason(null);
      const kept = savedRoom()?.code === roomCode ? savedMeta() : null;
      setMeta(kept ?? EMPTY_META);
      hostRef.current = null;
      meRef.current = { me, joinedAt, code: roomCode };

      return new Promise((resolve) => {
        let resolved = false;
        let welcomeTimer: number | undefined;
        const finish = (r: JoinResult | 'taken') => {
          if (resolved) return;
          resolved = true;
          window.clearTimeout(welcomeTimer);
          if (r === 'ok') {
            setStatus('lobby');
            saveRoom({ code: roomCode, name: me.name, emoji: me.emoji, joinedAt: meRef.current?.joinedAt ?? joinedAt });
          } else {
            cleanup();
            // A join that was turned away shows its message in the lobby menu (no overlay).
            setStatus(r === 'not_found' || r === 'taken' ? 'not_found' : r === 'error' ? 'error' : 'idle');
          }
          resolve(r);
        };
        const channel = openChannel(`kpoproom:${roomCode}`, myId);
        channelRef.current = channel;

        channel.on('presence', { event: 'sync' }, () => {
          // Players the host turned away don't count (they leave a moment later).
          const list = presenceList<RoomPlayer>(channel)
            .filter((p) => p.id && (p.id === myId || admission(metaRef.current, p.id) === 'ok'))
            .sort((a, b) => a.joinedAt - b.joinedAt);
          const elected = pickHost(list);
          const current = hostRef.current;
          if (current && !list.some(p => p.id === current)) {
            // The host vanished (sleeping iPad, refresh, bad Wi-Fi). Give them time to come back —
            // unless a teacher is here, who takes over at once.
            const teacher = list.find(p => p.role === 'teacher');
            if (teacher) { hostRef.current = teacher.id; setHostId(teacher.id); setHostAway(false); }
            else {
              setHostAway(true);
              window.clearTimeout(graceTimer.current);
              graceTimer.current = window.setTimeout(() => {
                const next = pickHost(presenceList<RoomPlayer>(channel).filter(p => p.id));
                hostRef.current = next;
                setHostId(next);
                setHostAway(false);
              }, HOST_GRACE_MS);
            }
          } else {
            if (current && list.some(p => p.id === current)) { window.clearTimeout(graceTimer.current); setHostAway(false); }
            // A returning host (same joinedAt), a teacher, or a player the host passed the crown to
            // ranks first and takes the seat; otherwise keep the current host.
            const cur = list.find(p => p.id === current);
            const el = list.find(p => p.id === elected);
            const next = !current || !cur || (el && hostOrder(el, cur) < 0) ? elected : current;
            hostRef.current = next;
            setHostId(next);
          }
          setPlayers(list.map(p => ({ ...p, isHost: p.id === hostRef.current })));
          // Host: welcome new players (room settings), or turn them away.
          if (hostRef.current === myId) {
            let welcome = false;
            for (const p of presenceList<RoomPlayer>(channel)) {
              if (!p.id || p.id === myId) continue;
              const a = admission(metaRef.current, p.id);
              if (a !== 'ok') rawSend({ t: ROOM_REFUSE, to: p.id, reason: a });
              else welcome = true;
            }
            if (welcome) rawSend({ t: ROOM_META, meta: metaRef.current });
          }
          // Joining: the room exists once anyone else is in it. Wait for the host's welcome
          // (or a short while, for an older app version) before going in.
          if (mode !== 'create' && !resolved && list.some(p => p.id !== myId) && welcomeTimer === undefined) {
            welcomeTimer = window.setTimeout(() => finish('ok'), WELCOME_WAIT_MS);
          }
        });

        channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
          const m = payload as GameMsg;
          if (m.t === ROOM_META && m.from !== myId && m.meta) {
            setMeta(m.meta as RoomMeta);
            if (mode !== 'create') finish('ok');
          } else if (m.t === ROOM_REFUSE && m.to === myId) {
            setClosedReason(m.reason === 'removed' ? 'removed' : 'locked');
            if (resolved) { cleanup(); saveRoom(null); setStatus('closed'); }
            else finish(m.reason === 'removed' ? 'removed' : 'locked');
            return;
          } else if (m.t === ROOM_HOST && m.to === myId) {
            // The host passed me the crown: rank myself first.
            const others = presenceList<RoomPlayer>(channel).filter(p => p.id && p.id !== myId);
            const first = Math.min(...others.map(p => p.joinedAt), Date.now());
            const r = meRef.current;
            if (r) {
              r.joinedAt = first - 1;
              channel.track({ id: myId, name: r.me.name, emoji: r.me.emoji, isHost: false, joinedAt: r.joinedAt, ...(r.me.role ? { role: r.me.role } : {}) });
              saveRoom({ code: r.code, name: r.me.name, emoji: r.me.emoji, joinedAt: r.joinedAt });
            }
          }
          handlersRef.current.forEach((h) => h(m));
        });

        channel.subscribe(async (st) => {
          if (st === 'SUBSCRIBED') {
            // Track on every (re)subscribe: after a dropped connection the channel rejoins and
            // our presence has to be announced again.
            const r = meRef.current!;
            await channel.track({ id: myId, name: me.name, emoji: me.emoji, isHost: false, joinedAt: r.joinedAt, ...(me.role ? { role: me.role } : {}) });
            if (mode === 'reopen') finish('ok');
            else if (mode === 'create') {
              // A brand-new code: make sure nobody is already in a room with it.
              window.setTimeout(() => {
                const taken = presenceList<RoomPlayer>(channel).some(p => p.id && p.id !== myId);
                finish(taken ? 'taken' : 'ok');
              }, CODE_CHECK_MS);
            } else window.setTimeout(() => { if (welcomeTimer === undefined) finish('not_found'); }, 3500);
          } else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !resolved) {
            finish('error');
          }
        });
      });
    },
    [cleanup, myId, rawSend, setMeta]
  );

  /** Makes a room with a fresh code (retrying if the code is in use). Returns the code. */
  const createRoom = useCallback(
    async (me: Me): Promise<string | null> => {
      for (let i = 0; i < 4; i++) {
        const c = makeCode();
        const r = await connect(c, me, 'create');
        if (r === 'ok') return c;
        if (r !== 'taken') return null;
      }
      return null;
    },
    [connect]
  );

  const joinRoom = useCallback(
    async (c: string, me: Me): Promise<JoinResult> => {
      const r = await connect(c.toUpperCase().trim(), me, 'join');
      return r === 'taken' ? 'not_found' : r;
    },
    [connect]
  );

  /** Rejoin the room saved for this tab (after a refresh), keeping the same seat and host rank. */
  const rejoin = useCallback(async (role?: 'teacher'): Promise<JoinResult> => {
    const r = savedRoom();
    if (!r) return 'not_found';
    const me = { name: r.name, emoji: r.emoji, role };
    // Try as a joiner first (others are there); if the room is empty, reopen it as its host.
    const res = await connect(r.code, me, 'join', r.joinedAt);
    if (res !== 'not_found') return res === 'taken' ? 'not_found' : res;
    return (await connect(r.code, me, 'reopen', r.joinedAt)) === 'ok' ? 'ok' : 'error';
  }, [connect]);

  const leaveRoom = useCallback(() => {
    cleanup();
    saveRoom(null);
    setStatus('idle');
    setCode(null);
    setPlayers([]);
    setHostId(null);
    setHostAway(false);
    setClosedReason(null);
    setMeta(EMPTY_META);
    hostRef.current = null;
  }, [cleanup, setMeta]);

  const send = rawSend;

  const onMessage = useCallback((h: (msg: GameMsg) => void) => {
    handlersRef.current.add(h);
    return () => {
      handlersRef.current.delete(h);
    };
  }, []);

  const reportResult = useCallback((ranked: (string | string[])[]) => send({ t: SESSION_RESULT, ranked }), [send]);

  // ---- Host powers ----
  /** Lock or unlock the room. Everyone already in stays allowed. */
  const setLocked = useCallback((locked: boolean) => {
    const ids = players.map(p => p.id);
    updateMeta({ locked, allowed: locked ? [...new Set([...metaRef.current.allowed, ...ids])] : metaRef.current.allowed });
  }, [players, updateMeta]);

  /** Let a player in (club knock / invite), even when the room is locked. */
  const allowPlayer = useCallback((id: string) => {
    updateMeta({ allowed: [...new Set([...metaRef.current.allowed, id])], removed: metaRef.current.removed.filter(x => x !== id) });
  }, [updateMeta]);

  /** Remove a player: they get a kind message and are turned away if they come back. */
  const removePlayer = useCallback((id: string) => {
    if (id === myId) return;
    updateMeta({ removed: [...new Set([...metaRef.current.removed, id])], allowed: metaRef.current.allowed.filter(x => x !== id) });
    rawSend({ t: ROOM_REFUSE, to: id, reason: 'removed' });
  }, [myId, rawSend, updateMeta]);

  /** Hand the crown to another player. */
  const passHost = useCallback((id: string) => {
    if (hostRef.current !== myId || id === myId) return;
    rawSend({ t: ROOM_HOST, to: id });
  }, [myId, rawSend]);

  return {
    status, code, players, isHost, hostId, hostAway, myId, meta, closedReason,
    createRoom, joinRoom, rejoin, leaveRoom, send, onMessage, reportResult,
    setLocked, allowPlayer, removePlayer, passHost,
  };
}
