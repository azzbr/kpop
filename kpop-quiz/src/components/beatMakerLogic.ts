// Pure rules for Beat Maker (beat_maker): instruments, presets, timing and the saved-beats list.
// No React or Web Audio here — see beatMakerLogic.test.ts.
import type { Rng } from '../games/engine/rng';

export type Instrument = 'kick' | 'snare' | 'hihat' | 'clap' | 'bass' | 'synth';
export const INSTRUMENTS: { id: Instrument; name: string; emoji: string; on: string }[] = [
  { id: 'kick', name: 'Kick', emoji: '🥁', on: 'bg-rose-500 border-rose-300' },
  { id: 'snare', name: 'Snare', emoji: '🪘', on: 'bg-orange-500 border-orange-300' },
  { id: 'hihat', name: 'Hi-Hat', emoji: '🎩', on: 'bg-yellow-400 border-yellow-200' },
  { id: 'clap', name: 'Clap', emoji: '👏', on: 'bg-green-500 border-green-300' },
  { id: 'bass', name: 'Bass', emoji: '🎸', on: 'bg-sky-500 border-sky-300' },
  { id: 'synth', name: 'Synth', emoji: '🎹', on: 'bg-fuchsia-500 border-fuchsia-300' },
];

export const STEPS = 16;
export const MIN_BPM = 60;
export const MAX_BPM = 200;
export const BPM_STEP = 5;
export const MAX_SAVED = 5;
export const SAVE_KEY = 'funquest-beats';

export type Grid = boolean[][];

const row = (s: string) => s.split('').map(c => c === '1');

export const PRESETS: Record<string, Grid> = {
  'Pop Beat': [
    row('1000100010001000'),
    row('0000100000001000'),
    row('1010101010101010'),
    row('0010001000100010'),
    row('1000001010000000'),
    row('0001000100010001'),
  ],
  'Hip-Hop': [
    row('1000000010000000'),
    row('0000100000001001'),
    row('1101110111011101'),
    row('0000100000001000'),
    row('1010001010100000'),
    row('0000000000000000'),
  ],
  'Disco': [
    row('1000100010001000'),
    row('0000100000001000'),
    row('0010001000100010'),
    row('0000000000000000'),
    row('1010101010101010'),
    row('1000000010000010'),
  ],
};

export const emptyGrid = (): Grid => INSTRUMENTS.map(() => Array<boolean>(STEPS).fill(false));
export const cloneGrid = (g: Grid): Grid => g.map(r => [...r]);

export function toggleCell(g: Grid, inst: number, step: number): Grid {
  return g.map((r, i) => (i === inst ? r.map((c, s) => (s === step ? !c : c)) : r));
}

/** A random beat that still sounds like a beat: kick on the beat, snare on 2 and 4. */
export function randomGrid(rng: Rng): Grid {
  return INSTRUMENTS.map((_, ti) => Array.from({ length: STEPS }, (_, si) => {
    if (ti === 0) return si % 4 === 0 && rng() > 0.25;
    if (ti === 1) return si % 8 === 4 && rng() > 0.15;
    if (ti === 2) return si % 2 === 0 ? rng() > 0.3 : rng() > 0.8;
    return rng() > 0.78;
  }));
}

export const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
/** Seconds per step (16th note). */
export const stepSeconds = (bpm: number) => 60 / clampBpm(bpm) / 4;

/** Synth plays a fixed tune: a C-major pentatonic note per step, so the same beat sounds the same every loop. */
const SYNTH_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33];
export const synthFreq = (step: number) => SYNTH_NOTES[step % SYNTH_NOTES.length];

// ── Saved beats ────────────────────────────────────────────────────────────────

export interface SavedBeat { id: string; name: string; bpm: number; rows: string[] }

const NAME_EMOJI = ['🚀', '🌈', '🐉', '🍕', '🦄', '⚡', '🐙', '🌋', '🎈', '🍩'];
const NAME_WORDS = ['Rocket', 'Rainbow', 'Dragon', 'Pizza', 'Unicorn', 'Thunder', 'Octopus', 'Volcano', 'Balloon', 'Donut'];

/** A fun name that isn't already used, e.g. "🐉 Dragon Beat". */
export function beatName(existing: string[], rng: Rng): string {
  const start = Math.floor(rng() * NAME_WORDS.length);
  for (let k = 0; k < NAME_WORDS.length; k++) {
    const i = (start + k) % NAME_WORDS.length;
    const name = `${NAME_EMOJI[i]} ${NAME_WORDS[i]} Beat`;
    if (!existing.includes(name)) return name;
  }
  return `🎵 Beat ${existing.length + 1}`;
}

export const encodeGrid = (g: Grid): string[] => g.map(r => r.map(c => (c ? '1' : '0')).join(''));

export function decodeGrid(rows: unknown): Grid | null {
  if (!Array.isArray(rows) || rows.length !== INSTRUMENTS.length) return null;
  const out: Grid = [];
  for (const r of rows) {
    if (typeof r !== 'string' || !/^[01]{16}$/.test(r)) return null;
    out.push(row(r));
  }
  return out;
}

/** Reads the saved list, dropping anything malformed. */
export function parseSaved(raw: string | null): SavedBeat[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter((b): b is SavedBeat =>
      !!b && typeof b === 'object' && typeof b.id === 'string' && typeof b.name === 'string'
      && typeof b.bpm === 'number' && decodeGrid(b.rows) !== null,
    ).slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

/** Adds a beat to the front of the list; returns null when the list is full. */
export function addBeat(list: SavedBeat[], beat: SavedBeat): SavedBeat[] | null {
  if (list.length >= MAX_SAVED) return null;
  return [beat, ...list];
}

export const removeBeat = (list: SavedBeat[], id: string) => list.filter(b => b.id !== id);
export const isEmpty = (g: Grid) => g.every(r => r.every(c => !c));
