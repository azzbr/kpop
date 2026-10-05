// Pure helpers for the Trophy Room (achievement_showcase): friendly game names, best-score
// formatting, badge grouping and the streak calendar grid. No React here — see trophyRoomLogic.test.ts.
import type { GameBadge } from '../data/gameBadges';

/** Friendly names for game ids passed to finishRound / submitScore (titles match the game grid tiles). */
export const GAME_NAMES: Record<string, { icon: string; name: string }> = {
  paper_clash: { icon: '🗺️', name: 'Paper Clash' },
  snake_arena: { icon: '🐍', name: 'Snake Arena' },
  kpop_rush: { icon: '🏃', name: 'Rush Runner' },
  ninja_slice: { icon: '🥷', name: 'Ninja Slice' },
  rocket_launch: { icon: '🚀', name: 'Rocket Launch' },
  tower_defense: { icon: '🏰', name: 'Tower Defense' },
  battle_arena: { icon: '⚔️', name: 'Battle Arena' },
  word_guess: { icon: '🟩', name: 'Word Guess' },
  game_2048: { icon: '🧮', name: '2048' },
  block_blast: { icon: '🧱', name: 'Block Blast' },
  mini_sudoku: { icon: '🔢', name: 'Mini Sudoku' },
  zip_game: { icon: '🔗', name: 'Zip' },
  word_ladder: { icon: '🪜', name: 'Word Ladder' },
  crossword_mini: { icon: '📰', name: 'Crossword Mini' },
  word_scramble: { icon: '🔤', name: 'Word Scramble' },
  pattern_memory: { icon: '🧠', name: 'Pattern Memory' },
  memory_speed: { icon: '🃏', name: 'Speed Memory' },
  sparkle_match: { icon: '💎', name: 'Gem Match' },
  quiz_arena: { icon: '❓', name: 'Quiz Arena' },
  real_or_fake: { icon: '🤔', name: 'Real or Fake?' },
  emoji_guess: { icon: '🕵️', name: 'Emoji Guess' },
  quiz_party: { icon: '🎉', name: 'Quiz Party' },
  imposter: { icon: '🤫', name: 'Imposter' },
  tug_of_war: { icon: '🪢', name: 'Tug-of-War' },
  heads_up: { icon: '🙆', name: 'Heads Up' },
  would_you_rather: { icon: '🤷', name: 'Would You Rather' },
  truth_or_dare: { icon: '🎯', name: 'Truth or Dare' },
  trivia_battle: { icon: '🛎️', name: 'Buzzer Battle' },
  reaction_duel: { icon: '👆', name: 'Reaction Duel' },
  talent_show: { icon: '🎭', name: 'Talent Show' },
  beat_maker: { icon: '🎛️', name: 'Beat Maker' },
  guess_intro: { icon: '🎧', name: 'Guess the Intro' },
  agent_hq: { icon: '🕶️', name: 'Agent HQ' },
  any: { icon: '🌍', name: 'All games' },
};

/** Unknown ids still read nicely: "guess_race" → 🎮 "Guess Race". */
export function gameName(id: string): { icon: string; name: string } {
  return GAME_NAMES[id] ?? { icon: '🎮', name: id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') };
}

/** highScores keys that are counters for badges, not a game's best score. */
const HELPER_KEYS = new Set(['truth_or_dare_dares', 'truth_or_dare_super']);
export const isScoreKey = (id: string) => !id.endsWith('_losses') && !HELPER_KEYS.has(id);

/** A best score with its unit, e.g. Paper Clash 253 → "25.3%". */
export function formatBest(id: string, v: number): string {
  switch (id) {
    case 'paper_clash': return `${Math.round(v) / 10}% of the map`;
    case 'snake_arena': return `length ${v.toLocaleString()}`;
    case 'real_or_fake': return `streak of ${v}`;
    case 'battle_arena': return `${Math.round(v / 10)} ❤️ left`;
    case 'pattern_memory': return `round ${v}`;
    case 'emoji_guess': return `${v} / 10 right`;
    case 'heads_up': return `${v} ${v === 1 ? 'card' : 'cards'}`;
    case 'word_guess': return v >= 1 ? 'solved ✅' : '—';
    case 'guess_intro': return `${v} right`;
    default: return v.toLocaleString();
  }
}

export interface ScoreRow { id: string; icon: string; name: string; value: number; text: string }

/** Every game with a best score above 0, sorted by name. */
export function bestScoreRows(highScores: Record<string, number>): ScoreRow[] {
  return Object.entries(highScores)
    .filter(([id, v]) => isScoreKey(id) && typeof v === 'number' && v > 0)
    .map(([id, v]) => ({ id, ...gameName(id), value: v, text: formatBest(id, v) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface BadgeGroup { game: string; icon: string; name: string; badges: { badge: GameBadge; earned: boolean }[]; earned: number }

/** Badges grouped by game, in catalogue order, with "All games" last. */
export function badgeGroups(badges: GameBadge[], earnedIds: string[]): BadgeGroup[] {
  const earned = new Set(earnedIds);
  const groups = new Map<string, BadgeGroup>();
  for (const badge of badges) {
    let g = groups.get(badge.game);
    if (!g) {
      g = { game: badge.game, ...gameName(badge.game), badges: [], earned: 0 };
      groups.set(badge.game, g);
    }
    const has = earned.has(badge.id);
    g.badges.push({ badge, earned: has });
    if (has) g.earned++;
  }
  const list = [...groups.values()];
  return [...list.filter(g => g.game !== 'any'), ...list.filter(g => g.game === 'any')];
}

/** Calendar cells for a month: null for the blank days before the 1st, then YYYY-MM-DD keys. */
export function monthCells(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mm = String(month + 1).padStart(2, '0');
  return [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${mm}-${String(i + 1).padStart(2, '0')}`),
  ];
}

/** Year and month (0–11) `offset` months away from the given date. */
export function shiftMonth(base: Date, offset: number): { year: number; month: number } {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** How many months back the calendar may go: to the first month she played (0 = only this month). */
export function monthsBack(datesPlayed: string[], today: Date): number {
  if (datesPlayed.length === 0) return 0;
  const first = [...datesPlayed].sort()[0];
  const [y, m] = first.split('-').map(Number);
  if (!y || !m) return 0;
  return Math.max(0, (today.getFullYear() - y) * 12 + today.getMonth() - (m - 1));
}

export function streakMessage(current: number): string {
  if (current === 0) return 'Play today to start your streak! 🌟';
  if (current === 1) return 'Great start! Come back tomorrow! 🔥';
  if (current < 7) return `${current} days in a row! Keep it up! 🔥🔥`;
  if (current < 14) return `AMAZING! ${current}-day streak! You're on fire! 🔥🏆`;
  return `LEGENDARY! ${current} days! You're a true Fun Quest legend! 👑🔥`;
}
