// "Player Card" (screen id idol_profile): a trading card built from tap choices only.
// Saved in localStorage 'funquest-player-card' and shown on the card screen and in My Stats.

export interface CardOption { id: string; label: string; emoji: string }
export interface CardColor { id: string; name: string; grad: string }

export const CARD_AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🐲', '🦉', '🐬', '🐝', '🐧', '🤖', '👾', '🦖', '🐱'];

export const CARD_COLORS: CardColor[] = [
  { id: 'galaxy', name: 'Galaxy', grad: 'from-indigo-600 via-purple-600 to-fuchsia-600' },
  { id: 'ocean', name: 'Ocean', grad: 'from-cyan-500 via-sky-600 to-blue-700' },
  { id: 'sunset', name: 'Sunset', grad: 'from-amber-400 via-orange-500 to-rose-600' },
  { id: 'forest', name: 'Forest', grad: 'from-lime-500 via-emerald-600 to-teal-700' },
  { id: 'candy', name: 'Candy', grad: 'from-pink-400 via-fuchsia-500 to-purple-600' },
  { id: 'lava', name: 'Lava', grad: 'from-yellow-500 via-orange-600 to-red-700' },
  { id: 'gold', name: 'Gold', grad: 'from-yellow-300 via-amber-400 to-yellow-600' },
  { id: 'midnight', name: 'Midnight', grad: 'from-slate-700 via-indigo-900 to-slate-900' },
];

export const CARD_TITLES: CardOption[] = [
  { id: 'puzzle_pro', label: 'Puzzle Pro', emoji: '🧩' },
  { id: 'speed_star', label: 'Speed Star', emoji: '⚡' },
  { id: 'party_captain', label: 'Party Captain', emoji: '🎉' },
  { id: 'master_builder', label: 'Master Builder', emoji: '🛠️' },
  { id: 'word_wizard', label: 'Word Wizard', emoji: '📚' },
  { id: 'quiz_champ', label: 'Quiz Champ', emoji: '🧠' },
  { id: 'arcade_ace', label: 'Arcade Ace', emoji: '🕹️' },
  { id: 'music_maker', label: 'Music Maker', emoji: '🎵' },
  { id: 'art_star', label: 'Art Star', emoji: '🎨' },
  { id: 'brave_explorer', label: 'Brave Explorer', emoji: '🧭' },
  { id: 'kindness_hero', label: 'Kindness Hero', emoji: '💖' },
  { id: 'secret_agent', label: 'Secret Agent', emoji: '🕵️' },
];

export const CARD_POWERS: CardOption[] = [
  { id: 'speed', label: 'Super speed', emoji: '💨' },
  { id: 'animals', label: 'Talks to animals', emoji: '🐾' },
  { id: 'freeze', label: 'Time freeze', emoji: '⏸️' },
  { id: 'flying', label: 'Flying', emoji: '🪽' },
  { id: 'memory', label: 'Super memory', emoji: '🧠' },
  { id: 'teleport', label: 'Teleporting', emoji: '✨' },
  { id: 'strength', label: 'Mega strength', emoji: '💪' },
  { id: 'plants', label: 'Grows plants', emoji: '🌱' },
  { id: 'weather', label: 'Weather control', emoji: '🌦️' },
  { id: 'luck', label: 'Super luck', emoji: '🍀' },
  { id: 'invisible', label: 'Invisibility', emoji: '🫥' },
  { id: 'shrink', label: 'Shrinking', emoji: '🐜' },
];

