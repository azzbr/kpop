import { describe, it, expect } from 'vitest';
import { pickHost, admission, EMPTY_META, makeCode, CODE_CHARS } from './useRoom';
import { countPresence } from './usePresenceCount';
import { allow, openRooms, memberAction, fresh, CLUB_GAP_MS, CLUB_TTL_MS } from './clubLogic';
import type { ClubMember } from './clubLogic';

describe('room rules', () => {
  it('a teacher is always the host, even if they joined last', () => {
    expect(pickHost([{ id: 'a', joinedAt: 1 }, { id: 't', joinedAt: 9, role: 'teacher' }])).toBe('t');
    expect(pickHost([{ id: 'a', joinedAt: 1 }, { id: 'b', joinedAt: 0 }])).toBe('b');
    expect(pickHost([{ id: 't2', joinedAt: 5, role: 'teacher' }, { id: 't1', joinedAt: 4, role: 'teacher' }])).toBe('t1');
  });

  it('locked rooms let in only allowed players; removed players stay out', () => {
    expect(admission(EMPTY_META, 'x')).toBe('ok');
    const locked = { locked: true, removed: [], allowed: ['a'] };
    expect(admission(locked, 'a')).toBe('ok');
    expect(admission(locked, 'b')).toBe('locked');
    expect(admission({ ...EMPTY_META, removed: ['b'] }, 'b')).toBe('removed');
    expect(admission({ locked: true, removed: ['a'], allowed: ['a'] }, 'a')).toBe('removed');
  });

  it('room codes are 4 easy-to-read letters', () => {
    for (let i = 0; i < 100; i++) {
      const c = makeCode();
      expect(c).toHaveLength(4);
      for (const ch of c) expect(CODE_CHARS).toContain(ch);
    }
    expect(CODE_CHARS).not.toMatch(/[IO]/);
  });

  it('counts devices and hosted rooms', () => {
    expect(countPresence([{ r: 0 }, { r: 1 }, {}, { r: 1 }])).toEqual({ online: 4, rooms: 2 });
  });
});

const member = (id: string, extra: Partial<ClubMember> = {}): ClubMember => ({ id, name: id, emoji: '🦊', status: 'menu', ...extra });

describe('club rules', () => {
  it('rate-limits knocks and invites per person', () => {
    const last = new Map<string, number>();
    expect(allow(last, 'k1', 0)).toBe(true);
    expect(allow(last, 'k1', CLUB_GAP_MS - 1)).toBe(false);
    expect(allow(last, 'k2', 5)).toBe(true);
    expect(allow(last, 'k1', CLUB_GAP_MS)).toBe(true);
  });

  it('lists hosted rooms, not my own', () => {
    const ms = [
      member('zoe', { status: 'lobby', room: { code: 'ABCD', players: 2, host: true, locked: false } }),
      member('amy', { status: 'lobby', room: { code: 'ABCD', players: 2, host: false, locked: false } }),
      member('ben', { status: 'playing', room: { code: 'WXYZ', game: 'imposter', players: 4, host: true, locked: true } }),
    ];
    expect(openRooms(ms).map(r => r.code)).toEqual(['WXYZ', 'ABCD']);
    expect(openRooms(ms, 'ABCD').map(r => r.code)).toEqual(['WXYZ']);
  });

  it('tapping a member knocks on their room or invites them to mine', () => {
    const host = member('zoe', { room: { code: 'ABCD', players: 2, host: true, locked: false } });
    const free = member('ben');
    expect(memberAction(host, { roomCode: null, isHost: false })).toBe('knock');
    expect(memberAction(free, { roomCode: 'QQQQ', isHost: true })).toBe('invite');
    expect(memberAction(free, { roomCode: 'QQQQ', isHost: false })).toBe('none');
    expect(memberAction(free, { roomCode: null, isHost: false })).toBe('none');
    expect(memberAction(host, { roomCode: 'ABCD', isHost: false })).toBe('same_room');
  });

  it('keeps one fresh knock per sender', () => {
    const items = [{ from: 'a', at: 0 }, { from: 'a', at: 10 }, { from: 'b', at: -CLUB_TTL_MS }];
    expect(fresh(items, 100)).toEqual([{ from: 'a', at: 10 }]);
  });
});
