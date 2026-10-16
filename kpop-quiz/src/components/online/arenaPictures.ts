// Finished drawings in Friends Arena games (Picture Telephone, Doodle Decoy, Monster Mash).
//
// A picture is one JPEG data URL (480×360, ~20–60 KB) and always travels ALONE in its own
// `<prefix>_pic { id, img }` message — never inside the game view that is re-broadcast after
// every change. Every device (host included) keeps the pictures it has seen in a local cache
// keyed by id; the game view only names ids. A device that is missing a picture the view
// needs (it loaded late, or a message got lost) asks with `<prefix>_need { ids }`: the host
// answers from its cache, and when the host itself is missing one, the artist's device does.
import { useEffect, useRef, useState } from 'react';
import type { GameMsg, RoomApi } from '../../online/useRoom';
import { saveDoodle } from '../draw/doodleStore';

export const PIC_W = 480;
export const PIC_H = 360;
/** Longest data URL we send (~110 KB of JPEG). Broadcast messages must stay well under ~250 KB. */
const MAX_LEN = 150_000;
const ASK_AGAIN_MS = 2500;
const ANSWER_GAP_MS = 1500;
const PER_ASK = 3;

/** The finished drawing as a JPEG data URL, squeezed until it fits in one message. */
export function snapPicture(h: { getImage: (w?: number, h?: number, quality?: number) => string } | null | undefined): string {
  if (!h) return '';
  for (const q of [0.6, 0.45, 0.3]) {
    const img = h.getImage(PIC_W, PIC_H, q);
    if (!img || img.length <= MAX_LEN) return img;
  }
  const small = h.getImage(320, 240, 0.35);
  return small.length <= MAX_LEN ? small : '';
}

export const isPicture = (s: unknown): s is string =>
  typeof s === 'string' && s.startsWith('data:image/jpeg;base64,') && s.length <= MAX_LEN + 1000;

export interface Pictures {
  /** The cached picture, if this device has it. */
  get: (id: string) => string | undefined;
  /** Send this device's drawing (also cached here). */
  send: (id: string, img: string) => void;
}

/**
 * Picture cache + sync for one game. `wanted` = the ids this device needs right now (missing
 * ones are asked for, a few at a time, until they arrive).
 */
export function usePictures(room: RoomApi, prefix: string, wanted: string[]): Pictures {
  const cache = useRef(new Map<string, string>());
  const mine = useRef(new Set<string>());
  const asked = useRef(new Map<string, number>());
  const answered = useRef(new Map<string, number>());
  const [, setVer] = useState(0);
  const roomRef = useRef(room);
  roomRef.current = room;
  const wantedRef = useRef(wanted);
  wantedRef.current = wanted;
  const { onMessage } = room;

  useEffect(() => {
    const picT = `${prefix}_pic`;
    const needT = `${prefix}_need`;
    return onMessage((m: GameMsg) => {
      if (m.t === picT) {
        if (typeof m.id !== 'string' || !isPicture(m.img) || cache.current.has(m.id)) return;
        cache.current.set(m.id, m.img);
        setVer(v => v + 1);
      } else if (m.t === needT && Array.isArray(m.ids) && m.from && m.from !== roomRef.current.myId) {
        const r = roomRef.current;
        const fromHost = r.players.find(p => p.id === m.from)?.isHost ?? false;
        const now = Date.now();
        for (const id of m.ids.slice(0, PER_ASK)) {
          if (typeof id !== 'string') continue;
          const img = cache.current.get(id);
          // The host answers everyone; an artist answers only the host (when the host lost it).
          if (!img || !(r.isHost || (fromHost && mine.current.has(id)))) continue;
          if (now - (answered.current.get(id) ?? 0) < ANSWER_GAP_MS) continue;
          answered.current.set(id, now);
          r.send({ t: picT, id, img });
        }
      }
    });
  }, [onMessage, prefix]);

  const key = wanted.join('|');
  useEffect(() => {
    if (!key) return;
    const check = () => {
      const now = Date.now();
      const missing = wantedRef.current.filter(id => id && !cache.current.has(id) && now - (asked.current.get(id) ?? 0) > ASK_AGAIN_MS);
      if (!missing.length) return;
      const ids = missing.slice(0, PER_ASK);
      ids.forEach(id => asked.current.set(id, now));
      roomRef.current.send({ t: `${prefix}_need`, ids });
    };
    const first = window.setTimeout(check, 700);
    const iv = window.setInterval(check, 2000);
    return () => { window.clearTimeout(first); window.clearInterval(iv); };
  }, [key, prefix]);

  return {
    get: (id: string) => cache.current.get(id),
    send: (id: string, img: string) => {
      if (!img) return;
      cache.current.set(id, img);
      mine.current.add(id);
      setVer(v => v + 1);
      roomRef.current.send({ t: `${prefix}_pic`, id, img });
    },
  };
}

// ---- Saving into the solo Doodle Pad gallery ----

/** The Doodle Pad board size: saved pictures open on it, so we compose at the same 4:3 shape. */
export const SHEET_W = 1200;
export const SHEET_H = 900;
export const SHEET_BG = '#fdf6e3';

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function newSheet(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas');
  canvas.width = SHEET_W;
  canvas.height = SHEET_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = SHEET_BG;
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);
  return { canvas, ctx };
}

/** Writes `text` centred in a box, shrinking the font and wrapping to fit. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, max = 44, color = '#3b0764') {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let size = max; size >= 14; size -= 2) {
    ctx.font = `bold ${size}px "Fredoka One", "Nunito", sans-serif`;
    const lines = wrap(ctx, text, w);
    if (lines.length * size * 1.2 <= h) {
      const top = y + h / 2 - ((lines.length - 1) * size * 1.2) / 2;
      lines.forEach((l, i) => ctx.fillText(l, x + w / 2, top + i * size * 1.2));
      return;
    }
  }
  ctx.fillText(text.slice(0, 40), x + w / 2, y + h / 2);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > w && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Saves a composed 1200×900 sheet into the Doodle Pad gallery (IndexedDB, this device only). */
export async function saveSheet(canvas: HTMLCanvasElement): Promise<boolean> {
  const image = await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
  if (!image) return false;
  const t = document.createElement('canvas');
  t.width = 240;
  t.height = 180;
  t.getContext('2d')?.drawImage(canvas, 0, 0, 240, 180);
  const now = Date.now();
  return saveDoodle({
    id: `d${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    created: now, updated: now, background: SHEET_BG, image, thumb: t.toDataURL('image/jpeg', 0.7),
  });
}
