// Big kid-drawable word bank for Doodle Dash + Word Scramble.
// ~250 G-rated, picturable words across themed categories so kids can't
// memorise the list any more. Shuffled fresh every game.

export interface WordCategory {
  category: string;
  words: string[];
}

export const DOODLE_CATEGORIES: WordCategory[] = [
  {
    category: 'Animals',
    words: [
      'cat', 'dog', 'fish', 'lion', 'tiger', 'monkey', 'elephant', 'giraffe',
      'penguin', 'snake', 'spider', 'butterfly', 'frog', 'rabbit', 'horse', 'cow',
      'pig', 'duck', 'owl', 'shark', 'octopus', 'dolphin', 'panda', 'fox',
    ],
  },
  {
    category: 'Food & Treats',
    words: [
      'apple', 'banana', 'pizza', 'cake', 'ice cream', 'cookie', 'donut', 'burger',
      'hotdog', 'popcorn', 'lollipop', 'cupcake', 'watermelon', 'strawberry', 'carrot',
      'cheese', 'egg', 'bread', 'sandwich', 'taco', 'pancake', 'candy', 'grapes', 'cherry',
    ],
  },
  {
    category: 'Around the House',
    words: [
      'chair', 'table', 'door', 'window', 'clock', 'lamp', 'bed', 'sofa', 'mirror',
      'key', 'cup', 'spoon', 'fork', 'plate', 'broom', 'bucket', 'pillow', 'blanket',
      'television', 'telephone', 'toothbrush', 'scissors',
    ],
  },
  {
    category: 'Nature & Weather',
    words: [
      'sun', 'moon', 'star', 'cloud', 'rain', 'rainbow', 'snowman', 'tree', 'flower',
      'mountain', 'river', 'volcano', 'lightning', 'tornado', 'leaf', 'mushroom',
      'cactus', 'island', 'waterfall', 'snowflake', 'wave', 'rock',
    ],
  },
  {
    category: 'On the Move',
    words: [
      'car', 'bus', 'train', 'plane', 'boat', 'rocket', 'bicycle', 'truck',
      'helicopter', 'submarine', 'tractor', 'scooter', 'ship', 'ambulance', 'firetruck',
      'taxi', 'motorbike', 'sailboat', 'anchor', 'skateboard',
    ],
  },
  {
    category: 'Fairy-Tale & Fantasy',
    words: [
      'dragon', 'castle', 'crown', 'king', 'queen', 'princess', 'knight', 'wizard',
      'witch', 'unicorn', 'mermaid', 'fairy', 'ghost', 'robot', 'alien', 'monster',
      'pirate', 'treasure', 'genie', 'troll', 'giant', 'sword',
    ],
  },
  {
    category: 'Sports & Play',
    words: [
      'football', 'basketball', 'tennis', 'swimming', 'kite', 'baseball', 'goal',
      'trophy', 'medal', 'jump rope', 'hula hoop', 'slide', 'swing', 'seesaw',
      'bowling', 'surfboard', 'skates', 'dartboard', 'racquet', 'whistle',
    ],
  },
  {
    category: 'Music & K-pop',
    words: [
      'guitar', 'drum', 'piano', 'microphone', 'headphones', 'music note', 'speaker',
      'trumpet', 'violin', 'saxophone', 'stage', 'spotlight', 'idol', 'concert',
      'album', 'radio', 'bell', 'maracas', 'tambourine', 'flute',
    ],
  },
  {
    category: 'Body & Clothes',
    words: [
      'eye', 'hand', 'foot', 'nose', 'ear', 'tooth', 'hat', 'shoe', 'sock', 'glasses',
      'shirt', 'dress', 'scarf', 'gloves', 'boot', 'jacket', 'button', 'ring',
      'mustache', 'belt',
    ],
  },
  {
    category: 'Places',
    words: [
      'school', 'beach', 'park', 'zoo', 'farm', 'hospital', 'library', 'bridge',
      'lighthouse', 'tent', 'igloo', 'garden', 'playground', 'airport', 'barn',
      'windmill', 'cave', 'market',
    ],
  },
  {
    category: 'Jobs & People',
    words: [
      'teacher', 'doctor', 'chef', 'pilot', 'firefighter', 'police', 'farmer',
      'astronaut', 'clown', 'artist', 'nurse', 'scientist', 'painter', 'baker',
      'magician', 'superhero', 'ballerina', 'cowboy',
    ],
  },
  {
    category: 'Holidays & Fun',
    words: [
      'present', 'candle', 'fireworks', 'pumpkin', 'party hat', 'christmas tree',
      'santa', 'snow globe', 'easter egg', 'birthday cake', 'confetti', 'ribbon',
      'lantern', 'costume', 'mask', 'sparkler', 'balloon', 'bow',
    ],
  },
];

// Flat list — used by Doodle Dash (one drawer per round).
export const DOODLE_WORDS: string[] = DOODLE_CATEGORIES.flatMap((c) => c.words);

export interface ScrambleWord {
  word: string;
  category: string;
}

const SINGLE_WORD = /^[a-z]+$/;

// Single-word, comfy-length entries for Word Scramble (no spaces, 4–8 letters).
export function pickScrambleWords(n: number): ScrambleWord[] {
  const pool: ScrambleWord[] = [];
  for (const c of DOODLE_CATEGORIES) {
    for (const w of c.words) {
      if (SINGLE_WORD.test(w) && w.length >= 4 && w.length <= 8) {
        pool.push({ word: w, category: c.category });
      }
    }
  }
  return pool.sort(() => Math.random() - 0.5).slice(0, n);
}

// Shuffle a word's letters, re-rolling until it differs from the original.
export function scramble(word: string): string {
  const letters = word.split('');
  let out = word;
  let tries = 0;
  while (out === word && tries < 25) {
    out = [...letters].sort(() => Math.random() - 0.5).join('');
    tries++;
  }
  return out;
}
