import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { createRng } from '../../games/engine/rng';
import { BOTS, BOT_IDS, botLine, chooseMove, hasFastPath, hintMove } from './chessBot';
import type { BotId } from './chessBot';
import { askBot, isLegalUci } from './chessBotClient';

/** Plays a UCI move; throws if it isn't legal. */
function play(fen: string, uci: string): Chess {
  const c = new Chess(fen);
  const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  expect(m.lan).toBe(uci);
  return c;
}

const MATE_IN_ONE = [
  '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', // back rank: Ra8#
  'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', // Qxf7#
  'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2', // Black: Qh4#
  '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', // smothered: Nf7#
  '7k/4P3/6K1/8/8/8/8/8 w - - 0 1', // promote with mate
  '6k1/5ppp/8/8/8/8/r4PPP/6K1 b - - 0 1', // Black: Ra1#
];

/** Positions where a queen hangs to a knight: [fen, the capture]. */
const FREE_QUEEN: [string, string][] = [
  ['rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3h4'],
  ['rnbqkb1r/pppppppp/5n2/8/4Q3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 1', 'f6e4'],
  ['4k3/8/8/8/3q4/5N2/8/4K3 w - - 0 1', 'f3d4'],
];

const MIDDLEGAMES = [
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  'r1b1kb1r/pp1n1ppp/1qn1p3/3pP3/3P4/2PB1N2/PP3PPP/RNBQK2R w KQkq - 0 8',
  '2rq1rk1/pp1bppbp/2np1np1/8/3NP3/1BN1BP2/PPPQ2PP/2KR3R b - - 0 11',
];

const isMate = (fen: string, uci: string) => play(fen, uci).isCheckmate();
const hasMateInOne = (fen: string) => new Chess(fen).moves({ verbose: true }).some(m => isMate(fen, m.lan));

/** ~50 positions from seeded random games (some captures, checks, promotions and castling on the way). */
function randomPositions(count: number): string[] {
  const rng = createRng(2026);
  const out: string[] = [];
  while (out.length < count) {
    const c = new Chess();
    const plies = 6 + Math.floor(rng() * 70);
    for (let i = 0; i < plies && !c.isGameOver(); i++) {
      const moves = c.moves();
      c.move(moves[Math.floor(rng() * moves.length)]);
    }
    if (!c.isGameOver()) out.push(c.fen());
  }
  return out;
}

const SPECIAL = [
  'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', // en passant
  'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 8', // castling both ways
  '1r5k/P7/8/8/8/8/6PP/6K1 w - - 0 1', // promote, or capture-promote
  'rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3', // checkmated: no move
  '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', // stalemate: no move
  'rnbqkbnr/ppppp1pp/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2', // in check: only ...g6
];

