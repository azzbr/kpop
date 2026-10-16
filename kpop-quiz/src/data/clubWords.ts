// Friends Arena clubs: a code like FOX-RAINBOW-27 and a name made from it ("🦊 Rainbow Foxes").
// Both come from these fixed lists, so nobody can type a rude club name.
import type { Club } from '../store';

export const CLUB_ANIMALS: { code: string; emoji: string; plural: string }[] = [
  { code: 'FOX', emoji: '🦊', plural: 'Foxes' },
  { code: 'OWL', emoji: '🦉', plural: 'Owls' },
  { code: 'PANDA', emoji: '🐼', plural: 'Pandas' },
  { code: 'TIGER', emoji: '🐯', plural: 'Tigers' },
  { code: 'BUNNY', emoji: '🐰', plural: 'Bunnies' },
  { code: 'KOALA', emoji: '🐨', plural: 'Koalas' },
  { code: 'OTTER', emoji: '🦦', plural: 'Otters' },
  { code: 'PENGUIN', emoji: '🐧', plural: 'Penguins' },
  { code: 'DOLPHIN', emoji: '🐬', plural: 'Dolphins' },
  { code: 'LION', emoji: '🦁', plural: 'Lions' },
  { code: 'BEAR', emoji: '🐻', plural: 'Bears' },
  { code: 'FROG', emoji: '🐸', plural: 'Frogs' },
  { code: 'UNICORN', emoji: '🦄', plural: 'Unicorns' },
  { code: 'DRAGON', emoji: '🐲', plural: 'Dragons' },
  { code: 'WHALE', emoji: '🐳', plural: 'Whales' },
  { code: 'PARROT', emoji: '🦜', plural: 'Parrots' },
  { code: 'TURTLE', emoji: '🐢', plural: 'Turtles' },
  { code: 'HEDGEHOG', emoji: '🦔', plural: 'Hedgehogs' },
  { code: 'SLOTH', emoji: '🦥', plural: 'Sloths' },
  { code: 'ZEBRA', emoji: '🦓', plural: 'Zebras' },
  { code: 'GIRAFFE', emoji: '🦒', plural: 'Giraffes' },
  { code: 'MONKEY', emoji: '🐵', plural: 'Monkeys' },
  { code: 'LLAMA', emoji: '🦙', plural: 'Llamas' },
  { code: 'OCTOPUS', emoji: '🐙', plural: 'Octopuses' },
];

export const CLUB_WORDS = [
  'RAINBOW', 'ROCKET', 'COMET', 'THUNDER', 'SUNNY', 'COSMIC', 'SPARKLE', 'TURBO', 'BUBBLE', 'PIXEL',
  'GALAXY', 'JELLY', 'MANGO', 'COCONUT', 'CRYSTAL', 'GOLDEN', 'SILVER', 'NEON', 'LUCKY', 'MIGHTY',
  'HAPPY', 'SPEEDY', 'JAZZY', 'FROSTY', 'BREEZY', 'MAGIC', 'SUPER', 'DISCO', 'CANDY', 'COOKIE',
  'MAPLE', 'OCEAN', 'MOON', 'SOLAR', 'BOUNCY', 'ZIPPY', 'WOBBLY', 'TWINKLE', 'STARRY', 'CHEERY',
];

const title = (w: string) => w[0] + w.slice(1).toLowerCase();

/** The club for a canonical code (ANIMAL-WORD-NN), or null if it isn't one. */
export function clubFromCode(code: string): Club | null {
  const m = /^([A-Z]+)-([A-Z]+)-(\d{2})$/.exec(code);
  if (!m) return null;
  const a = CLUB_ANIMALS.find(x => x.code === m[1]);
  if (!a || !CLUB_WORDS.includes(m[2])) return null;
  return { code, name: `${title(m[2])} ${a.plural}`, emoji: a.emoji };
}

/**
 * Reads a code typed on the on-screen keyboard: case, spaces and dashes don't matter
 * ("fox rainbow 27", "FOXRAINBOW27"). Returns the club, or null.
 */
export function parseClubCode(typed: string): Club | null {
  const s = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]+)(\d{2})$/.exec(s);
  if (!m) return null;
  for (const a of CLUB_ANIMALS) {
    if (!m[1].startsWith(a.code)) continue;
    const w = m[1].slice(a.code.length);
    if (CLUB_WORDS.includes(w)) return clubFromCode(`${a.code}-${w}-${m[2]}`);
  }
  return null;
}

/** A new random club. */
export function makeClub(rand: () => number = Math.random): Club {
  const a = CLUB_ANIMALS[Math.floor(rand() * CLUB_ANIMALS.length)];
  const w = CLUB_WORDS[Math.floor(rand() * CLUB_WORDS.length)];
  const n = 10 + Math.floor(rand() * 90);
  return clubFromCode(`${a.code}-${w}-${n}`)!;
}
