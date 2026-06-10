import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export type GameId = 'quiz_duel' | 'team_tug' | 'world_tour' | 'class_show';

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
}

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

export function useRoom() {
  const [status, setStatus] = useState<RoomStatus>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const myId = useRef(getMyId()).current;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const handlersRef = useRef<Set<(msg: GameMsg) => void>>(new Set());

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const connect = useCallback(
    (roomCode: string, me: { name: string; emoji: string }, asHost: boolean): Promise<boolean> => {
      cleanup();
      setStatus('connecting');
      setIsHost(asHost);
      setCode(roomCode);
      setPlayers([]);

      return new Promise((resolve) => {
        let resolved = false;
        const channel = supabase.channel(`kpoproom:${roomCode}`, {
          config: {
            presence: { key: myId },
            broadcast: { self: true },
          },
        });
        channelRef.current = channel;

        channel.on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const list = Object.values(state)
            .map((metas) => metas[0] as unknown as RoomPlayer)
            .filter((p) => p && p.id)
            .sort((a, b) => a.joinedAt - b.joinedAt);
          setPlayers(list);

          const hostPresent = list.some((p) => p.isHost);
          if (!asHost) {
            if (hostPresent && !resolved) {
              resolved = true;
              setStatus('lobby');
              resolve(true);
            } else if (!hostPresent && resolved) {
              setStatus('closed');
            }
          }
        });

        channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
          handlersRef.current.forEach((h) => h(payload as GameMsg));
        });

        channel.subscribe(async (st) => {
          if (st === 'SUBSCRIBED') {
            await channel.track({
              id: myId,
              name: me.name,
              emoji: me.emoji,
              isHost: asHost,
              joinedAt: Date.now(),
            });
            if (asHost && !resolved) {
              resolved = true;
              setStatus('lobby');
              resolve(true);
            }
            if (!asHost) {
              // If no host shows up in presence shortly, the room doesn't exist
              setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  setStatus('not_found');
                  cleanup();
                  resolve(false);
                }
              }, 3000);
            }
          } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
            if (!resolved) {
              resolved = true;
              setStatus('error');
              cleanup();
              resolve(false);
            }
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

  const leaveRoom = useCallback(() => {
    cleanup();
    setStatus('idle');
    setCode(null);
    setPlayers([]);
    setIsHost(false);
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

  return { status, code, players, isHost, myId, createRoom, joinRoom, leaveRoom, send, onMessage };
}
