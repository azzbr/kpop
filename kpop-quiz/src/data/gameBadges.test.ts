import { describe, it, expect } from 'vitest';
import { GAME_BADGES, gameBadgeById } from './gameBadges';
import type { BadgeCheck } from './gameBadges';
import { QUESTS, questStatuses } from './quests';
import type { QuestState } from './quests';

const KNOWN_GAMES = [
  'paper_clash', 'snake_arena', 'game_2048', 'block_blast', 'word_guess', 'quiz_arena', 'quiz_party',
  'real_or_fake', 'emoji_guess', 'would_you_rather', 'kpop_rush', 'ninja_slice', 'rocket_launch',
  'battle_arena', 'pattern_memory', 'sparkle_match', 'tower_defense', 'heads_up', 'imposter', 'truth_or_dare',
  'crossword_mini', 'zip_game', 'mini_sudoku', 'word_ladder', 'word_scramble', 'memory_speed', 'guess_intro',
  'trivia_battle', 'reaction_duel', 'tug_of_war', 'talent_show', 'friends_arena',
];

/** A plausible good-but-not-amazing score per game, in finishRound units. */
const PLAUSIBLE: Record<string, number> = {
  paper_clash: 120, snake_arena: 60, game_2048: 2500, block_blast: 400, word_guess: 1, quiz_arena: 4000,
  quiz_party: 3000, real_or_fake: 5, emoji_guess: 6, would_you_rather: 6, kpop_rush: 800, ninja_slice: 150,
  rocket_launch: 200, battle_arena: 300, pattern_memory: 6, sparkle_match: 300, tower_defense: 400, heads_up: 7, imposter: 2,
  crossword_mini: 700, zip_game: 200, mini_sudoku: 300, word_ladder: 80, word_scramble: 900, memory_speed: 260,
  guess_intro: 3, trivia_battle: 6, reaction_duel: 6, tug_of_war: 200, talent_show: 20, friends_arena: 60, truth_or_dare: 15,
};

const check = (gameId: string, score: number, extra: Partial<BadgeCheck> = {}): BadgeCheck => ({
  gameId, score, best: score, highScores: { [gameId]: score }, rounds: { [gameId]: 1 }, daysPlayed: 1, ...extra,
});

describe('game badges', () => {
  it('have unique ids and names', () => {
    expect(new Set(GAME_BADGES.map(b => b.id)).size).toBe(GAME_BADGES.length);
    expect(new Set(GAME_BADGES.map(b => b.name)).size).toBe(GAME_BADGES.length);
  });

  it('belong to a known game or "any"', () => {
    for (const b of GAME_BADGES) expect([...KNOWN_GAMES, 'any']).toContain(b.game);
  });

  it('have a name, icon and description', () => {
    for (const b of GAME_BADGES) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.icon.length).toBeGreaterThan(0);
      expect(b.description.length).toBeGreaterThan(5);
    }
  });

  it('run without throwing on sample and empty checks', () => {
    const empty: BadgeCheck = { gameId: 'paper_clash', score: 0, best: 0, highScores: {}, rounds: {}, daysPlayed: 0 };
    for (const b of GAME_BADGES) {
      expect(typeof b.test(empty)).toBe('boolean');
      expect(typeof b.test(check('snake_arena', 75))).toBe('boolean');
    }
  });

  it('every game has at least one badge that a plausible first round earns', () => {
    for (const game of KNOWN_GAMES) {
      const earned = GAME_BADGES.filter(b => b.game === game && b.test(check(game, PLAUSIBLE[game])));
      expect(earned.length, game).toBeGreaterThan(0);
    }
  });

  it('every game has 2–4 badges', () => {
    for (const game of KNOWN_GAMES) {
      const n = GAME_BADGES.filter(b => b.game === game).length;
      expect(n, game).toBeGreaterThanOrEqual(2);
      expect(n, game).toBeLessThanOrEqual(4);
    }
  });

  it('nothing triggers on a score of 0 except "first play" badges', () => {
    for (const game of KNOWN_GAMES) {
      const earned = GAME_BADGES.filter(b => b.test(check(game, 0)));
      for (const b of earned) expect(b.id, b.id).toMatch(/_first$/);
    }
  });

  it('cross-game badges count different games, days and rounds', () => {
    const rounds: Record<string, number> = {};
    KNOWN_GAMES.slice(0, 10).forEach(g => { rounds[g] = 10; });
    rounds.battle_arena_losses = 5; // not a game of its own
    const c = check('paper_clash', 0, { rounds, daysPlayed: 7 });
    const ids = GAME_BADGES.filter(b => b.game === 'any' && b.test(c)).map(b => b.id);
    expect(ids).toEqual(expect.arrayContaining(['any_5games', 'any_10games', 'any_3days', 'any_7days', 'any_25rounds', 'any_100rounds']));
    expect(ids).not.toContain('any_20games');
    expect(ids).not.toContain('any_30days');
  });

  it('skill badges also see best scores from other games', () => {
    const c = check('snake_arena', 10, { highScores: { snake_arena: 10, paper_clash: 260 } });
    expect(gameBadgeById('pc_25')!.test(c)).toBe(true);
    expect(gameBadgeById('pc_50')!.test(c)).toBe(false);
  });
});

