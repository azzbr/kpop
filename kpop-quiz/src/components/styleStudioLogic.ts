// Style Studio rules (no React). A "runway round": dress up → Strut → three judges score the look.
// The score depends only on the look, so strutting the same outfit again can't fish for a better score.
// Rewards: only a look that has never been rewarded before, and at most MAX_REWARDED_PER_DAY a day.

export const MODELS = ['🧑', '👧', '👦', '🧑‍🚀', '🦸', '🧚', '🧙', '🧑‍🍳', '🤖'];
export const HATS = ['—', '👑', '🎀', '🎩', '👒', '🧢', '🎓', '⛑️'];
export const OUTFITS = ['👗', '👘', '🥻', '👚', '👕', '🎽', '🥋', '🦺', '🥼'];
export const SHOES = ['👠', '👟', '🥿', '👢', '🩴', '🥾', '🩰', '👞'];
export const ACCESSORIES = ['—', '✨', '💎', '🌹', '🎤', '⭐', '💖', '🎁', '🪄', '🌸', '🦋', '🎸'];
export const BACKDROPS = [
  { name: 'Sunset', grad: 'from-orange-300 via-pink-400 to-purple-500' },
  { name: 'Beach', grad: 'from-sky-300 via-cyan-300 to-yellow-200' },
  { name: 'Spotlight', grad: 'from-purple-900 via-fuchsia-700 to-pink-600' },
  { name: 'Garden', grad: 'from-green-300 via-emerald-300 to-pink-200' },
  { name: 'Galaxy', grad: 'from-indigo-900 via-purple-800 to-fuchsia-700' },
  { name: 'Snow', grad: 'from-sky-100 via-white to-indigo-200' },
];

export interface Look { model: string; hat: string; outfit: string; shoes: string; accessory: string; bg: number }

export const DEFAULT_LOOK: Look = { model: MODELS[0], hat: HATS[0], outfit: OUTFITS[0], shoes: SHOES[0], accessory: ACCESSORIES[0], bg: 0 };

export interface Vibe { id: string; name: string; emoji: string; check: (l: Look) => boolean }

/** Themed combos: matching one adds VIBE_BONUS to the runway score. */
export const VIBES: Vibe[] = [
  { id: 'royal', name: 'Royal Parade', emoji: '👑', check: l => l.hat === '👑' && (l.outfit === '👗' || l.outfit === '👘') },
  { id: 'rock', name: 'Rock Star', emoji: '🎸', check: l => (l.accessory === '🎸' || l.accessory === '🎤') && l.bg === 2 },
  { id: 'galaxy', name: 'Galaxy Hero', emoji: '🦸', check: l => (l.model === '🦸' || l.model === '🧑‍🚀') && l.bg === 4 },
  { id: 'beach', name: 'Beach Day', emoji: '🏖️', check: l => l.shoes === '🩴' && l.bg === 1 },
  { id: 'fairy', name: 'Sparkle Fairy', emoji: '🧚', check: l => l.model === '🧚' && (l.accessory === '✨' || l.accessory === '🪄') },
  { id: 'heart', name: 'Big Heart', emoji: '💖', check: l => l.accessory === '💖' && l.bg === 0 },
  { id: 'wizard', name: 'Wizard School', emoji: '🧙', check: l => l.model === '🧙' && l.hat === '🎓' },
  { id: 'snow', name: 'Snow Explorer', emoji: '❄️', check: l => l.bg === 5 && (l.shoes === '🥾' || l.shoes === '👢') },
];

export const VIBE_BONUS = 5;
export const MAX_REWARDED_PER_DAY = 3;
/** finishRound xpScale: a typical runway score (≈ 27–37) gives roughly 35–45 XP. */
export const STYLE_XP_SCALE = 0.8;

export const JUDGES = [
  { id: 'owl', emoji: '🦉', name: 'Professor Hoot', likes: 'colours that go together' },
  { id: 'cat', emoji: '🐱', name: 'Captain Whiskers', likes: 'bold ideas' },
  { id: 'robot', emoji: '🤖', name: 'Judge Beep', likes: 'the wow factor' },
];

