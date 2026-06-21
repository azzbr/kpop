// Brain Buzzer: fast TRUE / FALSE statements. A mix of generated maths
// equations (sometimes correct, sometimes sneakily wrong) and trivia facts.

export interface Buzz {
  prompt: string;
  isTrue: boolean;
}

const randInt = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function mathBuzz(difficulty: string): Buzz {
  let a: number;
  let b: number;
  let op: string;
  let ans: number;
  if (difficulty === 'easy') {
    op = pick(['+', '−', '×']);
    if (op === '×') { a = randInt(2, 5); b = randInt(2, 5); ans = a * b; }
    else if (op === '+') { a = randInt(2, 20); b = randInt(2, 20); ans = a + b; }
    else { a = randInt(5, 20); b = randInt(1, a); ans = a - b; }
  } else if (difficulty === 'master' || difficulty === 'expert') {
    op = pick(['+', '−', '×', '÷']);
    if (op === '×') { a = randInt(8, 20); b = randInt(6, 15); ans = a * b; }
    else if (op === '÷') { b = randInt(4, 12); ans = randInt(4, 15); a = b * ans; }
    else if (op === '+') { a = randInt(50, 900); b = randInt(50, 900); ans = a + b; }
    else { a = randInt(100, 1000); b = randInt(20, a); ans = a - b; }
  } else {
    op = pick(['+', '−', '×', '÷']);
    if (op === '×') { a = randInt(3, 12); b = randInt(3, 12); ans = a * b; }
    else if (op === '÷') { b = randInt(2, 10); ans = randInt(2, 10); a = b * ans; }
    else if (op === '+') { a = randInt(10, 100); b = randInt(10, 100); ans = a + b; }
    else { a = randInt(20, 100); b = randInt(1, a); ans = a - b; }
  }
  const makeFalse = Math.random() < 0.5;
  let shown = ans;
  if (makeFalse) {
    const delta = pick([1, 2, 3, -1, -2, 10, -10]);
    shown = ans + delta === ans ? ans + 1 : ans + delta;
    if (shown < 0) shown = ans + Math.abs(delta);
  }
  return { prompt: `${a} ${op} ${b} = ${shown}`, isTrue: shown === ans };
}

// Trivia facts — `t` is whether the statement is true.
const FACTS: Buzz[] = [
  { prompt: 'A spider has 8 legs.', isTrue: true },
  { prompt: 'An insect has 6 legs.', isTrue: true },
  { prompt: 'A triangle has 4 sides.', isTrue: false },
  { prompt: 'A week has 7 days.', isTrue: true },
  { prompt: 'There are 12 months in a year.', isTrue: true },
  { prompt: 'The sun is a planet.', isTrue: false },
  { prompt: 'The Earth orbits the Sun.', isTrue: true },
  { prompt: 'A baby dog is called a kitten.', isTrue: false },
  { prompt: 'A baby cat is called a kitten.', isTrue: true },
  { prompt: 'Penguins can fly.', isTrue: false },
  { prompt: 'Bats are the only mammals that can truly fly.', isTrue: true },
  { prompt: 'A spider is an insect.', isTrue: false },
  { prompt: 'Water freezes at 0°C.', isTrue: true },
  { prompt: 'Water boils at 50°C.', isTrue: false },
  { prompt: 'A rainbow has 7 colours.', isTrue: true },
  { prompt: 'Honey is made by ants.', isTrue: false },
  { prompt: 'A cow says "moo".', isTrue: true },
  { prompt: 'Sharks are fish.', isTrue: true },
  { prompt: 'A dolphin is a fish.', isTrue: false },
  { prompt: 'The capital of France is Paris.', isTrue: true },
  { prompt: 'The capital of England is Manchester.', isTrue: false },
  { prompt: 'There are 5 continents.', isTrue: false },
  { prompt: 'An octopus has 8 arms.', isTrue: true },
  { prompt: 'A square has 4 equal sides.', isTrue: true },
  { prompt: 'Plants make food using sunlight.', isTrue: true },
  { prompt: 'The moon makes its own light.', isTrue: false },
  { prompt: 'A leap year has 366 days.', isTrue: true },
  { prompt: 'Tomatoes are a type of meat.', isTrue: false },
  { prompt: 'A heptagon has 7 sides.', isTrue: true },
  { prompt: 'Ice is frozen water.', isTrue: true },
  { prompt: 'The largest planet is Jupiter.', isTrue: true },
  { prompt: 'Humans breathe in oxygen.', isTrue: true },
  { prompt: 'A snail moves faster than a cheetah.', isTrue: false },
  { prompt: 'A century is 100 years.', isTrue: true },
  { prompt: 'There are 60 seconds in a minute.', isTrue: true },
  { prompt: 'There are 100 minutes in an hour.', isTrue: false },
  { prompt: 'A frog is an amphibian.', isTrue: true },
  { prompt: 'Bananas grow on trees... actually on giant herb plants.', isTrue: true },
  { prompt: 'The fastest land animal is the cheetah.', isTrue: true },
  { prompt: 'A dozen means 13.', isTrue: false },
  { prompt: 'Half of 50 is 20.', isTrue: false },
  { prompt: 'A pentagon has 5 sides.', isTrue: true },
  { prompt: 'Spiders spin webs.', isTrue: true },
  { prompt: 'The Pacific is the largest ocean.', isTrue: true },
  { prompt: 'A baby sheep is called a calf.', isTrue: false },
  { prompt: 'Zero is an even number.', isTrue: true },
  { prompt: 'A kilometre is shorter than a metre.', isTrue: false },
  { prompt: 'Owls are awake mostly at night.', isTrue: true },
  { prompt: 'A decade is 100 years.', isTrue: false },
];

export function makeBuzzerRounds(difficulty: string, n: number): Buzz[] {
  // Roughly half maths, half facts; harder tiers lean more on maths.
  const mathChance = difficulty === 'easy' ? 0.4 : difficulty === 'master' ? 0.6 : 0.5;
  const facts = [...FACTS].sort(() => Math.random() - 0.5);
  const rounds: Buzz[] = [];
  const seen = new Set<string>();
  let fi = 0;
  let guard = 0;
  while (rounds.length < n && guard < n * 30) {
    guard++;
    let b: Buzz;
    if (Math.random() < mathChance || fi >= facts.length) b = mathBuzz(difficulty);
    else b = facts[fi++];
    if (seen.has(b.prompt)) continue;
    seen.add(b.prompt);
    rounds.push(b);
  }
  return rounds;
}