// Quest Map data (kept here: quests.ts has no test file of its own).

describe('quests', () => {
  const eq = { avatar: '😎', color: '#3b82f6', trail: '', title: '', skin: '' };
  const fresh: QuestState = {
    userName: '', xp: 0, level: 0, userCurrency: 100, highScores: {}, rounds: {}, datesPlayed: [], gameBadges: [],
    pet: null, myQuizzes: [], equipped: eq, defaultEquipped: eq, inventory: [], dailyDoneDate: '',
  };

  it('has ~30 quests with unique ids and positive rewards', () => {
    expect(QUESTS.length).toBeGreaterThanOrEqual(28);
    expect(new Set(QUESTS.map(q => q.id)).size).toBe(QUESTS.length);
    for (const q of QUESTS) expect(q.reward).toBeGreaterThan(0);
  });

  it('a brand-new player has nothing done and only the first quest open', () => {
    for (const q of QUESTS) expect(q.check(fresh), q.id).toBe(false);
    const st = questStatuses(fresh, new Set());
    expect(st[0]).toBe('current');
    expect(st.slice(1).every(s => s === 'locked')).toBe(true);
  });

  it('opens quests in order and keeps claimed ones done', () => {
    const s = { ...fresh, userName: 'Mia', rounds: { paper_clash: 1 } };
    expect(questStatuses(s, new Set()).slice(0, 3)).toEqual(['ready', 'ready', 'current']);
    expect(questStatuses(s, new Set(['q_name'])).slice(0, 3)).toEqual(['claimed', 'ready', 'current']);
  });

  it('a player who has done everything can finish the whole map', () => {
    const pet = { name: 'Pip', species: 'chick', growth: 30, happiness: 90, lastVisitDate: 'x', lastFedDate: 'x', decor: ['pet_ball'], born: 'x' };
    const rounds: Record<string, number> = {};
    ['a', 'b', 'c', 'd', 'e', 'f', 'quiz_party', 'truth_or_dare'].forEach(g => { rounds[g] = 5; });
    const all: QuestState = {
      ...fresh, userName: 'Mia', xp: 5000, level: 6, rounds, datesPlayed: Array.from({ length: 8 }, (_, i) => `d${i}`),
      gameBadges: Array.from({ length: 20 }, (_, i) => `b${i}`), pet, myQuizzes: [{ id: '1', title: 't', emoji: '❓', questions: [], updatedAt: 0 }],
      equipped: { ...eq, avatar: '🦄' }, dailyDoneDate: '2026-10-01',
      highScores: { word_guess: 1, game_2048: 1000, paper_clash: 100, snake_arena: 50, real_or_fake: 5, emoji_guess: 7, block_blast: 500, pattern_memory: 8, quiz_arena: 6000 },
    };
    for (const q of QUESTS) expect(q.check(all), q.id).toBe(true);
  });
});
