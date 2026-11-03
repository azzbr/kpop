/**
 * Chess Academy bot worker: gets `{ id, fen, bot, seed, timeMs?, seen? }`, answers `{ id, uci }`
 * ('' if it could not find a move). Started and reused by `askBot` in chessBotClient.ts.
 */
import { createRng } from '../../games/engine/rng';
import { BOT_IDS, chooseMove } from './chessBot';
import type { BotRequest, BotReply } from './chessBotClient';

// The app's TypeScript setup uses the DOM library, so describe the worker scope we need here.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<BotRequest>) => void) | null;
  postMessage(reply: BotReply): void;
};

scope.onmessage = e => {
  const { id, fen, bot, seed, timeMs, seen } = e.data ?? ({} as Partial<BotRequest>);
  let uci = '';
  try {
    uci = chooseMove(String(fen), BOT_IDS.includes(bot) ? bot : 'fox', createRng(Number(seed) || 0), {
      timeMs: typeof timeMs === 'number' ? timeMs : undefined,
      seen: Array.isArray(seen) ? seen.filter(f => typeof f === 'string') : undefined,
    });
  } catch {
    uci = '';
  }
  scope.postMessage({ id, uci });
};
