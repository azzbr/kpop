// Per-game badges, checked inside store.finishRound after every round.
// Add new badges here; never rename an id (it's saved in gameBadges).

export interface BadgeCheck {
  gameId: string;
  score: number;
  /** Best score for this game after this round. */
  best: number;
  /** All best scores (to check across games). */
  highScores: Record<string, number>;
  /** Total rounds finished per game id, after this round. */
  rounds: Record<string, number>;
  /** Number of different days played. */
  daysPlayed: number;
}

export interface GameBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Which game it belongs to (for grouping), or 'any'. */
  game: string;
  test: (c: BadgeCheck) => boolean;
}

// Badge helpers. Skill badges look at the best score for that game; "play N" badges look at the
// number of rounds finished (a solved / won round can't be counted from these numbers).
const best = (id: string, game: string, name: string, icon: string, min: number, description: string): GameBadge => ({
  id, name, icon, description, game,
  test: c => (c.gameId === game ? c.best : c.highScores[game] ?? 0) >= min && min > 0,
});
const plays = (id: string, game: string, name: string, icon: string, min: number, description: string): GameBadge => ({
  id, name, icon, description, game,
  test: c => (c.rounds[game] ?? 0) >= min,
});

/** Game ids that only count losses etc. and shouldn't count as a "different game". */
const isRealGame = (id: string) => !id.endsWith('_losses');
const gamesPlayed = (c: BadgeCheck) => Object.keys(c.rounds).filter(id => isRealGame(id) && c.rounds[id] > 0).length;
const totalRounds = (c: BadgeCheck) => Object.entries(c.rounds).reduce((n, [id, r]) => n + (isRealGame(id) ? r : 0), 0);

