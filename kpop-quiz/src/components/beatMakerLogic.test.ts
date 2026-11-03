import { describe, it, expect } from 'vitest';
import { createRng } from '../games/engine/rng';
import {
  INSTRUMENTS, STEPS, PRESETS, MAX_SAVED, emptyGrid, toggleCell, randomGrid, clampBpm, stepSeconds,
  encodeGrid, decodeGrid, parseSaved, addBeat, removeBeat, beatName, isEmpty, synthFreq,
  MELODY_NOTES, emptyMelody, toggleMelody, decodeMelody, tuneToMelody, PRESET_TUNES, randomMelody,
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

describe('melody grid', () => {
  it('has ten pentatonic notes from high to low', () => {
    expect(MELODY_NOTES).toHaveLength(10);
    for (let i = 1; i < MELODY_NOTES.length; i++) expect(MELODY_NOTES[i].freq).toBeLessThan(MELODY_NOTES[i - 1].freq);
    expect(new Set(MELODY_NOTES.map(n => n.label))).toEqual(new Set(['Do', 'Re', 'Mi', 'So', 'La']));
  });

  it('toggles notes, and round-trips through a save', () => {
    const m = toggleMelody(toggleMelody(emptyMelody(), 4, 0), 7, 3);
    expect(m[4][0] && m[7][3]).toBe(true);
    expect(m.flat().filter(Boolean)).toHaveLength(2);
    expect(decodeMelody(encodeGrid(m))).toEqual(m);
    expect(decodeMelody(['101'])).toBeNull();
    expect(isEmpty(toggleMelody(m, 4, 0).map((r, i) => (i === 7 ? r.map(() => false) : r)))).toBe(true);
  });

  it('every preset has a tune on its even steps', () => {
    for (const name of Object.keys(PRESETS)) {
      const m = tuneToMelody(PRESET_TUNES[name]);
      expect(m.flat().some(Boolean), name).toBe(true);
      m.forEach(r => r.forEach((on, step) => { if (on) expect(step % 2).toBe(0); }));
    }
  });

  it('random tunes play at most one note per step and end on Do', () => {
    for (let seed = 1; seed < 60; seed++) {
      const m = randomMelody(createRng(seed));
      for (let step = 0; step < STEPS; step++) expect(m.filter(r => r[step]).length).toBeLessThanOrEqual(1);
      const last = m.findIndex(r => r[STEPS - 2]);
      expect(MELODY_NOTES[last].label).toBe('Do');
    }
  });

  it('old saves without a tune still load, and a broken tune keeps the beat', () => {
    const rows = encodeGrid(PRESETS['Disco']);
    const old = { id: 'o', name: 'Old', bpm: 100, rows };
    const withTune = { id: 't', name: 'Tune', bpm: 100, rows, melody: encodeGrid(tuneToMelody(PRESET_TUNES['Disco'])) };
    const broken = { id: 'b', name: 'Broken', bpm: 100, rows, melody: ['nope'] };
    const list = parseSaved(JSON.stringify([old, withTune, broken]));
    expect(list.map(b => b.id)).toEqual(['o', 't', 'b']);
    expect(list[0].melody).toBeUndefined();
    expect(decodeMelody(list[1].melody)).not.toBeNull();
    expect(list[2].melody).toBeUndefined();
  });
});
