import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameConfig, GameMsg, RoomApi } from '../../online/useRoom';
import { useHostGame, useCountdown, type HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { playClick, playCorrect, playPop, playTick, playWin } from '../../utils/sounds';
import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas';
import { useDrawStream } from './useDrawStream';
import type { Action, DrawOp } from './drawOps';
import { FinalCard } from './RaceParts';
import { Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import {
  CARD_MS, TURN_MS, VOTE_MS, DRUM_MS, UNMASK_MS, GUESS_MS, REVEAL_MS, STROKES_PER_TURN, LAPS,
  parseConfig, colorsFor, fakeOrder, turnOrder, pickWord, guessChoices, validVote, tally, mostVoted, roundPoints, allVoted,
  type FaConfig,
} from './fakeArtistLogic';

// Fake Artist: everyone draws one shared picture of a secret word, one line per turn, two laps.
// One player — the fake artist — only knows the category. Then everyone votes for the fake;
// a caught fake can still steal the round by picking the word from 6 choices.
// Host-authoritative (useHostGame, prefix fa). The word and who the fake is never go in the
// public view until the reveal: each device gets its own card in an addressed fa_card message.
// The picture streams through the host (useDrawStream), which only takes the current artist's
// one line, in their own colour.

type Phase = 'card' | 'turn' | 'vote' | 'drum' | 'unmask' | 'guess' | 'reveal' | 'final';

interface State {
  cfg: FaConfig;
  ids: string[];
  colors: Record<string, string>;
  fakes: string[];
  round: number;
  fake: string;
  word: string;
  category: string;
  used: string[];
  order: string[];
  turn: number;
  turnStart: number;
  phase: Phase;
  endsAt: number;
  votes: Record<string, string>;
  top: string | null;
  caught: boolean;
  choices: string[];
  fakeGuess: string | null;
  last: Record<string, number>;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}

interface View {
  phase: Phase; round: number; rounds: number; ms: number; turn: number; turns: number; drawer: string;
  colors: Record<string, string>; category: string; ids: string[]; order: string[]; voted: string[]; board: boolean;
  scores: Record<string, number>;
  votes?: Record<string, string>; top?: string | null; fake?: string; caught?: boolean; choices?: string[];
  fakeGuess?: string | null; word?: string; last?: Record<string, number>; ranked?: (string | string[])[];
}

interface Card { round: number; word: string | null; category: string }

const AUTO_DONE_MS = 2500;

export default function FakeArtist({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const cfg = parseConfig(config);
  const { finish, reward } = useArenaFinish(room);
  const { myId, isHost, send, onMessage } = room;
  const isBoard = cfg.board && isHost;
  const canvas = useRef<DrawCanvasHandle>(null);
  const playersRef = useRef(room.players);
  playersRef.current = room.players;
  const actionsRef = useRef<() => Action[]>(() => []);

  const [card, setCard] = useState<Card | null>(null);
  const [peek, setPeek] = useState(false);
  const [myVote, setMyVote] = useState<{ round: number; id: string } | null>(null);
  const [drew, setDrew] = useState('');

  // ---------------- HOST ----------------
  const present = () => new Set(playersRef.current.map(p => p.id));

  const sendCard = (s: State, to: string) => {
    if (!s.ids.includes(to) || !s.word || s.phase === 'final') return;
    send({ t: 'fa_card', to, round: s.round, word: to === s.fake ? null : s.word, category: s.category });
  };

  const startRound = (t: HostTools<State>, s: State, r: number): State => {
    ['card', 'turn', 'vote', 'drum', 'unmask', 'guess', 'reveal'].forEach(k => t.cancel(k));
    const here = present();
    const live = s.ids.filter(id => here.has(id));
    if (r > s.cfg.rounds || live.length < 2) return { ...s, phase: 'final', endsAt: 0, ranked: rankByScore(s.scores, s.ids) };
    let fake = s.fakes[r - 1];
    if (!here.has(fake)) fake = live[Math.floor(Math.random() * live.length)];
    const secret = pickWord(s.cfg.category, s.used);
    const n: State = {
      ...s, round: r, fake, word: secret.word, category: secret.category, used: [...s.used, secret.word],
      order: turnOrder(live, fake), turn: -1, turnStart: 0, phase: 'card', endsAt: Date.now() + CARD_MS,
      votes: {}, top: null, caught: false, choices: [], fakeGuess: null, last: {},
    };
    n.ids.forEach(id => sendCard(n, id));
    t.after('card', CARD_MS, () => { const cur = t.get(); if (cur.phase === 'card' && cur.round === r) t.set(startTurn(t, cur, 0)); });
    return n;
  };

  const startTurn = (t: HostTools<State>, s: State, k: number): State => {
    t.cancel('turn');
    const here = present();
    let i = k;
    while (i < s.order.length && !here.has(s.order[i])) i++;
    if (i >= s.order.length) return startVote(t, s);
    t.after('turn', TURN_MS + 300, () => { const cur = t.get(); if (cur.phase === 'turn' && cur.round === s.round && cur.turn === i) t.set(startTurn(t, cur, i + 1)); });
    return { ...s, phase: 'turn', turn: i, turnStart: actionsRef.current().length, endsAt: Date.now() + TURN_MS };
  };

  const startVote = (t: HostTools<State>, s: State): State => {
    t.cancel('turn');
    t.after('vote', VOTE_MS + 300, () => t.set(endVote(t, t.get())));
    return { ...s, phase: 'vote', endsAt: Date.now() + VOTE_MS, votes: {} };
  };

  const endVote = (t: HostTools<State>, s: State): State => {
    if (s.phase !== 'vote') return s;
    t.cancel('vote');
    t.after('drum', DRUM_MS, () => t.set(unmask(t, t.get())));
    return { ...s, phase: 'drum', endsAt: Date.now() + DRUM_MS };
  };

  const unmask = (t: HostTools<State>, s: State): State => {
    if (s.phase !== 'drum') return s;
    t.cancel('drum');
    const top = mostVoted(s.votes);
    const caught = top === s.fake;
    t.after('unmask', UNMASK_MS, () => { const cur = t.get(); t.set(cur.caught ? startGuess(t, cur) : reveal(t, cur)); });
    return { ...s, phase: 'unmask', top, caught, endsAt: Date.now() + UNMASK_MS };
  };

  const startGuess = (t: HostTools<State>, s: State): State => {
    if (s.phase !== 'unmask') return s;
    t.cancel('unmask');
    t.after('guess', GUESS_MS + 300, () => t.set(reveal(t, t.get())));
    return { ...s, phase: 'guess', choices: guessChoices({ word: s.word, category: s.category }), endsAt: Date.now() + GUESS_MS };
  };

  const reveal = (t: HostTools<State>, s: State): State => {
    if (s.phase !== 'unmask' && s.phase !== 'guess') return s;
    ['unmask', 'guess'].forEach(k => t.cancel(k));
    const right = s.caught && s.fakeGuess === s.word;
    const last = roundPoints(s.ids, s.fake, s.caught, right);
    const scores = { ...s.scores };
    for (const id of s.ids) scores[id] = (scores[id] ?? 0) + (last[id] ?? 0);
    const r = s.round;
    t.after('reveal', REVEAL_MS, () => { const cur = t.get(); if (cur.phase === 'reveal' && cur.round === r) t.set(startRound(t, cur, r + 1)); });
    return { ...s, phase: 'reveal', last, scores, endsAt: Date.now() + REVEAL_MS };
  };

  const { view, input, tools } = useHostGame<State, View>(room, 'fa', {
    board: cfg.board,
    start: (ids, t) => {
      const s: State = {
        cfg, ids, colors: colorsFor(ids), fakes: fakeOrder(ids, cfg.rounds), round: 0, fake: '', word: '', category: '', used: [],
        order: [], turn: -1, turnStart: 0, phase: 'card', endsAt: 0, votes: {}, top: null, caught: false, choices: [],
        fakeGuess: null, last: {}, scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [],
      };
      return startRound(t, s, 1);
    },
    onInput: (s, from, m, t) => {
      if (m.round !== s.round) return;
      if (m.done !== undefined) {
        if (s.phase !== 'turn' || m.done !== s.turn || from !== s.order[s.turn]) return;
        return startTurn(t, s, s.turn + 1);
      }
      if (m.vote !== undefined) {
        if (s.phase !== 'vote' || s.votes[from] !== undefined || !validVote(from, m.vote, s.ids)) return;
        const n = { ...s, votes: { ...s.votes, [from]: m.vote as string } };
        const here = present();
        return allVoted(n.ids.filter(id => here.has(id)), n.votes) ? endVote(t, n) : n;
      }
      if (m.guess !== undefined) {
        if (s.phase !== 'guess' || from !== s.fake || typeof m.guess !== 'string' || !s.choices.includes(m.guess)) return;
        return reveal(t, { ...s, fakeGuess: m.guess });
      }
    },
    onSkip: (s, t) => {
      switch (s.phase) {
        case 'card': return startTurn(t, s, 0);
        case 'turn': return startTurn(t, s, s.turn + 1);
        case 'vote': return endVote(t, s);
        case 'drum': return unmask(t, s);
        case 'unmask': return s.caught ? startGuess(t, s) : reveal(t, s);
        case 'guess': return reveal(t, s);
        case 'reveal': return startRound(t, s, s.round + 1);
        default: return undefined;
      }
    },
    view: s => {
      const shown = s.phase === 'unmask' || s.phase === 'guess' || s.phase === 'reveal';
      return {
        phase: s.phase, round: s.round, rounds: s.cfg.rounds, ms: msLeft(s.endsAt), turn: s.turn, turns: s.order.length,
        drawer: s.phase === 'turn' ? s.order[s.turn] ?? '' : '', colors: s.colors, category: s.category, ids: s.ids, order: s.order,
        voted: Object.keys(s.votes), board: s.cfg.board, scores: s.scores,
        ...(shown ? { votes: s.votes, top: s.top, fake: s.fake, caught: s.caught } : {}),
        ...(s.phase === 'guess' || s.phase === 'reveal' ? { choices: s.choices } : {}),
        ...(s.phase === 'reveal' ? { word: s.word, fakeGuess: s.fakeGuess, last: s.last } : {}),
        ...(s.phase === 'final' ? { ranked: s.ranked } : {}),
      };
    },
  });

  // The shared picture: only the current artist, one line per turn, in their own colour.
  const hostState = () => (isHost ? tools.get() ?? null : null);
  const drawKey = view && view.round > 0 && view.phase !== 'final' ? `r${view.round}` : '';
  const { onOp: streamOp, hostActions } = useDrawStream(room, 'fa', {
    drawKey,
    canvas,
    hostKey: () => { const s = hostState(); return s && s.phase === 'turn' ? `r${s.round}` : ''; },
    accept: (from, op: DrawOp, actions) => {
      const s = hostState();
      if (!s || s.phase !== 'turn' || from !== s.order[s.turn]) return false;
      const mine = actions.length - s.turnStart; // actions added this turn (all this artist's)
      if (op.k === 'pt') {
        if (op.c !== s.colors[from]) return false;
        return op.pt[2] ? mine < STROKES_PER_TURN : mine > 0 && actions[actions.length - 1].k === 'stroke';
      }
      if (op.k === 'undo') return mine > 0;
      return false; // no fills or clears in Fake Artist
    },
  });
  actionsRef.current = hostActions;

  // Cards: the host sends each player theirs; a device that missed it (or refreshed) asks.
  useEffect(() => {
    return onMessage((m: GameMsg) => {
      if (m.t === 'fa_ask_card' && isHost && m.from) {
        const s = tools.get();
        if (s) sendCard(s, m.from);
      } else if (m.t === 'fa_card' && m.to === myId) {
        setCard({ round: Number(m.round), word: (m.word as string | null) ?? null, category: String(m.category ?? '') });
      }
    });
    // sendCard / tools read the latest host state on each call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMessage, isHost, myId]);

  const round = view?.round ?? 0;
  const phase = view?.phase;
  const plays = !!view && view.ids.includes(myId) && !isBoard;
  const myCard = card?.round === round ? card : null;
  const askedRound = useRef(0);
  useEffect(() => {
    if (!plays || !round || myCard || phase === 'final' || askedRound.current === round) return;
    askedRound.current = round;
    const id = window.setTimeout(() => send({ t: 'fa_ask_card' }), 600);
    return () => window.clearTimeout(id);
  }, [plays, round, myCard, phase, send]);

  // The card is big while everyone reads it, then hidden (tap to peek) so the picture fits.
  useEffect(() => { setPeek(false); }, [phase, round]);

  // Drama: a drumroll, then the unmasking.
  useEffect(() => {
    if (phase !== 'drum') return;
    let n = 0;
    const iv = window.setInterval(() => { n++; playTick(); if (n > 12) window.clearInterval(iv); }, 210);
    return () => window.clearInterval(iv);
  }, [phase, round]);
  useEffect(() => {
    if (phase === 'unmask') { if (view?.caught) playWin(); else playPop(); }
    if (phase === 'reveal') playCorrect();
    if (phase === 'card') playPop();
    // Only on phase changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  const reported = useRef(false);
  useEffect(() => {
    if (phase !== 'final' || !view?.ranked) return;
    if (isBoard) { if (!reported.current) { reported.current = true; room.reportResult(view.ranked); } }
    else finish(view.ranked);
  }, [phase, view?.ranked, finish, isBoard, room]);

  const seconds = useCountdown(view && phase !== 'final' ? view.ms : undefined, `${round}:${phase}:${view?.turn}`);

  // My turn: one line, then "Done" (sent automatically a moment after the line, unless undone).
  const myTurn = !!view && phase === 'turn' && view.drawer === myId;
  const turnTag = `${round}-${view?.turn ?? -1}`;
  const doneTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(doneTimer.current), [turnTag]);
  const sendDone = () => {
    window.clearTimeout(doneTimer.current);
    if (!view || !myTurn) return;
    playClick();
    input({ round, done: view.turn });
  };
  const sendDoneRef = useRef(sendDone);
  sendDoneRef.current = sendDone;
  const onOp = (op: DrawOp) => {
    streamOp(op);
    if (op.k === 'undo') { window.clearTimeout(doneTimer.current); setDrew(''); }
  };
  const onStrokeEnd = () => {
    setDrew(turnTag);
    window.clearTimeout(doneTimer.current);
    doneTimer.current = window.setTimeout(() => sendDoneRef.current(), AUTO_DONE_MS);
  };

  if (!view || round === 0) return <Frame><Waiting text="Shuffling the secret cards…" /></Frame>;

  const name = (id: string) => who(room.players, id);
  const dot = (id: string, size = 'w-5 h-5') => <span className={`inline-block ${size} rounded-full border-2 border-white/70 align-middle`} style={{ background: view.colors[id] }} />;
  const iAmFake = !!myCard && myCard.word === null;
  const live = view.ids.filter(id => room.players.some(p => p.id === id));
  const t = tally(view.votes ?? {});

  const cardBox = myCard && (
    <motion.div key={`card-${round}`} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ duration: 0.35 }}
      className={`rounded-3xl border-4 p-5 text-center ${iAmFake ? 'bg-gradient-to-br from-fuchsia-700 to-purple-900 border-fuchsia-300' : 'bg-gradient-to-br from-emerald-700 to-teal-900 border-emerald-300'}`}
      data-testid="fa-card">
      {iAmFake ? (
        <>
          <div className="text-6xl mb-1">🎭</div>
          <div className="font-fredoka text-3xl text-fuchsia-100">You're the FAKE ARTIST!</div>
          <div className="font-nunito text-xl mt-1">The category is <b>{myCard.category}</b> — draw like you know the word. Blend in! 🤫</div>
        </>
      ) : (
        <>
          <div className="text-5xl mb-1">🖼️</div>
          <div className="font-nunito text-xl">The secret word is</div>
          <div className="font-fredoka text-4xl uppercase text-amber-200" data-testid="fa-word">{myCard.word}</div>
          <div className="font-nunito text-lg mt-1">Category: {myCard.category} · Someone here doesn't know it! 🕵️</div>
        </>
      )}
    </motion.div>
  );

  const status = (() => {
    switch (phase) {
      case 'card':
        return <div className="font-fredoka text-2xl">🃏 Look at your secret card! <span className="text-violet-200">Category: {view.category}</span></div>;
      case 'turn':
        return myTurn ? (
          <div className="font-fredoka text-2xl text-amber-200" data-testid="fa-myturn">{dot(myId)} Your turn! Add ONE line ✏️</div>
        ) : (
          <div className="font-fredoka text-2xl">{dot(view.drawer)} {name(view.drawer).emoji} {name(view.drawer).name} is adding a line…</div>
        );
      case 'vote':
        return <div className="font-fredoka text-2xl">🕵️ Who is the fake artist? <span className="text-violet-200">{view.voted.length}/{live.length} voted</span></div>;
      case 'drum':
        return <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.4 }} className="font-fredoka text-4xl">🥁 The votes are in…</motion.div>;
      default:
        return null;
    }
  })();

  const canvasBox = (
    <div className={`mx-auto w-full ${phase === 'turn' || phase === 'card' ? (isBoard ? 'max-w-4xl' : 'max-w-2xl') : isBoard ? 'max-w-3xl' : 'max-w-md'}`}
      style={!isBoard && phase === 'turn' ? { maxWidth: `max(20rem, min(42rem, calc((100dvh - ${myTurn ? 420 : 300}px) * 4 / 3)))` } : undefined}>
      <DrawCanvas ref={canvas} disabled={!myTurn} onOp={onOp} onStrokeEnd={onStrokeEnd} color={view.colors[myId] ?? '#1f2937'}
        tools={{ sizes: false, fill: false, eraser: false, clear: false, undo: true }} maxStrokes={STROKES_PER_TURN} strokeKey={turnTag} />
      {myTurn && (
        <div className="flex justify-center mt-2">
          <button onClick={sendDone} className="min-h-[52px] px-8 rounded-full font-fredoka text-xl bg-gradient-to-r from-emerald-400 to-teal-500 shadow-lg" data-testid="fa-done">
            {drew === turnTag ? '✅ Done!' : '⏭️ Pass'}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Frame
      right={(
        <div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right">
          <div>Round {round}/{view.rounds}</div>
          {phase !== 'final' && <div className={seconds <= 5 ? 'text-amber-300' : 'text-violet-200'}>⏱️ {seconds}s</div>}
        </div>
      )}
    >
      {status && <div className="text-center mb-3">{status}</div>}

      {/* My card: big at the start of a round, then tap to peek. */}
      {plays && (phase === 'card' ? cardBox : phase !== 'final' && myCard && (
        <div className="mb-3">
          <div className="flex justify-center">
            <button onClick={() => { playClick(); setPeek(p => !p); }} className="min-h-[48px] px-5 rounded-full font-fredoka text-lg bg-white/15 border-2 border-white/30">
              {peek ? '🙈 Hide my card' : '🃏 Peek at my card'}
            </button>
          </div>
          {peek && (
            <div className={`mt-2 mx-auto max-w-md rounded-2xl border-2 px-4 py-2 text-center font-fredoka text-xl ${iAmFake ? 'bg-fuchsia-800/80 border-fuchsia-300' : 'bg-emerald-800/80 border-emerald-300'}`} data-testid="fa-peek">
              {iAmFake ? `🎭 You're the fake! Category: ${myCard.category}` : <>🖼️ <span className="uppercase text-amber-200">{myCard.word}</span> · {myCard.category}</>}
            </div>
          )}
        </div>
      ))}
      {!plays && phase === 'card' && (
        <div className="text-center font-nunito text-xl text-violet-200 mb-3">Everyone but one artist knows the secret word… 🤫</div>
      )}

      {phase !== 'final' && <div className={phase === 'vote' ? 'mb-4' : ''}>{canvasBox}</div>}

      {/* Turn order with colours */}
      {(phase === 'turn' || phase === 'card') && (
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {view.order.slice(0, Math.ceil(view.order.length / LAPS)).map(id => (
            <span key={id} className={`rounded-full px-3 py-1 font-nunito text-lg ${view.drawer === id ? 'bg-amber-400/30 ring-2 ring-amber-300' : 'bg-white/10'}`}>
              {dot(id, 'w-4 h-4')} {name(id).name}
            </span>
          ))}
        </div>
      )}

      {phase === 'vote' && (
        <div>
          {plays ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="fa-vote">
              {view.ids.filter(id => id !== myId && live.includes(id)).map(id => {
                const mine = myVote?.round === round ? myVote.id : null;
                return (
                  <motion.button key={id} whileTap={{ scale: 0.94 }} disabled={!!mine || view.voted.includes(myId)}
                    onClick={() => { playClick(); setMyVote({ round, id }); input({ round, vote: id }); }}
                    className={`min-h-[64px] rounded-2xl px-3 font-fredoka text-xl border-4 flex items-center gap-2 justify-center ${mine === id ? 'bg-amber-400/40 border-amber-300' : 'bg-white/10 border-white/20 disabled:opacity-50'}`}>
                    {dot(id)} {name(id).emoji} {name(id).name}
                  </motion.button>
                );
              })}
              {view.voted.includes(myId) && <div className="col-span-full text-center font-nunito text-lg text-violet-200">🤫 Vote locked in — waiting for the others…</div>}
            </div>
          ) : (
            <div className="text-center font-fredoka text-2xl text-violet-200">Everyone is voting on their own device… 🗳️</div>
          )}
        </div>
      )}

      <AnimatePresence>
        {(phase === 'unmask' || phase === 'guess' || phase === 'reveal') && view.fake && (
          <motion.div key={`res-${round}-${phase}`} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="mt-4 rounded-3xl bg-gradient-to-br from-violet-800 to-fuchsia-900 border-4 border-amber-400 p-5 text-center" data-testid="fa-result">
            {phase === 'unmask' && (
              <>
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {view.ids.filter(id => t[id]).sort((a, b) => (t[b] ?? 0) - (t[a] ?? 0)).map(id => (
                    <span key={id} className="rounded-full bg-black/25 px-3 py-1 font-nunito text-lg">{dot(id, 'w-4 h-4')} {name(id).name}: {t[id]} 🗳️</span>
                  ))}
                </div>
                {!view.top ? (
                  <div className="font-fredoka text-2xl">No clear pick in the vote — it's a tie!</div>
                ) : (
                  <div className="font-fredoka text-2xl">Most votes: {name(view.top).emoji} {name(view.top).name}</div>
                )}
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: 'spring' }} className="font-fredoka text-3xl text-amber-300 mt-2">
                  {view.caught
                    ? `🎉 ${name(view.fake).name} WAS the fake artist!`
                    : `🎭 The fake was ${name(view.fake).emoji} ${name(view.fake).name}! Sneaky! 🎨`}
                </motion.div>
                {view.caught && <div className="font-nunito text-xl mt-2">But can they guess the word and steal the round? 🤔</div>}
              </>
            )}
            {phase === 'guess' && (
              <>
                <div className="font-fredoka text-2xl mb-3">
                  {view.fake === myId ? '🎭 Last chance! Which word were they drawing?' : `🎭 ${name(view.fake).name} gets one guess at the word…`}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="fa-choices">
                  {(view.choices ?? []).map(w => (
                    <motion.button key={w} whileTap={{ scale: 0.94 }} disabled={view.fake !== myId}
                      onClick={() => { playClick(); input({ round, guess: w }); }}
                      className="min-h-[64px] rounded-2xl font-fredoka text-2xl uppercase bg-white/15 border-4 border-white/25 disabled:opacity-80">
                      {w}
                    </motion.button>
                  ))}
                </div>
              </>
            )}
            {phase === 'reveal' && (
              <>
                <div className="font-nunito text-xl">The secret word was</div>
                <div className="font-fredoka text-4xl uppercase text-amber-300 mb-2" data-testid="fa-reveal-word">{view.word}</div>
                <div className="font-fredoka text-2xl mb-2">
                  {!view.caught
                    ? `Sneaky! 🎨 ${name(view.fake).name} fooled everyone — +3!`
                    : view.fakeGuess === view.word
                      ? `Sneaky! 🎨 ${name(view.fake).name} guessed “${view.word}” and steals the round — +3!`
                      : `Great detective work, artists! 🕵️ +2 each${view.fakeGuess ? ` (${name(view.fake).name} guessed “${view.fakeGuess}” — good try!)` : ''}`}
                </div>
                <div className="font-nunito text-lg text-violet-200">{round < view.rounds ? `Next round in ${seconds}s…` : 'Adding up the scores…'}</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4">
        <Scores room={room} scores={view.scores} ids={view.ids}
          note={id => (view.last?.[id] ? <span className="font-fredoka text-green-300">+{view.last[id]}</span> : <span>{dot(id, 'w-4 h-4')}</span>)} />
      </div>

      {phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={isBoard ? null : reward} />
      )}
    </Frame>
  );
}

function Frame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="min-h-screen-d bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-950 text-white px-4 select-none"
      style={{ paddingTop: 'max(4rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="font-fredoka text-3xl md:text-4xl">🎨 Fake Artist</h1>
            <div className="font-nunito text-lg text-violet-200">One line each — but one artist is faking it!</div>
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}
