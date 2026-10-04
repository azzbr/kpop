// Odd One Out sets: three items share a category, one doesn't belong.
// `level: 'easy'` = obvious mismatch, `'hard'` = trickier (colour, ability…).

export interface OddItem {
  emoji: string;
  label: string;
}
export interface OddSet {
  level: 'easy' | 'hard' | 'expert' | 'master';
  theme: string; // why the three belong together (shown on reveal)
  sames: OddItem[]; // exactly 3
  odd: OddItem;
}

export const ODD_SETS: OddSet[] = [
  // ---- EASY: clear category mismatch ----
  { level: 'easy', theme: 'fruits', sames: [{ emoji: '🍎', label: 'apple' }, { emoji: '🍌', label: 'banana' }, { emoji: '🍓', label: 'strawberry' }], odd: { emoji: '🥕', label: 'carrot' } },
  { level: 'easy', theme: 'animals', sames: [{ emoji: '🐶', label: 'dog' }, { emoji: '🐱', label: 'cat' }, { emoji: '🐴', label: 'horse' }], odd: { emoji: '🚗', label: 'car' } },
  { level: 'easy', theme: 'vehicles', sames: [{ emoji: '🚗', label: 'car' }, { emoji: '🚌', label: 'bus' }, { emoji: '✈️', label: 'plane' }], odd: { emoji: '🌳', label: 'tree' } },
  { level: 'easy', theme: 'instruments', sames: [{ emoji: '🎸', label: 'guitar' }, { emoji: '🥁', label: 'drum' }, { emoji: '🎹', label: 'piano' }], odd: { emoji: '🍕', label: 'pizza' } },
  { level: 'easy', theme: 'sports balls', sames: [{ emoji: '⚽', label: 'football' }, { emoji: '🏀', label: 'basketball' }, { emoji: '🎾', label: 'tennis' }], odd: { emoji: '🎸', label: 'guitar' } },
  { level: 'easy', theme: 'desserts', sames: [{ emoji: '🍰', label: 'cake' }, { emoji: '🍩', label: 'donut' }, { emoji: '🍪', label: 'cookie' }], odd: { emoji: '🥦', label: 'broccoli' } },
  { level: 'easy', theme: 'school things', sames: [{ emoji: '✏️', label: 'pencil' }, { emoji: '📚', label: 'books' }, { emoji: '🎒', label: 'bag' }], odd: { emoji: '🍔', label: 'burger' } },
  { level: 'easy', theme: 'sea animals', sames: [{ emoji: '🐟', label: 'fish' }, { emoji: '🐬', label: 'dolphin' }, { emoji: '🐙', label: 'octopus' }], odd: { emoji: '🦁', label: 'lion' } },
  { level: 'easy', theme: 'clothes', sames: [{ emoji: '👕', label: 'shirt' }, { emoji: '👖', label: 'jeans' }, { emoji: '🧥', label: 'coat' }], odd: { emoji: '🍎', label: 'apple' } },
  { level: 'easy', theme: 'weather', sames: [{ emoji: '🌧️', label: 'rain' }, { emoji: '🌈', label: 'rainbow' }, { emoji: '⛈️', label: 'storm' }], odd: { emoji: '🍰', label: 'cake' } },
  { level: 'easy', theme: 'breakfast food', sames: [{ emoji: '🥞', label: 'pancakes' }, { emoji: '🥚', label: 'egg' }, { emoji: '🥓', label: 'bacon' }], odd: { emoji: '🚲', label: 'bike' } },
  { level: 'easy', theme: 'jobs', sames: [{ emoji: '👨‍🍳', label: 'chef' }, { emoji: '👩‍⚕️', label: 'doctor' }, { emoji: '👨‍🚒', label: 'firefighter' }], odd: { emoji: '🐶', label: 'dog' } },
  { level: 'easy', theme: 'transport', sames: [{ emoji: '🚂', label: 'train' }, { emoji: '🚀', label: 'rocket' }, { emoji: '⛵', label: 'boat' }], odd: { emoji: '👟', label: 'shoe' } },
  { level: 'easy', theme: 'pets', sames: [{ emoji: '🐶', label: 'dog' }, { emoji: '🐱', label: 'cat' }, { emoji: '🐹', label: 'hamster' }], odd: { emoji: '🐊', label: 'crocodile' } },
  { level: 'easy', theme: 'cold treats', sames: [{ emoji: '🍦', label: 'ice cream' }, { emoji: '🧊', label: 'ice' }, { emoji: '🍧', label: 'shaved ice' }], odd: { emoji: '☕', label: 'hot coffee' } },
  { level: 'easy', theme: 'drinks', sames: [{ emoji: '🥛', label: 'milk' }, { emoji: '🧃', label: 'juice' }, { emoji: '💧', label: 'water' }], odd: { emoji: '🧱', label: 'brick' } },
  { level: 'easy', theme: 'space', sames: [{ emoji: '⭐', label: 'star' }, { emoji: '🌙', label: 'moon' }, { emoji: '🪐', label: 'planet' }], odd: { emoji: '🍌', label: 'banana' } },
  { level: 'easy', theme: 'flowers & plants', sames: [{ emoji: '🌸', label: 'blossom' }, { emoji: '🌻', label: 'sunflower' }, { emoji: '🌵', label: 'cactus' }], odd: { emoji: '🔑', label: 'key' } },
  { level: 'easy', theme: 'tools', sames: [{ emoji: '🔨', label: 'hammer' }, { emoji: '🪛', label: 'screwdriver' }, { emoji: '🔧', label: 'wrench' }], odd: { emoji: '🍦', label: 'ice cream' } },
  { level: 'easy', theme: 'body parts', sames: [{ emoji: '👁️', label: 'eye' }, { emoji: '👂', label: 'ear' }, { emoji: '👃', label: 'nose' }], odd: { emoji: '🚪', label: 'door' } },
  { level: 'easy', theme: 'farm animals', sames: [{ emoji: '🐮', label: 'cow' }, { emoji: '🐷', label: 'pig' }, { emoji: '🐔', label: 'chicken' }], odd: { emoji: '🦈', label: 'shark' } },
  { level: 'easy', theme: 'fruits', sames: [{ emoji: '🍊', label: 'orange' }, { emoji: '🍉', label: 'watermelon' }, { emoji: '🍇', label: 'grapes' }], odd: { emoji: '🧦', label: 'sock' } },
  { level: 'easy', theme: 'in the sky', sames: [{ emoji: '☁️', label: 'cloud' }, { emoji: '🐦', label: 'bird' }, { emoji: '🪁', label: 'kite' }], odd: { emoji: '🐢', label: 'turtle' } },
  { level: 'easy', theme: 'royalty', sames: [{ emoji: '👑', label: 'crown' }, { emoji: '🏰', label: 'castle' }, { emoji: '🤴', label: 'prince' }], odd: { emoji: '🍕', label: 'pizza' } },
  { level: 'easy', theme: 'bugs', sames: [{ emoji: '🐝', label: 'bee' }, { emoji: '🐜', label: 'ant' }, { emoji: '🕷️', label: 'spider' }], odd: { emoji: '🐘', label: 'elephant' } },

  // ---- HARD: subtle logic (colour, ability, size) ----
  { level: 'hard', theme: 'things that can fly', sames: [{ emoji: '🐦', label: 'bird' }, { emoji: '✈️', label: 'plane' }, { emoji: '🦋', label: 'butterfly' }], odd: { emoji: '🐧', label: 'penguin' } },
  { level: 'hard', theme: 'red things', sames: [{ emoji: '🍎', label: 'apple' }, { emoji: '🍓', label: 'strawberry' }, { emoji: '🌹', label: 'rose' }], odd: { emoji: '🫐', label: 'blueberry' } },
  { level: 'hard', theme: 'yellow things', sames: [{ emoji: '🍌', label: 'banana' }, { emoji: '🌝', label: 'moon' }, { emoji: '🧀', label: 'cheese' }], odd: { emoji: '🍇', label: 'grapes' } },
  { level: 'hard', theme: 'round things', sames: [{ emoji: '⚽', label: 'ball' }, { emoji: '🍩', label: 'donut' }, { emoji: '🌕', label: 'full moon' }], odd: { emoji: '📚', label: 'book' } },
  { level: 'hard', theme: 'animals that can swim', sames: [{ emoji: '🐟', label: 'fish' }, { emoji: '🦆', label: 'duck' }, { emoji: '🐬', label: 'dolphin' }], odd: { emoji: '🐈', label: 'cat' } },
  { level: 'hard', theme: 'has wings', sames: [{ emoji: '🦋', label: 'butterfly' }, { emoji: '🐝', label: 'bee' }, { emoji: '🦅', label: 'eagle' }], odd: { emoji: '🐍', label: 'snake' } },
  { level: 'hard', theme: 'green things', sames: [{ emoji: '🌳', label: 'tree' }, { emoji: '🥦', label: 'broccoli' }, { emoji: '🐸', label: 'frog' }], odd: { emoji: '🍓', label: 'strawberry' } },
  { level: 'hard', theme: 'comes out at night', sames: [{ emoji: '🌙', label: 'moon' }, { emoji: '⭐', label: 'star' }, { emoji: '🦉', label: 'owl' }], odd: { emoji: '☀️', label: 'sun' } },
  { level: 'hard', theme: 'big animals', sames: [{ emoji: '🐘', label: 'elephant' }, { emoji: '🦒', label: 'giraffe' }, { emoji: '🦏', label: 'rhino' }], odd: { emoji: '🐭', label: 'mouse' } },
  { level: 'hard', theme: 'big cats', sames: [{ emoji: '🦁', label: 'lion' }, { emoji: '🐯', label: 'tiger' }, { emoji: '🐆', label: 'leopard' }], odd: { emoji: '🐘', label: 'elephant' } },
  { level: 'hard', theme: 'hot things', sames: [{ emoji: '☀️', label: 'sun' }, { emoji: '🔥', label: 'fire' }, { emoji: '🌶️', label: 'chilli' }], odd: { emoji: '❄️', label: 'snowflake' } },
  { level: 'hard', theme: 'flying insects', sames: [{ emoji: '🐝', label: 'bee' }, { emoji: '🦋', label: 'butterfly' }, { emoji: '🦟', label: 'mosquito' }], odd: { emoji: '🐌', label: 'snail' } },
  { level: 'hard', theme: 'liquids', sames: [{ emoji: '💧', label: 'water' }, { emoji: '🥛', label: 'milk' }, { emoji: '🧃', label: 'juice' }], odd: { emoji: '🧊', label: 'ice cube' } },
  { level: 'hard', theme: 'has a shell', sames: [{ emoji: '🐢', label: 'turtle' }, { emoji: '🐌', label: 'snail' }, { emoji: '🦀', label: 'crab' }], odd: { emoji: '🐙', label: 'octopus' } },
  { level: 'hard', theme: 'frozen / cold', sames: [{ emoji: '❄️', label: 'snow' }, { emoji: '⛄', label: 'snowman' }, { emoji: '🧊', label: 'ice' }], odd: { emoji: '🌋', label: 'volcano' } },

  // ---- EXPERT: needs real knowledge (animal classes, materials, music…) ----
  { level: 'expert', theme: 'reptiles', sames: [{ emoji: '🐍', label: 'snake' }, { emoji: '🦎', label: 'lizard' }, { emoji: '🐊', label: 'crocodile' }], odd: { emoji: '🐸', label: 'frog (amphibian)' } },
  { level: 'expert', theme: 'insects (6 legs)', sames: [{ emoji: '🐜', label: 'ant' }, { emoji: '🐝', label: 'bee' }, { emoji: '🦗', label: 'cricket' }], odd: { emoji: '🕷️', label: 'spider (8 legs)' } },
  { level: 'expert', theme: 'mammals', sames: [{ emoji: '🐬', label: 'dolphin' }, { emoji: '🦇', label: 'bat' }, { emoji: '🐘', label: 'elephant' }], odd: { emoji: '🦅', label: 'eagle (bird)' } },
  { level: 'expert', theme: 'root vegetables', sames: [{ emoji: '🥕', label: 'carrot' }, { emoji: '🥔', label: 'potato' }, { emoji: '🧅', label: 'onion' }], odd: { emoji: '🥦', label: 'broccoli' } },
  { level: 'expert', theme: 'nocturnal animals', sames: [{ emoji: '🦉', label: 'owl' }, { emoji: '🦇', label: 'bat' }, { emoji: '🦝', label: 'raccoon' }], odd: { emoji: '🐓', label: 'rooster (daytime)' } },
  { level: 'expert', theme: 'string instruments', sames: [{ emoji: '🎻', label: 'violin' }, { emoji: '🎸', label: 'guitar' }, { emoji: '🪕', label: 'banjo' }], odd: { emoji: '🎺', label: 'trumpet (brass)' } },
  { level: 'expert', theme: 'made of metal', sames: [{ emoji: '🔑', label: 'key' }, { emoji: '🔧', label: 'spanner' }, { emoji: '🔩', label: 'bolt' }], odd: { emoji: '🪵', label: 'log (wood)' } },
  { level: 'expert', theme: 'herbivores (plant eaters)', sames: [{ emoji: '🐰', label: 'rabbit' }, { emoji: '🐮', label: 'cow' }, { emoji: '🐘', label: 'elephant' }], odd: { emoji: '🦁', label: 'lion (meat eater)' } },
  { level: 'expert', theme: 'cold-blooded animals', sames: [{ emoji: '🐍', label: 'snake' }, { emoji: '🐸', label: 'frog' }, { emoji: '🐟', label: 'fish' }], odd: { emoji: '🐶', label: 'dog (warm-blooded)' } },
  { level: 'expert', theme: 'hatch from eggs', sames: [{ emoji: '🐔', label: 'chicken' }, { emoji: '🐢', label: 'turtle' }, { emoji: '🐍', label: 'snake' }], odd: { emoji: '🐬', label: 'dolphin (live birth)' } },

  // ---- MASTER: abstract logic (numbers, colour theory, classification) ----
  { level: 'master', theme: 'primary colours', sames: [{ emoji: '🔴', label: 'red' }, { emoji: '🔵', label: 'blue' }, { emoji: '🟡', label: 'yellow' }], odd: { emoji: '🟢', label: 'green (secondary)' } },
  { level: 'master', theme: 'even numbers', sames: [{ emoji: '2️⃣', label: 'two' }, { emoji: '4️⃣', label: 'four' }, { emoji: '6️⃣', label: 'six' }], odd: { emoji: '7️⃣', label: 'seven (odd)' } },
  { level: 'master', theme: 'odd numbers', sames: [{ emoji: '1️⃣', label: 'one' }, { emoji: '3️⃣', label: 'three' }, { emoji: '5️⃣', label: 'five' }], odd: { emoji: '8️⃣', label: 'eight (even)' } },
  { level: 'master', theme: 'sink in water', sames: [{ emoji: '🪨', label: 'rock' }, { emoji: '🔩', label: 'bolt' }, { emoji: '⚓', label: 'anchor' }], odd: { emoji: '🍎', label: 'apple (floats)' } },
  { level: 'master', theme: 'predators', sames: [{ emoji: '🦁', label: 'lion' }, { emoji: '🦈', label: 'shark' }, { emoji: '🐊', label: 'crocodile' }], odd: { emoji: '🐑', label: 'sheep (prey)' } },
  { level: 'master', theme: 'can sting or bite', sames: [{ emoji: '🐍', label: 'snake' }, { emoji: '🦂', label: 'scorpion' }, { emoji: '🐝', label: 'bee' }], odd: { emoji: '🐞', label: 'ladybird (harmless)' } },
];

export function pickOddSets(level: 'easy' | 'hard' | 'expert' | 'master', n: number): OddSet[] {
  let pool = ODD_SETS.filter((s) => s.level === level);
  if (pool.length < n) pool = ODD_SETS; // fall back to all if a level runs short
  return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
}
