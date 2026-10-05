import { describe, expect, it } from 'vitest';
import { createRng } from '../../games/engine/rng';
import {
  COLOUR_DIFF, MEMORY_DIFF, MISSING_DIFF, PALETTE, TRAY_POOL,
  makeColourRounds, makeMemoryRounds, makeMissingRounds, memoryPoints,
} from './raceRounds';

const LEVELS = ['easy', 'medium', 'hard', 'expert', 'master', 'legend'];

describe('Memory Digits rounds', () => {
  it('grow one digit per round from the level start, answer = the shown digits', () => {
    for (const lvl of LEVELS) {
      const rounds = makeMemoryRounds(lvl, 6, createRng(7));
      rounds.forEach((r, i) => {
        expect(r.show).toHaveLength(MEMORY_DIFF[lvl].start + i);
        expect(r.answer).toBe(r.show!.join(''));
        expect(r.prompt.len).toBe(r.answer.length);
        expect(r.showMs).toBe(r.answer.length * MEMORY_DIFF[lvl].perMs);
      });
    }
  });
  it('falls back to medium and scores longer numbers higher', () => {
    expect(makeMemoryRounds('nope', 1)[0].answer).toHaveLength(MEMORY_DIFF.medium.start);
    expect(memoryPoints('12345')).toBeGreaterThan(memoryPoints('123'));
  });
});

describe('Colour Clash rounds', () => {
  it('the right option is always the ink colour, from the level palette', () => {
    for (const lvl of LEVELS) {
      for (const r of makeColourRounds(lvl, 50, createRng(3))) {
        expect(r.options).toHaveLength(COLOUR_DIFF[lvl].colors);
        expect(r.options[r.correctIndex].hex).toBe(r.prompt.inkHex);
        expect(PALETTE.slice(0, COLOUR_DIFF[lvl].colors).map(p => p.name)).toContain(r.prompt.word);
      }
    }
  });
  it('word and ink differ on non-tricky levels', () => {
    for (const r of makeColourRounds('easy', 200, createRng(11))) {
      expect(r.options[r.correctIndex].label).not.toBe(r.prompt.word);
    }
  });
});

describe("What's Missing rounds", () => {
  it('blanks exactly one tray item, which is the right option; decoys were not on the tray', () => {
    for (const lvl of LEVELS) {
      for (const r of makeMissingRounds(lvl, 30, createRng(5))) {
        const tray = r.study!;
        expect(tray).toHaveLength(MISSING_DIFF[lvl].count);
        expect(new Set(tray.map(t => t.label)).size).toBe(tray.length);
        const blanks = r.prompt.map((p, i) => (p ? -1 : i)).filter(i => i >= 0);
        expect(blanks).toHaveLength(1);
        expect(r.options).toHaveLength(4);
        expect(r.options[r.correctIndex]).toBe(tray[blanks[0]]);
        r.options.forEach((o, i) => { if (i !== r.correctIndex) expect(tray).not.toContain(o); });
      }
    }
  });
  it('the pool is big enough for the hardest tray plus 3 decoys', () => {
    expect(TRAY_POOL.length).toBeGreaterThanOrEqual(MISSING_DIFF.legend.count + 3);
    expect(new Set(TRAY_POOL.map(t => t.emoji)).size).toBe(TRAY_POOL.length);
  });
});
