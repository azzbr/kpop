// ♟️ Chess Academy (chess_academy): one tile, four rooms.
//  🎓 Learn        — star hunts for every piece, then check & checkmate (data/chessLessons.ts, chessLessonLogic.ts)
//  🧩 Puzzle Streak — Lichess puzzles (CC0, data/chessPuzzles.ts) picked for her own puzzle level
//  🤖 Play a bot    — 🐶 Biscuit, 🦊 Fox, 🦉 Professor Hoot (chessBot.ts in a Web Worker via chessBotClient.ts)
//  👫 Two players   — pass-and-play on one device
// Rules come from chess.js through chessLogic.ts; the board is ChessBoard.tsx with our own pieces.
// Each room is its own GameShell (gameId chess_learn / chess_puzzles / chess_bot / chess_duo) whose
// Back returns to this menu. With ?debug, window.__chess drives the open room for e2e tests.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import ScreenFrame from '../ui/ScreenFrame';
import ConfettiBurst from '../ConfettiBurst';
import ChessBoard from './ChessBoard';
import ChessPiece from './chessPieces';
import { useGameStore } from '../../store';
import { useSafeTimeout } from '../../utils/useSafeTimeout';
import { playClick, playCorrect, playPop, playWrong } from '../../utils/sounds';
import {
  newGame, legalTargets, needsPromotion, tryMove, tryUci, parseUci, gameStatus, undoLast, checkSquare, lastMoveSquares,
  startPuzzle, puzzleMove, puzzleHint, noteHint, updateLevel, pickPuzzle, START_LEVEL, MIN_LEVEL, MAX_LEVEL,
} from './chessLogic';
import type { PuzzleRun, PromotionPiece } from './chessLogic';
import type { Chess } from 'chess.js';
import { CHESS_PUZZLES } from '../../data/chessPuzzles';
import type { ChessPuzzle } from '../../data/chessPuzzles';
import { PUZZLE_THEMES } from '../../data/chessThemes';
import { CHESS_LESSONS, CHESS_LESSON_LEVELS } from '../../data/chessLessons';
import type { ChessLessonLevel, StarHuntLevel, CheckLevel } from './chessLessonLogic';
import {
  starHuntStart, starHuntTargets, starHuntMove, isComplete, starsLeft, starsEarned, toFen, starHuntSolution,
  checkLessonAnswer, checkLessonTargets, checkLessonSolutions,
} from './chessLessonLogic';
import type { StarHuntState } from './chessLessonLogic';
import { BOTS, BOT_IDS, botLine, hintMove } from './chessBot';
import type { BotId } from './chessBot';
import { askBot } from './chessBotClient';

type Room = 'learn' | 'puzzles' | 'bot' | 'duo';
type Marks = Record<string, 'star' | 'hint' | 'goal' | 'good' | 'oops'>;

interface ChessHook { room: Room; move: (uci: string) => void; solve?: () => void; load?: (fen: string) => void }
declare global { interface Window { __chess?: ChessHook } }
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

// Content keys (they move with the save code). Scores go through finishRound.
const LESSONS_KEY = 'chess_lessons'; // { levelId: 1|2|3 stars }
const LEVEL_KEY = 'chess_puzzle_level';
const SEEN_KEY = 'chess_puzzle_seen';
const BOT_KEY = 'chess_bot_pick';
const MAX_SEEN = 500;

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v === null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const btn = 'min-h-[52px] px-5 rounded-2xl font-fredoka text-lg disabled:opacity-40';
const pill = 'rounded-full bg-white/10 px-4 py-1 font-fredoka text-lg';

/** Puts the debug hook on window while a room is open (tests only). */
function useDebugHook(hook: ChessHook | null) {
  const ref = useRef(hook);
  ref.current = hook;
  useEffect(() => {
    if (!DEBUG) return;
    window.__chess = {
      get room() { return ref.current?.room ?? 'learn'; },
      move: uci => ref.current?.move(uci),
      solve: () => ref.current?.solve?.(),
      load: fen => ref.current?.load?.(fen),
    } as ChessHook;
    return () => { delete window.__chess; };
  }, []);
}

/** The board plus a line of buttons and a message, laid out for iPad and phone. */
function Stage({ top, board, message, buttons }: { top: ReactNode; board: ReactNode; message?: ReactNode; buttons?: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 py-3" style={{ touchAction: 'pan-y' }}>
      <div className="max-w-3xl mx-auto flex flex-col items-center gap-3">
        {top}
        {board}
        {message && <div className="font-nunito text-lg text-center text-violet-100 min-h-[28px] max-w-xl">{message}</div>}
        {buttons && <div className="flex flex-wrap justify-center gap-2">{buttons}</div>}
      </div>
    </div>
  );
}

