import { describe, it, expect } from 'vitest';
import { TRACKS } from '../store';
import { createRng } from '../games/engine/rng';
import { songsFrom, pickRounds, pickOptions, isRight, clipStart, LEVELS, ROUND_COUNT, OPTION_COUNT } from './guessIntroLogic';

describe('guessIntroLogic', () => {
  const songs = songsFrom(TRACKS);

  it('treats versions of the same song as one answer', () => {
    const takedown = songs.filter(s => s.key === 'takedown');
    expect(takedown.length).toBe(1);
    expect(takedown[0].files.length).toBe(2);
    expect(takedown[0].title).toBe('Takedown');
    expect(new Set(songs.map(s => s.key)).size).toBe(songs.length);
    // Every track belongs to exactly one song.
    expect(songs.reduce((n, s) => n + s.files.length, 0)).toBe(TRACKS.length);
  });

  it('never repeats a song or track within a game', () => {
    for (let seed = 1; seed < 50; seed++) {
      const rounds = pickRounds(songs, createRng(seed));
      expect(rounds.length).toBe(Math.min(ROUND_COUNT, songs.length));
      expect(new Set(rounds.map(r => r.song.key)).size).toBe(rounds.length);
      expect(new Set(rounds.map(r => r.file)).size).toBe(rounds.length);
      for (const r of rounds) expect(r.song.files).toContain(r.file);
    }
  });

  it('offers the right answer once and never two versions of one song', () => {
    for (let seed = 1; seed < 50; seed++) {
      const rng = createRng(seed);
      const [round] = pickRounds(songs, rng);
      const opts = pickOptions(round.song, songs, rng);
      expect(opts.length).toBe(Math.min(OPTION_COUNT, songs.length));
      expect(new Set(opts.map(o => o.key)).size).toBe(opts.length);
      expect(opts.filter(o => isRight(o, round)).length).toBe(1);
    }
  });

  it('has three clip lengths and a start time for every track', () => {
    expect(LEVELS.map(l => l.clip)).toEqual([3, 2, 1]);
    for (const t of TRACKS) expect(clipStart(t.file)).toBeGreaterThan(0);
    // A perfect round lands near 40 XP on every level (finishRound: score / xpScale).
    for (const l of LEVELS) expect(Math.round(ROUND_COUNT / l.xpScale)).toBeGreaterThanOrEqual(30);
  });
});