export const lookKey = (l: Look) => [l.model, l.hat, l.outfit, l.shoes, l.accessory, l.bg].join('|');

export function vibeOf(l: Look): Vibe | null {
  return VIBES.find(v => v.check(l)) ?? null;
}

/** Small deterministic string hash (FNV-1a). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface RunwayResult { judges: number[]; complete: boolean; vibe: Vibe | null; score: number }

/** Each judge gives 6–10 stars (fixed for a look); +2 for a complete look (hat and accessory), +5 for a vibe. */
export function scoreLook(l: Look): RunwayResult {
  const key = lookKey(l);
  const judges = JUDGES.map(j => 6 + (hash(`${j.id}:${key}`) % 5));
  const complete = l.hat !== '—' && l.accessory !== '—';
  const vibe = vibeOf(l);
  const score = judges.reduce((a, b) => a + b, 0) + (complete ? 2 : 0) + (vibe ? VIBE_BONUS : 0);
  return { judges, complete, vibe, score };
}

export interface StrutLog { date: string; count: number; looks: string[] }

export const emptyLog = (date: string): StrutLog => ({ date, count: 0, looks: [] });

/** Whether strutting `l` today earns a reward, and why not. */
export function rewardCheck(log: StrutLog, l: Look, today: string): { ok: boolean; reason?: 'seen' | 'limit' } {
  if (log.looks.includes(lookKey(l))) return { ok: false, reason: 'seen' };
  const count = log.date === today ? log.count : 0;
  if (count >= MAX_REWARDED_PER_DAY) return { ok: false, reason: 'limit' };
  return { ok: true };
}

/** The log after a rewarded strut (keeps the last 300 looks). */
export function recordReward(log: StrutLog, l: Look, today: string): StrutLog {
  const count = log.date === today ? log.count : 0;
  return { date: today, count: count + 1, looks: [...log.looks, lookKey(l)].slice(-300) };
}

export function rewardsLeft(log: StrutLog, today: string): number {
  return Math.max(0, MAX_REWARDED_PER_DAY - (log.date === today ? log.count : 0));
}

export function parseLog(raw: unknown, today: string): StrutLog {
  if (!raw || typeof raw !== 'object') return emptyLog(today);
  const r = raw as Partial<StrutLog>;
  return {
    date: typeof r.date === 'string' ? r.date : today,
    count: typeof r.count === 'number' ? r.count : 0,
    looks: Array.isArray(r.looks) ? r.looks.filter((k): k is string => typeof k === 'string') : [],
  };
}

/** A saved look is valid only if every part is a known option (old saves may hold removed items). */
export function isValidLook(l: unknown): l is Look {
  if (!l || typeof l !== 'object') return false;
  const x = l as Look;
  return MODELS.includes(x.model) && HATS.includes(x.hat) && OUTFITS.includes(x.outfit) && SHOES.includes(x.shoes)
    && ACCESSORIES.includes(x.accessory) && Number.isInteger(x.bg) && x.bg >= 0 && x.bg < BACKDROPS.length;
}

/** Old saves may hold removed items: keep what still exists, swap the rest for the default. */
export function sanitizeLook(l: unknown): Look | null {
  if (!l || typeof l !== 'object') return null;
  const x = l as Partial<Look>;
  const pick = (list: string[], v: unknown) => (typeof v === 'string' && list.includes(v) ? v : list[0]);
  return {
    model: pick(MODELS, x.model), hat: pick(HATS, x.hat), outfit: pick(OUTFITS, x.outfit),
    shoes: pick(SHOES, x.shoes), accessory: pick(ACCESSORIES, x.accessory),
    bg: Number.isInteger(x.bg) && (x.bg as number) >= 0 && (x.bg as number) < BACKDROPS.length ? (x.bg as number) : 0,
  };
}