// ── 🎓 Learn ──────────────────────────────────────────────────────────────────

function LearnRoom({ onExit }: { onExit: () => void }) {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [progress, setProgress] = useState<Record<string, number>>(() => read(LESSONS_KEY, {}));
  const [levelId, setLevelId] = useState(() => (CHESS_LESSON_LEVELS.find(l => !read<Record<string, number>>(LESSONS_KEY, {})[l.id]) ?? CHESS_LESSON_LEVELS[0]).id);
  const level = CHESS_LESSON_LEVELS.find(l => l.id === levelId) ?? CHESS_LESSON_LEVELS[0];
  const lesson = CHESS_LESSONS.find(ls => ls.levels.some(l => l.id === level.id))!;
  const [hunt, setHunt] = useState<StarHuntState | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [message, setMessage] = useState('');
  const [hintMarks, setHintMarks] = useState<Marks>({});
  const [earned, setEarned] = useState(0);
  const [won, setWon] = useState(false);
  const playing = status === 'playing' && !won;

  const startLevel = (l: ChessLessonLevel) => {
    setLevelId(l.id);
    setHunt(l.kind === 'stars' ? starHuntStart(l) : null);
    setMistakes(0);
    setMessage(l.kind === 'check' ? l.tip : l.tip ?? '');
    setHintMarks({});
    setWon(false);
    setEarned(0);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const finish = (stars: number) => {
    setEarned(stars);
    setWon(true);
    const next = { ...progress, [level.id]: Math.max(progress[level.id] ?? 0, stars) };
    setProgress(next);
    write(LESSONS_KEY, next);
    playCorrect();
    later(() => setStatus('over'), 1400);
  };

  const huntMove = (to: string) => {
    if (!playing || level.kind !== 'stars' || !hunt) return;
    const next = starHuntMove(level, hunt, to as StarHuntState['square']);
    if (!next) return;
    playPop();
    setHunt(next);
    setHintMarks({});
    if (next.collected.length > hunt.collected.length) setMessage(starsLeft(level, next).length ? '⭐ Got one! Keep going!' : '');
    if (isComplete(level, next)) finish(starsEarned(next.moves, level.target));
  };

  const checkMove = (from: string, to: string, promotion?: PromotionPiece) => {
    if (!playing || level.kind !== 'check') return;
    const res = checkLessonAnswer(level, { from: from as StarHuntState['square'], to: to as StarHuntState['square'], promotion });
    setHintMarks({});
    if (res.result === 'correct') {
      setMessage(`✅ ${res.san} — well done!`);
      finish(mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1);
      return;
    }
    setMistakes(m => m + 1);
    playWrong();
    setMessage(res.reason === 'no_check' ? 'Good move, but it isn’t check — find a move that attacks the king!'
      : res.reason === 'no_mate' ? 'That’s check, but the king can still escape — find the checkmate!'
        : 'That move isn’t allowed here — try another one!');
  };

  const showHint = () => {
    playClick();
    if (level.kind === 'stars' && hunt) {
      const route = starHuntSolution({ ...level, piece: hunt.piece, start: hunt.square, stars: starsLeft(level, hunt) } as StarHuntLevel);
      if (route?.[0]) { setHintMarks({ [hunt.square]: 'hint', [route[0]]: 'goal' }); setMessage('Try moving here 👉'); }
    } else if (level.kind === 'check') {
      const answer = checkLessonSolutions(level)[0];
      if (answer) { setHintMarks({ [answer.slice(0, 2)]: 'hint' }); setMessage('Try moving the glowing piece!'); }
    }
  };

  useDebugHook({
    room: 'learn',
    move: uci => {
      const m = parseUci(uci);
      if (!m) return;
      if (level.kind === 'stars') huntMove(m.to); else checkMove(m.from, m.to, m.promotion);
    },
    solve: () => {
      if (level.kind === 'stars' && hunt) {
        let s = hunt;
        for (const sq of starHuntSolution(level) ?? []) { const n = starHuntMove(level, s, sq); if (n) s = n; }
        setHunt(s);
        if (isComplete(level, s)) finish(starsEarned(s.moves, level.target));
      } else if (level.kind === 'check') {
        const a = checkLessonSolutions(level)[0];
        if (a) checkMove(a.slice(0, 2), a.slice(2, 4), a[4] as PromotionPiece | undefined);
      }
    },
  });

  const idx = CHESS_LESSON_LEVELS.findIndex(l => l.id === level.id);
  const nextLevel = CHESS_LESSON_LEVELS[idx + 1];
  const totalStars = Object.values(progress).reduce((a, b) => a + b, 0);

  const board = level.kind === 'stars' && hunt ? (
    <ChessBoard
      fen={toFen(level, hunt)} orientation="w" canMove={playing ? 'w' : 'none'}
      legal={from => starHuntTargets(level, hunt, from as StarHuntState['square'])}
      onMove={(_from, to) => huntMove(to)} needsPromotion={() => false}
      marks={{ ...Object.fromEntries(starsLeft(level, hunt).map(s => [s, 'star'])), ...hintMarks }} showCoords
    />
  ) : level.kind === 'check' ? (
    <ChessBoard
      fen={level.fen} orientation="w" canMove={playing ? 'w' : 'none'}
      legal={from => checkLessonTargets(level as CheckLevel, from as StarHuntState['square'])}
      onMove={checkMove} checkSquare={checkSquare(newGame(level.fen))} marks={hintMarks} showCoords
    />
  ) : null;

  return (
    <GameShell
      gameId="chess_learn" title="Learn chess" icon="🎓" xpScale={20} status={status} score={won ? earned * 100 : 0} round={round}
      celebrateEnd onBack={onExit} leaveLabel="Back to Chess Academy" againLabel={nextLevel ? '▶ Next level' : '🔁 Play again'}
      formatScore={n => `${'⭐'.repeat(Math.round(n / 100))}`}
      overTitle={`${lesson.title}: ${level.title} — ${'⭐'.repeat(earned)}${'☆'.repeat(3 - earned)}`}
      startLabel={`▶ Play: ${level.title}`}
      onStart={() => startLevel(status === 'over' && won && nextLevel ? nextLevel : level)}
      onPause={() => setStatus('paused')} onResume={() => setStatus('playing')}
      readyContent={
        <div className="text-left space-y-3 max-h-[52vh] overflow-y-auto pr-1">
          <p className="font-nunito text-lg text-violet-100 text-center">Learn how every piece moves, then check and checkmate. ⭐ {totalStars} / {CHESS_LESSON_LEVELS.length * 3}</p>
          {CHESS_LESSONS.map(ls => (
            <div key={ls.id} className="rounded-2xl bg-white/5 p-2">
              <div className="flex items-center gap-2 mb-1">
                <ChessPiece type={ls.piece} color="w" size={32} />
                <span className="font-fredoka text-lg">{ls.title}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ls.levels.map((l, i) => (
                  <button key={l.id} onClick={() => { playClick(); setLevelId(l.id); }}
                    className={`min-h-[52px] rounded-xl px-2 font-fredoka text-base ${l.id === level.id ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                    <div>Level {i + 1}</div>
                    <div className="text-sm">{progress[l.id] ? '⭐'.repeat(progress[l.id]) : '☆☆☆'}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      }
    >
      {won && <ConfettiBurst count={60} durationMs={2200} />}
      <Stage
        top={
          <div className="text-center max-w-xl">
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              <span className={pill}>{lesson.title} · {level.title}</span>
              {level.kind === 'stars' && hunt && <span className={pill}>⭐ {hunt.collected.length}/{level.stars.length} · Moves {hunt.moves} (best {level.target})</span>}
            </div>
            <p className="font-nunito text-lg text-violet-100">{lesson.intro}</p>
          </div>
        }
        board={board}
        message={message}
        buttons={<>
          <button onClick={showHint} disabled={!playing} className={`${btn} bg-amber-500 text-stone-900`}>💡 Show me</button>
          <button onClick={() => { playClick(); startLevel(level); }} disabled={!playing} className={`${btn} bg-white/15`}>🔄 Start again</button>
        </>}
      />
    </GameShell>
  );
}

// ── 🧩 Puzzle Streak ─────────────────────────────────────────────────────────

const ROUND_SECONDS = 300;
const LIVES = 3;

function PuzzleRoom({ onExit }: { onExit: () => void }) {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [level, setLevel] = useState<number>(() => {
    const v = Number(read(LEVEL_KEY, START_LEVEL));
    return Number.isFinite(v) ? Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, v)) : START_LEVEL;
  });
  const levelRef = useRef(level);
  levelRef.current = level;
  const seen = useRef<string[]>(read<string[]>(SEEN_KEY, []));
  const [puzzle, setPuzzle] = useState<ChessPuzzle | null>(null);
  const [run, setRun] = useState<PuzzleRun | null>(null);
  const [display, setDisplay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lives, setLives] = useState(LIVES);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [points, setPoints] = useState(0);
  const [solved, setSolved] = useState(0);
  const [message, setMessage] = useState('');
  const [marks, setMarks] = useState<Marks>({});
  const playing = status === 'playing';
  // Delayed steps (next puzzle, end) belong to one round; a new round or the end cancels them.
  const live = useRef(0);
  const soon = (fn: () => void, ms: number) => { const r = live.current; later(() => { if (r === live.current) fn(); }, ms); };

  const next = useCallback(() => {
    const p = pickPuzzle(CHESS_PUZZLES, levelRef.current, seen.current, Math.random) ?? CHESS_PUZZLES[0];
    seen.current = [...seen.current.filter(id => id !== p.id), p.id].slice(-MAX_SEEN);
    write(SEEN_KEY, seen.current);
    setPuzzle(p);
    setRun(startPuzzle(p));
    setDisplay(null);
    setMarks({});
    setBusy(false);
    setMessage(`${PUZZLE_THEMES[p.theme].emoji} Find: ${PUZZLE_THEMES[p.theme].name}`);
  }, []);

  const end = useCallback(() => {
    live.current++;
    write(LEVEL_KEY, levelRef.current);
    setBusy(true);
    setStatus('over');
  }, []);

  const start = () => {
    live.current++;
    setLives(LIVES); setTimeLeft(ROUND_SECONDS); setPoints(0); setSolved(0);
    setRound(r => r + 1);
    setStatus('playing');
    next();
  };

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setTimeLeft(s => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [playing]);
  useEffect(() => { if (playing && timeLeft <= 0) end(); }, [playing, timeLeft, end]);

  const setLevelSaved = (v: number) => { setLevel(v); levelRef.current = v; write(LEVEL_KEY, v); };

  const onSolved = (r: PuzzleRun, p: ChessPuzzle) => {
    const gained = Math.round((p.rating / 10) * (r.hints === 2 ? 0.5 : 1));
    setPoints(x => x + gained);
    setSolved(x => x + 1);
    // A clean solve raises her level; a solve after a retry or the full hint leaves it where it is.
    if (r.mistakes === 0 && r.hints < 2) setLevelSaved(updateLevel(levelRef.current, p.rating, true));
    setRun(r);
    playCorrect();
    const theme = PUZZLE_THEMES[p.theme];
    setMessage(`✅ ${theme.emoji} ${theme.name}! ${theme.tip} (+${gained})`);
    setBusy(true);
    soon(next, 1800);
  };

  const onMove = (from: string, to: string, promotion?: PromotionPiece) => {
    if (!playing || busy || !run || !puzzle) return;
    const res = puzzleMove(run, `${from}${to}${promotion ?? ''}`);
    if (res.result === 'solved') { setDisplay(null); onSolved(res.run, puzzle); return; }
    if (res.result === 'correct') {
      playPop();
      setDisplay(res.move.fen);
      setBusy(true);
      setMarks({});
      setMessage('👍 Yes! Keep going…');
      soon(() => { setDisplay(null); setRun(res.run); setBusy(false); }, 550);
      return;
    }
    if (res.reason !== 'try') return;
    if (res.run.mistakes < 2) {
      setRun(res.run);
      playWrong();
      setMessage('Not quite — have another look! 🤔');
      return;
    }
    // Second miss: show the answer kindly, lose a heart, move on.
    const answer = puzzleHint(res.run, 2);
    playWrong();
    setRun(res.run);
    setLevelSaved(updateLevel(levelRef.current, puzzle.rating, false));
    if (answer && answer.level === 2) setMarks({ [answer.from]: 'hint', [answer.to]: 'goal' });
    const theme = PUZZLE_THEMES[puzzle.theme];
    setMessage(`The answer was ${answer && answer.level === 2 ? answer.san : 'tricky'} — ${theme.tip}`);
    setBusy(true);
    const left = lives - 1;
    setLives(left);
    soon(() => (left <= 0 ? end() : next()), 2600);
  };

  const hint = () => {
    if (!run || busy) return;
    playClick();
    const lvl: 1 | 2 = run.hints === 0 ? 1 : 2;
    const h = puzzleHint(run, lvl);
    if (!h) return;
    setRun(noteHint(run, lvl));
    setMarks(h.level === 1 ? { [h.square]: 'hint' } : { [h.from]: 'hint', [h.to]: 'goal' });
    setMessage(h.level === 1 ? 'Look at the glowing piece…' : 'Move it to the 🎯 (half points)');
  };

  useDebugHook({
    room: 'puzzles',
    move: uci => { const m = parseUci(uci); if (m) onMove(m.from, m.to, m.promotion); },
    solve: () => {
      if (!run || !puzzle) return;
      let r = run;
      for (let i = 0; i < 8; i++) {
        const h = puzzleHint(r, 2);
        if (!h || h.level !== 2) return;
        const res = puzzleMove(r, h.uci);
        if (res.result === 'solved') { onSolved(res.run, puzzle); return; }
        if (res.result !== 'correct') return;
        r = res.run;
      }
    },
  });

  const fen = display ?? run?.fen ?? null;
  const game = fen ? newGame(fen) : null;

  return (
    <GameShell
      gameId="chess_puzzles" title="Puzzle Streak" icon="🧩" xpScale={22} status={status} score={points} round={round}
      celebrateEnd onBack={onExit} leaveLabel="Back to Chess Academy"
      overTitle={`${solved} puzzle${solved === 1 ? '' : 's'} solved!`}
      overStats={[{ label: 'Solved', value: String(solved) }, { label: 'Puzzle level', value: String(level) }]}
      startLabel="▶ Start the streak" onStart={start}
      onPause={() => setStatus('paused')} onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-2">
          <p className="font-nunito text-lg text-violet-100">Real chess puzzles, picked for <b>your level</b>. Find the best move — the computer answers, then it's you again.</p>
          <p className="font-fredoka text-lg">❤️ 3 lives · ⏱️ 5 minutes · Your level: {level}</p>
          <p className="font-nunito text-base text-violet-200">A wrong move gets one more try. 💡 Hints help (the second one halves the points).</p>
        </div>
      }
    >
      <Stage
        top={
          <div className="flex flex-wrap justify-center gap-2">
            <span className={pill}>{'❤️'.repeat(lives)}{'🤍'.repeat(Math.max(0, LIVES - lives))}</span>
            <span className={`${pill} tabular-nums`}>⏱️ {fmtTime(timeLeft)}</span>
            <span className={pill}>✅ {solved} · {points} pts</span>
            {run && <span className={pill}>{run.color === 'w' ? '⚪ You play White' : '⚫ You play Black'}</span>}
          </div>
        }
        board={run && fen && game && (
          <ChessBoard
            fen={fen} orientation={run.color} canMove={playing && !busy ? run.color : 'none'}
            legal={from => legalTargets(newGame(run.fen), from)} needsPromotion={(f, t) => needsPromotion(newGame(run.fen), f, t)}
            onMove={onMove} lastMove={lastMoveSquares(game) ?? run.lastMove} checkSquare={checkSquare(game)} marks={marks}
          />
        )}
        message={message}
        buttons={<>
          <button onClick={hint} disabled={!playing || busy || !run || run.hints >= 2} className={`${btn} bg-amber-500 text-stone-900`}>💡 Hint</button>
          <button onClick={() => { playClick(); end(); }} disabled={!playing} className={`${btn} bg-white/15`}>🏁 Finish</button>
        </>}
      />
    </GameShell>
  );
}

// ── 🤖 Play a bot ─────────────────────────────────────────────────────────────

const BOT_WIN: Record<BotId, number> = { biscuit: 100, fox: 250, hoot: 450 };
const BOT_DRAW: Record<BotId, number> = { biscuit: 30, fox: 60, hoot: 90 };
type Side = 'w' | 'b' | 'random';
type Outcome = 'win' | 'loss' | 'draw';

function BotRoom({ onExit }: { onExit: () => void }) {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [bot, setBot] = useState<BotId>(() => {
    const b = read<string>(BOT_KEY, 'biscuit');
    return (BOT_IDS as string[]).includes(b) ? (b as BotId) : 'biscuit';
  });
  const [side, setSide] = useState<Side>('w');
  const [color, setColor] = useState<'w' | 'b'>('w');
  const gameRef = useRef<Chess>(newGame());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [thinking, setThinking] = useState(false);
  const [line, setLine] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [marks, setMarks] = useState<Marks>({});
  const [confirmStop, setConfirmStop] = useState(false);
  const token = useRef(0);
  const info = BOTS[bot];
  const playing = status === 'playing' && !outcome;

  const finishGame = (o: Outcome) => {
    setOutcome(o);
    setLine(botLine(bot, o === 'win' ? 'lose' : o === 'loss' ? 'win' : 'draw'));
    if (o === 'win') playCorrect();
    later(() => setStatus('over'), 1600);
  };

  const checkEnd = (me: 'w' | 'b'): boolean => {
    const st = gameStatus(gameRef.current);
    if (st.state === 'playing') return false;
    finishGame(st.state === 'checkmate' ? (st.winner === me ? 'win' : 'loss') : 'draw');
    return true;
  };

  const botTurn = (me: 'w' | 'b') => {
    const t = ++token.current;
    const asked = gameRef.current.fen();
    setThinking(true);
    // `seen`: earlier positions, so a bot that's ahead doesn't repeat moves for ever.
    askBot(asked, bot, { seen: gameRef.current.history({ verbose: true }).map(m => m.before) }).then(uci => {
      if (t !== token.current || gameRef.current.fen() !== asked) return;
      const r = tryUci(gameRef.current, uci);
      setThinking(false);
      if (!r.ok) return;
      playPop();
      setFen(gameRef.current.fen());
      checkEnd(me);
    });
  };

  const start = () => {
    token.current++;
    const me: 'w' | 'b' = side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
    write(BOT_KEY, bot);
    gameRef.current = newGame();
    setFen(gameRef.current.fen());
    setColor(me);
    setOutcome(null);
    setMarks({});
    setConfirmStop(false);
    setThinking(false);
    setLine(botLine(bot, 'greet'));
    setRound(r => r + 1);
    setStatus('playing');
    if (me === 'b') botTurn(me);
  };

  const onMove = (from: string, to: string, promotion?: PromotionPiece) => {
    if (!playing || thinking || gameRef.current.turn() !== color) return;
    const r = tryMove(gameRef.current, from, to, promotion);
    if (!r.ok) return;
    playPop();
    setFen(gameRef.current.fen());
    setMarks({});
    if ((r.captured || r.check) && Math.random() < 0.6) setLine(botLine(bot, 'goodMove'));
    if (!checkEnd(color)) botTurn(color);
  };

  const takeBack = () => {
    if (!playing || thinking || gameRef.current.turn() !== color) return;
    playClick();
    if (undoLast(gameRef.current, 2) > 0) { setFen(gameRef.current.fen()); setMarks({}); setLine('No problem — have another go! 🙂'); }
  };

  const hint = () => {
    if (!playing || thinking || gameRef.current.turn() !== color) return;
    playClick();
    const uci = hintMove(gameRef.current.fen());
    const m = parseUci(uci);
    if (m) setMarks({ [m.from]: 'hint', [m.to]: 'goal' });
  };

  useDebugHook({
    room: 'bot',
    move: uci => { const m = parseUci(uci); if (m) onMove(m.from, m.to, m.promotion); },
    load: f => { token.current++; gameRef.current = newGame(f); setThinking(false); setFen(gameRef.current.fen()); },
  });

  const game = gameRef.current;
  const score = outcome === 'win' ? BOT_WIN[bot] : outcome === 'draw' ? BOT_DRAW[bot] : 0;
  const myTurn = game.turn() === color;

  return (
    <GameShell
      gameId="chess_bot" title={`Play ${info.name}`} icon={info.emoji} xpScale={9} status={status} score={score} round={round}
      celebrateEnd onBack={onExit} leaveLabel="Back to Chess Academy" againLabel="🔁 Rematch"
      overTitle={outcome === 'win' ? `You beat ${info.name}! 🎉` : outcome === 'draw' ? `A draw with ${info.name}!` : `${info.name} won this time — good game!`}
      overStats={[{ label: 'Moves', value: String(Math.ceil(game.history().length / 2)) }, { label: 'Opponent', value: `${info.emoji} ${info.name}` }]}
      startLabel={`▶ Play ${info.name}`} onStart={start}
      onPause={() => setStatus('paused')} onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-3 text-left">
          <div className="grid gap-2">
            {BOT_IDS.map(id => (
              <button key={id} onClick={() => { playClick(); setBot(id); }}
                className={`min-h-[64px] rounded-2xl p-3 flex items-center gap-3 ${bot === id ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                <span className="text-4xl">{BOTS[id].emoji}</span>
                <span><span className="block font-fredoka text-lg">{BOTS[id].name}</span><span className="block font-nunito text-sm text-violet-100">{BOTS[id].blurb}</span></span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['w', '⚪ White'], ['b', '⚫ Black'], ['random', '🎲 Either']] as [Side, string][]).map(([id, label]) => (
              <button key={id} onClick={() => { playClick(); setSide(id); }} className={`min-h-[52px] rounded-xl font-fredoka text-base ${side === id ? 'bg-sky-500' : 'bg-white/10'}`}>{label}</button>
            ))}
          </div>
        </div>
      }
    >
      {outcome === 'win' && <ConfettiBurst count={90} durationMs={2600} />}
      <Stage
        top={
          <div className="flex items-center gap-3 max-w-xl w-full rounded-2xl bg-white/10 px-4 py-2">
            <span className="text-4xl">{info.emoji}</span>
            <p className="font-nunito text-lg flex-1">{thinking ? `${info.name} is thinking… 🤔` : `“${line}”`}</p>
          </div>
        }
        board={
          <ChessBoard
            fen={fen} orientation={color} canMove={playing && !thinking && myTurn ? color : 'none'}
            legal={from => legalTargets(gameRef.current, from)} needsPromotion={(f, t) => needsPromotion(gameRef.current, f, t)}
            onMove={onMove} lastMove={lastMoveSquares(game)} checkSquare={checkSquare(game)} marks={marks}
          />
        }
        message={playing ? (myTurn ? 'Your move!' : '') : ''}
        buttons={<>
          <button onClick={hint} disabled={!playing || thinking || !myTurn} className={`${btn} bg-amber-500 text-stone-900`}>💡 Hint</button>
          <button onClick={takeBack} disabled={!playing || thinking || !myTurn || game.history().length < 2} className={`${btn} bg-sky-600`}>↩️ Take back</button>
          <button onClick={() => { playClick(); if (confirmStop) finishGame('loss'); else { setConfirmStop(true); later(() => setConfirmStop(false), 3000); } }}
            disabled={!playing} className={`${btn} ${confirmStop ? 'bg-rose-600' : 'bg-white/15'}`}>{confirmStop ? 'Tap again to stop' : '🏳️ Stop'}</button>
        </>}
      />
    </GameShell>
  );
}

// ── 👫 Two players ────────────────────────────────────────────────────────────

function DuoRoom({ onExit }: { onExit: () => void }) {
  const later = useSafeTimeout();
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const gameRef = useRef<Chess>(newGame());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [flip, setFlip] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const playing = status === 'playing' && !result;

  const start = () => {
    gameRef.current = newGame();
    setFen(gameRef.current.fen());
    setResult(null);
    setRound(r => r + 1);
    setStatus('playing');
  };

  const onMove = (from: string, to: string, promotion?: PromotionPiece) => {
    if (!playing) return;
    const r = tryMove(gameRef.current, from, to, promotion);
    if (!r.ok) return;
    playPop();
    setFen(gameRef.current.fen());
    const st = gameStatus(gameRef.current);
    if (st.state === 'playing') return;
    setResult(st.state === 'checkmate' ? (st.winner === 'w' ? '⚪ White wins! 🎉' : '⚫ Black wins! 🎉') : 'It’s a draw — well played, both of you!');
    playCorrect();
    later(() => setStatus('over'), 1600);
  };

  useDebugHook({ room: 'duo', move: uci => { const m = parseUci(uci); if (m) onMove(m.from, m.to, m.promotion); } });

  const game = gameRef.current;
  const turn = game.turn();
  return (
    <GameShell
      gameId="chess_duo" title="Two players" icon="👫" xpScale={1} status={status} score={0} round={round}
      celebrateEnd onBack={onExit} leaveLabel="Back to Chess Academy" overTitle={result ?? 'Good game!'}
      overStats={[{ label: 'Moves', value: String(Math.ceil(game.history().length / 2)) }]}
      startLabel="▶ Start a game" onStart={start}
      onPause={() => setStatus('paused')} onResume={() => setStatus('playing')}
      readyContent={
        <div className="space-y-3">
          <p className="font-nunito text-lg text-violet-100">Two players, one device: pass it over after each move. White goes first.</p>
          <button onClick={() => { playClick(); setFlip(f => !f); }} className={`min-h-[52px] w-full rounded-xl font-fredoka text-lg ${flip ? 'bg-sky-500' : 'bg-white/10'}`}>
            {flip ? '🔄 Board turns round each move' : '⬆️ Board stays still'}
          </button>
        </div>
      }
    >
      {result && <ConfettiBurst count={70} durationMs={2400} />}
      <Stage
        top={<span className={pill}>{result ?? (turn === 'w' ? '⚪ White to move' : '⚫ Black to move')}{!result && game.isCheck() ? ' — check!' : ''}</span>}
        board={
          <ChessBoard
            fen={fen} orientation={flip ? turn : 'w'} canMove={playing ? turn : 'none'}
            legal={from => legalTargets(gameRef.current, from)} needsPromotion={(f, t) => needsPromotion(gameRef.current, f, t)}
            onMove={onMove} lastMove={lastMoveSquares(game)} checkSquare={checkSquare(game)}
          />
        }
        buttons={<button onClick={() => { if (!playing) return; playClick(); if (undoLast(gameRef.current, 1)) setFen(gameRef.current.fen()); }}
          disabled={!playing || game.history().length === 0} className={`${btn} bg-sky-600`}>↩️ Undo</button>}
      />
    </GameShell>
  );
}

// ── The menu ──────────────────────────────────────────────────────────────────

export default function ChessAcademy() {
  const [room, setRoom] = useState<Room | null>(null);
  const highScores = useGameStore(s => s.highScores);
  const exit = () => setRoom(null);
  if (room === 'learn') return <LearnRoom onExit={exit} />;
  if (room === 'puzzles') return <PuzzleRoom onExit={exit} />;
  if (room === 'bot') return <BotRoom onExit={exit} />;
  if (room === 'duo') return <DuoRoom onExit={exit} />;

  const lessons = read<Record<string, number>>(LESSONS_KEY, {});
  const lessonStars = Object.values(lessons).reduce((a, b) => a + b, 0);
  const done = CHESS_LESSON_LEVELS.filter(l => lessons[l.id]).length;
  const level = Number(read(LEVEL_KEY, START_LEVEL)) || START_LEVEL;
  const rooms: { id: Room; icon: ReactNode; title: string; text: string; info: string; colour: string }[] = [
    { id: 'learn', icon: <ChessPiece type="n" color="w" size={56} />, title: '🎓 Learn', text: 'How every piece moves, then check and checkmate.', info: `${done} / ${CHESS_LESSON_LEVELS.length} levels · ⭐ ${lessonStars}`, colour: 'from-emerald-500/40 to-teal-600/40' },
    { id: 'puzzles', icon: <ChessPiece type="q" color="w" size={56} />, title: '🧩 Puzzle Streak', text: 'Real chess puzzles, picked for your level.', info: `Your level ${level}${highScores.chess_puzzles ? ` · Best ${highScores.chess_puzzles}` : ''}`, colour: 'from-fuchsia-500/40 to-purple-600/40' },
    { id: 'bot', icon: <span className="text-5xl">🐶🦊🦉</span>, title: '🤖 Play a bot', text: 'Biscuit, Fox or Professor Hoot — friendly and fair.', info: highScores.chess_bot ? `Best win: ${highScores.chess_bot >= 450 ? 'Professor Hoot 🦉' : highScores.chess_bot >= 250 ? 'Fox 🦊' : highScores.chess_bot >= 100 ? 'Biscuit 🐶' : 'none yet'}` : 'No wins yet — try Biscuit!', colour: 'from-amber-500/40 to-orange-600/40' },
    { id: 'duo', icon: <span className="flex"><ChessPiece type="k" color="w" size={48} /><ChessPiece type="k" color="b" size={48} /></span>, title: '👫 Two players', text: 'Play a friend on one device.', info: 'Pass it over after each move', colour: 'from-sky-500/40 to-indigo-600/40' },
  ];
  return (
    <ScreenFrame title="Chess Academy" icon="♟️" width="max-w-4xl">
      <p className="font-nunito text-lg text-violet-100 text-center mb-4">Learn the moves, train your eye with real puzzles, then take on the bots!</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rooms.map(r => (
          <button key={r.id} onClick={() => { playClick(); setRoom(r.id); }}
            className={`min-h-[132px] rounded-3xl p-4 text-left bg-gradient-to-br ${r.colour} border border-white/15 flex items-center gap-4`}>
            <span className="shrink-0">{r.icon}</span>
            <span className="min-w-0">
              <span className="block font-fredoka text-2xl">{r.title}</span>
              <span className="block font-nunito text-base text-violet-100">{r.text}</span>
              <span className="block font-nunito text-sm text-yellow-200 mt-1">{r.info}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="font-nunito text-sm text-violet-300 text-center mt-4">Puzzles from the Lichess puzzle database (public domain).</p>
    </ScreenFrame>
  );
}
