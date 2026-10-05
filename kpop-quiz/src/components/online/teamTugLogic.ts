// Team Tug-of-War + Rocket race rules (pure).
import { rankByScore } from '../../online/helloGate';

export type TugMode = 'tug' | 'rocket';
export type Team = 0 | 1;

export const WIN_SCORE = 2; // tug: best of 3
export const PULL = 2.2; // % per tap, divided by team size
export const LEFT_GOAL = 8;
export const RIGHT_GOAL = 92;
export const ROCKET_GOAL = 150; // rocket: taps to reach the moon
/** Nobody taps 20 times in 250 ms; anything more is a stuck key. */
export const MAX_TAPS_PER_MSG = 20;

export const modeOf = (config?: Record<string, string>): TugMode => (config?.mode === 'rocket' ? 'rocket' : 'tug');

/** Alternating teams in join order: 0, 1, 0, 1… */
export function assignTeams(ids: string[]): Record<string, Team> {
  const map: Record<string, Team> = {};
  ids.forEach((id, i) => (map[id] = (i % 2) as Team));
  return map;
}

export function teamSizes(teams: Record<string, Team>): [number, number] {
  const v = Object.values(teams);
  return [Math.max(1, v.filter(t => t === 0).length), Math.max(1, v.filter(t => t === 1).length)];
}

/** Team 0 pulls left (down), team 1 right (up); a big team doesn't win just by being big. */
export function applyPull(pos: number, taps: [number, number], sizes: [number, number]): number {
  const p = pos - (taps[0] * PULL) / sizes[0] + (taps[1] * PULL) / sizes[1];
  return Math.max(0, Math.min(100, p));
}

export const goalReached = (pos: number): Team | null => (pos <= LEFT_GOAL ? 0 : pos >= RIGHT_GOAL ? 1 : null);

export const clampTaps = (n: unknown) => Math.max(0, Math.min(MAX_TAPS_PER_MSG, Math.floor(Number(n) || 0)));

/** Tug: the winning team shares first place, the other team second. */
export function tugRanking(teams: Record<string, Team>, winner: Team): string[][] {
  const ids = Object.keys(teams);
  const win = ids.filter(id => teams[id] === winner);
  const lose = ids.filter(id => teams[id] !== winner);
  return lose.length ? [win, lose] : [win];
}

/** Rocket: adds taps; returns the new progress and whether this rocket just reached the moon. */
export function addRocketTaps(progress: Record<string, number>, id: string, n: number) {
  if (progress[id] === undefined) return { progress, landed: false };
  const v = Math.min(ROCKET_GOAL, progress[id] + clampTaps(n));
  return { progress: { ...progress, [id]: v }, landed: v >= ROCKET_GOAL && progress[id] < ROCKET_GOAL };
}

/** Rocket: the first to the moon wins; everyone else by how far they got (equal = shared place). */
export function rocketRanking(progress: Record<string, number>, winnerId: string): (string | string[])[] {
  const rest = Object.keys(progress).filter(id => id !== winnerId);
  return [winnerId, ...rankByScore(progress, rest)];
}