/** Favourite game: labels match the game grid tiles. */
export const CARD_GAMES: CardOption[] = [
  { id: 'paper_clash', label: 'Paper Clash', emoji: '🗺️' },
  { id: 'snake_arena', label: 'Snake Arena', emoji: '🐍' },
  { id: 'kpop_rush', label: 'Rush Runner', emoji: '🏃' },
  { id: 'ninja_slice', label: 'Ninja Slice', emoji: '🥷' },
  { id: 'rocket_launch', label: 'Rocket Launch', emoji: '🚀' },
  { id: 'tower_defense', label: 'Tower Defense', emoji: '🏰' },
  { id: 'word_guess', label: 'Word Guess', emoji: '🟩' },
  { id: 'game_2048', label: '2048', emoji: '🧮' },
  { id: 'block_blast', label: 'Block Blast', emoji: '🧱' },
  { id: 'mini_sudoku', label: 'Mini Sudoku', emoji: '🔢' },
  { id: 'sparkle_match', label: 'Gem Match', emoji: '💎' },
  { id: 'quiz_arena', label: 'Quiz Arena', emoji: '❓' },
  { id: 'online_hub', label: 'Friends Arena', emoji: '🌐' },
  { id: 'truth_or_dare', label: 'Truth or Dare', emoji: '🎯' },
  { id: 'heads_up', label: 'Heads Up', emoji: '🙆' },
  { id: 'beat_maker', label: 'Beat Maker', emoji: '🎛️' },
  { id: 'pet_pal', label: 'Pet Pal', emoji: '🐾' },
  { id: 'style_studio', label: 'Style Studio', emoji: '👗' },
];

export const CARD_MOTTOS: string[] = [
  'Never give up!',
  'Be kind, have fun!',
  'Practice makes progress.',
  'Every day is a new level.',
  'Try, try, and try again!',
  'Big dreams, brave steps.',
  'Mistakes help me learn.',
  'Teamwork makes the dream work.',
  'Stay curious!',
  'Laugh a lot, play a lot.',
  'I can do hard things.',
  'Shine your own way.',
  'Today is a great day to play.',
  'Smile, then press start.',
  'Brain on, fun on!',
  'Friends first, high scores second.',
  'Keep calm and play on.',
  'Small steps, big wins.',
  'Be the hero of your story.',
  'Let’s go on an adventure!',
];

export interface PlayerCard {
  v: 1;
  avatar: string;
  color: string;
  title: string;
  power: string;
  game: string;
  /** Index into CARD_MOTTOS. */
  motto: number;
  /** Local date the card was first made (YYYY-MM-DD). */
  created: string;
}

export const PLAYER_CARD_KEY = 'funquest-player-card';

export function defaultCard(created: string): PlayerCard {
  return {
    v: 1, avatar: CARD_AVATARS[0], color: CARD_COLORS[0].id, title: CARD_TITLES[0].id,
    power: CARD_POWERS[0].id, game: CARD_GAMES[0].id, motto: 0, created,
  };
}

/** Accepts only a card whose every field is a known option (anything else → null). */
export function parseCard(raw: unknown): PlayerCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const ok =
    typeof c.avatar === 'string' && CARD_AVATARS.includes(c.avatar) &&
    CARD_COLORS.some(o => o.id === c.color) &&
    CARD_TITLES.some(o => o.id === c.title) &&
    CARD_POWERS.some(o => o.id === c.power) &&
    CARD_GAMES.some(o => o.id === c.game) &&
    typeof c.motto === 'number' && Number.isInteger(c.motto) && c.motto >= 0 && c.motto < CARD_MOTTOS.length;
  if (!ok) return null;
  return {
    v: 1, avatar: c.avatar as string, color: c.color as string, title: c.title as string,
    power: c.power as string, game: c.game as string, motto: c.motto as number,
    created: typeof c.created === 'string' ? c.created : '',
  };
}

export function loadCard(): PlayerCard | null {
  try {
    const s = localStorage.getItem(PLAYER_CARD_KEY);
    return s ? parseCard(JSON.parse(s)) : null;
  } catch { return null; }
}

export function saveCard(card: PlayerCard): boolean {
  try { localStorage.setItem(PLAYER_CARD_KEY, JSON.stringify(card)); return true; } catch { return false; }
}

export const colorOf = (id: string) => CARD_COLORS.find(c => c.id === id) ?? CARD_COLORS[0];
export const titleOf = (id: string) => CARD_TITLES.find(c => c.id === id) ?? CARD_TITLES[0];
export const powerOf = (id: string) => CARD_POWERS.find(c => c.id === id) ?? CARD_POWERS[0];
export const gameOf = (id: string) => CARD_GAMES.find(c => c.id === id) ?? CARD_GAMES[0];
