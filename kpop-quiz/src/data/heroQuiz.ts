// "Which Arcade Hero Are You?" (screen id idol_personality_quiz).
// Four original heroes; every answer gives one point to exactly one hero.
// A tie after the main questions is settled by a tie-break question that only shows the tied heroes.

export type HeroId = 'speedster' | 'puzzler' | 'party' | 'inventor';

export interface Hero {
  id: HeroId;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  strengths: string[];
  power: string;
  /** Tailwind gradient classes for the result card. */
  grad: string;
  /** Tailwind class for the score bar. */
  bar: string;
}

export const HEROES: Hero[] = [
  {
    id: 'speedster', name: 'The Speedster', emoji: '⚡',
    tagline: 'Fast feet, bright spark, first to say “Let’s go!”',
    description: 'You love action and you are always ready for the next adventure. Your energy gets everyone moving, and you never give up on a challenge.',
    strengths: ['Brave', 'Energetic', 'Quick'],
    power: 'Super Speed: you can finish a race before it even starts!',
    grad: 'from-amber-400 to-orange-600', bar: 'bg-amber-400',
  },
  {
    id: 'puzzler', name: 'The Puzzler', emoji: '🧩',
    tagline: 'Sharp eyes, clever brain, always one step ahead.',
    description: 'You notice the little things other people miss. Riddles, codes and tricky puzzles are your kind of fun, and you always find a clever way through.',
    strengths: ['Clever', 'Patient', 'Curious'],
    power: 'Mind Map: you can see the path to the answer glowing.',
    grad: 'from-sky-400 to-indigo-600', bar: 'bg-sky-400',
  },
  {
    id: 'party', name: 'The Party Star', emoji: '🎉',
    tagline: 'Big laugh, kind heart, nobody gets left out.',
    description: 'You make everyone feel welcome. You bring the jokes, the games and the good mood, and when you are around nobody gets left out.',
    strengths: ['Kind', 'Funny', 'Team player'],
    power: 'Mega Cheer: your laugh gives everyone an energy boost.',
    grad: 'from-pink-400 to-fuchsia-600', bar: 'bg-pink-400',
  },
  {
    id: 'inventor', name: 'The Inventor', emoji: '🔧',
    tagline: 'Big ideas, busy hands, never stops making.',
    description: 'You love making things: drawings, gadgets, stories and brand-new ideas. When something breaks, you do not give up. You build something even better.',
    strengths: ['Creative', 'Inventive', 'Determined'],
    power: 'Build Anything: you can turn a cardboard box into a rocket.',
    grad: 'from-emerald-400 to-teal-600', bar: 'bg-emerald-400',
  },
];

export interface HeroAnswer { text: string; hero: HeroId }
export interface HeroQuestion { id: string; emoji: string; text: string; answers: HeroAnswer[] }

