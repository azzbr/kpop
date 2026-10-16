// A Friends Arena club: the people who joined with the same club code can see each other
// (first name + emoji + what they're doing), see each other's rooms, knock to join a room and
// invite each other — no room code needed. Channel `kpopclub:<CODE>`; presence carries a
// ClubMember, and knock / admit / deny / invite are broadcasts addressed `to` one device.
// Nothing is stored anywhere. Joining needs the code, which a grown-up or teacher shares.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/realtime-js';
import { openChannel, closeChannel, presenceList, getMyId } from './channel';
import { allow, fresh } from './clubLogic';
import type { ClubMember, Knock, Invite } from './clubLogic';

export const CLUB_KNOCK = 'club_knock';
export const CLUB_ADMIT = 'club_admit';
export const CLUB_DENY = 'club_deny';
export const CLUB_INVITE = 'club_invite';

type Me = Omit<ClubMember, 'id'>;

interface Handlers {
  /** The host let us in: join this room now. */
  onAdmit: (room: string) => void;
  /** The host said "not now". */
  onDeny?: () => void;
}

export function useClub(code: string | null, me: Me, handlers: Handlers) {
  const myId = useRef(getMyId()).current;
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [connected, setConnected] = useState(false);
  const [knocks, setKnocks] = useState<Knock[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const chRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  const hRef = useRef(handlers);
  hRef.current = handlers;
  const sent = useRef(new Map<string, number>());
  const got = useRef(new Map<string, number>());

  useEffect(() => {
    setMembers([]);
    setKnocks([]);
    setInvites([]);
    setConnected(false);
    if (!code) return;
    const ch = openChannel(`kpopclub:${code}`, myId);
    chRef.current = ch;
    ch.on('presence', { event: 'sync' }, () => {
      setMembers(presenceList<ClubMember>(ch).filter(m => m.id && m.id !== myId).sort((a, b) => a.name.localeCompare(b.name)));
    });
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      const m = payload as { t: string; to?: string; from?: string; [k: string]: unknown };
      if (m.to !== myId || !m.from) return;
      const now = Date.now();
      if (m.t === CLUB_KNOCK) {
        if (!meRef.current.room?.host || m.room !== meRef.current.room.code || !allow(got.current, `k${m.from}`, now)) return;
        setKnocks(k => fresh([...k, { from: m.from!, name: String(m.name), emoji: String(m.emoji), room: String(m.room), at: now }], now));
      } else if (m.t === CLUB_INVITE) {
        if (meRef.current.room || !allow(got.current, `i${m.from}`, now)) return;
        setInvites(v => fresh([...v, { from: m.from!, name: String(m.name), emoji: String(m.emoji), room: String(m.room), game: m.game as string | undefined, at: now }], now));
      } else if (m.t === CLUB_ADMIT) {
        if (typeof m.room === 'string') hRef.current.onAdmit(m.room);
      } else if (m.t === CLUB_DENY) {
        hRef.current.onDeny?.();
      }
    });
    ch.subscribe((st) => {
      if (st === 'SUBSCRIBED') {
        setConnected(true);
        ch.track({ id: myId, ...meRef.current });
      }
    });
    // Old knocks and invites fade away.
    const iv = window.setInterval(() => {
      const now = Date.now();
      setKnocks(k => (k.length ? fresh(k, now) : k));
      setInvites(v => (v.length ? fresh(v, now) : v));
    }, 5000);
    return () => {
      window.clearInterval(iv);
      closeChannel(ch);
      chRef.current = null;
    };
  }, [code, myId]);

  // Share changes to what I'm doing (status, room, players) — only when something changed.
  const meKey = JSON.stringify(me);
  const lastTracked = useRef('');
  useEffect(() => {
    if (!connected || lastTracked.current === meKey) return;
    lastTracked.current = meKey;
    chRef.current?.track({ id: myId, ...meRef.current });
  }, [connected, meKey, myId]);

  const send = useCallback((msg: Record<string, unknown>) => {
    chRef.current?.send({ type: 'broadcast', event: 'msg', payload: { ...msg, from: myId } });
  }, [myId]);

  /** Ask a host to let me into their room. Returns false if I asked them very recently. */
  const knock = useCallback((host: ClubMember) => {
    if (!host.room || !allow(sent.current, `k${host.id}`, Date.now())) return false;
    send({ t: CLUB_KNOCK, to: host.id, room: host.room.code, name: meRef.current.name, emoji: meRef.current.emoji });
    return true;
  }, [send]);

  /** Invite a free member into my room. */
  const invite = useCallback((m: ClubMember, game?: string) => {
    const room = meRef.current.room;
    if (!room || !allow(sent.current, `i${m.id}`, Date.now())) return false;
    send({ t: CLUB_INVITE, to: m.id, room: room.code, game, name: meRef.current.name, emoji: meRef.current.emoji });
    return true;
  }, [send]);

  /** Host: answer a knock. (Let the knocker into the room's allowed list first.) */
  const answerKnock = useCallback((k: Knock, yes: boolean) => {
    send({ t: yes ? CLUB_ADMIT : CLUB_DENY, to: k.from, room: k.room });
    setKnocks(list => list.filter(x => x.from !== k.from));
  }, [send]);

  const dismissInvite = useCallback((i: Invite) => setInvites(list => list.filter(x => x.from !== i.from)), []);

  return { myId, members, connected, knocks, invites, knock, invite, answerKnock, dismissInvite };
}