describe('chess bots', () => {
  it('can use the fast chess.js internals (fails if a chess.js upgrade renames them)', () => {
    expect(hasFastPath()).toBe(true);
  });

  it('every bot has a name, an emoji and kind lines of every kind', () => {
    expect(new Set(BOT_IDS.map(id => BOTS[id].emoji)).size).toBe(3);
    for (const id of BOT_IDS) {
      const { name, blurb, lines } = BOTS[id];
      expect(name.length).toBeGreaterThan(0);
      expect(blurb.length).toBeGreaterThan(0);
      for (const kind of ['greet', 'goodMove', 'win', 'lose', 'draw'] as const) {
        expect(lines[kind].length).toBeGreaterThan(0);
        for (const line of lines[kind]) expect(line.length).toBeLessThanOrEqual(64);
        expect(lines[kind]).toContain(botLine(id, kind, createRng(1)));
      }
    }
  });

  it('Fox, Hoot and the hint always find a mate in one', () => {
    const mates = MATE_IN_ONE.filter(hasMateInOne);
    expect(mates.length).toBeGreaterThanOrEqual(5);
    for (const fen of mates) {
      expect(isMate(fen, hintMove(fen)), `hint ${fen}`).toBe(true);
      for (const bot of ['fox', 'hoot'] as const) {
        for (let seed = 1; seed <= 4; seed++) {
          expect(isMate(fen, chooseMove(fen, bot, createRng(seed))), `${bot} ${fen}`).toBe(true);
        }
      }
    }
  });

  it('Fox, Hoot and the hint take a free queen', () => {
    for (const [fen, take] of FREE_QUEEN) {
      expect(hintMove(fen)).toBe(take);
      for (const bot of ['fox', 'hoot'] as const) {
        for (let seed = 1; seed <= 4; seed++) expect(chooseMove(fen, bot, createRng(seed)), `${bot} ${fen}`).toBe(take);
      }
    }
  });

  it('Biscuit usually takes a free queen, but not always', () => {
    for (const [fen, take] of FREE_QUEEN) {
      let took = 0;
      for (let seed = 1; seed <= 60; seed++) if (chooseMove(fen, 'biscuit', createRng(seed)) === take) took++;
      expect(took, fen).toBeGreaterThan(30);
      expect(took, fen).toBeLessThan(60);
    }
  });

  it("Biscuit's mistakes never simply give away its queen", () => {
    // Qf6 / Qf4 / Qa3 / Qxf7+ lose the queen to a pawn, knight, bishop or king.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR w KQkq - 2 3';
    const played = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) played.add(chooseMove(fen, 'biscuit', createRng(seed)));
    expect(played.size).toBeGreaterThan(5); // it does make random moves…
    for (const bad of ['f3f6', 'f3f4', 'f3a3', 'f3f7']) expect(played.has(bad), bad).toBe(false); // …but not these
  });

  it('every bot only ever plays legal moves', () => {
    const fens = [...randomPositions(50), ...SPECIAL];
    for (const fen of fens) {
      const legal = new Chess(fen).moves({ verbose: true }).map(m => m.lan);
      for (const bot of BOT_IDS) {
        const uci = chooseMove(fen, bot, createRng(fen.length), { timeMs: bot === 'hoot' ? 50 : undefined });
        if (legal.length === 0) expect(uci).toBe('');
        else expect(legal, `${bot} ${fen}`).toContain(uci);
      }
      const hint = hintMove(fen);
      if (legal.length === 0) expect(hint).toBe('');
      else expect(legal).toContain(hint);
    }
  }, 60_000);

  it('answers "" for a broken FEN instead of throwing', () => {
    expect(chooseMove('not a fen', 'fox', createRng(1))).toBe('');
    expect(hintMove('8/8/8/8/8/8/8/8 w - - 0 1')).toBe('');
  });

  it('Hoot stops at the time cap', () => {
    for (const [i, fen] of MIDDLEGAMES.entries()) {
      let t = performance.now();
      if (i < 2) {
        expect(isLegalUci(fen, chooseMove(fen, 'hoot', createRng(1)))).toBe(true);
        expect(performance.now() - t).toBeLessThan(2000);
      }
      t = performance.now();
      expect(isLegalUci(fen, chooseMove(fen, 'hoot', createRng(1), { timeMs: 100 }))).toBe(true);
      expect(performance.now() - t).toBeLessThan(400);
    }
  }, 60_000);

  it('the same seed gives the same move', () => {
    const fens = [new Chess().fen(), MIDDLEGAMES[3], FREE_QUEEN[0][0]];
    for (const fen of fens) {
      for (const bot of BOT_IDS) {
        const timeMs = 60_000; // never reached: the search always finishes, so timing can't change the answer
        const a = chooseMove(fen, bot, createRng(42), { timeMs });
        expect(chooseMove(fen, bot, createRng(42), { timeMs }), `${bot} ${fen}`).toBe(a);
      }
    }
  }, 60_000);

  it('Fox and Hoot vary their moves between games', () => {
    const start = new Chess().fen();
    for (const bot of ['fox', 'hoot'] as BotId[]) {
      const firsts = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) firsts.add(chooseMove(start, bot, createRng(seed)));
      expect(firsts.size, bot).toBeGreaterThan(1);
    }
  }, 60_000);

  it("doesn't go back to an earlier position while ahead", () => {
    // White is well ahead: told where the game has been, Fox picks a move that goes somewhere new.
    const fen = '7k/8/8/7Q/8/8/1r4PP/6K1 w - - 0 1';
    const after = play(fen, chooseMove(fen, 'fox', createRng(1))).fen();
    for (let seed = 1; seed <= 5; seed++) {
      const uci = chooseMove(fen, 'fox', createRng(seed), { seen: [after] });
      expect(play(fen, uci).fen().split(' ')[0]).not.toBe(after.split(' ')[0]);
    }
  });

  it('still plays well with only the public chess.js API (the fallback)', () => {
    for (const fen of MATE_IN_ONE.filter(hasMateInOne)) {
      expect(isMate(fen, chooseMove(fen, 'fox', createRng(1), { publicApiOnly: true }))).toBe(true);
    }
    for (const [fen, take] of FREE_QUEEN) expect(chooseMove(fen, 'hoot', createRng(1), { publicApiOnly: true })).toBe(take);
    for (const fen of [...randomPositions(5), ...SPECIAL]) {
      const legal = new Chess(fen).moves({ verbose: true }).map(m => m.lan);
      const uci = chooseMove(fen, 'biscuit', createRng(3), { publicApiOnly: true });
      if (legal.length) expect(legal).toContain(uci);
      else expect(uci).toBe('');
    }
  }, 60_000);
});

describe('askBot', () => {
  it('works without Web Workers (main-thread fallback) and never rejects', async () => {
    const fen = FREE_QUEEN[0][0];
    expect(await askBot(fen, 'fox', { seed: 1 })).toBe(FREE_QUEEN[0][1]);
    expect(isLegalUci(fen, await askBot(fen, 'biscuit'))).toBe(true);
    expect(await askBot(SPECIAL[3], 'hoot')).toBe(''); // checkmated: nothing to play
    expect(await askBot('garbage', 'fox')).toBe('');
  });

  it('isLegalUci checks the promotion letter too', () => {
    expect(isLegalUci(SPECIAL[2], 'a7a8q')).toBe(true);
    expect(isLegalUci(SPECIAL[2], 'a7a8')).toBe(false);
    expect(isLegalUci(new Chess().fen(), 'e2e4q')).toBe(false);
    expect(isLegalUci(new Chess().fen(), 'e2e5')).toBe(false);
  });
});
