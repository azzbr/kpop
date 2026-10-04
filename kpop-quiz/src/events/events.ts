// Seasonal events (Halloween, Winter…): definitions plus the pure rules for the hunt.
// No React here — PumpkinHunt.tsx / EventBanner.tsx use these, events.test.ts tests them.
import type { LockerItem } from '../data/lockerItems';
import { HALLOWEEN_LOCKER_ITEMS, HALLOWEEN_REWARD_ONLY_IDS, PUMPKIN_HUNTER_TITLE_ID } from '../data/halloweenLocker';

export interface EventReward {
  /** Items found needed. */
  at: number;
  coins: number;
  label: string;
  /** Optional Locker item id given for free when this reward is claimed. */
  unlocks?: string;
}

export interface SeasonEvent {
  /** Save key in store.events, e.g. 'halloween-2026'. Never rename once live. */
  key: string;
  /** Short id used by `?event=` and `data-event` (e.g. 'halloween'). */
  id: string;
  name: string;
  emoji: string;
  /** Local dates, inclusive. */
  start: string;
  end: string;
  itemEmoji: string;
  itemName: string;
  /** Plural, for UI text ("pumpkins"). */
  itemPlural: string;
  totalItems: number;
  rewards: EventReward[];
  lockerItemIds: string[];
  /** Quiz bank id in QUIZ_BANKS (Quiz Arena source `bank:<id>`). */
  quizBankId?: string;
  /** Button label for that quiz, e.g. 'Halloween Quiz'. */
  quizTitle?: string;
  /** Value written to <html data-event="…"> while active (see halloween.css). */
  themeClass?: string;
}

export const SEASON_EVENTS: SeasonEvent[] = [
  {
    key: 'halloween-2026',
    id: 'halloween',
    name: 'Halloween Pumpkin Hunt',
    emoji: '🎃',
    start: '2026-10-01',
    end: '2026-11-02',
    itemEmoji: '🎃',
    itemName: 'pumpkin',
    itemPlural: 'pumpkins',
    totalItems: 31,
    rewards: [
      { at: 5, coins: 25, label: '25 coins' },
      { at: 10, coins: 50, label: '50 coins' },
      { at: 20, coins: 100, label: '100 coins' },
      { at: 31, coins: 150, label: '150 coins + “Pumpkin Hunter” title', unlocks: PUMPKIN_HUNTER_TITLE_ID },
    ],
    lockerItemIds: HALLOWEEN_LOCKER_ITEMS.map(i => i.id),
    quizBankId: 'halloween',
    quizTitle: 'Halloween Quiz',
    themeClass: 'halloween',
  },
  {
    key: 'winter-2026',
    id: 'winter',
    name: 'Winter Wonderland',
    emoji: '❄️',
    start: '2026-12-01',
    end: '2027-01-06',
    itemEmoji: '❄️',
    itemName: 'snowflake',
    itemPlural: 'snowflakes',
    totalItems: 25,
    rewards: [
      { at: 5, coins: 25, label: '25 coins' },
      { at: 15, coins: 75, label: '75 coins' },
      { at: 25, coins: 150, label: '150 coins' },
    ],
    lockerItemIds: [],
    themeClass: 'winter',
  },
];

/** Reads `?event=halloween` (or the full key) — makes that event active whatever the date. */
export function eventOverride(search?: string): string | null {
  let s = search;
  if (s === undefined) {
    try { s = typeof window !== 'undefined' ? window.location.search : ''; } catch { s = ''; }
  }
  const v = new URLSearchParams(s).get('event');
  return v ? v.trim().toLowerCase() : null;
}

/**
 * The event running on local date `dateKey` (YYYY-MM-DD), or null.
 * `search` defaults to the page's query string; pass '' in tests to ignore it.
 */
export function activeEvent(dateKey: string, search?: string, events: SeasonEvent[] = SEASON_EVENTS): SeasonEvent | null {
  const forced = eventOverride(search);
  if (forced) {
    const ev = events.find(e => e.id === forced || e.key === forced);
    if (ev) return ev;
  }
  // YYYY-MM-DD strings compare correctly as text, including across the new year.
  return events.find(e => dateKey >= e.start && dateKey <= e.end) ?? null;
}

// ─── The hunt ────────────────────────────────────────────────────────────────

/** Screens where an item may hide: menus and collections only — never a real-time game. */
export const HUNT_SCREENS: readonly string[] = [
  'welcome', 'game_mode', 'secret_menu', 'streak_calendar', 'achievement_showcase',
  'locker', 'idol_profile', 'style_studio', 'agent_hq', 'team_maker',
];
/** Screens that get an item each day (~1 in 3 of HUNT_SCREENS). */
export const SPOTS_PER_DAY = Math.ceil(HUNT_SCREENS.length / 3);
/** New items she can find per day. */
export const DAILY_CAP = 3;

