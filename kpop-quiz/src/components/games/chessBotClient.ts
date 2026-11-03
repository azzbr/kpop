/**
 * Asks a Chess Academy bot for its move without freezing the board: `chooseMove` runs in one
 * reused Web Worker (chessBot.worker.ts). If Workers are missing or fail (old browser, a worker
 * file gone after a deploy, no reply), the move is worked out on the main thread instead, after a
 * short timeout so "Fox is thinking…" can paint first. The promise never rejects.
 */
import { Chess } from 'chess.js';
import { createRng } from '../../games/engine/rng';
import { chooseMove, DEFAULT_TIME_MS } from './chessBot';
import type { BotId, ChooseOptions } from './chessBot';

export interface AskOptions extends Pick<ChooseOptions, 'timeMs' | 'seen'> {
  /** Same seed ⇒ same move (for ?seed= debug runs). Random when left out. */
  seed?: number;
}

export interface BotRequest {
  id: number;
  fen: string;
  bot: BotId;
  seed: number;
  timeMs?: number;
  /** Earlier positions of the game (see `ChooseOptions.seen`). */
  seen?: string[];
}

export interface BotReply {
  id: number;
  /** UCI move, or '' if the worker could not find one. */
  uci: string;
}

/** Longest wait for the worker before thinking on the main thread (Hoot stops at 1.5 s). */
const WATCHDOG_EXTRA_MS = 5000;
/** Main-thread fallback: let the UI paint first, and keep Hoot's freeze short. */
const MAIN_THREAD_DELAY_MS = 30;
const MAIN_THREAD_MAX_MS = 1000;

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const waiting = new Map<number, (uci: string) => void>();

/** Stop using the worker for this visit; everyone waiting falls back to the main thread. */
function breakWorker() {
  workerBroken = true;
  const w = worker;
  worker = null;
  try {
    w?.terminate();
  } catch {
    // already gone
  }
  const all = [...waiting.values()];
  waiting.clear();
  all.forEach(done => done(''));
}

function getWorker(): Worker | null {
  if (worker || workerBroken) return worker;
  if (typeof Worker === 'undefined') {
    workerBroken = true;
    return null;
  }
  try {
    const w = new Worker(new URL('./chessBot.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<BotReply>) => {
      const id = e.data?.id;
      const done = waiting.get(id);
      if (!done) return; // a late reply after the watchdog gave up
      waiting.delete(id);
      done(typeof e.data.uci === 'string' ? e.data.uci : '');
    };
    w.onerror = e => {
      e.preventDefault();
      breakWorker();
    };
    w.onmessageerror = () => breakWorker();
    worker = w;
  } catch {
    workerBroken = true;
  }
  return worker;
}

/** Is `uci` a legal move in `fen` (promotion letter included when, and only when, it promotes)? */
export function isLegalUci(fen: string, uci: string): boolean {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return false;
  try {
    const m = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return m.lan === uci;
  } catch {
    return false;
  }
}

/** Any legal move ('' if there are none), for when everything else has gone wrong. */
function anyLegalMove(fen: string): string {
  try {
    return new Chess(fen).moves({ verbose: true })[0]?.lan ?? '';
  } catch {
    return '';
  }
}

function thinkHere(fen: string, bot: BotId, seed: number, opts: AskOptions): string {
  try {
    const timeMs = Math.min(opts.timeMs ?? MAIN_THREAD_MAX_MS, MAIN_THREAD_MAX_MS);
    const uci = chooseMove(fen, bot, createRng(seed), { timeMs, seen: opts.seen });
    if (isLegalUci(fen, uci)) return uci;
  } catch {
    // fall through to any legal move
  }
  return anyLegalMove(fen);
}

/**
 * The bot's move in UCI ("e2e4", "e7e8q"). Always resolves — with a legal move, or '' when the
 * position has none (game over) or the FEN is broken. Pass `seed` for a repeatable game (?seed=42)
 * and `seen` (the game's earlier FENs) so a bot that is ahead doesn't repeat moves.
 * If the position may change while the bot thinks (new game, undo), ignore stale answers by
 * comparing the FEN you asked about with the current one.
 */
export function askBot(fen: string, bot: BotId, opts: AskOptions = {}): Promise<string> {
  const seed = opts.seed ?? Math.floor(Math.random() * 0x1_0000_0000);
  return new Promise<string>(resolve => {
    const onMainThread = () => setTimeout(() => resolve(thinkHere(fen, bot, seed, opts)), MAIN_THREAD_DELAY_MS);
    const w = getWorker();
    if (!w) {
      onMainThread();
      return;
    }
    const id = nextId++;
    const watchdog = setTimeout(() => {
      // No answer at all: stop trusting the worker for this visit (this also answers the others waiting).
      waiting.delete(id);
      breakWorker();
      onMainThread();
    }, (opts.timeMs ?? DEFAULT_TIME_MS) + WATCHDOG_EXTRA_MS);
    waiting.set(id, uci => {
      clearTimeout(watchdog);
      if (isLegalUci(fen, uci)) resolve(uci);
      else onMainThread();
    });
    try {
      const msg: BotRequest = { id, fen, bot, seed, timeMs: opts.timeMs, seen: opts.seen };
      w.postMessage(msg);
    } catch {
      waiting.delete(id);
      clearTimeout(watchdog);
      onMainThread();
    }
  });
}
