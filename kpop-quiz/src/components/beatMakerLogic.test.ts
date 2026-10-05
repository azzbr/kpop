import { describe, it, expect } from 'vitest';
import { createRng } from '../games/engine/rng';
import {
  INSTRUMENTS, STEPS, PRESETS, MAX_SAVED, emptyGrid, toggleCell, randomGrid, clampBpm, stepSeconds,
  encodeGrid, decodeGrid, parseSaved, addBeat, removeBeat, beatName, isEmpty, synthFreq,
} from './beatMakerLogic';

describe('beatMakerLogic', () => {
  it('presets have one 16-step row per instrument and no K-Pop names', () => {
    for (const [name, g] of Object.entries(PRESETS)) {
      expect(g.length).toBe(INSTRUMENTS.length);
      for (const r of g) expect(r.length).toBe(STEPS);
      expect(name.toLowerCase()).not.toContain('k-pop');
    }
  });

  it('toggles one cell without touching the rest', () => {
    const g = toggleCell(emptyGrid(), 2, 5);
    expect(g[2][5]).toBe(true);
    expect(g.flat().filter(Boolean).length).toBe(1);
    expect(isEmpty(toggleCell(g, 2, 5))).toBe(true);
  });

  it('random beats keep the kick on the beat', () => {
    const g = randomGrid(createRng(7));
    g[0].forEach((on, i) => { if (on) expect(i % 4).toBe(0); });
  });

  it('clamps tempo and times steps as 16th notes', () => {
    expect(clampBpm(20)).toBe(60);
    expect(clampBpm(999)).toBe(200);
    expect(stepSeconds(120)).toBeCloseTo(0.125);
    expect(synthFreq(8)).toBe(synthFreq(0));
  });

  it('round-trips grids and rejects bad saves', () => {
    const g = PRESETS['Hip-Hop'];
    expect(decodeGrid(encodeGrid(g))).toEqual(g);
    expect(decodeGrid(['101'])).toBeNull();
    expect(parseSaved('not json')).toEqual([]);
    expect(parseSaved(null)).toEqual([]);
    const ok = { id: 'a', name: 'x', bpm: 120, rows: encodeGrid(g) };
    expect(parseSaved(JSON.stringify([ok, { id: 'b' }, 5]))).toEqual([ok]);
  });

  it('keeps at most 5 saved beats with unique names', () => {
    const rng = createRng(1);
    let list: ReturnType<typeof parseSaved> = [];
    for (let i = 0; i < MAX_SAVED; i++) {
      const next = addBeat(list, { id: String(i), name: beatName(list.map(b => b.name), rng), bpm: 100, rows: encodeGrid(emptyGrid()) });
      expect(next).not.toBeNull();
      list = next!;
    }
    expect(new Set(list.map(b => b.name)).size).toBe(MAX_SAVED);
    expect(addBeat(list, { id: 'x', name: 'x', bpm: 100, rows: [] })).toBeNull();
    expect(removeBeat(list, '0').length).toBe(MAX_SAVED - 1);
  });
});
