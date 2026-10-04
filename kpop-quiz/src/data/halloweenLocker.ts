// Limited Halloween 2026 Locker items. Ids are stored in store.inventory, so never rename one.
// They show in the Locker while the Halloween event is on (or forever once owned) — see
// `eventLockerItems()` in src/events/events.ts.
import type { LockerItem } from './lockerItems';

/** Can't be bought — it's the prize for finding all 31 pumpkins. The price is only a safety net. */
export const PUMPKIN_HUNTER_TITLE_ID = 'hw26_ti_hunter';

export const HALLOWEEN_LOCKER_ITEMS: LockerItem[] = [
  // Avatars
  { id: 'hw26_av_pumpkin', kind: 'avatar', name: 'Jack-o’-Lantern', value: '🎃', price: 50, emoji: '🎃' },
  { id: 'hw26_av_ghost', kind: 'avatar', name: 'Friendly Ghost', value: '👻', price: 60, emoji: '👻' },
  { id: 'hw26_av_bat', kind: 'avatar', name: 'Night Bat', value: '🦇', price: 60, emoji: '🦇' },
  { id: 'hw26_av_witch', kind: 'avatar', name: 'Good Witch', value: '🧙‍♀️', price: 80, emoji: '🧙‍♀️' },
  // Colours
  { id: 'hw26_col_pumpkin', kind: 'color', name: 'Pumpkin Orange', value: '#ff7518', price: 40, emoji: '🟠' },
  { id: 'hw26_col_midnight', kind: 'color', name: 'Midnight Purple', value: '#6d28d9', price: 40, emoji: '🟣' },
  // Trails
  { id: 'hw26_tr_candy', kind: 'trail', name: 'Candy Trail', value: '🍬', price: 70, emoji: '🍬' },
  { id: 'hw26_tr_leaves', kind: 'trail', name: 'Autumn Leaves', value: '🍂', price: 70, emoji: '🍂' },
  // Title — event reward only
  { id: PUMPKIN_HUNTER_TITLE_ID, kind: 'title', name: 'Pumpkin Hunter', value: 'Pumpkin Hunter', price: 9999, emoji: '🎃' },
];

/** Locker items that can only be earned (show "Find all 31 🎃" instead of a Buy button). */
export const HALLOWEEN_REWARD_ONLY_IDS: ReadonlySet<string> = new Set([PUMPKIN_HUNTER_TITLE_ID]);
