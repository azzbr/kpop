// Moving progress to another place — from Safari to the Home Screen app (on iPhone and iPad they
// keep separate storage, so the app starts empty), or to a new tablet or phone. Everything the app
// keeps in localStorage (the store save plus per-game keys) goes into one "save code" that a
// grown-up copies or shares, then pastes on the other side. Nothing is uploaded anywhere.
// Pictures in the Doodle Pad gallery (IndexedDB) stay on the old device.

export const CODE_PREFIX = 'FUNQUEST-SAVE:';
export const STORE_KEY = 'funquest-save';
const FORMAT = 1;

export interface SaveBundle {
  f: number;
  /** When the code was made (ISO time). */
  at: string;
  keys: Record<string, string>;
}

export interface SaveSummary {
  name: string;
  xp: number;
  coins: number;
  badges: number;
  days: number;
  /** The store's SAVE_VERSION when it was saved. */
  version: number;
}

/** Test markers and other keys that belong to this browser tab, not to the player. */
const isSkipped = (key: string) => key.startsWith('__');

/** Every app key in this storage. */
export function collectKeys(storage: Storage): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null || isSkipped(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** The save code: gzip + base64 where the browser can compress ("z"), plain base64 JSON otherwise ("j"). */
export async function encodeSave(keys: Record<string, string>, now = new Date()): Promise<string> {
  const bundle: SaveBundle = { f: FORMAT, at: now.toISOString(), keys };
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  if (typeof CompressionStream === 'function') {
    return `${CODE_PREFIX}z${toBase64(await pipe(bytes, new CompressionStream('gzip')))}`;
  }
  return `${CODE_PREFIX}j${toBase64(bytes)}`;
}

export class SaveCodeError extends Error {}

/** Reads a pasted code. Spaces and line breaks (added by messaging apps) are ignored. */
export async function decodeSave(code: string): Promise<SaveBundle> {
  const clean = code.replace(/\s+/g, '');
  const at = clean.indexOf(CODE_PREFIX);
  if (at < 0) throw new SaveCodeError("That doesn't look like a Fun Quest save code.");
  const body = clean.slice(at + CODE_PREFIX.length);
  const kind = body[0];
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(body.slice(1));
    if (kind === 'z') {
      if (typeof DecompressionStream !== 'function') throw new SaveCodeError('This browser is too old to read the code. Update it and try again.');
      bytes = await pipe(bytes, new DecompressionStream('gzip'));
    } else if (kind !== 'j') {
      throw new SaveCodeError("That doesn't look like a Fun Quest save code.");
    }
  } catch (e) {
    if (e instanceof SaveCodeError) throw e;
    throw new SaveCodeError('Part of the code is missing. Copy the whole code and try again.');
  }
  let bundle: SaveBundle;
  try {
    bundle = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new SaveCodeError('Part of the code is missing. Copy the whole code and try again.');
  }
  const keys = bundle?.keys;
  if (!keys || typeof keys !== 'object' || Object.values(keys).some(v => typeof v !== 'string') || typeof keys[STORE_KEY] !== 'string') {
    throw new SaveCodeError('This code has no saved progress in it.');
  }
  if (bundle.f > FORMAT) throw new SaveCodeError('This code comes from a newer Fun Quest. Update the app and try again.');
  return bundle;
}

/** Name, XP, coins… of a save, for the "replace this progress?" check. Null when there is no save. */
export function summarize(keys: Record<string, string>): SaveSummary | null {
  const raw = keys[STORE_KEY];
  if (!raw) return null;
  try {
    const { state, version } = JSON.parse(raw) as { state?: Record<string, unknown>; version?: number };
    const s = state ?? {};
    const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
    return {
      name: typeof s.userName === 'string' && s.userName ? s.userName : 'Player',
      xp: Number(s.xp) || 0,
      coins: Number(s.userCurrency) || 0,
      badges: count(s.gameBadges) + count(s.earnedBadges),
      days: count(s.datesPlayed),
      version: Number(version) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Replaces this device's progress with the bundle's keys. If the browser runs out of space part way,
 * the old progress is put back and the error is thrown.
 */
export function applySave(storage: Storage, keys: Record<string, string>) {
  const before = collectKeys(storage);
  const clearOurs = () => { for (const k of Object.keys(collectKeys(storage))) storage.removeItem(k); };
  try {
    clearOurs();
    for (const [k, v] of Object.entries(keys)) if (!isSkipped(k)) storage.setItem(k, v);
  } catch (e) {
    clearOurs();
    for (const [k, v] of Object.entries(before)) storage.setItem(k, v);
    throw e;
  }
}
