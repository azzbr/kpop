// Limited Winter Wonderland 2026 Locker items. Ids are stored in store.inventory, so never rename one.
// They show in the Locker while the winter event is on (or forever once owned) — see
// `eventLockerItems()` in src/events/events.ts. Some can't be bought: they come from the snowflake
// hunt or from a door of the Advent calendar (src/events/advent.ts, data/adventDoors.ts).
import type { LockerItem } from './lockerItems';

/** The prize for finding all 25 snowflakes. */
export const SNOWFLAKE_TITLE_ID = 'wi26_ti_catcher';
/** Advent door gifts. */
export const ADVENT_AVATAR_ID = 'wi26_av_buddy';
export const ADVENT_STICKER_ID = 'wi26_st_scarf';
export const ADVENT_TRAIL_ID = 'wi26_tr_cloud';
export const WINTER_STAR_TITLE_ID = 'wi26_ti_star';

export const WINTER_LOCKER_ITEMS: LockerItem[] = [
  // Avatars
  { id: 'wi26_av_snowpal', kind: 'avatar', name: 'Snow Pal', value: '⛄', price: 60, emoji: '⛄' },
  { id: 'wi26_av_polar', kind: 'avatar', name: 'Polar Bear', value: '🐻‍❄️', price: 70, emoji: '🐻‍❄️' },
  { id: 'wi26_av_seal', kind: 'avatar', name: 'Seal Pup', value: '🦭', price: 60, emoji: '🦭' },
  { id: 'wi26_av_reindeer', kind: 'avatar', name: 'Reindeer', value: '🦌', price: 80, emoji: '🦌' },
  // Colours
  { id: 'wi26_col_frost', kind: 'color', name: 'Frost Blue', value: '#7dd3fc', price: 40, emoji: '🧊' },
  { id: 'wi26_col_holly', kind: 'color', name: 'Holly Red', value: '#dc2626', price: 40, emoji: '🎀' },
  // Trails
  { id: 'wi26_tr_snow', kind: 'trail', name: 'Snowflake Trail', value: '❄️', price: 70, emoji: '❄️' },
  { id: 'wi26_tr_skate', kind: 'trail', name: 'Ice Skates', value: '⛸️', price: 70, emoji: '⛸️' },
  // Earned only — the prices are a safety net, there is no Buy button.
  { id: ADVENT_AVATAR_ID, kind: 'avatar', name: 'Snow Buddy', value: '☃️', price: 9999, emoji: '☃️' },
  { id: ADVENT_STICKER_ID, kind: 'sticker', name: 'Cosy Scarf Sticker', value: '🧣', price: 9999, emoji: '🧣' },
  { id: ADVENT_TRAIL_ID, kind: 'trail', name: 'Snow Cloud Trail', value: '🌨️', price: 9999, emoji: '🌨️' },
  { id: SNOWFLAKE_TITLE_ID, kind: 'title', name: 'Snowflake Catcher', value: 'Snowflake Catcher', price: 9999, emoji: '❄️' },
  { id: WINTER_STAR_TITLE_ID, kind: 'title', name: 'Winter Star', value: 'Winter Star', price: 9999, emoji: '🌟' },
];

/** How each earned-only item is won: [short label for the Locker button, longer sentence]. */
export const WINTER_REWARD_ONLY: Record<string, [string, string]> = {
  [SNOWFLAKE_TITLE_ID]: ['❄️ Find all 25', 'Find all 25 hidden snowflakes ❄️ to earn this one!'],
  [ADVENT_AVATAR_ID]: ['🎄 Advent door 6', 'Open door 6 of the Advent calendar 🎄 to get this one!'],
  [ADVENT_STICKER_ID]: ['🎄 Advent door 12', 'Open door 12 of the Advent calendar 🎄 to get this one!'],
  [ADVENT_TRAIL_ID]: ['🎄 Advent door 18', 'Open door 18 of the Advent calendar 🎄 to get this one!'],
  [WINTER_STAR_TITLE_ID]: ['🎄 Advent door 24', 'Open the golden door 24 of the Advent calendar 🌟 to get this one!'],
};
