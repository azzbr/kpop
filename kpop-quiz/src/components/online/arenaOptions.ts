// Host-chosen setup for Friends Arena games, shown in the lobby and sent in the `start`
// message as GameConfig (key → value).
import type { GameId } from '../../online/useRoom';
import { DOODLE_CATEGORIES } from '../../online/doodleWords';
import { FAKE_ARTIST_CATEGORIES } from '../../online/fakeArtistWords';
import { HEADS_UP_CATEGORIES } from '../../data/headsUpCards';

export interface OptionGroup {
  key: string;
  label: string;
  choices: { value: string; label: string }[];
}
const STD = [
  { value: 'easy', label: '😀 Easy' }, { value: 'medium', label: '🙂 Medium' }, { value: 'hard', label: '🤓 Hard' }, { value: 'expert', label: '🧠 Expert' }, { value: 'master', label: '🔥 Master' }, { value: 'legend', label: '💀 Legend' },
];
/** Big-screen mode: the host's device shows the game on the board and doesn't play (config.board === '1'). */
export const BOARD: OptionGroup = { key: 'board', label: 'Host screen', choices: [{ value: '0', label: '📱 Host plays too' }, { value: '1', label: '📺 Big screen (host watches)' }] };

// The first choice of each group is the default.
export const GAME_OPTIONS: Partial<Record<GameId, OptionGroup[]>> = {
  quip_clash: [BOARD],
  emoji_charades: [
    { key: 'rounds', label: 'Tellers', choices: [{ value: '5', label: '⏱️ 5 tellers (~6 min)' }, { value: '3', label: '⚡ 3 tellers' }, { value: '8', label: '🎬 8 tellers' }, { value: 'all', label: '👥 Everyone tells once' }] },
    { key: 'difficulty', label: 'Phrases', choices: [{ value: 'mixed', label: '🎲 Mixed' }, { value: 'easy', label: '😀 Easy' }, { value: 'tricky', label: '🤓 Tricky' }] },
    BOARD,
  ],
  spy_station: [BOARD],
  heads_up_party: [
    { key: 'deck', label: 'Deck', choices: [{ value: 'mix', label: '🎲 Mixed' }, ...HEADS_UP_CATEGORIES.map(c => ({ value: c.id, label: `${c.emoji} ${c.name}` }))] },
    { key: 'teams', label: 'Play as', choices: [{ value: 'solo', label: '🙋 Solo turns' }, { value: '2', label: '🔴🔵 Two teams' }] },
    { key: 'turns', label: 'Turns', choices: [{ value: '5', label: '⏱️ 5 turns (~6 min)' }, { value: '3', label: '⚡ 3 turns' }, { value: '8', label: '🎉 8 turns' }, { value: 'all', label: '👥 Everyone guesses once' }] },
    BOARD,
  ],
  doodle_dash: [
    { key: 'category', label: 'Words', choices: [{ value: 'mixed', label: '🎲 Mixed' }, ...DOODLE_CATEGORIES.map(c => ({ value: c.category, label: c.category }))] },
    { key: 'difficulty', label: 'Word choices', choices: [{ value: 'mixed', label: '🎯 Easy + medium + hard' }, { value: 'easy', label: '😀 Easy' }, { value: 'medium', label: '🙂 Medium' }, { value: 'hard', label: '🤓 Hard' }] },
    { key: 'laps', label: 'Turns each', choices: [{ value: '1', label: '✏️ Draw once' }, { value: '2', label: '✏️✏️ Twice' }, { value: '3', label: '✏️✏️✏️ Three times' }] },
    BOARD,
  ],
  fake_artist: [
    { key: 'rounds', label: 'Rounds', choices: [{ value: '2', label: '🎨 2 rounds' }, { value: '3', label: '🎨 3 rounds' }] },
    { key: 'category', label: 'Words', choices: [{ value: 'mixed', label: '🎲 Mixed' }, ...FAKE_ARTIST_CATEGORIES.map(c => ({ value: c.category, label: c.category }))] },
    BOARD,
  ],
  picture_phone: [
    { key: 'start', label: 'Start with', choices: [{ value: 'cards', label: '🎲 Word cards' }, { value: 'write', label: '✍️ Write your own start' }] },
    BOARD,
  ],
  doodle_decoy: [BOARD],
  monster_mash: [
    { key: 'rounds', label: 'Rounds', choices: [{ value: '3', label: '🧟 3 rounds' }, { value: '2', label: '🧟 2 rounds' }] },
    BOARD,
  ],
  team_tug: [{ key: 'mode', label: 'Mode', choices: [{ value: 'tug', label: '🪢 Team tug' }, { value: 'rocket', label: '🚀 Rocket race' }] }],
  math_sprint: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  pattern_quest: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  make_24: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  hangman: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  brain_buzzer: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  minesweeper: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  sliding_puzzle: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  colour_clash: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  dots_boxes: [{ key: 'difficulty', label: 'Board size', choices: [
    { value: 'small', label: '▫️ Small · 3×3' }, { value: 'medium', label: '◻️ Medium · 4×4' }, { value: 'large', label: '⬜ Large · 5×5' },
  ] }],
  code_breaker: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy · 3' }, { value: 'normal', label: '🙂 Normal · 4' }, { value: 'hard', label: '🤓 Hard · 4+' }, { value: 'expert', label: '🧠 Expert · 5' }, { value: 'master', label: '🔥 Master · 5/8' }, { value: 'legend', label: '💀 Legend · 6/8' },
  ] }],
  odd_one_out: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy' }, { value: 'hard', label: '🤓 Tricky' }, { value: 'expert', label: '🧠 Genius' }, { value: 'master', label: '🔥 Master' }, { value: 'legend', label: '💀 Legend' },
  ] }],
  whats_missing: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy · 5' }, { value: 'medium', label: '🙂 Medium · 7' }, { value: 'hard', label: '🤓 Hard · 9' }, { value: 'expert', label: '🧠 Expert · 11' }, { value: 'master', label: '🔥 Master · 13' }, { value: 'legend', label: '💀 Legend · 15' },
  ] }],
  memory_digits: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy · 3' }, { value: 'medium', label: '🙂 Medium · 4' }, { value: 'hard', label: '🤓 Hard · 5' }, { value: 'expert', label: '🧠 Expert · 6' }, { value: 'master', label: '🔥 Master · 7' }, { value: 'legend', label: '💀 Legend · 8' },
  ] }],
  sudoku_mini: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy · 4×4' }, { value: 'medium', label: '🙂 Medium · 4×4' }, { value: 'hard', label: '🤓 Hard · 6×6' }, { value: 'expert', label: '🧠 Expert · 6×6' }, { value: 'master', label: '🔥 Master · 6×6' }, { value: 'legend', label: '💀 Legend · 6×6' },
  ] }],
};