export const REWARD_PREFIX = 'reward-';
export const rewardId = (at: number) => `${REWARD_PREFIX}${at}`;
export const itemId = (screen: string, dateKey: string) => `${screen}-${dateKey}`;

/** FNV-1a plus a murmur3 finaliser — small, stable, well-mixed string hash. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Items found (claimed rewards are also stored in the list, so leave those out). */
export const foundItems = (collected: string[]) => collected.filter(id => !id.startsWith(REWARD_PREFIX));
export const foundCount = (collected: string[]) => foundItems(collected).length;
export const foundOn = (collected: string[], dateKey: string) =>
  foundItems(collected).filter(id => id.endsWith(`-${dateKey}`)).length;

/** The screens hiding an item on this date (same for everyone, every visit). */
export function huntScreensFor(eventKey: string, dateKey: string): string[] {
  return [...HUNT_SCREENS]
    .sort((a, b) => hash(`${eventKey}|${a}|${dateKey}`) - hash(`${eventKey}|${b}|${dateKey}`))
    .slice(0, SPOTS_PER_DAY);
}

/**
 * Where to draw the item: on the left edge (below the Back-button row) or along the bottom-left,
 * away from the Music button (right middle) and from screen headers.
 */
export interface HuntSpot { anchor: 'left' | 'bottom'; /** 0–100 along that edge */ pct: number }

export function spotFor(eventKey: string, screen: string, dateKey: string): HuntSpot {
  const h = hash(`${eventKey}|${screen}|${dateKey}|spot`);
  return h % 2 === 0
    ? { anchor: 'left', pct: 30 + (h >>> 1) % 41 } // 30–70 % down the left edge
    : { anchor: 'bottom', pct: 2 + (h >>> 1) % 29 }; // 2–30 % along the bottom
}

export interface HuntItem { id: string; spot: HuntSpot }

/** The item to show on `screen` today, or null (not a hunt screen today, already found, daily cap, all found). */
export function huntItemFor(event: SeasonEvent, screen: string, dateKey: string, collected: string[]): HuntItem | null {
  if (!HUNT_SCREENS.includes(screen)) return null;
  if (!huntScreensFor(event.key, dateKey).includes(screen)) return null;
  const id = itemId(screen, dateKey);
  if (collected.includes(id)) return null;
  if (foundOn(collected, dateKey) >= DAILY_CAP) return null;
  if (foundCount(collected) >= event.totalItems) return null;
  return { id, spot: spotFor(event.key, screen, dateKey) };
}

/** The next reward still to reach, or null when all are reached. */
export function nextReward(event: SeasonEvent, collected: string[]): EventReward | null {
  const n = foundCount(collected);
  return event.rewards.find(r => n < r.at) ?? null;
}

/** Rewards reached but not yet claimed. */
export function pendingRewards(event: SeasonEvent, collected: string[]): EventReward[] {
  const n = foundCount(collected);
  return event.rewards.filter(r => n >= r.at && !collected.includes(rewardId(r.at)));
}

export interface RewardDeps {
  /** Current list for this event (store.events[event.key] ?? []). */
  collected: () => string[];
  /** store.collectEventItem — returns false if already there. */
  collect: (eventKey: string, id: string) => boolean;
  addCoins: (coins: number) => void;
  unlock: (lockerItemId: string) => void;
}

/** Grants every reached reward exactly once (the reward id in the list is the receipt). */
export function claimRewards(event: SeasonEvent, deps: RewardDeps): EventReward[] {
  const granted: EventReward[] = [];
  for (const r of pendingRewards(event, deps.collected())) {
    if (!deps.collect(event.key, rewardId(r.at))) continue;
    deps.addCoins(r.coins);
    if (r.unlocks) deps.unlock(r.unlocks);
    granted.push(r);
  }
  return granted;
}

// ─── Locker ──────────────────────────────────────────────────────────────────

const ALL_EVENT_ITEMS: LockerItem[] = [...HALLOWEEN_LOCKER_ITEMS];
const REWARD_ONLY: ReadonlySet<string> = new Set([...HALLOWEEN_REWARD_ONLY_IDS]);

/** Limited Locker items to show: those of the active event, plus any she already owns. */
export function eventLockerItems(dateKey: string, inventory: string[], search?: string): LockerItem[] {
  const ev = activeEvent(dateKey, search);
  const live = new Set(ev?.lockerItemIds ?? []);
  return ALL_EVENT_ITEMS.filter(i => live.has(i.id) || inventory.includes(i.id));
}

/** True for items that can only be earned in an event (no Buy button). */
export const isRewardOnly = (id: string) => REWARD_ONLY.has(id);