export const HERO_QUESTIONS: HeroQuestion[] = [
  {
    id: 'q1', emoji: '🎒', text: 'It’s a free afternoon! What do you do first?',
    answers: [
      { text: 'Race my friends to the park', hero: 'speedster' },
      { text: 'Build a den out of blankets', hero: 'inventor' },
      { text: 'Invite everyone over for games', hero: 'party' },
      { text: 'Try a new puzzle book', hero: 'puzzler' },
    ],
  },
  {
    id: 'q2', emoji: '🕹️', text: 'Pick a game to play right now!',
    answers: [
      { text: 'A brain game like Word Guess', hero: 'puzzler' },
      { text: 'A fast game like Snake Arena', hero: 'speedster' },
      { text: 'Making beats in Beat Maker', hero: 'inventor' },
      { text: 'A party game with friends', hero: 'party' },
    ],
  },
  {
    id: 'q3', emoji: '🦸', text: 'Choose a superpower!',
    answers: [
      { text: 'Making anyone laugh', hero: 'party' },
      { text: 'Building anything from junk', hero: 'inventor' },
      { text: 'Running faster than a cheetah', hero: 'speedster' },
      { text: 'Reading any secret code', hero: 'puzzler' },
    ],
  },
  {
    id: 'q4', emoji: '🏕️', text: 'Your class goes camping. Your job is…',
    answers: [
      { text: 'Putting up the tents', hero: 'inventor' },
      { text: 'Reading the map', hero: 'puzzler' },
      { text: 'Leading the campfire songs', hero: 'party' },
      { text: 'Exploring the trail first', hero: 'speedster' },
    ],
  },
  {
    id: 'q5', emoji: '🤝', text: 'A friend is having a bad day. You…',
    answers: [
      { text: 'Take them for a bike ride', hero: 'speedster' },
      { text: 'Tell them your best joke', hero: 'party' },
      { text: 'Help them work out a plan', hero: 'puzzler' },
      { text: 'Make them a card or a little gift', hero: 'inventor' },
    ],
  },
  {
    id: 'q6', emoji: '🐾', text: 'Pick a pet sidekick!',
    answers: [
      { text: 'A wise owl', hero: 'puzzler' },
      { text: 'A playful puppy', hero: 'party' },
      { text: 'A clever robot dog', hero: 'inventor' },
      { text: 'A speedy cheetah', hero: 'speedster' },
    ],
  },
  {
    id: 'q7', emoji: '🏆', text: 'What would you love to win a prize for?',
    answers: [
      { text: 'The coolest invention', hero: 'inventor' },
      { text: 'The fastest race time', hero: 'speedster' },
      { text: 'The best team spirit', hero: 'party' },
      { text: 'The top quiz score', hero: 'puzzler' },
    ],
  },
  {
    id: 'q8', emoji: '🌧️', text: 'It’s raining all weekend. You…',
    answers: [
      { text: 'Have a family movie night', hero: 'party' },
      { text: 'Do a giant jigsaw puzzle', hero: 'puzzler' },
      { text: 'Dance around the living room', hero: 'speedster' },
      { text: 'Make a marble run', hero: 'inventor' },
    ],
  },
  {
    id: 'q9', emoji: '🚀', text: 'You’re on a space mission. Which job?',
    answers: [
      { text: 'Pilot: full speed ahead!', hero: 'speedster' },
      { text: 'Engineer: fixing the rocket', hero: 'inventor' },
      { text: 'Navigator: finding the way', hero: 'puzzler' },
      { text: 'Crew captain: keeping everyone happy', hero: 'party' },
    ],
  },
  {
    id: 'q10', emoji: '💬', text: 'Which sounds most like you?',
    answers: [
      { text: '“Hmm… I’ve got it!”', hero: 'puzzler' },
      { text: '“Yay! Everyone come too!”', hero: 'party' },
      { text: '“Ooh, let’s build it!”', hero: 'inventor' },
      { text: '“Zoom! Let’s go!”', hero: 'speedster' },
    ],
  },
];

/** Shown only when two or more heroes tie; only the tied heroes' answers appear. */
export const TIE_BREAK: HeroQuestion = {
  id: 'tie', emoji: '🎲', text: 'It’s a tie! Pick what feels most like you today:',
  answers: [
    { text: 'I want to go fast!', hero: 'speedster' },
    { text: 'I want to figure something out', hero: 'puzzler' },
    { text: 'I want to be with my friends', hero: 'party' },
    { text: 'I want to make something new', hero: 'inventor' },
  ],
};

export type HeroScores = Record<HeroId, number>;

export const emptyScores = (): HeroScores => ({ speedster: 0, puzzler: 0, party: 0, inventor: 0 });

export function addAnswer(scores: HeroScores, hero: HeroId): HeroScores {
  return { ...scores, [hero]: scores[hero] + 1 };
}

/** Heroes with the highest score, in HEROES order (more than one = a tie). */
export function leaders(scores: HeroScores): HeroId[] {
  const max = Math.max(...HEROES.map(h => scores[h.id]));
  return HEROES.filter(h => scores[h.id] === max).map(h => h.id);
}

/** The tie-break answers for a set of tied heroes. */
export function tieBreakAnswers(tied: HeroId[]): HeroAnswer[] {
  return TIE_BREAK.answers.filter(a => tied.includes(a.hero));
}

/** Runner-up hero (closest second place), or null when the winner is far ahead. */
export function sidekick(scores: HeroScores, winner: HeroId): HeroId | null {
  const others = HEROES.filter(h => h.id !== winner).sort((a, b) => scores[b.id] - scores[a.id]);
  const best = others[0];
  return best && scores[best.id] > 0 && scores[winner] - scores[best.id] <= 2 ? best.id : null;
}

export const heroById = (id: HeroId): Hero => HEROES.find(h => h.id === id)!;
