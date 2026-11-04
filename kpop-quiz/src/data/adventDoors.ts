// The 24 doors of the Winter Wonderland Advent calendar (src/events/advent.ts has the rules).
// Every door pays coins plus one surprise. Jokes are G-rated; facts were checked in November 2026.
// Challenges complete on any qualifying round of that game once the door is open (+CHALLENGE_COINS).
import { ADVENT_AVATAR_ID, ADVENT_STICKER_ID, ADVENT_TRAIL_ID, WINTER_STAR_TITLE_ID } from './winterLocker';

export type DoorSurprise =
  | { kind: 'item'; itemId: string; text: string }
  | { kind: 'joke'; q: string; a: string }
  | { kind: 'fact'; text: string }
  /** `gameId` + `target` in that game's finishRound units; `screen` is where ▶ Play now goes. */
  | { kind: 'challenge'; gameId: string; screen: string; target: number; text: string };

export interface AdventDoor { day: number; emoji: string; coins: number; surprise: DoorSurprise }

export const DOOR_COINS = 10;
export const GOLDEN_DOOR_COINS = 50;
export const CHALLENGE_COINS = 20;

const door = (day: number, emoji: string, surprise: DoorSurprise): AdventDoor =>
  ({ day, emoji, coins: day === 24 ? GOLDEN_DOOR_COINS : DOOR_COINS, surprise });

export const ADVENT_DOORS: AdventDoor[] = [
  door(1, '❄️', { kind: 'joke', q: 'What do snowmen eat for breakfast?', a: 'Snowflakes! ❄️' }),
  door(2, '🐧', { kind: 'fact', text: 'Emperor penguins huddle together in big groups to stay warm in the icy Antarctic wind. They take turns in the cosy middle!' }),
  door(3, '🏗️', { kind: 'challenge', gameId: 'stack_lab', screen: 'stack_lab', target: 50, text: 'Build a tower 50 cm tall in Stack Lab!' }),
  door(4, '⛄', { kind: 'joke', q: 'What do you call a snowman in summer?', a: 'A puddle! 💧' }),
  door(5, '🔍', { kind: 'fact', text: 'Every snowflake grows its own way as it tumbles through the cloud, so it’s very unlikely that two big snowflakes are exactly the same.' }),
  door(6, '☃️', { kind: 'item', itemId: ADVENT_AVATAR_ID, text: 'A new avatar for your Locker: the Snow Buddy!' }),
  door(7, '🤖', { kind: 'challenge', gameId: 'robo_quest', screen: 'robo_quest', target: 100, text: 'Solve any level in Robo Quest!' }),
  door(8, '🛣️', { kind: 'joke', q: 'What did the snow say to the road?', a: 'Don’t worry — I’ve got you covered! ❄️' }),
  door(9, '🧊', { kind: 'fact', text: 'Ice is lighter than water, so it floats. That’s why ponds freeze from the top down and fish can keep swimming underneath.' }),
  door(10, '♟️', { kind: 'challenge', gameId: 'chess_puzzles', screen: 'chess_academy', target: 300, text: 'Score 300 in a chess Puzzle Streak!' }),
  door(11, '🐻‍❄️', { kind: 'fact', text: 'A polar bear’s fur looks white, but the skin underneath is black — great for soaking up warmth from the sun.' }),
  door(12, '🧣', { kind: 'item', itemId: ADVENT_STICKER_ID, text: 'A cosy scarf sticker for your Doodle Pad and Sticker Board!' }),
  door(13, '🧺', { kind: 'challenge', gameId: 'snow_catch', screen: 'snow_catch', target: 20, text: 'Catch 20 snowflake points in Snow Catch!' }),
  door(14, '🍪', { kind: 'joke', q: 'Why did the gingerbread man go to the doctor?', a: 'He was feeling crummy! 🍪' }),
  door(15, '🌌', { kind: 'fact', text: 'The northern lights glow when tiny bits from the Sun hit the air high above the Earth. They’re easiest to see on dark winter nights far in the north.' }),
  door(16, '🔢', { kind: 'challenge', gameId: 'game_2048', screen: 'game_2048', target: 1000, text: 'Score 1,000 in 2048!' }),
  door(17, '🐻', { kind: 'fact', text: 'Some bears spend the winter asleep in a snug den. They can go for months without eating!' }),
  door(18, '🌨️', { kind: 'item', itemId: ADVENT_TRAIL_ID, text: 'A Snow Cloud trail for Paper Clash!' }),
  door(19, '📏', { kind: 'challenge', gameId: 'stack_lab', screen: 'stack_lab', target: 100, text: 'Build a whole metre (100 cm) in Stack Lab!' }),
  door(20, '🐕', { kind: 'joke', q: 'Why did the snowman call his dog Frost?', a: 'Because Frost bites! 🐶' }),
  door(21, '🌅', { kind: 'fact', text: 'Around 21 December is the shortest day of the year in the northern half of the world. After it, the days slowly get longer again!' }),
  door(22, '⭐', { kind: 'challenge', gameId: 'robo_quest', screen: 'robo_quest', target: 300, text: 'Get ⭐⭐⭐ on a Robo Quest level!' }),
  door(23, '🤔', { kind: 'joke', q: 'What falls all winter but never gets hurt?', a: 'Snow! 🌨️' }),
  door(24, '🌟', { kind: 'item', itemId: WINTER_STAR_TITLE_ID, text: 'The golden door! You are now a Winter Star — a title for your Player Card. 🌟' }),
];

/** The calendar's door layout (like a real Advent calendar, the numbers are mixed up). */
export const DOOR_ORDER: number[] = [
  7, 19, 3, 14, 22, 10,
  1, 16, 11, 24, 5, 20,
  13, 8, 21, 2, 17, 9,
  23, 4, 12, 18, 6, 15,
];
