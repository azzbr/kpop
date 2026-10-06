// Word Chain dictionary: every word list the site already has, combined — the Word Guess lists
// (ALLOWED_5 + ANSWERS_5), Word Ladder's 3–4 letter words, single-word Doodle Dash words and
// single-word Heads Up cards. Words not in here aren't wrong: the other players vote on them.
// Rude words (the big 5-letter list has some) are removed. Only the lazy Word Chain chunk imports this.
import { ALLOWED_5 } from '../data/words5Allowed';
import { ANSWERS_5, BLOCKLIST } from '../data/words5Answers';
import { VALID_WORDS } from '../data/wordLadder';
import { DOODLE_WORDS } from './doodleWords';
import { HEADS_UP_CATEGORIES } from '../data/headsUpCards';
import { isRude } from './rudeWords';

const blocked = new Set(BLOCKLIST);
const ok = (w: string) => /^[a-z]{3,}$/.test(w) && !blocked.has(w) && !isRude(w);

function build(): Set<string> {
  const all = [
    ...ALLOWED_5.split('\n'),
    ...ANSWERS_5,
    ...VALID_WORDS,
    ...DOODLE_WORDS,
    ...HEADS_UP_CATEGORIES.flatMap(c => c.cards),
  ].map(w => w.trim().toLowerCase());
  return new Set(all.filter(ok));
}

export const CHAIN_WORDS: ReadonlySet<string> = build();

/** Friendly first words: common 5-letter words that don't end in a hard letter. */
export const START_WORDS: string[] = ANSWERS_5.filter(w => ok(w) && !/[jqxzy]$/.test(w));
