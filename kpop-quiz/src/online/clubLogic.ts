// Pure rules for Friends Arena clubs (no React, no network). See useClub.ts.

export type ClubStatus = 'menu' | 'lobby' | 'playing';

/** What each club member shares with the rest of the club (first name + emoji only). */
export interface ClubMember {
  id: string;
  name: string;
  emoji: string;
  status: ClubStatus;
  /** The room this member is in, if any. */
  room?: { code: string; game?: string; players: number; host: boolean; locked: boolean };
  role?: 'teacher';
}

export interface Knock { from: string; name: string; emoji: string; room: string; at: number }
export interface Invite { from: string; name: string; emoji: string; room: string; game?: string; at: number }

/** One knock or invite per person per this many ms, both when sending and when receiving. */
export const CLUB_GAP_MS = 10000;
/** A knock or invite nobody answered disappears after this. */
export const CLUB_TTL_MS = 30000;

/** Rate limit: true (and records it) if `key` hasn't been used within `gap` ms. */
export function allow(last: Map<string, number>, key: string, now: number, gap = CLUB_GAP_MS): boolean {
  const t = last.get(key);
  if (t !== undefined && now - t < gap) return false;
  last.set(key, now);
  return true;
}

/** An open room a member hosts, as a card in the club list (newest first is not needed: by name). */
export interface RoomCard { code: string; game?: string; players: number; locked: boolean; host: ClubMember }

export function openRooms(members: ClubMember[], myRoom?: string | null): RoomCard[] {
  return members
    .filter(m => m.room?.host && m.room.code !== myRoom)
    .map(m => ({ code: m.room!.code, game: m.room!.game, players: m.room!.players, locked: m.room!.locked, host: m }))
    .sort((a, b) => a.host.name.localeCompare(b.host.name));
}

/** What tapping a member does: knock on their room, invite them to mine, or nothing. */
export function memberAction(m: ClubMember, me: { roomCode?: string | null; isHost: boolean }): 'knock' | 'invite' | 'same_room' | 'none' {
  if (me.roomCode && m.room?.code === me.roomCode) return 'same_room';
  if (m.room?.host) return 'knock';
  if (me.roomCode && me.isHost && !m.room) return 'invite';
  return 'none';
}

/** Keeps only fresh items, one per sender (the newest). */
export function fresh<T extends { from: string; at: number }>(items: T[], now: number): T[] {
  const by = new Map<string, T>();
  for (const it of items) if (now - it.at < CLUB_TTL_MS) by.set(it.from, it);
  return [...by.values()];
}

export const STATUS_TEXT: Record<ClubStatus, string> = {
  menu: 'online',
  lobby: 'in a room',
  playing: 'playing',
};
