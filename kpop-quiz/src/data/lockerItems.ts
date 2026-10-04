// Everything coins can buy in the Locker. Items with price 0 are free for everyone.
// Ids are stored in store.inventory, so never rename an existing id.

export type LockerKind = 'avatar' | 'color' | 'trail' | 'title' | 'sticker';

export interface LockerItem {
  id: string;
  kind: LockerKind;
  name: string;
  /** avatar: the emoji; color: hex; trail: particle emoji ('' = none); title: the text; sticker: emoji */
  value: string;
  price: number;
  emoji: string;
}

const av = (id: string, value: string, name: string, price: number): LockerItem => ({ id: `av_${id}`, kind: 'avatar', name, value, price, emoji: value });
const col = (id: string, value: string, name: string, price: number, emoji: string): LockerItem => ({ id: `col_${id}`, kind: 'color', name, value, price, emoji });
const tr = (id: string, value: string, name: string, price: number): LockerItem => ({ id: `tr_${id}`, kind: 'trail', name, value, price, emoji: value || '🚫' });
const ti = (id: string, value: string, price: number, emoji: string): LockerItem => ({ id: `ti_${id}`, kind: 'title', name: value, value, price, emoji });

export const LOCKER_ITEMS: LockerItem[] = [
  // Avatars
  av('cool', '😎', 'Cool Shades', 0), av('robot', '🤖', 'Robot', 0), av('alien', '👽', 'Alien', 0),
  av('tiger', '🐯', 'Tiger', 0), av('octopus', '🐙', 'Octopus', 0), av('dino', '🦖', 'T-Rex', 0),
  av('fox', '🦊', 'Fox', 40), av('panda', '🐼', 'Panda', 40), av('frog', '🐸', 'Frog', 40), av('penguin', '🐧', 'Penguin', 40),
  av('lion', '🦁', 'Lion', 60), av('shark', '🦈', 'Shark', 60), av('owl', '🦉', 'Owl', 60), av('koala', '🐨', 'Koala', 60),
  av('ninja', '🥷', 'Ninja', 100), av('astronaut', '🧑‍🚀', 'Astronaut', 100), av('wizard', '🧙', 'Wizard', 100), av('hero', '🦸', 'Superhero', 100),
  av('unicorn', '🦄', 'Unicorn', 150), av('dragon', '🐉', 'Dragon', 200), av('crown', '👑', 'Royal Crown', 250), av('trophy', '🏆', 'Champion', 300),
  // Player colours (Paper Clash land, Snake body)
  col('blue', '#3b82f6', 'Ocean Blue', 0, '🟦'), col('red', '#ef4444', 'Fire Red', 30, '🟥'), col('green', '#22c55e', 'Lime Green', 30, '🟩'),
  col('purple', '#a855f7', 'Royal Purple', 30, '🟪'), col('orange', '#f97316', 'Tangerine', 30, '🟧'), col('pink', '#ec4899', 'Hot Pink', 50, '💗'),
  col('teal', '#14b8a6', 'Teal', 50, '🩵'), col('gold', '#eab308', 'Gold', 120, '🥇'), col('white', '#e2e8f0', 'Snow', 80, '⬜'),
  // Trails (particles behind your player)
  tr('none', '', 'No trail', 0), tr('sparkle', '✨', 'Sparkles', 60), tr('hearts', '💖', 'Hearts', 60), tr('stars', '⭐', 'Stars', 80),
  tr('bubbles', '🫧', 'Bubbles', 80), tr('fire', '🔥', 'Fire', 120), tr('rainbow', '🌈', 'Rainbow', 150), tr('notes', '🎵', 'Music Notes', 100),
  // Name titles
  ti('rookie', 'Rookie', 0, '🌱'), ti('puzzle', 'Puzzle Pro', 40, '🧩'), ti('speedy', 'Speedy', 40, '⚡'), ti('brain', 'Big Brain', 60, '🧠'),
  ti('quiz', 'Quiz Whiz', 60, '❓'), ti('legend', 'Arcade Legend', 150, '🕹️'), ti('boss', 'The Boss', 200, '😤'), ti('goat', 'Unbeatable', 300, '🐐'),
  // Stickers for the Living Mural (ids kept from the old Shop so earlier purchases still count)
  { id: 'rare_star', kind: 'sticker', name: 'Rare Star Sticker', value: '🌟', price: 10, emoji: '🌟' },
  { id: 'golden_heart', kind: 'sticker', name: 'Golden Heart Sticker', value: '💛', price: 15, emoji: '💛' },
  { id: 'unicorn_magic', kind: 'sticker', name: 'Unicorn Magic Sticker', value: '🦄', price: 25, emoji: '🦄' },
];

export const ownsItem = (inventory: string[], item: LockerItem) => item.price === 0 || inventory.includes(item.id);
