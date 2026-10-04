// A light filter for text kids type into things other people will see (custom quiz titles,
// questions and answers shown in a Friends Arena room). Not exhaustive — just catches the
// obvious words. Matching is on whole words, case-insensitive.
const BLOCKED = [
  'idiot', 'stupid', 'dumb', 'moron', 'loser', 'ugly', 'fatty', 'hate you',
  'shut up', 'poo', 'poop', 'pee', 'butt', 'fart', 'crap', 'damn', 'hell', 'sexy', 'sex',
  'drunk', 'beer', 'vodka',
];

const RE = new RegExp(`\\b(${BLOCKED.map(w => w.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');

export function isClean(text: string): boolean {
  return !RE.test(text);
}

/** Returns the first blocked word found, for a friendly message. */
export function blockedWord(text: string): string | null {
  return RE.exec(text)?.[1] ?? null;
}
