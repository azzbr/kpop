import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { GameConfig, GameMsg, RoomApi } from '../../online/useRoom';
import { useHostGame, useCountdown, type HostTools } from '../../online/useHostGame';
import { useArenaFinish, msLeft } from '../../online/helloGate';
import { isKidSafe } from '../../online/rudeWords';
import { playClick, playCorrect, playPop, playTick, playUnlock } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas';
import { useDrawStream } from './useDrawStream';
import { FinalCard, ScoreList } from './RaceParts';
import { Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { saveDoodle } from '../draw/doodleStore';
import {
  ROUND_MS, PICK_MS, REVEAL_MS, HINT_TIMES, MAX_GUESS,
  parseConfig, isRightGuess, isCloseGuess, normalizeGuess, guessPoints, drawerGain, drawOrder, doodleRanking, allGuessed,
  wordPool, pickChoices, hintOrder, hintPattern, wordLevel,
  type DdConfig, type PoolWord,
} from './doodleDashLogic';

// Doodle Dash: one player draws a secret word, everyone else guesses on the on-screen keyboard.
// Host-authoritative (useHostGame, prefix dd): the host picks drawers, offers the drawer 3
// words, checks guesses and shows letter hints over time. The word only ever goes to the
// drawer and to players who guessed it (dd_secret, addressed). The picture streams through
// the host as DrawCanvas ops (useDrawStream), so undo / fill look the same everywhere and a
// late device gets the drawing so far.

type Phase = 'pick' | 'draw' | 'reveal' | 'final';
interface Feed { id: string; ok: boolean; text?: string; pts?: number }

interface State {
  cfg: DdConfig;
  ids: string[];
  order: string[];
  turn: number;
  phase: Phase;
  endsAt: number;
  choices: PoolWord[];
  word: string;
  category: string;
  hints: number[];
  shown: number;
  correct: string[];
  gained: Record<string, number>;
  feed: Feed[];
  likes: string[];
  used: string[];
  scores: Record<string, number>;
  ranked: (string | string[])[];
}

interface View {
  phase: Phase; turn: number; total: number; lap: number; laps: number; drawer: string; ms: number;
  hint: string; category: string; correct: string[]; gained: Record<string, number>; feed: Feed[];
  likes: string[]; scores: Record<string, number>; ids: string[]; board: boolean;
  word?: string; ranked?: (string | string[])[];
}

interface Secret { turn: number; choices?: string[]; word?: string }

const LEVEL_LABEL = { easy: '😀 Easy', medium: '🙂 Medium', hard: '🤓 Hard' } as const;

export default function DoodleDash({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const cfg = parseConfig(config);
  const { finish, reward } = useArenaFinish(room);
  const { myId, isHost, send, onMessage } = room;
  const isBoard = cfg.board && isHost;
  const canvas = useRef<DrawCanvasHandle>(null);
  const playersRef = useRef(room.players);
  playersRef.current = room.players;

  const [secret, setSecret] = useState<Secret | null>(null);
  const [guess, setGuess] = useState('');
  const [note, setNote] = useState<{ turn: number; text: string } | null>(null);
  const [liked, setLiked] = useState(-1);
  const [saved, setSaved] = useState<{ turn: number; text: string } | null>(null);

  // ---------------- HOST ----------------
  const present = () => new Set(playersRef.current.map(p => p.id));

  const sendSecret = (s: State, to: string) => {
    if (s.phase === 'pick' && to === s.order[s.turn]) send({ t: 'dd_secret', to, turn: s.turn, choices: s.choices.map(c => c.word) });
    else if (s.phase === 'draw' && (to === s.order[s.turn] || s.correct.includes(to))) send({ t: 'dd_secret', to, turn: s.turn, word: s.word });
  };

  const finalState = (s: State): State => ({ ...s, phase: 'final', endsAt: 0, ranked: doodleRanking(s.scores, s.ids) });

  const startTurn = (t: HostTools<State>, s: State, turn: number): State => {
    ['pick', 'hint0', 'hint1', 'end', 'next'].forEach(k => t.cancel(k));
    const here = present();
    let i = turn;
    while (i < s.order.length && !here.has(s.order[i])) i++; // the drawer left: next one
    if (i >= s.order.length) return finalState(s);
    const choices = pickChoices(wordPool(s.cfg.category), s.used, s.cfg.difficulty);
    const n: State = {
      ...s, turn: i, phase: 'pick', endsAt: Date.now() + PICK_MS, choices, word: '', category: '',
      hints: [], shown: 0, correct: [], gained: {}, feed: [], likes: [],
    };
    t.after('pick', PICK_MS + 300, () => {
      const cur = t.get();
      if (cur.phase === 'pick' && cur.turn === i) t.set(beginDraw(t, cur, Math.floor(Math.random() * cur.choices.length)));
    });
    sendSecret(n, n.order[i]);
    return n;
  };

  const beginDraw = (t: HostTools<State>, s: State, idx: number): State => {
    t.cancel('pick');
    const c = s.choices[idx] ?? s.choices[0];
    const hints = hintOrder(c.word);
    const n: State = { ...s, phase: 'draw', word: c.word, category: c.category, used: [...s.used, c.word], hints, shown: 0, endsAt: Date.now() + ROUND_MS };
    hints.forEach((_, k) => t.after(`hint${k}`, HINT_TIMES[k], () => {
      const cur = t.get();
      if (cur.phase === 'draw' && cur.turn === s.turn) t.set({ ...cur, shown: Math.max(cur.shown, k + 1) });
    }));
    t.after('end', ROUND_MS + 300, () => t.set(endTurn(t, t.get())));
    sendSecret(n, n.order[n.turn]);
    return n;
  };

  const endTurn = (t: HostTools<State>, s: State): State => {
    if (s.phase !== 'draw') return s;
    ['hint0', 'hint1', 'end'].forEach(k => t.cancel(k));
    const turn = s.turn;
    t.after('next', REVEAL_MS, () => {
      const cur = t.get();
      if (cur.phase === 'reveal' && cur.turn === turn) t.set(startTurn(t, cur, turn + 1));
    });
    return { ...s, phase: 'reveal', endsAt: Date.now() + REVEAL_MS };
  };

  const onGuess = (t: HostTools<State>, s: State, from: string, raw: unknown): State | undefined => {
    const drawer = s.order[s.turn];
    if (s.phase !== 'draw' || from === drawer || !s.ids.includes(from) || s.correct.includes(from)) return;
    const text = String(raw ?? '').slice(0, MAX_GUESS).trim();
    if (!text) return;
    if (isRightGuess(text, s.word)) {
      const order = s.correct.length;
      const pts = guessPoints(msLeft(s.endsAt), order);
      const dg = drawerGain(order);
      const n: State = {
        ...s,
        correct: [...s.correct, from],
        scores: { ...s.scores, [from]: (s.scores[from] ?? 0) + pts, [drawer]: (s.scores[drawer] ?? 0) + dg },
        gained: { ...s.gained, [from]: pts, [drawer]: (s.gained[drawer] ?? 0) + dg },
        feed: [{ id: from, ok: true, pts }, ...s.feed].slice(0, 8),
      };
      sendSecret(n, from);
      const here = present();
      const guessers = n.ids.filter(id => id !== drawer && here.has(id));
      return allGuessed(guessers, n.correct) ? endTurn(t, n) : n;
    }
    // Nearly right (or the word hidden inside a longer guess): only the guesser hears about it.
    const g = normalizeGuess(text);
    if (isCloseGuess(text, s.word) || g.includes(normalizeGuess(s.word))) {
      send({ t: 'dd_close', to: from, turn: s.turn });
      return;
    }
    return { ...s, feed: [{ id: from, ok: false, text: isKidSafe(text) ? text : '🤐' }, ...s.feed].slice(0, 8) };
  };

  const { view, input, tools } = useHostGame<State, View>(room, 'dd', {
    board: cfg.board,
    start: (ids, t) => {
      const s: State = {
        cfg, ids, order: drawOrder(ids, cfg.laps), turn: 0, phase: 'pick', endsAt: 0, choices: [], word: '', category: '',
        hints: [], shown: 0, correct: [], gained: {}, feed: [], likes: [], used: [],
        scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [],
      };
      return startTurn(t, s, 0);
    },
    onInput: (s, from, m, t) => {
      if (m.turn !== s.turn) return;
      if (m.pick !== undefined) {
        if (s.phase !== 'pick' || from !== s.order[s.turn]) return;
        const idx = Number(m.pick);
        if (!(idx >= 0 && idx < s.choices.length)) return;
        return beginDraw(t, s, idx);
      }
      if (m.guess !== undefined) return onGuess(t, s, from, m.guess);
      if (m.like) {
        if (s.phase !== 'reveal' || from === s.order[s.turn] || !s.ids.includes(from) || s.likes.includes(from)) return;
        return { ...s, likes: [...s.likes, from] };
      }
    },
    onSkip: (s, t) => {
      if (s.phase === 'pick' || s.phase === 'reveal') return startTurn(t, s, s.turn + 1);
      if (s.phase === 'draw') return endTurn(t, s);
    },
    view: s => ({
      phase: s.phase, turn: s.turn, total: s.order.length, lap: Math.floor(s.turn / Math.max(1, s.ids.length)) + 1, laps: s.cfg.laps,
      drawer: s.order[s.turn] ?? '', ms: msLeft(s.endsAt),
      hint: s.phase === 'draw' ? hintPattern(s.word, s.hints.slice(0, s.shown)) : '',
      category: s.phase === 'pick' ? '' : s.category, correct: s.correct, gained: s.gained, feed: s.feed, likes: s.likes,
      scores: s.scores, ids: s.ids, board: s.cfg.board,
      ...(s.phase === 'reveal' || s.phase === 'final' ? { word: s.word } : {}),
      ...(s.phase === 'final' ? { ranked: s.ranked } : {}),
    }),
  });

  // The host's live state, for the picture stream and private messages (never rendered).
  const hostState = useRef<() => State | null>(() => null);
  hostState.current = () => (isHost ? tools.get() ?? null : null);

  // The picture: only the drawer may add to it, only while drawing.
  const drawKey = view && view.phase !== 'final' ? `t${view.turn}` : '';
  const { onOp } = useDrawStream(room, 'dd', {
    drawKey,
    canvas,
    hostKey: () => { const s = hostState.current(); return s && s.phase === 'draw' ? `t${s.turn}` : ''; },
    accept: (from) => { const s = hostState.current(); return !!s && s.phase === 'draw' && from === s.order[s.turn]; },
  });

  // Host: private messages (the drawer's choices / word, the word for players who got it).
  useEffect(() => {
    return onMessage((m: GameMsg) => {
      if (m.t === 'dd_ask_secret' && isHost && m.from) {
        const s = hostState.current();
        if (s) sendSecret(s, m.from);
      } else if (m.t === 'dd_secret' && m.to === myId) {
        setSecret({ turn: Number(m.turn), choices: m.choices as string[] | undefined, word: m.word as string | undefined });
      } else if (m.t === 'dd_close' && m.to === myId) {
        setNote({ turn: Number(m.turn), text: 'So close! 🔥 Check your spelling!' });
      }
    });
    // sendSecret only reads the latest state through hostState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessage, isHost, myId]);

  const turn = view?.turn ?? -1;
  const phase = view?.phase;
  const amDrawer = !!view && view.drawer === myId;
  const iGuessed = !!view && view.correct.includes(myId);
  const plays = !!view && view.ids.includes(myId) && !isBoard;

  // Ask for my secret when I need it and don't have it (first mount, refresh, a missed message).
  const askedFor = useRef('');
  useEffect(() => {
    if (!view || isBoard) return;
    const need = (amDrawer && (phase === 'pick' || phase === 'draw')) || (iGuessed && phase === 'draw');
    if (!need) return;
    const have = secret?.turn === turn && (phase === 'pick' ? !!secret.choices : !!secret.word);
    const tag = `${turn}:${phase}:${iGuessed}`;
    if (have || askedFor.current === tag) return;
    askedFor.current = tag;
    const id = window.setTimeout(() => send({ t: 'dd_ask_secret' }), 400); // the host usually sends it first
    return () => window.clearTimeout(id);
  }, [view, isBoard, amDrawer, iGuessed, phase, turn, secret, send]);

  // Sounds + rewards
  useEffect(() => { if (phase === 'reveal') playPop(); }, [phase, turn]);
  useEffect(() => { if (iGuessed) playCorrect(); }, [iGuessed]);
  useEffect(() => { if (view?.hint && view.hint.replace(/[_ ]/g, '').length > 0) playTick(); }, [view?.hint]);
  const reported = useRef(false);
  useEffect(() => {
    if (phase !== 'final' || !view?.ranked) return;
    if (isBoard) { if (!reported.current) { reported.current = true; room.reportResult(view.ranked); } }
    else finish(view.ranked);
  }, [phase, view?.ranked, finish, isBoard, room]);

  const seconds = useCountdown(phase === 'pick' || phase === 'draw' || phase === 'reveal' ? view?.ms : undefined, `${turn}:${phase}:${view?.ms === 0}`);

  if (!view) {
    return <Frame><Waiting text="Sharpening the pencils…" /></Frame>;
  }

  const drawer = who(room.players, view.drawer);
  const mySecret = secret?.turn === turn ? secret : null;
  const canGuess = plays && !amDrawer && phase === 'draw' && !iGuessed;
  const myNote = note?.turn === turn ? note.text : '';

  const onKey = (k: string) => {
    setNote(null);
    setGuess(g => (g.length >= MAX_GUESS || (k === ' ' && (g === '' || g.endsWith(' '))) ? g : g + k.toLowerCase()));
  };
  const onBackspace = () => setGuess(g => g.slice(0, -1));
  const onEnter = () => {
    const text = guess.trim();
    if (!canGuess || !text) return;
    if (!isKidSafe(text)) {
      setNote({ turn, text: 'Let’s keep it kind — try another word! 🙂' });
      setGuess('');
      return;
    }
    playClick();
    input({ turn, guess: text });
    setGuess('');
  };

  const pickWord = (i: number) => {
    if (!amDrawer || phase !== 'pick') return;
    playClick();
    input({ turn, pick: i });
  };

  const like = () => {
    if (liked === turn || amDrawer || !plays) return;
    playPop();
    setLiked(turn);
    input({ turn, like: 1 });
  };

  const save = async () => {
    const c = canvas.current;
    if (!c) return;
    playClick();
    const image = await c.toBlob(1200, 900);
    const thumb = c.getImage(240, 180, 0.7);
    const now = Date.now();
    const ok = !!image && await saveDoodle({ id: `dd-${now}`, created: now, updated: now, background: '#ffffff', image, thumb });
    if (ok) playUnlock();
    setSaved({ turn, text: ok ? 'Saved to your Doodle Pad! 🖼️' : 'Couldn’t save on this device 😕' });
  };

  const blanks = view.hint.split('').map((ch, i) => (
    <span key={i} className={ch === ' ' ? 'inline-block w-4' : 'inline-block w-6 text-center border-b-4 border-amber-300/70 mx-0.5'}>{ch === '_' || ch === ' ' ? ' ' : ch.toUpperCase()}</span>
  ));

  const feed = (
    <div className="bg-white/5 rounded-2xl p-3 min-h-[5rem]" data-testid="dd-feed">
      <div className="font-fredoka text-lg text-orange-300 mb-1">Guesses</div>
      {view.feed.length === 0 && <div className="font-nunito text-base text-white/60">No guesses yet…</div>}
      {view.feed.map((f, i) => (
        <div key={i} className={`font-nunito text-lg py-0.5 break-words ${f.ok ? 'text-emerald-300 font-bold' : 'text-white/80'}`}>
          {f.ok ? `✅ ${who(room.players, f.id).name} guessed it! +${f.pts}` : `💬 ${who(room.players, f.id).name}: ${f.text}`}
        </div>
      ))}
    </div>
  );

  const banner = (() => {
    if (phase === 'pick') {
      return amDrawer ? null : (
        <div className="text-center font-fredoka text-2xl">🤔 {drawer.emoji} {drawer.name} is choosing a word… <span className="text-orange-200">{seconds}s</span></div>
      );
    }
    if (phase === 'draw') {
      if (amDrawer) {
        return (
          <div className="inline-flex flex-wrap items-center justify-center gap-2 bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-5 py-2 font-fredoka text-xl">
            ✏️ Draw: <span className="font-bold text-amber-300 text-3xl uppercase tracking-wider" data-testid="dd-my-word">{mySecret?.word || '…'}</span>
            <span className="text-orange-200 text-lg">No letters or numbers! · {view.correct.length} got it</span>
          </div>
        );
      }
      return (
        <div className="space-y-1">
          <div className="font-fredoka text-xl">✏️ {drawer.emoji} {drawer.name} is drawing{view.category && <span className="text-orange-200"> · {view.category}</span>}</div>
          {iGuessed && mySecret?.word ? (
            <div className="font-fredoka text-2xl text-emerald-300">✅ You got it: <span className="uppercase">{mySecret.word}</span> — shhh! 🤫</div>
          ) : (
            <div className={`font-fredoka ${isBoard ? 'text-5xl' : 'text-3xl'} tracking-wide whitespace-nowrap`} aria-label="Word hint" data-testid="dd-hint">{blanks}</div>
          )}
        </div>
      );
    }
    return null;
  })();

  return (
    <Frame
      right={(
        <div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right">
          <div>Turn {Math.min(view.turn + 1, view.total)}/{view.total}</div>
          {phase !== 'final' && <div className={seconds <= 10 && phase === 'draw' ? 'text-amber-300' : 'text-orange-200'}>⏱️ {seconds}s</div>}
        </div>
      )}
    >
      {phase === 'pick' && amDrawer && (
        <div className="rounded-3xl bg-white/10 p-5 mb-4 text-center" data-testid="dd-choices">
          <div className="font-fredoka text-3xl mb-1">🎨 Your turn to draw!</div>
          <div className="font-nunito text-lg text-orange-200 mb-4">Pick a word · {seconds}s</div>
          <div className="grid sm:grid-cols-3 gap-3">
            {(mySecret?.choices ?? []).map((w, i) => (
              <motion.button key={w} whileTap={{ scale: 0.94 }} onClick={() => pickWord(i)}
                className="min-h-[96px] rounded-3xl bg-gradient-to-br from-amber-400/30 to-pink-500/30 border-4 border-amber-300/60 px-4 py-3">
                <div className="font-fredoka text-3xl uppercase">{w}</div>
                <div className="font-nunito text-lg text-orange-100">{LEVEL_LABEL[wordLevel(w)]}</div>
              </motion.button>
            ))}
            {!mySecret?.choices && <div className="sm:col-span-3 font-fredoka text-xl animate-pulse">Getting your words…</div>}
          </div>
        </div>
      )}

      {banner && <div className="text-center mb-3">{banner}</div>}

      <div className={`grid gap-4 ${isBoard ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : 'lg:grid-cols-[minmax(0,1fr)_23rem]'}`}>
        <div className={`relative w-full mx-auto ${amDrawer || isBoard ? 'max-w-3xl' : 'max-w-2xl'} lg:max-w-none`}>
          {/* The board keeps to the screen height (landscape iPad); the tools keep the full width. */}
          <DrawCanvas ref={canvas} disabled={!amDrawer || phase !== 'draw'} onOp={onOp}
            className={`mx-auto ${amDrawer && phase === 'draw' ? 'max-w-[max(20rem,calc((100dvh_-_400px)*4/3))]' : 'max-w-[max(20rem,calc((100dvh_-_260px)*4/3))]'}`} />
          {phase === 'pick' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-7xl animate-bounce">✏️</div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {phase === 'reveal' && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="rounded-3xl bg-gradient-to-br from-rose-800 to-purple-900 border-4 border-amber-400 p-5 text-center" data-testid="dd-reveal">
              <div className="font-fredoka text-xl text-orange-200">The word was</div>
              <div className="font-fredoka text-4xl text-amber-300 uppercase mb-2" data-testid="dd-reveal-word">{view.word}</div>
              <div className="font-nunito text-lg mb-1">
                {view.correct.length === 0 ? 'Tricky one! Nobody got it this time 🙂' : `${view.correct.length} guessed it!`}
                {(view.gained[view.drawer] ?? 0) > 0 && ` · ${drawer.name} +${view.gained[view.drawer]}`}
              </div>
              <div className="font-fredoka text-2xl mb-3" data-testid="dd-likes">👍 {view.likes.length} great drawing{view.likes.length === 1 ? '' : 's'}!</div>
              <div className="flex flex-wrap justify-center gap-2">
                {plays && !amDrawer && (
                  <button onClick={like} disabled={liked === turn}
                    className="min-h-[52px] px-5 rounded-full font-fredoka text-lg bg-emerald-500/80 disabled:opacity-60">
                    {liked === turn ? '👍 Thanks!' : '👍 Great drawing!'}
                  </button>
                )}
                {saved?.turn === turn ? (
                  <div className="font-fredoka text-lg text-emerald-200 self-center">{saved.text}</div>
                ) : (
                  <button onClick={() => { void save(); }} className="min-h-[52px] px-5 rounded-full font-fredoka text-lg bg-white/20 border-2 border-white/40">
                    💾 Save to my Doodle Pad
                  </button>
                )}
              </div>
              <div className="font-nunito text-base text-orange-200 mt-3">{view.turn + 1 < view.total ? `Next artist in ${seconds}s…` : 'Adding up the scores…'}</div>
            </motion.div>
          )}

          {plays && !amDrawer && phase === 'draw' && (
            <div>
              <div className={`min-h-[52px] rounded-2xl px-4 py-2 font-fredoka text-2xl flex items-center justify-center tracking-wide mb-2 ${iGuessed ? 'bg-emerald-500/30 text-emerald-100' : 'bg-white/90 text-gray-800'}`} data-testid="dd-guess">
                {iGuessed ? 'You guessed it! 🎉' : guess ? guess.toUpperCase() : <span className="text-gray-400 text-xl">Tap letters to guess…</span>}
              </div>
              {myNote && <div className="text-center font-fredoka text-xl text-amber-200 mb-2" data-testid="dd-note">{myNote}</div>}
              <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={!canGuess} enterLabel="Guess" />
            </div>
          )}

          {feed}
          <ScoreList players={room.players} scores={view.scores} accent="text-orange-300" max={10} />
        </div>
      </div>

      {phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={isBoard ? null : reward} />
      )}
    </Frame>
  );
}

function Frame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="min-h-screen-d bg-gradient-to-br from-orange-950 via-rose-950 to-purple-950 text-white px-4 select-none"
      style={{ paddingTop: 'max(4rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="font-fredoka text-3xl md:text-4xl">🎨 Doodle Dash</h1>
            <div className="font-nunito text-lg text-orange-200">One draws, everyone guesses!</div>
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}
