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
    name: 'K-Pop Stage! 🌟',
    rows: [
      'STARS',
      'I###H',
      'N###I',
      'G###N',
      'STAGE',
    ],
    clues: [
      { id: 1, dir: 'across', clue: '⭐ Twinkly lights in the night sky — idols are pop ones too! (5)', answer: 'STARS', row: 0, col: 0 },
      { id: 3, dir: 'across', clue: '🎤 The raised floor where idols perform (5)', answer: 'STAGE', row: 4, col: 0 },
      { id: 1, dir: 'down', clue: '🎵 An idol ___ songs (5)', answer: 'SINGS', row: 0, col: 0 },
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
