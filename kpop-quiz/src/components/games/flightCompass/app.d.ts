// Types for app.js: the Flight Compass screen controller, mounted by FlightCompass.tsx.
export interface FlightSummary {
  score: number; flown: number; hits: number; bestStreak: number;
  grid: string; shareText: string; mode: 'daily' | 'practice' | 'class'; isRecord: boolean;
}
export interface FlightOptions {
  onRunStart?: () => void;
  onSummary?: (info: FlightSummary) => void;
  sfxVolume?: number;
  vibrate?: boolean;
}
export interface FlightDebug {
  state(): { phase: string; index?: number; score?: number; lives?: number; streak?: number; mode?: string; over?: boolean; targets?: number };
  aim(deg: number): void;
  aimTrue(): number | null;
  lock(): Promise<void>;
  next(): void;
  setReduceMotion(on: boolean): void;
}
export default class App {
  constructor(rootEl: HTMLElement, options?: FlightOptions);
  run: { phase: string; over: boolean } | null;
  feedback: { setVolume(v: number): void; vibrateOn: boolean };
  showHome(): void;
  newFlight(): void;
  saveRun(): void;
  destroy(): void;
  debugApi(): FlightDebug;
}
