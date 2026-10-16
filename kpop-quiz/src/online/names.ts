// Display names other players see (Friends Arena rooms and clubs): first names only, short,
// and kid-safe. Anything that fails the checks is not shown.
import { isKidSafe } from './rudeWords';

export const NAME_MAX = 12;

/** A tidy, kid-safe display name, or '' if it can't be used. */
export function safeName(raw: string): string {
  const n = raw.replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  if (!n || !/\p{L}/u.test(n) || !isKidSafe(n)) return '';
  return n;
}

/** The name to show for a player: their safe name, or a friendly stand-in. */
export const shownName = (raw: string, fallback = 'Player') => safeName(raw) || fallback;
