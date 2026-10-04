// Quest Map: a trail of quests done in order. Each check reads saved progress only, so a quest
// done earlier (before the map existed) counts straight away. Never rename an id — claimed ids
// are saved in localStorage ('funquest-quests-claimed').
import type { GameState, PetState, SavedQuiz, Equipped } from '../store';

/** The bits of the store a quest can look at (plus the level number, worked out by QuestMap). */
export interface QuestState {
  userName: string;
  xp: number;
  /** getLevel(xp): 0 = Rookie, 1 = Player (level 2), … */
  level: number;
  userCurrency: number;
  highScores: Record<string, number>;
  rounds: Record<string, number>;
  datesPlayed: string[];
  gameBadges: string[];
  pet: PetState | null;
  myQuizzes: SavedQuiz[];
  equipped: Equipped;
  defaultEquipped: Equipped;
  inventory: string[];
  dailyDoneDate: string;
}

export interface Quest {
  id: string;
  title: string;
  icon: string;
  /** Coins added once when claimed. */
  reward: number;
  check: (s: QuestState) => boolean;
  /** Screen the "Go!" button opens (pet_pal / quest_map are new screens). */
  screen?: GameState;
}

const best = (s: QuestState, id: string) => s.highScores[id] ?? 0;
const gamesPlayed = (s: QuestState) => Object.keys(s.rounds).filter(id => !id.endsWith('_losses') && s.rounds[id] > 0).length;
const totalRounds = (s: QuestState) => Object.entries(s.rounds).reduce((n, [id, r]) => n + (id.endsWith('_losses') ? 0 : r), 0);
const equippedSomething = (s: QuestState) =>
  (Object.keys(s.defaultEquipped) as (keyof Equipped)[]).some(k => s.equipped[k] !== s.defaultEquipped[k]);

