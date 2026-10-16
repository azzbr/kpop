// Picture Telephone rules (pure). Every player starts a "book" — a word card, or a start they
// write themselves — and the books travel round the room one seat per step:
// draw → guess → draw → guess … The chain always ends on a guess. Then the host turns the
// pages of every book for everyone, and the room votes for the 😂 funniest moment and the
// 🎨 best drawing (never your own).

export const DRAW_MS = 60_000;
export const WRITE_MS = 25_000;
export const START_MS = 30_000;
export const VOTE_MS = 45_000;
/** After the timer: devices that haven't sent their page yet send what they have. */
export const GRACE_MS = 2500;
export const AWARDS_MS = 25_000;
export const AUTO_PAGE_MS = 2200;
export const MAX_STEPS = 9;
export const MAX_WRITE = 32;

export type StartMode = 'cards' | 'write';
export type StepMode = 'draw' | 'write';
/** A drawing's `content` is a picture id ('' = left blank); a written page's is its text. */
export interface Entry { kind: StepMode; by: string; content: string }
/** `seed` is the word card (in 'write' mode it's only used if the start is missing). */
export interface Book { owner: string; seed: string; entries: Entry[] }

export const startMode = (v: unknown): StartMode => (v === 'write' ? 'write' : 'cards');

/**
 * Number of steps. One per player at most (so nobody sees a book twice), up to MAX_STEPS, and
 * the chain must end on a guess: 'cards' starts with a drawing (even count), 'write' starts
 * with writing (odd count). Tiny rooms still get a minimal chain.
 */
export function stepsFor(players: number, start: StartMode = 'cards'): number {
  const odd = start === 'write';
  let n = Math.min(Math.max(1, players), MAX_STEPS);
  if ((n % 2 === 1) !== odd) n--;
  return Math.max(odd ? 3 : 2, n);
}

/** 'cards': draw the card, guess, draw … · 'write': write a start, draw it, guess … */
export const stepMode = (step: number, start: StartMode = 'cards'): StepMode =>
  (step % 2 === 0) === (start === 'cards') ? 'draw' : 'write';

export const stepMs = (step: number, start: StartMode = 'cards') =>
  start === 'write' && step === 0 ? START_MS : stepMode(step, start) === 'draw' ? DRAW_MS : WRITE_MS;

/** Which book player number `pi` works on at `step` (books move one seat each step). */
export const bookOf = (pi: number, step: number, players: number) => (((pi - step) % players) + players) % players;

/** The picture id for a player's drawing at a step. */
export const picId = (step: number, by: string) => `pt${step}.${by}`;

/** What a player sees for a step: the card, nothing (write your own start), or the previous page. */
export function taskPayload(books: Book[], pi: number, step: number, start: StartMode = 'cards'): string {
  const b = books[bookOf(pi, step, books.length)];
  if (step === 0) return start === 'cards' ? b.seed : '';
  return b.entries[step - 1]?.content ?? '';
}

/** Tidy typed text: single spaces, trimmed, at most MAX_WRITE characters. */
export const tidyText = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, MAX_WRITE);

/**
 * Files everyone's work for a step. Missing drawings stay blank, missing guesses become
 * "???", and a missing (or unkind) start falls back to the book's word card.
 */
export function fileStep(books: Book[], order: string[], step: number, submitted: Record<string, string>, start: StartMode = 'cards'): Book[] {
  const mode = stepMode(step, start);
  const next = books.map(b => ({ ...b, entries: [...b.entries] }));
  order.forEach((pid, pi) => {
    const b = next[bookOf(pi, step, order.length)];
    const got = submitted[pid];
    const content = got !== undefined && got !== '' ? got : mode === 'draw' ? '' : step === 0 ? b.seed : '???';
    b.entries[step] = { kind: mode, by: pid, content };
  });
  return next;
}

// ---- Reveal ----

export interface Page { kind: 'seed' | 'start' | StepMode; by?: string; content: string; key: string }

