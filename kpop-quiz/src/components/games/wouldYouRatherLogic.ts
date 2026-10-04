// Would You Rather rules. Pure — no React.
import type { WyrQuestion } from '../../data/wouldYouRather';

export type Pick = 'a' | 'b';
export const ROUND_SIZE = 10;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const MAX_NAME = 10;

/** Did this pick go with the crowd? A 50/50 split counts as agreeing either way. */
export function withMajority(q: WyrQuestion, pick: Pick): boolean {
  if (q.aPct === 50) return true;
  return (q.aPct > 50) === (pick === 'a');
}

export const pctFor = (q: WyrQuestion, pick: Pick) => (pick === 'a' ? q.aPct : 100 - q.aPct);

export interface PartySummary {
  /** Players who agreed with the crowd most often (ties share the title). */
  crowd: string[];
  /** Players who went their own way most often. */
  unique: string[];
  agree: Record<string, number>;
}

/** picks[question][player] */
export function partySummary(players: string[], questions: WyrQuestion[], picks: Pick[][]): PartySummary {
  const agree: Record<string, number> = {};
  players.forEach((p, i) => {
    agree[p] = picks.reduce((n, row, q) => n + (row[i] && withMajority(questions[q], row[i]) ? 1 : 0), 0);
  });
  const vals = players.map(p => agree[p]);
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  return {
    crowd: players.filter(p => agree[p] === hi),
    unique: hi === lo ? [] : players.filter(p => agree[p] === lo),
    agree,
  };
}

/** Clean up a typed name: letters/spaces only, trimmed, capitalised, max length. */
export function cleanName(raw: string): string {
  const s = raw.replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return s.toLowerCase().replace(/(^|\s)[a-z]/g, m => m.toUpperCase());
}
