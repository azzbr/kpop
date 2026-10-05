// Mini crossword puzzles (5×5). Checked by src/data/crossword.test.ts:
// the grid letters must agree with every answer, and every numbered cell must be shown.

export type Dir = 'across' | 'down';

export interface CrosswordClue {
  /** Clue number, using normal crossword numbering (see clueNumbers). */
  id: number;
  dir: Dir;
  clue: string;
  answer: string;
  row: number;
  col: number;
}

export interface CrosswordPuzzle {
  name: string;
  /** One string per row; '#' is a black square. */
  rows: string[];
  clues: CrosswordClue[];
}

export const CROSSWORD_SIZE = 5;

export const PUZZLES: CrosswordPuzzle[] = [
  {
    name: 'Show Time! 🌟',
    rows: [
      'STARS',
      'I###H',
      'N###I',
      'G###N',
      'STAGE',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '⭐ Twinkly lights in the night sky (5)', answer: 'STARS', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '🎤 The raised floor where actors and singers perform (5)', answer: 'STAGE', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '🎵 A choir ___ songs together (5)', answer: 'SINGS', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '✨ To glow brightly, like a spotlight (5)', answer: 'SHINE', row: 0, col: 4 },
    ],
  },
  {
    name: 'Animal Friends 🐾',
    rows: [
      'SHEEP',
      'L###A',
      'O###N',
      'T###D',
      'HYENA',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '🐑 Fluffy farm animal that gives us wool (5)', answer: 'SHEEP', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '😆 Wild animal famous for its "laughing" call (5)', answer: 'HYENA', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '🦥 Super-slow animal that hangs upside down in trees (5)', answer: 'SLOTH', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '🐼 Black-and-white bear that munches bamboo (5)', answer: 'PANDA', row: 0, col: 4 },
    ],
  },
  {
    name: 'Snack Time 🍩',
    rows: [
      'SALAD',
      'U###O',
      'G###N',
      'A###U',
      'ROAST',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '🥗 A bowl of lettuce and other veggies (5)', answer: 'SALAD', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '🔥 To cook in an oven, or toast marshmallows over a fire (5)', answer: 'ROAST', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '🍬 Sweet white stuff baked into cakes and cookies (5)', answer: 'SUGAR', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '🍩 Round sweet treat with a hole in the middle (5)', answer: 'DONUT', row: 0, col: 4 },
    ],
  },
  {
    name: 'Sky & Nature 🌍',
    rows: [
      'COMET',
      'L###R',
      'O###E',
      'U###E',
      'DUNES',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '☄️ Icy space rock with a long glowing tail (5)', answer: 'COMET', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '🏜️ Big hills of sand in a desert (5)', answer: 'DUNES', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '☁️ Fluffy white shape floating in the sky (5)', answer: 'CLOUD', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '🌳 Tall plants with trunks, branches and leaves (5)', answer: 'TREES', row: 0, col: 4 },
    ],
  },
  {
    name: 'Your Amazing Body 🦴',
    rows: [
      'TEETH',
      'H###A',
      'U###N',
      'M###D',
      'BONES',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '🦷 You brush these twice a day (5)', answer: 'TEETH', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '🦴 Your skeleton is made of these (5)', answer: 'BONES', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '👍 The short finger you hold up to say "good job!" (5)', answer: 'THUMB', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '👏 You clap with these (5)', answer: 'HANDS', row: 0, col: 4 },
    ],
  },
  {
    name: 'Sports Day ⚽',
    rows: [
      'SKATE',
      'W###V',
      'I###E',
      'M###N',
      'SPORT',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '⛸️ Glide across the ice on blades (5)', answer: 'SKATE', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '⚽ Football, tennis and swimming are each one of these (5)', answer: 'SPORT', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '🐟 A fish ___ through the water (5)', answer: 'SWIMS', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '🏅 One race or contest on sports day (5)', answer: 'EVENT', row: 0, col: 4 },
    ],
  },
  {
    name: 'Weather Watch ⛅',
    rows: [
      'STORM',
      'N###E',
      'O###L',
      'W###T',
      'SKIES',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '⛈️ Wild weather with wind, rain and thunder (5)', answer: 'STORM', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '🌤️ Look up! Clouds drift across the blue ___ (5)', answer: 'SKIES', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '❄️ When it ___, you can build a snowman (5)', answer: 'SNOWS', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '🍦 What an ice cream does on a hot sunny day (5)', answer: 'MELTS', row: 0, col: 4 },
    ],
  },
  {
    name: 'Music Time 🎵',
    rows: [
      'BEATS',
      'A###I',
      'N###N',
      'D###G',
      'SONGS',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '🥁 Drum ___ keep the rhythm of a song (5)', answer: 'BEATS', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '🎶 Tunes with words you can sing along to (5)', answer: 'SONGS', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '🎸 Groups of musicians who play together (5)', answer: 'BANDS', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '🐦 A bird ___ a happy tune in the morning (5)', answer: 'SINGS', row: 0, col: 4 },
    ],
  },
  {
    name: 'School Day ✏️',
    rows: [
      'BOOKS',
      'O###T',
      'A###U',
      'R###D',
      'DIARY',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '📚 You borrow these from the library (5)', answer: 'BOOKS', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '📔 A notebook where you write about your day (5)', answer: 'DIARY', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '🧑‍🏫 The teacher writes on the big white ___ (5)', answer: 'BOARD', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '🧠 To learn and practise before a test (5)', answer: 'STUDY', row: 0, col: 4 },
    ],
  },
  {
    name: 'Fruit Bowl 🍐',
    rows: [
      'PLUMS',
      'E###E',
      'A###E',
      'R###D',
      'STEWS',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '🟣 Juicy purple or red fruits with a stone in the middle (5)', answer: 'PLUMS', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '🍲 Hot dishes cooked slowly in a pot with chunky veggies (5)', answer: 'STEWS', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '🍐 Fruits that are thin at the top and round at the bottom (5)', answer: 'PEARS', row: 0, col: 0 },
      { id: 2, dir: 'down', clue: '🌱 Plant these in soil and they grow into new plants (5)', answer: 'SEEDS', row: 0, col: 4 },
    ],
  },
];

export const isBlackCell = (p: CrosswordPuzzle, r: number, c: number) => p.rows[r][c] === '#';

/**
 * Standard crossword numbering: scanning left-to-right, top-to-bottom, a white cell gets the
 * next number if it starts an across word or a down word (2+ letters). Returns "r-c" → number.
 */
export function clueNumbers(p: CrosswordPuzzle): Map<string, number> {
  const nums = new Map<string, number>();
  const size = p.rows.length;
  const white = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && !isBlackCell(p, r, c);
  let n = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!white(r, c)) continue;
      const startsAcross = !white(r, c - 1) && white(r, c + 1);
      const startsDown = !white(r - 1, c) && white(r + 1, c);
      if (startsAcross || startsDown) nums.set(`${r}-${c}`, ++n);
    }
  }
  return nums;
}