/** The pages of a book in order: the card (cards mode) or the written start, then every step. */
export function bookPages(b: Book, bookIndex: number, start: StartMode = 'cards'): Page[] {
  const pages: Page[] = start === 'cards' ? [{ kind: 'seed', content: b.seed, key: `${bookIndex}:card` }] : [];
  b.entries.forEach((e, step) => {
    if (!e) return;
    pages.push({ kind: start === 'write' && step === 0 ? 'start' : e.kind, by: e.by, content: e.content, key: `${bookIndex}:${step}` });
  });
  return pages;
}

export interface RevealPos { book: number; page: number }

/** ▶ / ◀ through the pages, book after book. 'end' = past the last page of the last book. */
export function stepReveal(pos: RevealPos, pageCounts: number[], dir: 1 | -1): RevealPos | 'end' {
  const { book, page } = pos;
  if (dir === 1) {
    if (page < (pageCounts[book] ?? 0) - 1) return { book, page: page + 1 };
    if (book < pageCounts.length - 1) return { book: book + 1, page: 0 };
    return 'end';
  }
  if (page > 0) return { book, page: page - 1 };
  if (book > 0) return { book: book - 1, page: Math.max(0, (pageCounts[book - 1] ?? 1) - 1) };
  return pos;
}

// ---- Votes ----

export type VoteKind = 'fun' | 'art';
export interface Votes { fun: Record<string, string>; art: Record<string, string> }

/** Can `voter` vote for this page? Never your own; 🎨 only drawings; nothing blank or "???". */
export function canVote(page: Page | undefined, voter: string, kind: VoteKind): boolean {
  if (!page || !page.by || page.by === voter) return false;
  if (page.kind === 'seed') return false;
  if (kind === 'art') return page.kind === 'draw' && page.content !== '';
  return page.content !== '' && page.content !== '???';
}

export const findPage = (all: Page[][], key: string): Page | undefined => {
  const b = Number(key.split(':')[0]);
  return all[b]?.find(p => p.key === key);
};

/** Has this voter anything left to vote for? (A tiny room may have no drawings by others.) */
export const hasChoice = (all: Page[][], voter: string, kind: VoteKind) => all.some(ps => ps.some(p => canVote(p, voter, kind)));

/** Done voting: voted (or nothing to vote for) in both categories. */
export const doneVoting = (all: Page[][], votes: Votes, voter: string) =>
  (['fun', 'art'] as VoteKind[]).every(k => votes[k][voter] !== undefined || !hasChoice(all, voter, k));

export interface Awards {
  /** One point for every vote a player's pages received. */
  points: Record<string, number>;
  /** Winning page keys (ties share), with their vote counts. */
  fun: { key: string; votes: number }[];
  art: { key: string; votes: number }[];
}

export function tallyAwards(all: Page[][], votes: Votes, ids: string[]): Awards {
  const points: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));
  const winners = (kind: VoteKind) => {
    const counts = new Map<string, number>();
    for (const [voter, key] of Object.entries(votes[kind])) {
      const p = findPage(all, key);
      if (!canVote(p, voter, kind) || !p?.by) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      points[p.by] = (points[p.by] ?? 0) + 1;
    }
    const best = Math.max(0, ...counts.values());
    return best === 0 ? [] : [...counts].filter(([, n]) => n === best).map(([key, n]) => ({ key, votes: n }));
  };
  return { fun: winners('fun'), art: winners('art'), points };
}

// ---- Saving a book as one picture ----

export interface Rect { x: number; y: number; w: number; h: number }

/** Grid cells for `n` pages on a W×H sheet under a `header` strip (2 columns up to 4 pages, then 3). */
export function sheetLayout(n: number, W = 1200, H = 900, header = 90): Rect[] {
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(n / cols));
  const w = W / cols;
  const h = (H - header) / rows;
  return Array.from({ length: n }, (_, i) => ({ x: (i % cols) * w, y: header + Math.floor(i / cols) * h, w, h }));
}
