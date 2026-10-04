import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { useSwipeInput } from '../../games/engine/useSwipeInput';
import type { SwipeDir } from '../../games/engine/useSwipeInput';
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';
import ConfettiBurst from '../ConfettiBurst';
import { playClick, playCoin, playPop, playUnlock, playWin } from '../../utils/sounds';
import { newGame, move, isGameOver, tileStyle, SIZE, WIN_VALUE } from './game2048Logic';
import type { Board2048, Tile } from './game2048Logic';

// Board geometry in % of the board: 4 cells of CELL% with GAP% gutters.
const CELL = 22;
const GAP = (100 - SIZE * CELL) / (SIZE + 1);
const STEP = ((CELL + GAP) / CELL) * 100; // translate step, in % of a tile's own size
const SLIDE_MS = 110;

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');

interface Float { id: number; text: string }

export default function Game2048() {
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [board, setBoard] = useState<Board2048 | null>(null);
  const [undo, setUndo] = useState<{ prev: Board2048 | null; used: boolean }>({ prev: null, used: false });
  const [winMoment, setWinMoment] = useState(false);
  const [keepGoing, setKeepGoing] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [over, setOver] = useState({ score: 0, title: '', bestTile: 0, moves: 0 });

  const rngRef = useRef<Rng>(createRng(1));
  const boardRef = useRef<Board2048 | null>(null);
  boardRef.current = board;
  const statusRef = useRef(status);
  statusRef.current = status;
  const blockRef = useRef(false); // true while the "You made 2048!" card is up
  blockRef.current = winMoment;
  const keepRef = useRef(keepGoing);
  keepRef.current = keepGoing;
  const floatId = useRef(0);
  const areaRef = useRef<HTMLDivElement>(null);
  // One move per swipe: once a finger has moved the board, ignore it until it lifts.
  const gesture = useRef<{ down: boolean; used: boolean }>({ down: false, used: false });

  const finish = useCallback((b: Board2048, title: string) => {
    setOver({ score: b.score, title, bestTile: b.best, moves: b.moves });
    setStatus('over');
  }, []);

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) : Math.floor(Math.random() * 1e9);
    rngRef.current = createRng(seed);
    setBoard(newGame(rngRef.current));
    setUndo({ prev: null, used: false });
    setWinMoment(false);
    setKeepGoing(false);
    setFloats([]);
    setRound(r => r + 1);
    setStatus('playing');
  }, []);

  const doMove = useCallback((d: SwipeDir) => {
    const b = boardRef.current;
    if (!b || statusRef.current !== 'playing' || blockRef.current) return;
    const res = move(b, d, rngRef.current);
    if (!res.moved) return;
    boardRef.current = res.board;
    setBoard(res.board);
    setUndo(u => (u.used ? u : { prev: b, used: false }));

    if (res.gained) {
      const id = ++floatId.current;
      setFloats(f => [...f.slice(-3), { id, text: `+${res.gained}` }]);
      setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 700);
      const top = Math.max(...res.mergedValues);
      if (top >= 128) playCoin(); else playPop();
    }

    if (!keepRef.current && res.mergedValues.includes(WIN_VALUE)) {
      playWin();
      setTimeout(() => setWinMoment(true), SLIDE_MS + 150);
      return;
    }
    if (isGameOver(res.board)) {
      setTimeout(() => finish(res.board, 'No more moves!'), 600);
    }
  }, [finish]);

  const onDir = useCallback((d: SwipeDir) => {
    if (gesture.current.down) {
      if (gesture.current.used) return;
      gesture.current.used = true;
    }
    doMove(d);
  }, [doMove]);
  useSwipeInput(areaRef, onDir, 28);

  const doUndo = () => {
    if (!undo.prev || undo.used || status !== 'playing') return;
    playUnlock();
    // Drop the "gone"/animation flags so the restored tiles don't replay a merge.
    const prev: Board2048 = { ...undo.prev, tiles: undo.prev.tiles.filter(t => !t.gone).map(t => ({ ...t, isNew: false, merged: false })) };
    setBoard(prev);
    setUndo({ prev: null, used: true });
  };

  // Debug hook: ?debug&seed=42 → window.__game.move(0..3)
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      get board() { return boardRef.current; },
      get status() { return statusRef.current; },
      start,
      move: (d: SwipeDir) => doMove(d),
    };
    (window as unknown as { __game: typeof api }).__game = api;
    return () => { delete (window as unknown as { __game?: unknown }).__game; };
  }, [start, doMove]);

  const score = board?.score ?? 0;
  const undoReady = !!undo.prev && !undo.used && status === 'playing';

  return (
    <GameShell
      gameId="game_2048"
      title="2048"
      icon="🔢"
      xpScale={150}
      status={status}
      score={over.score}
      round={round}
      overTitle={over.title}
      overStats={[
        { label: 'Biggest tile', value: String(over.bestTile) },
        { label: 'Moves', value: String(over.moves) },
      ]}
      onStart={start}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
      readyContent={
        <ul className="text-left font-nunito text-base text-violet-100 space-y-1">
          <li>👆 <b>Swipe</b> to slide all the tiles (or use the arrow keys).</li>
          <li>➕ Two tiles with the same number join into one: 2 + 2 = 4!</li>
          <li>🎯 Can you make the <b>2048</b> tile?</li>
          <li>↩️ You get <b>one Undo</b> each game.</li>
        </ul>
      }
    >
      <div className="absolute inset-0 game-surface">
      {/* Swipe layer behind everything: the content above is pointer-events-none except the buttons,
          so a swipe can start anywhere — and taps on buttons never reach the swipe handler. */}
      <div
        ref={areaRef}
        className="absolute inset-0"
        onPointerDown={() => { gesture.current = { down: true, used: false }; }}
        onPointerUp={() => { gesture.current = { down: false, used: false }; }}
        onPointerCancel={() => { gesture.current = { down: false, used: false }; }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 pointer-events-none">
        <div className="flex items-stretch gap-3 w-full" style={{ maxWidth: 'min(92vw, calc(100dvh - 260px), 560px)' }}>
          <div className="relative flex-1 rounded-2xl bg-black/35 px-4 py-2">
            <div className="font-nunito text-base text-violet-200">Score</div>
            <div className="font-fredoka text-3xl text-yellow-300 tabular-nums">{score.toLocaleString()}</div>
            <AnimatePresence>
              {floats.map(f => (
                <motion.div key={f.id} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -30 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  className="absolute right-4 top-3 font-fredoka text-2xl text-fuchsia-300 pointer-events-none">{f.text}</motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="rounded-2xl bg-black/35 px-4 py-2">
            <div className="font-nunito text-base text-violet-200">Biggest</div>
            <div className="font-fredoka text-3xl tabular-nums">{board?.best ?? 0}</div>
          </div>
          <button
            onClick={doUndo}
            disabled={!undoReady}
            className={`pointer-events-auto min-w-[88px] min-h-[56px] rounded-2xl font-fredoka text-lg px-3 ${undoReady ? 'bg-sky-500 active:bg-sky-400' : 'bg-white/10 text-white/40'}`}
            aria-label="Undo last move"
          >
            ↩️ {undo.used ? 'Used' : 'Undo'}
          </button>
        </div>

        <div
          className="relative aspect-square w-full rounded-3xl bg-indigo-900/80 border-2 border-fuchsia-400/40 shadow-2xl"
          style={{ maxWidth: 'min(92vw, calc(100dvh - 260px), 560px)', containerType: 'inline-size' }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => (
            <div key={i} className="absolute rounded-xl bg-white/10"
              style={{ width: `${CELL}%`, height: `${CELL}%`, left: `${GAP + (i % SIZE) * (CELL + GAP)}%`, top: `${GAP + Math.floor(i / SIZE) * (CELL + GAP)}%` }} />
          ))}
          {board?.tiles.map(t => <TileView key={t.id} tile={t} />)}
        </div>

        <p className="font-nunito text-base text-violet-200 text-center">Swipe anywhere to slide the tiles</p>
      </div>

        {winMoment && (
          <div className="absolute inset-0 z-10 bg-black/55 flex items-center justify-center p-4">
            <ConfettiBurst count={90} durationMs={3000} />
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-full max-w-sm rounded-3xl bg-indigo-950/95 border-2 border-fuchsia-400/60 p-6 text-center">
              <div className="text-6xl mb-2">🎉</div>
              <h2 className="font-fredoka text-3xl mb-2">You made 2048!</h2>
              <p className="font-nunito text-lg text-violet-200 mb-4">Amazing! Keep going for an even bigger tile?</p>
              <button onClick={() => { playClick(); setKeepGoing(true); setWinMoment(false); if (board && isGameOver(board)) finish(board, 'You made 2048!'); }}
                className="w-full min-h-[56px] rounded-full bg-gradient-to-r from-green-500 to-emerald-500 font-fredoka text-2xl mb-3">
                ▶ Keep going
              </button>
              <button onClick={() => { playClick(); setWinMoment(false); if (board) finish(board, 'You made 2048!'); }}
                className="w-full min-h-[48px] rounded-full bg-white/15 font-fredoka text-lg">
                🏁 Finish here
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

function TileView({ tile }: { tile: Tile }) {
  const { bg, fg } = tileStyle(tile.value);
  const digits = String(tile.value).length;
  const font = digits <= 2 ? 11 : digits === 3 ? 9 : digits === 4 ? 7 : 5.5; // in cqw (board width)
  return (
    <div
      className="absolute"
      style={{
        width: `${CELL}%`,
        height: `${CELL}%`,
        left: `${GAP}%`,
        top: `${GAP}%`,
        transform: `translate(${tile.col * STEP}%, ${tile.row * STEP}%)`,
        transition: `transform ${SLIDE_MS}ms ease-in-out`,
        zIndex: tile.gone ? 1 : 2,
      }}
    >
      <motion.div
        initial={tile.isNew || tile.merged ? { scale: 0 } : false}
        animate={tile.merged ? { scale: [0, 1.18, 1] } : { scale: 1 }}
        transition={{ delay: SLIDE_MS / 1000, duration: tile.merged ? 0.22 : 0.16 }}
        className="w-full h-full rounded-xl flex items-center justify-center font-fredoka shadow-lg"
        style={{
          background: bg,
          color: fg,
          fontSize: `${font}cqw`,
          boxShadow: tile.value >= 128 ? `0 0 18px ${bg}` : undefined,
        }}
      >
        {tile.value}
      </motion.div>
    </div>
  );
}
