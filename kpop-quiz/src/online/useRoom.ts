import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/realtime-js';
import { realtime } from './supabaseClient';
import { LocalChannel, LOCAL_ROOMS } from './localChannel';

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
}

export type RoomStatus = 'idle' | 'connecting' | 'lobby' | 'not_found' | 'closed' | 'error';

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
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeCode(): string {
  let c = '';
  for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

export function getMyId(): string {
  let id = sessionStorage.getItem('kpop_player_id');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionStorage.setItem('kpop_player_id', id);
  }
  return id;
}

// The room this tab is in, so a refresh (or iPad Safari reloading a sleeping tab) rejoins it
// with the same seat. `joinedAt` decides who is host, so keeping it keeps the host the host.
const ROOM_KEY = 'kpop_room';
export interface SavedRoom { code: string; name: string; emoji: string; joinedAt: number }
export function savedRoom(): SavedRoom | null {
  try { return JSON.parse(sessionStorage.getItem(ROOM_KEY) || 'null'); } catch { return null; }
}
const saveRoom = (r: SavedRoom | null) => {
  try { if (r) sessionStorage.setItem(ROOM_KEY, JSON.stringify(r)); else sessionStorage.removeItem(ROOM_KEY); } catch { /* ignore */ }
};

/** How long everyone waits for a vanished host to come back before someone else takes over. */
export const HOST_GRACE_MS = 20000;

/** The host is whoever has been in the room longest (ties broken by id, so every device agrees). */
export function pickHost(list: { id: string; joinedAt: number }[]): string | null {
  if (!list.length) return null;
  return [...list].sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1))[0].id;
}

export function useRoom() {
  const [status, setStatus] = useState<RoomStatus>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  /** True while the host has vanished and we're waiting HOST_GRACE_MS for them to come back. */
  const [hostAway, setHostAway] = useState(false);
  const myId = useRef(getMyId()).current;
  const channelRef = useRef<RealtimeChannel | LocalChannel | null>(null);
  const handlersRef = useRef<Set<(msg: GameMsg) => void>>(new Set());
  const hostRef = useRef<string | null>(null);
  const graceTimer = useRef<number | undefined>(undefined);
  const isHost = hostId === myId;

  const cleanup = useCallback(() => {
    window.clearTimeout(graceTimer.current);
    const ch = channelRef.current;
    if (ch) {
      if (ch instanceof LocalChannel) ch.close();
      else realtime.removeChannel(ch);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const connect = useCallback(
    (roomCode: string, me: { name: string; emoji: string }, creating: boolean, joinedAt = Date.now()): Promise<boolean> => {
      cleanup();
      setStatus('connecting');
      setCode(roomCode);
      setPlayers([]);
      setHostId(null);
      setHostAway(false);
      hostRef.current = null;

      return new Promise((resolve) => {
        let resolved = false;
        const finish = (ok: boolean, st: RoomStatus) => {
          if (resolved) return;
          resolved = true;
          setStatus(st);
          if (ok) saveRoom({ code: roomCode, name: me.name, emoji: me.emoji, joinedAt });
          else cleanup();
          resolve(ok);
        };
        // ?localroom swaps Supabase for a BroadcastChannel between tabs (tests, offline play).
        const channel = (LOCAL_ROOMS
          ? new LocalChannel(`kpoproom:${roomCode}`, myId)
          : realtime.channel(`kpoproom:${roomCode}`, {
              config: {
                presence: { key: myId },
                broadcast: { self: true },
              },
            })) as RealtimeChannel;
        channelRef.current = channel;

        channel.on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const list = Object.values(state)
            .map((metas) => metas[0] as unknown as RoomPlayer)
            .filter((p) => p && p.id)
            .sort((a, b) => a.joinedAt - b.joinedAt);
          const elected = pickHost(list);
          const current = hostRef.current;
          if (current && !list.some(p => p.id === current)) {
            // The host vanished (sleeping iPad, refresh, bad Wi-Fi). Give them time to come back.
            setHostAway(true);
            window.clearTimeout(graceTimer.current);
            graceTimer.current = window.setTimeout(() => {
              const now = Object.values(channel.presenceState()).map(m => m[0] as unknown as RoomPlayer).filter(p => p && p.id);
              const next = pickHost(now);
              hostRef.current = next;
              setHostId(next);
              setHostAway(false);
            }, HOST_GRACE_MS);
          } else {
            if (current && list.some(p => p.id === current)) { window.clearTimeout(graceTimer.current); setHostAway(false); }
            // A returning host (same joinedAt) takes their seat back; otherwise keep the current host.
            const next = !current || (elected && list.find(p => p.id === elected)!.joinedAt < (list.find(p => p.id === current)?.joinedAt ?? Infinity)) ? elected : current;
            hostRef.current = next;
            setHostId(next);
          }
          setPlayers(list.map(p => ({ ...p, isHost: p.id === hostRef.current })));
          // Joining: the room exists once anyone else is in it.
          if (!creating && list.some(p => p.id !== myId)) finish(true, 'lobby');
        });

        channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
          handlersRef.current.forEach((h) => h(payload as GameMsg));
        });

        channel.subscribe(async (st) => {
          if (st === 'SUBSCRIBED') {
            // Track on every (re)subscribe: after a dropped connection the channel rejoins and
            // our presence has to be announced again.
            await channel.track({ id: myId, name: me.name, emoji: me.emoji, isHost: false, joinedAt });
            if (creating) finish(true, 'lobby');
            else setTimeout(() => finish(false, 'not_found'), 3500);
          } else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !resolved) {
            finish(false, 'error');
          }
        });
      });
    },
    [cleanup, myId]
  );

  const createRoom = useCallback(
    async (me: { name: string; emoji: string }): Promise<string | null> => {
      const c = makeCode();
      const ok = await connect(c, me, true);
      return ok ? c : null;
    },
    [connect]
  );

  const joinRoom = useCallback(
    (c: string, me: { name: string; emoji: string }) => connect(c.toUpperCase().trim(), me, false),
    [connect]
  );

  /** Rejoin the room saved for this tab (after a refresh), keeping the same seat and host rank. */
  const rejoin = useCallback(async (): Promise<boolean> => {
    const r = savedRoom();
    if (!r) return false;
    // Try as a joiner first (others are there); if the room is empty, reopen it as its host.
    const ok = await connect(r.code, { name: r.name, emoji: r.emoji }, false, r.joinedAt);
    return ok || connect(r.code, { name: r.name, emoji: r.emoji }, true, r.joinedAt);
  }, [connect]);

  const leaveRoom = useCallback(() => {
    cleanup();
    saveRoom(null);
    setStatus('idle');
    setCode(null);
    setPlayers([]);
    setHostId(null);
    setHostAway(false);
    hostRef.current = null;
  }, [cleanup]);

  const send = useCallback(
    (msg: GameMsg) => {
      channelRef.current?.send({ type: 'broadcast', event: 'msg', payload: { ...msg, from: myId } });
    },
    [myId]
  );

  const onMessage = useCallback((h: (msg: GameMsg) => void) => {
    handlersRef.current.add(h);
    return () => {
      handlersRef.current.delete(h);
    };
  }, []);

  const reportResult = useCallback((ranked: (string | string[])[]) => send({ t: SESSION_RESULT, ranked }), [send]);

  return { status, code, players, isHost, hostId, hostAway, myId, createRoom, joinRoom, rejoin, leaveRoom, send, onMessage, reportResult };
}
