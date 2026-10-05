// Picture Telephone rules (pure). Each player's secret word travels round the room as a
// "book": draw → guess → draw … then every book is revealed.

export const DRAW_MS = 50000;
export const WRITE_MS = 25000;
export const MAX_STEPS = 8;
export const REVEAL_STEP_MS = 1500;
export const MAX_WRITE = 24;

export type StepMode = 'draw' | 'write';
export interface Entry { kind: StepMode; by: string; content: string }
export interface Book { owner: string; seed: string; entries: Entry[] }

/** Number of steps: one per player (so nobody gets their own book back), max 8. */
export const stepsFor = (players: number) => Math.min(MAX_STEPS, players);

/** Step 0 draws the secret word, then guess, draw, guess… */
export const stepMode = (step: number): StepMode => (step % 2 === 0 ? 'draw' : 'write');

export const stepMs = (step: number) => (stepMode(step) === 'draw' ? DRAW_MS : WRITE_MS);

/** Which book player number `pi` works on at `step` (books move one seat each step). */
export const bookOf = (pi: number, step: number, players: number) => (((pi - step) % players) + players) % players;

/** What a player sees for a step: the secret word, or the previous entry of that book. */
export function taskPayload(books: Book[], pi: number, step: number): string {
  const b = books[bookOf(pi, step, books.length)];
  return step === 0 ? b.seed : b.entries[step - 1]?.content ?? '';
}

/** Files everyone's work for a step; missing work becomes a blank drawing / "???". */
export function fileStep(books: Book[], order: string[], step: number, submitted: Record<string, string>): Book[] {
  const mode = stepMode(step);
  const next = books.map(b => ({ ...b, entries: [...b.entries] }));
  order.forEach((pid, pi) => {
    const content = submitted[pid] ?? (mode === 'draw' ? '' : '???');
    next[bookOf(pi, step, order.length)].entries[step] = { kind: mode, by: pid, content };
  });
  return next;
}

/** How long a book stays on screen during the reveal. */
export const bookDwellMs = (b: Book) => 3200 + b.entries.length * REVEAL_STEP_MS;

/** How many reveal items (seed + entries) are showing `elapsed` ms into a book. */
export const revealCountAt = (elapsed: number, entries: number) =>
  Math.min(entries + 1, 1 + Math.floor(Math.max(0, elapsed) / REVEAL_STEP_MS));

/** It's a team game: everyone shares first place. */
export const coopRanking = (ids: string[]): string[][] => [[...ids]];