export const QUESTS: Quest[] = [
  { id: 'q_name', title: 'Tell us your name', icon: '👋', reward: 10, check: s => s.userName.trim().length > 0, screen: 'welcome' },
  { id: 'q_first_game', title: 'Finish your first game', icon: '🎮', reward: 10, check: s => gamesPlayed(s) >= 1, screen: 'game_mode' },
  { id: 'q_pet', title: 'Adopt a pet', icon: '🐣', reward: 15, check: s => s.pet !== null, screen: 'pet_pal' },
  { id: 'q_3games', title: 'Play 3 different games', icon: '🎲', reward: 15, check: s => gamesPlayed(s) >= 3, screen: 'game_mode' },
  { id: 'q_word', title: 'Solve a Word Guess', icon: '🟩', reward: 15, check: s => best(s, 'word_guess') >= 1, screen: 'word_guess' },
  { id: 'q_badge', title: 'Earn a game badge', icon: '🏅', reward: 15, check: s => s.gameBadges.length >= 1, screen: 'game_mode' },
  { id: 'q_level2', title: 'Reach level 2 (Player)', icon: '⬆️', reward: 20, check: s => s.level >= 1, screen: 'game_mode' },
  { id: 'q_feed', title: 'Feed your pet', icon: '🍽️', reward: 15, check: s => !!s.pet && s.pet.lastFedDate !== '', screen: 'pet_pal' },
  { id: 'q_locker', title: 'Equip something from the Locker', icon: '🎒', reward: 20, check: equippedSomething, screen: 'locker' },
  { id: 'q_2048', title: 'Score 1,000 in 2048', icon: '🔢', reward: 20, check: s => best(s, 'game_2048') >= 1000, screen: 'game_2048' },
  { id: 'q_3days', title: 'Play on 3 different days', icon: '📅', reward: 25, check: s => s.datesPlayed.length >= 3, screen: 'streak_calendar' },
  { id: 'q_paper', title: 'Own 10% of the map in Paper Clash', icon: '🗺️', reward: 20, check: s => best(s, 'paper_clash') >= 100, screen: 'paper_clash' },
  { id: 'q_decor', title: "Decorate your pet's room", icon: '🛋️', reward: 20, check: s => !!s.pet && s.pet.decor.length >= 1, screen: 'pet_pal' },
  { id: 'q_quiz_maker', title: 'Make your own quiz', icon: '✏️', reward: 25, check: s => s.myQuizzes.length >= 1, screen: 'quiz_maker' },
  { id: 'q_daily', title: 'Finish a Daily Challenge', icon: '⭐', reward: 25, check: s => s.dailyDoneDate !== '', screen: 'game_mode' },
  { id: 'q_snake', title: 'Grow to length 50 in Snake Arena', icon: '🐍', reward: 20, check: s => best(s, 'snake_arena') >= 50, screen: 'snake_arena' },
  { id: 'q_real', title: 'Get a streak of 5 in Real or Fake', icon: '🤔', reward: 20, check: s => best(s, 'real_or_fake') >= 5, screen: 'real_or_fake' },
  { id: 'q_6games', title: 'Play 6 different games', icon: '🧭', reward: 25, check: s => gamesPlayed(s) >= 6, screen: 'game_mode' },
  { id: 'q_party', title: 'Play Quiz Party with friends', icon: '🎉', reward: 30, check: s => (s.rounds.quiz_party ?? 0) >= 1, screen: 'online_hub' },
  { id: 'q_hatch', title: 'Help your pet hatch (3 days of play)', icon: '🐥', reward: 30, check: s => !!s.pet && s.pet.growth >= 3, screen: 'pet_pal' },
  { id: 'q_5badges', title: 'Collect 5 game badges', icon: '🎖️', reward: 30, check: s => s.gameBadges.length >= 5, screen: 'achievement_showcase' },
  { id: 'q_emoji', title: 'Get 7 right in Emoji Guess', icon: '🕵️', reward: 25, check: s => best(s, 'emoji_guess') >= 7, screen: 'emoji_guess' },
  { id: 'q_level3', title: 'Reach level 3 (Pro)', icon: '🚀', reward: 30, check: s => s.level >= 2, screen: 'game_mode' },
  { id: 'q_block', title: 'Score 500 in Block Blast', icon: '🧱', reward: 25, check: s => best(s, 'block_blast') >= 500, screen: 'block_blast' },
  { id: 'q_pattern', title: 'Reach round 8 in Pattern Memory', icon: '🧠', reward: 25, check: s => best(s, 'pattern_memory') >= 8, screen: 'pattern_memory' },
  { id: 'q_25rounds', title: 'Finish 25 rounds in total', icon: '🏃', reward: 35, check: s => totalRounds(s) >= 25, screen: 'game_mode' },
  { id: 'q_7days', title: 'Play on 7 different days', icon: '🔥', reward: 40, check: s => s.datesPlayed.length >= 7, screen: 'streak_calendar' },
  { id: 'q_quiz_arena', title: 'Score 6,000 in Quiz Arena', icon: '❓', reward: 35, check: s => best(s, 'quiz_arena') >= 6000, screen: 'quiz_arena' },
  { id: 'q_15badges', title: 'Collect 15 game badges', icon: '🏆', reward: 45, check: s => s.gameBadges.length >= 15, screen: 'achievement_showcase' },
  { id: 'q_grow', title: 'Raise your pet to Big Pal (14 days)', icon: '🐔', reward: 50, check: s => !!s.pet && s.pet.growth >= 14, screen: 'pet_pal' },
  { id: 'q_level5', title: 'Become a Champion (level 5)', icon: '👑', reward: 60, check: s => s.level >= 4, screen: 'game_mode' },
];

export type QuestStatus = 'claimed' | 'ready' | 'current' | 'locked';

/**
 * Quests open in order: a quest is reachable once every quest before it is done (done = claimed
 * or its check passes). Done-but-unclaimed quests are 'ready' to claim; the first not-done quest
 * is 'current'; everything after it is 'locked'.
 */
export function questStatuses(state: QuestState, claimed: ReadonlySet<string>): QuestStatus[] {
  const out: QuestStatus[] = [];
  let open = true;
  for (const q of QUESTS) {
    if (!open) { out.push('locked'); continue; }
    if (claimed.has(q.id)) out.push('claimed');
    else if (q.check(state)) out.push('ready');
    else { out.push('current'); open = false; }
  }
  return out;
}
