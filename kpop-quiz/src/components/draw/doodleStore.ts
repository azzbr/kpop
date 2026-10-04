// Saved doodles live in IndexedDB on this device only (images are too big for localStorage).
// The sticker board autosaves into the fixed id MURAL_ID; the gallery keeps up to MAX_DOODLES.

export interface SavedDoodle {
  id: string;
  created: number;
  updated: number;
  background: string;
  image: Blob;
  /** Small JPEG data URL for the gallery grid. */
  thumb: string;
}

export const DB_NAME = 'funquest-doodles';
const STORE = 'doodles';
export const MURAL_ID = 'mural';
export const MAX_DOODLES = 30;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function listDoodles(): Promise<SavedDoodle[]> {
  try {
    const all = await run<SavedDoodle[]>('readonly', s => s.getAll() as IDBRequest<SavedDoodle[]>);
    return all.filter(d => d.id !== MURAL_ID).sort((a, b) => b.updated - a.updated);
  } catch { return []; }
}

export async function getDoodle(id: string): Promise<SavedDoodle | null> {
  try { return (await run<SavedDoodle | undefined>('readonly', s => s.get(id) as IDBRequest<SavedDoodle | undefined>)) ?? null; }
  catch { return null; }
}

/** Saves (or replaces) a doodle, then trims the gallery to the newest MAX_DOODLES. */
export async function saveDoodle(d: SavedDoodle): Promise<boolean> {
  try {
    await run('readwrite', s => s.put(d));
    if (d.id !== MURAL_ID) {
      const all = await listDoodles();
      for (const old of all.slice(MAX_DOODLES)) await deleteDoodle(old.id);
    }
    return true;
  } catch { return false; }
}

export async function deleteDoodle(id: string): Promise<void> {
  try { await run('readwrite', s => s.delete(id)); } catch { /* nothing to delete */ }
}

/** Used by "Reset all progress". */
export function clearAllDoodles(): void {
  try { indexedDB.deleteDatabase(DB_NAME); } catch { /* not available */ }
}
