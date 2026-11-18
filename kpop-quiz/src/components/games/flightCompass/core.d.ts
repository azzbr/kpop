// Types for core.js (Flight Compass rules and spherical maths), used by Fun Quest's TypeScript.
export interface Point { lat: number; lon: number }
export interface City { n: string; c: string; cc: string; t: number; la: number; lo: number }
export interface Leg { from: City; to: City }
export interface Route { style: 'chain' | 'random'; start: City; targets: City[]; legs: Leg[] }
export interface Grade { id: string; label: string; max: number }
export interface Aim {
  error: number; longWay: boolean; grade: Grade; hit: boolean; streak: number;
  base: number; multiplier: number; hintFactor: number; points: number;
}
export interface Hidden { countries: { a3: string; id: string }[] }
declare const Core: {
  EARTH_RADIUS_KM: number;
  norm360(a: number): number;
  angleDiff(a: number, b: number): number;
  bearing(a: Point, b: Point): number;
  centralAngle(a: Point, b: Point): number;
  distanceKm(a: Point, b: Point): number;
  destination(a: Point, brg: number, d: number): Point;
  greatCirclePath(a: Point, b: Point, longWay: boolean, n: number): Point[];
  rhumbBearing(a: Point, b: Point): number;
  rhumbPath(a: Point, b: Point, n: number): Point[];
  compassWord(brg: number): string;
  hashString(s: string): number;
  makeRng(seed: string): () => number;
  DIFFICULTY: Record<string, { label: string; maxTier: number; startTier?: number }>;
  MIDDLE_EAST: string[];
  MIN_HOP_KM: number;
  MAX_HOP_KM: number;
  cityPoint(c: City): Point;
  buildRoute(cities: City[], seed: string, difficulty: string, length: number, options?: object): Route;
  buildRandomRoute(cities: City[], seed: string, difficulty: string, length: number): Route;
  makeRoute(cities: City[], seed: string, difficulty: string, length: number, style: string, options?: object): Route;
  GRADES: Grade[];
  MISS: Grade;
  MAX_SCORING_ERROR: number;
  HINT_FACTOR: Record<string, number>;
  scoreAim(o: { heading: number; trueBearing: number; streakBefore: number; hint?: string | null }): Aim;
  ROUND_OPTIONS: number[];
  makeClassCode(difficulty: string, rounds: number, rng?: () => number, style?: string): string;
  parseClassCode(text: string): { difficulty: string; rounds: number; style: string; code: string } | null;
  withoutHidden(data: { cities?: City[]; places?: { cc: string }[] }, hidden: Hidden): { cities: City[]; places: { cc: string }[]; hiddenCountryIds: Set<string> };
};
export default Core;
