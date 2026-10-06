// An extra filter on top of utils/cleanText for words kids type that everyone else in a Friends
// Arena room will see (Bluff Buster fakes, Category Blitz answers, Word Chain words). The big
// 5-letter Word Guess list contains rude words, so Word Chain also uses this to clean its
// dictionary. Not exhaustive — it catches the obvious ones.
import { isClean } from '../utils/cleanText';

/** Word starts that are never OK (checked against each typed word). */
const ROOTS = [
  'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'porn', 'penis', 'vagin', 'dildo', 'nigg',
  'wank', 'spunk', 'nazi', 'boob', 'rapist', 'pussy', 'semen', 'sperm', 'horny', 'skank',
  'fagg', 'dyke', 'lesbo', 'retard', 'turd', 'piss', 'arse', 'nude', 'nudi', 'bollock', 'bugger',
  'sexy', 'sext',
];

/** Whole words that are never OK. */
const WORDS = new Set([
  'ass', 'asses', 'titty', 'titties', 'dick', 'dicks', 'cock', 'cocks', 'tit', 'tits', 'crap', 'crapy', 'crappy',
  'damn', 'damns', 'hell', 'hells', 'butt', 'butts', 'fart', 'farts', 'farty', 'poo', 'poos', 'poop',
  'poops', 'poopy', 'pee', 'pees', 'wee', 'wees', 'rape', 'raped', 'rapes', 'raper', 'kill', 'kills',
  'killed', 'killer', 'drug', 'drugs', 'coke', 'coked', 'bong', 'bongs', 'opium',
  'booze', 'beer', 'beers', 'vodka', 'drunk', 'pimp', 'pimps', 'hussy', 'bimbo', 'labia', 'vulva',
  'gonad', 'gonads', 'nooky', 'homo', 'homos', 'gook', 'gooks', 'spic', 'spics', 'negro',
  'sex', 'sexes', 'sexed', 'prick', 'pricks', 'bum', 'bums', 'anal', 'anus', 'idiot', 'idiots',
  'moron', 'morons', 'stupid', 'dumb', 'dummy', 'loser', 'losers', 'ugly', 'fatty', 'fat', 'booby',
  'boobies', 'dead', 'death', 'die', 'blood', 'bloody', 'gun', 'guns', 'stab', 'murder', 'nerd', 'freak',
  'smelly', 'stinky', 'weirdo', 'geek', 'jerk', 'jerks', 'twit', 'twat', 'git', 'sod', 'slag',
]);

/** True if any word in the text is rude (or the text fails the shared cleanText check). */
export function isRude(text: string): boolean {
  if (!isClean(text)) return true;
  const words = text.toLowerCase().replace(/[^a-z ]+/g, ' ').split(/\s+/).filter(Boolean);
  const joined = words.join('');
  return words.some(w => WORDS.has(w) || ROOTS.some(r => w.startsWith(r))) || ROOTS.some(r => joined.startsWith(r));
}

/** Kid-safe for showing to the room. */
export const isKidSafe = (text: string) => !isRude(text);
