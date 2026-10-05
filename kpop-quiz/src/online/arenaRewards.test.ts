import { describe, it, expect, vi } from 'vitest';
import { placeScore, flatRanking, finishArenaGame, ARENA_ID } from './arenaRewards';
import { useGameStore } from '../store';

describe('Arena rewards', () => {
  it('scores 1st 100, last 20, evenly between; ties share a rung', () => {
    expect(placeScore(['a', 'b', 'c'], 'a')).toBe(100);
    expect(placeScore(['a', 'b', 'c'], 'b')).toBe(60);
    expect(placeScore(['a', 'b', 'c'], 'c')).toBe(20);
    expect(placeScore([['a', 'b'], 'c'], 'b')).toBe(100);
    expect(placeScore(['a', 'b'], 'z')).toBe(20);
    expect(placeScore(['a'], 'a')).toBe(100);
    expect(flatRanking([['a', 'b'], 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('rewards through finishRound and only the host reports the ranking', () => {
    const spy = vi.spyOn(useGameStore.getState(), 'finishRound');
    const host = { isHost: true, myId: 'a', reportResult: vi.fn() };
    const guest = { isHost: false, myId: 'b', reportResult: vi.fn() };
    finishArenaGame(host, ['a', 'b']);
    finishArenaGame(guest, ['a', 'b']);
    expect(host.reportResult).toHaveBeenCalledWith(['a', 'b']);
    expect(guest.reportResult).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(ARENA_ID, 100, expect.any(Number));
    expect(spy).toHaveBeenCalledWith(ARENA_ID, 20, expect.any(Number));
  });
});