export const GAME_BADGES: GameBadge[] = [
  // 🗺️ Paper Clash — score is % of the map owned × 10
  plays('pc_first', 'paper_clash', 'Paper Pioneer', '📄', 1, 'Play your first round of Paper Clash'),
  best('pc_10', 'paper_clash', 'Land Grab', '🚩', 100, 'Own 10% of the map in Paper Clash'),
  best('pc_25', 'paper_clash', 'Map Master', '🗺️', 250, 'Own 25% of the map in Paper Clash'),
  best('pc_50', 'paper_clash', 'Paper Emperor', '👑', 500, 'Own half the map in Paper Clash'),

  // 🐍 Snake Arena — score is peak length
  plays('sn_first', 'snake_arena', 'Hiss Hello', '🐍', 1, 'Play your first round of Snake Arena'),
  best('sn_50', 'snake_arena', 'Long Noodle', '🍜', 50, 'Grow to length 50 in Snake Arena'),
  best('sn_100', 'snake_arena', 'Big Snake', '🐉', 100, 'Grow to length 100 in Snake Arena'),
  best('sn_200', 'snake_arena', 'Mega Serpent', '🌟', 200, 'Grow to length 200 in Snake Arena'),

  // 🔢 2048 — points
  best('g2048_1k', 'game_2048', 'Merge Starter', '🔢', 1000, 'Score 1,000 in 2048'),
  best('g2048_5k', 'game_2048', 'Number Ninja', '🧮', 5000, 'Score 5,000 in 2048'),
  best('g2048_20k', 'game_2048', 'Tile Tycoon', '💰', 20000, 'Score 20,000 in 2048'),

  // 🧱 Block Blast — points
  best('bb_200', 'block_blast', 'Block Builder', '🧱', 200, 'Score 200 in Block Blast'),
  best('bb_1000', 'block_blast', 'Line Blaster', '💥', 1000, 'Score 1,000 in Block Blast'),
  best('bb_3000', 'block_blast', 'Blast Master', '🏗️', 3000, 'Score 3,000 in Block Blast'),

  // 🟩 Word Guess — score 1 = solved
  best('wg_solve', 'word_guess', 'First Word', '🟩', 1, 'Solve a Word Guess'),
  plays('wg_5', 'word_guess', 'Word Fan', '📖', 5, 'Play 5 Word Guess puzzles'),
  plays('wg_20', 'word_guess', 'Word Wizard', '🧙', 20, 'Play 20 Word Guess puzzles'),

  // ❓ Quiz Arena — points
  best('qa_2k', 'quiz_arena', 'Quiz Kid', '❓', 2000, 'Score 2,000 in Quiz Arena'),
  best('qa_6k', 'quiz_arena', 'Brain Box', '🧠', 6000, 'Score 6,000 in Quiz Arena'),
  best('qa_9k', 'quiz_arena', 'Quiz Genius', '🎓', 9000, 'Score 9,000 in Quiz Arena'),

  // 🎉 Quiz Party — mode scores differ, so these count games with friends
  plays('qp_first', 'quiz_party', 'Party Starter', '🎉', 1, 'Play Quiz Party with friends'),
  plays('qp_10', 'quiz_party', 'Party Legend', '🪩', 10, 'Play 10 games of Quiz Party'),

  // 🤔 Real or Fake — best streak
  best('rf_3', 'real_or_fake', 'Fact Finder', '🔍', 3, 'Get a streak of 3 in Real or Fake'),
  best('rf_8', 'real_or_fake', 'Truth Detector', '🤔', 8, 'Get a streak of 8 in Real or Fake'),
  best('rf_15', 'real_or_fake', 'Myth Buster', '🧪', 15, 'Get a streak of 15 in Real or Fake'),

  // 🕵️ Emoji Guess — correct out of 10
  best('eg_5', 'emoji_guess', 'Emoji Spotter', '🕵️', 5, 'Get 5 right in Emoji Guess'),
  best('eg_8', 'emoji_guess', 'Emoji Expert', '🧩', 8, 'Get 8 right in Emoji Guess'),
  best('eg_10', 'emoji_guess', 'Perfect Detective', '💯', 10, 'Get all 10 right in Emoji Guess'),

  // 🤷 Would You Rather
  plays('wyr_first', 'would_you_rather', 'Big Decider', '🤷', 1, 'Play a round of Would You Rather'),
  plays('wyr_10', 'would_you_rather', 'Choice Champion', '⚖️', 10, 'Play 10 rounds of Would You Rather'),

  // 🎭 Truth or Dare (truth_or_dare_dares = all dares done, ever; truth_or_dare_super = a Super brave game)
  plays('tod_first', 'truth_or_dare', 'Truth Teller', '🎭', 1, 'Finish a game of Truth or Dare'),
  { id: 'tod_dares_10', name: 'Daredevil', icon: '⚡', description: 'Do 10 dares in Truth or Dare', game: 'truth_or_dare', test: c => (c.highScores.truth_or_dare_dares ?? 0) >= 10 },
  { id: 'tod_super_brave', name: 'Super Brave', icon: '🤯', description: 'Finish a Super brave game of Truth or Dare', game: 'truth_or_dare', test: c => (c.highScores.truth_or_dare_super ?? 0) >= 1 },

  // 🏃 Rush Runner
  best('kr_300', 'kpop_rush', 'Quick Feet', '👟', 300, 'Score 300 in Rush Runner'),
  best('kr_1500', 'kpop_rush', 'Speed Star', '🏃', 1500, 'Score 1,500 in Rush Runner'),
  best('kr_4000', 'kpop_rush', 'Rush Legend', '⚡', 4000, 'Score 4,000 in Rush Runner'),

  // 🥷 Ninja Slice
  best('ns_100', 'ninja_slice', 'Fruit Chopper', '🍉', 100, 'Score 100 in Ninja Slice'),
  best('ns_400', 'ninja_slice', 'Slice Master', '🥷', 400, 'Score 400 in Ninja Slice'),

  // 🚀 Rocket Launch
  best('rl_100', 'rocket_launch', 'Lift Off', '🚀', 100, 'Score 100 in Rocket Launch'),
  best('rl_500', 'rocket_launch', 'Star Pilot', '🌌', 500, 'Score 500 in Rocket Launch'),

  // Score = ❤️ left × 10 on a win (since Oct 2026; older saves held a win count).
  best('ba_1', 'battle_arena', 'First Victory', '⚔️', 1, 'Win a battle in Battle Arena'),
  best('ba_10', 'battle_arena', 'Arena Hero', '🛡️', 500, 'Win a Battle Arena match with 50+ ❤️ left'),
  best('ba_25', 'battle_arena', 'Arena Champion', '🏆', 800, 'Win a Battle Arena match with 80+ ❤️ left'),

  // 🧠 Pattern Memory — round reached
  best('pm_5', 'pattern_memory', 'Good Memory', '💡', 5, 'Reach round 5 in Pattern Memory'),
  best('pm_10', 'pattern_memory', 'Memory Master', '🧠', 10, 'Reach round 10 in Pattern Memory'),

  // 💎 Gem Match
  best('sm_200', 'sparkle_match', 'Gem Collector', '💎', 200, 'Score 200 in Gem Match'),
  best('sm_800', 'sparkle_match', 'Jewel Genius', '💍', 800, 'Score 800 in Gem Match'),

  // 🏰 Tower Defense — waves × 100 + enemies stopped
  best('td_300', 'tower_defense', 'Castle Guard', '🏰', 300, 'Survive 3 waves in Tower Defense'),
  best('td_1000', 'tower_defense', 'Fortress Hero', '🛡️', 1000, 'Survive 10 waves in Tower Defense'),

  // 🙆 Heads Up — cards guessed
  best('hu_5', 'heads_up', 'Good Guesser', '🙆', 5, 'Guess 5 cards in one round of Heads Up'),
  best('hu_12', 'heads_up', 'Mind Reader', '🔮', 12, 'Guess 12 cards in one round of Heads Up'),

  // 🕵️ Imposter
  plays('im_first', 'imposter', 'Sneaky Start', '🎭', 1, 'Play a round of Imposter'),
  plays('im_10', 'imposter', 'Super Sleuth', '🔎', 10, 'Play 10 rounds of Imposter'),

  // 📰 Crossword Mini — 1000 − time/hints
  plays('cw_first', 'crossword_mini', 'Clue Cracker', '📰', 1, 'Finish a Crossword Mini'),
  best('cw_850', 'crossword_mini', 'Crossword Whizz', '✏️', 850, 'Score 850 in Crossword Mini'),

  // 🔗 Zip — level points for time
  plays('zip_first', 'zip_game', 'Zip Starter', '🪡', 1, 'Finish a Zip puzzle'),
  best('zip_250', 'zip_game', 'Path Finder', '🔗', 250, 'Score 250 in Zip'),
  best('zip_600', 'zip_game', 'Zip Zoomer', '🧵', 600, 'Score 600 in Zip'),

  // 🔢 Mini Sudoku — level points for time
  plays('su_first', 'mini_sudoku', 'Grid Solver', '🔢', 1, 'Solve a Mini Sudoku'),
  best('su_550', 'mini_sudoku', 'Sudoku Star', '🌟', 550, 'Score 550 in Mini Sudoku'),

  // 🪜 Word Ladder — 100 for the shortest ladder
  plays('wl_first', 'word_ladder', 'First Rung', '🪜', 1, 'Finish a Word Ladder'),
  best('wl_100', 'word_ladder', 'Perfect Ladder', '🏅', 100, 'Climb a Word Ladder in the fewest steps'),

  // 🔤 Word Scramble — points over 10 words
  best('ws_800', 'word_scramble', 'Unscrambler', '🔤', 800, 'Score 800 in Word Scramble'),
  best('ws_2000', 'word_scramble', 'Super Speller', '🐝', 2000, 'Score 2,000 in Word Scramble'),

  // 🃏 Speed Memory — 20 per pair + time bonus
  best('mem_250', 'memory_speed', 'Sharp Eyes', '👀', 250, 'Score 250 in Speed Memory'),
  best('mem_500', 'memory_speed', 'Pair Pro', '🃏', 500, 'Score 500 in Speed Memory'),

  // 🎧 Guess the Intro — songs right out of 5
  plays('gi_first', 'guess_intro', 'Music Detective', '🎧', 1, 'Play Guess the Intro'),
  best('gi_5', 'guess_intro', 'Golden Ears', '👂', 5, 'Name all 5 songs in Guess the Intro'),

  // 🛎️ Buzzer Battle, 👆 Reaction Duel, 🪢 Tug-of-War, 🎭 Talent Show (party games on one iPad)
  plays('tb_first', 'trivia_battle', 'Buzzer Rookie', '🔔', 1, 'Play a Buzzer Battle'),
  best('tb_7', 'trivia_battle', 'Buzzer Boss', '🛎️', 7, 'Win a Buzzer Battle with 7+ points'),
  plays('rd_first', 'reaction_duel', 'Quick Draw', '⚡', 1, 'Play a Reaction Duel'),
  best('rd_7', 'reaction_duel', 'Lightning Fingers', '👆', 7, 'Win a Reaction Duel with 7+ points'),
  plays('tw_first', 'tug_of_war', 'Rope Puller', '💪', 1, 'Play a Tug-of-War match'),
  best('tw_300', 'tug_of_war', 'Rope Ruler', '🪢', 300, 'Pull 300 times in one Tug-of-War match'),
  plays('ts_first', 'talent_show', 'Star of the Stage', '🎤', 1, 'Put on a Talent Show'),
  plays('ts_5', 'talent_show', 'Showstopper', '🎭', 5, 'Put on 5 Talent Shows'),

  // 🌐 Friends Arena — placement out of 100 (1st = 100)
  plays('arena_first', 'friends_arena', 'Arena Rookie', '🌐', 1, 'Finish a game in Friends Arena'),
  best('arena_win', 'friends_arena', 'Arena Winner', '🥇', 100, 'Win a game in Friends Arena'),
  plays('arena_10', 'friends_arena', 'Arena Regular', '🎮', 10, 'Finish 10 games in Friends Arena'),

  // 🌍 Across all games
  { id: 'any_5games', name: 'Game Hopper', icon: '🐸', description: 'Play 5 different games', game: 'any', test: c => gamesPlayed(c) >= 5 },
  { id: 'any_10games', name: 'Explorer', icon: '🧭', description: 'Play 10 different games', game: 'any', test: c => gamesPlayed(c) >= 10 },
  { id: 'any_20games', name: 'World Traveller', icon: '🌍', description: 'Play 20 different games', game: 'any', test: c => gamesPlayed(c) >= 20 },
  { id: 'any_3days', name: 'Coming Back', icon: '📅', description: 'Play on 3 different days', game: 'any', test: c => c.daysPlayed >= 3 },
  { id: 'any_7days', name: 'Dedicated', icon: '🔥', description: 'Play on 7 different days', game: 'any', test: c => c.daysPlayed >= 7 },
  { id: 'any_30days', name: 'Super Fan', icon: '🌈', description: 'Play on 30 different days', game: 'any', test: c => c.daysPlayed >= 30 },
  { id: 'any_25rounds', name: 'Warming Up', icon: '🎮', description: 'Finish 25 rounds in total', game: 'any', test: c => totalRounds(c) >= 25 },
  { id: 'any_100rounds', name: 'Marathon', icon: '🏅', description: 'Finish 100 rounds in total', game: 'any', test: c => totalRounds(c) >= 100 },
];

/** Badge by id (for toasts and the Trophy Room). */
export const gameBadgeById = (id: string): GameBadge | undefined => GAME_BADGES.find(b => b.id === id);
