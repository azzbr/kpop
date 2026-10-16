import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { SPY_QUESTIONS } from '../../online/spyPlaces';
import type { SpyQuestionId } from '../../online/spyPlaces';
import { playClick, playPop, playCorrect, playWrong, playWin } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { FinalCard } from './RaceParts';
import { RoundPill, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { PartyFrame, TimerBar, PausedNote, NextButton } from './partyParts';
import { useAddressed, useAskUntil, useBoard } from './partyHooks';
import {
  ROUNDS, INTRO_MS, ASK_MS, ANSWER_MS, VOTE_MS, GUESS_MS, RESULT_MS, EARLY_VOTE_AFTER, MAX_WORD,
  questionCount, pickSpies, pickPlaces, assignRoles, questionCards, answerChips, guessOptions, tallyVotes, scoreRound, spyWins,
  placeById, checkWord, showWord, tidyWord,
} from './spyStationLogic';
import type { Outcome } from './spyStationLogic';

// Spy Station: everyone but the spy knows the secret place. The place, the spy and the roles
// stay on the host; each device asks for its own card (`ss_card`, addressed) and the asked
// player gets their answer chips the same way (`ss_chips`). The view only has the questions,
// the answers given, and (after the vote) who the spy was.

const HIDDEN_WORD = '(a secret word 🤐)';

interface QA { k: number; asker: string; q: SpyQuestionId; to: string; answer: string; auto?: boolean }
interface State {
  ids: string[];
  spies: string[];
  places: string[];
  round: number;
  phase: 'intro' | 'ask' | 'answer' | 'vote' | 'guess' | 'result' | 'final';
  endsAt: number;
  order: string[];
  qn: number;
  limit: number;
  asker: string;
  cards: SpyQuestionId[];
  q: SpyQuestionId | null;
  target: string | null;
  chips: string[];
  log: QA[];
  roles: Record<string, string>;
  options: string[];
  votes: Record<string, string>;
  tally: { counts: Record<string, number>; top: string | null } | null;
  guess: string | null;
  called: boolean;
  calledVote: string | null;
  outcome: Outcome | 'left' | null;
  gained: Record<string, number>;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}
interface View {
  round: number; phase: State['phase']; ms: number; ids: string[];
  qn: number; limit: number; asker: string; cards: SpyQuestionId[]; q: SpyQuestionId | null; target: string | null;
  log: QA[]; options: string[]; voted: string[]; calledVote: string | null;
  tally?: State['tally']; spy?: string; guess?: string | null; called?: boolean; outcome?: State['outcome'];
  place?: string; roles?: Record<string, string>; gained?: Record<string, number>;
  scores: Record<string, number>; ranked?: (string | string[])[];
}
interface Card { round: number; spy: boolean; place?: string; role?: string }

type Present = () => string[];
interface Ctx { t: HostTools<State>; present: Present; send: RoomApi['send'] }

const here = (s: State, present: string[]) => s.ids.filter(id => present.includes(id));
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const shuffle = <T,>(a: T[]) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
const spyOf = (s: State) => s.spies[s.round - 1];
const placeOf = (s: State) => placeById(s.places[s.round - 1])!;
const qText = (q: SpyQuestionId) => SPY_QUESTIONS.find(x => x.id === q)!;

function startRound(c: Ctx, s: State): State {
  const round = s.round + 1;
  const spy = s.spies[round - 1];
  const place = placeById(s.places[round - 1])!;
  const ids = here(s, c.present());
  const order = shuffle(ids.length >= 2 ? ids : s.ids);
  c.t.after('phase', INTRO_MS, () => c.t.set(startAsk(c, c.t.get())));
  return {
    ...s, round, phase: 'intro', endsAt: Date.now() + INTRO_MS, order, qn: 0, limit: questionCount(order.length), asker: order[0], cards: [], q: null,
    target: null, chips: [], log: [], roles: assignRoles(s.ids, spy, place), options: guessOptions(place), votes: {}, tally: null, guess: null,
    called: false, calledVote: null, outcome: null, gained: {},
  };
}

function startAsk(c: Ctx, s: State): State {
  if (s.phase !== 'intro' && s.phase !== 'answer') return s;
  const present = c.present();
  let asker = s.order[s.qn % s.order.length];
  for (let i = 0; i < s.order.length && !present.includes(asker); i++) asker = s.order[(s.qn + i + 1) % s.order.length];
  const cards = questionCards(Math.random, s.log.slice(-2).map(x => x.q));
  c.t.after('phase', ASK_MS + 300, () => { const x = c.t.get(); if (x.phase === 'ask') c.t.set(autoAsk(c, x)); });
  return { ...s, phase: 'ask', endsAt: Date.now() + ASK_MS, asker, cards, q: null, target: null, chips: [] };
}

function autoAsk(c: Ctx, s: State): State {
  const others = here(s, c.present()).filter(id => id !== s.asker);
  if (!others.length) return startVote(c, s);
  return startAnswer(c, s, pick(s.cards), pick(others));
}

function startAnswer(c: Ctx, s: State, q: SpyQuestionId, target: string): State {
  const chips = answerChips(placeOf(s), q, target === spyOf(s));
  c.send({ t: 'ss_chips', to: target, round: s.round, qn: s.qn, chips });
  c.t.after('phase', ANSWER_MS + 300, () => { const x = c.t.get(); if (x.phase === 'answer') c.t.set(answer(c, x, pick(x.chips), true)); });
  return { ...s, phase: 'answer', endsAt: Date.now() + ANSWER_MS, q, target, chips };
}

function answer(c: Ctx, s: State, word: string, auto = false): State {
  if (s.phase !== 'answer' || !s.q || !s.target) return s;
  const log = [...s.log, { k: s.qn, asker: s.asker, q: s.q, to: s.target, answer: word, ...(auto ? { auto } : {}) }];
  const n: State = { ...s, log, qn: s.qn + 1 };
  return n.qn >= n.limit ? startVote(c, n) : startAsk(c, n);
}

function startVote(c: Ctx, s: State, by: string | null = null): State {
  if (s.phase === 'vote' || s.phase === 'guess' || s.phase === 'result' || s.phase === 'final') return s;
  c.t.after('phase', VOTE_MS + 300, () => c.t.set(resolveVote(c, c.t.get())));
  return { ...s, phase: 'vote', endsAt: Date.now() + VOTE_MS, votes: {}, calledVote: by, q: null, target: null, chips: [] };
}

function resolveVote(c: Ctx, s: State): State {
  if (s.phase !== 'vote') return s;
  const tally = tallyVotes(s.votes);
  if (tally.top === spyOf(s)) {
    c.t.after('phase', GUESS_MS + 300, () => c.t.set(spyGuess(c, c.t.get(), null)));
    return { ...s, phase: 'guess', endsAt: Date.now() + GUESS_MS, tally };
  }
  return result(c, { ...s, tally }, 'escaped');
}

function spyGuess(c: Ctx, s: State, placeId: string | null): State {
  if (s.phase !== 'guess') return s;
  return result(c, { ...s, guess: placeId }, placeId === placeOf(s).id ? 'caught_stole' : 'caught_missed');
}

function result(c: Ctx, s: State, outcome: Outcome | 'left'): State {
  const gained = outcome === 'left' ? {} : scoreRound(outcome, spyOf(s), s.ids);
  const scores = { ...s.scores };
  for (const [id, p] of Object.entries(gained)) scores[id] = (scores[id] ?? 0) + p;
  c.t.after('phase', RESULT_MS, () => c.t.set(afterResult(c, c.t.get())));
  return { ...s, phase: 'result', endsAt: Date.now() + RESULT_MS, outcome, gained, scores, q: null, target: null, chips: [] };
}

function afterResult(c: Ctx, s: State): State {
  if (s.phase !== 'result') return s;
  if (s.round >= s.spies.length) { c.t.cancel('phase'); return { ...s, phase: 'final', ranked: rankByScore(s.scores, s.ids) }; }
  return startRound(c, s);
}

export default function SpyStation({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const { boardMode, isBoard } = useBoard(room, config);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const present = useRef<Present>(() => presentRef.current).current;
  const hostId = useRef(room.myId);
  const [card, setCard] = useState<Card | null>(null);
  const [chips, setChips] = useState<{ round: number; qn: number; chips: string[] } | null>(null);
  const ctx = (t: HostTools<State>): Ctx => ({ t, present, send: room.send });

  const { view, input, tools, paused } = useHostGame<State, View>(room, 'ss', {
    board: boardMode,
    start: (ids, t) => startRound(ctx(t), {
      ids, spies: pickSpies(ids, ROUNDS), places: pickPlaces(ROUNDS).map(p => p.id), round: 0, phase: 'intro', endsAt: 0, order: [], qn: 0, limit: 0,
      asker: '', cards: [], q: null, target: null, chips: [], log: [], roles: {}, options: [], votes: {}, tally: null, guess: null, called: false,
      calledVote: null, outcome: null, gained: {}, scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [],
    }),
    onInput: (s, from, m, t) => {
      const c = ctx(t);
      if (m.kind === 'next') return from === hostId.current && s.phase === 'result' ? afterResult(c, s) : undefined;
      if (!s.ids.includes(from)) return undefined;
      if (m.kind === 'card') {
        const spy = spyOf(s) === from;
        const place = placeOf(s);
        room.send({ t: 'ss_card', to: from, round: s.round, spy, ...(spy ? {} : { place: place.id, role: s.roles[from] }) });
        return undefined;
      }
      if (m.kind === 'chips') {
        if (s.phase === 'answer' && s.target === from) room.send({ t: 'ss_chips', to: from, round: s.round, qn: s.qn, chips: s.chips });
        return undefined;
      }
      if (m.round !== s.round) return undefined;
      const playing = s.phase === 'intro' || s.phase === 'ask' || s.phase === 'answer';
      if (m.kind === 'ask' && s.phase === 'ask' && from === s.asker && s.cards.includes(m.q as SpyQuestionId)
        && typeof m.to === 'string' && m.to !== from && s.ids.includes(m.to)) {
        return startAnswer(c, s, m.q as SpyQuestionId, m.to);
      }
      if (m.kind === 'answer' && s.phase === 'answer' && from === s.target && typeof m.word === 'string') {
        if (m.typed) {
          const r = checkWord(m.word);
          if (r === 'empty') return undefined;
          return answer(c, s, r === 'ok' ? showWord(m.word) : HIDDEN_WORD);
        }
        return s.chips.includes(m.word) ? answer(c, s, m.word) : undefined;
      }
      if (m.kind === 'callvote' && playing && s.qn >= EARLY_VOTE_AFTER) return startVote(c, s, from);
      if (m.kind === 'call' && playing && from === spyOf(s) && typeof m.place === 'string' && s.options.includes(m.place)) {
        return result(c, { ...s, guess: m.place, called: true }, m.place === placeOf(s).id ? 'called_right' : 'called_wrong');
      }
      if (m.kind === 'vote' && s.phase === 'vote' && typeof m.who === 'string' && m.who !== from && s.ids.includes(m.who) && s.votes[from] === undefined) {
        const n = { ...s, votes: { ...s.votes, [from]: m.who } };
        return here(n, presentRef.current).every(id => n.votes[id] !== undefined) ? resolveVote(c, n) : n;
      }
      if (m.kind === 'guess' && s.phase === 'guess' && from === spyOf(s) && typeof m.place === 'string' && s.options.includes(m.place)) {
        return spyGuess(c, s, m.place);
      }
      return undefined;
    },
    onSkip: (s, t) => {
      const c = ctx(t);
      if (s.phase === 'intro') return startAsk(c, s);
      if (s.phase === 'ask') return autoAsk(c, s);
      if (s.phase === 'answer') return answer(c, s, pick(s.chips), true);
      if (s.phase === 'vote') return resolveVote(c, s);
      if (s.phase === 'guess') return spyGuess(c, s, null);
      if (s.phase === 'result') return afterResult(c, s);
      return undefined;
    },
    view: s => {
      const v: View = {
        round: s.round, phase: s.phase, ms: msLeft(s.endsAt), ids: s.ids, qn: s.qn, limit: s.limit, asker: s.asker, cards: s.phase === 'ask' ? s.cards : [],
        q: s.q, target: s.target, log: s.log, options: s.options, voted: Object.keys(s.votes), calledVote: s.calledVote, scores: s.scores,
      };
      if (s.phase === 'guess' || s.phase === 'result' || s.phase === 'final') { v.tally = s.tally; v.spy = spyOf(s); }
      if (s.phase === 'result' || s.phase === 'final') {
        Object.assign(v, { guess: s.guess, called: s.called, outcome: s.outcome, place: placeOf(s).id, roles: s.roles, gained: s.gained });
      }
      if (s.phase === 'final') v.ranked = s.ranked;
      return v;
    },
  });

  // People leaving: skip their turn, end the round if the spy left, finish a vote.
  const idsKey = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    const s = tools.get();
    if (!s || s.phase === 'result' || s.phase === 'final') return;
    const c = ctx(tools);
    const p = presentRef.current;
    if (!p.includes(spyOf(s))) tools.set(result(c, s, 'left'));
    else if (s.phase === 'ask' && !p.includes(s.asker)) tools.set(startAsk(c, { ...s, phase: 'answer', qn: s.qn + 1 }));
    else if (s.phase === 'answer' && s.target && !p.includes(s.target)) tools.set(answer(c, s, pick(s.chips), true));
    else if (s.phase === 'vote' && here(s, p).every(id => s.votes[id] !== undefined)) tools.set(resolveVote(c, s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  useAddressed(room, 'ss_card', m => setCard({ round: Number(m.round), spy: !!m.spy, place: m.place as string | undefined, role: m.role as string | undefined }));
  useAddressed(room, 'ss_chips', m => setChips({ round: Number(m.round), qn: Number(m.qn), chips: (m.chips as string[]) ?? [] }));

  const playing = !!view && view.ids.includes(room.myId) && !isBoard;
  const myCard = card && view && card.round === view.round ? card : null;
  useAskUntil(playing && !!view && view.phase !== 'final' && !myCard, () => input({ kind: 'card' }), view?.round);
  const myChips = chips && view && chips.round === view.round && chips.qn === view.qn ? chips.chips : null;
  const iAnswer = !!view && view.phase === 'answer' && view.target === room.myId;
  useAskUntil(iAnswer && !myChips, () => input({ kind: 'chips' }), `${view?.round}-${view?.qn}`);

  const seconds = useCountdown(view && view.phase !== 'final' ? view.ms : undefined, `${view?.round}-${view?.phase}-${view?.qn}`);
  useEffect(() => { if (view?.phase === 'vote' || view?.phase === 'guess') playPop(); }, [view?.phase, view?.round]);
  useEffect(() => {
    if (view?.phase !== 'result' || !view.outcome || view.outcome === 'left') return;
    const iWon = (view.gained?.[room.myId] ?? 0) > 0;
    if (iWon) playWin(); else playClick();
  }, [view?.phase, view?.outcome, view?.gained, room.myId]);
  useEffect(() => {
    if (view?.phase === 'final' && view.ranked) { playCorrect(); if (!isBoard) finish(view.ranked); }
  }, [view?.phase, view?.ranked, finish, isBoard]);

  if (!view) return <PartyFrame board={isBoard} title="Spy Station" icon="🕵️"><Waiting /></PartyFrame>;

  const total = { intro: INTRO_MS, ask: ASK_MS, answer: ANSWER_MS, vote: VOTE_MS, guess: GUESS_MS }[view.phase as 'intro'] ?? 0;
  const amSpy = !!myCard?.spy;
  const live = view.phase === 'intro' || view.phase === 'ask' || view.phase === 'answer';

  return (
    <PartyFrame board={isBoard} title="Spy Station" icon="🕵️" subtitle="Everyone knows the secret place… except the spy!" tint="from-slate-950 via-indigo-950 to-emerald-950"
      right={<RoundPill round={view.round} of={ROUNDS} seconds={total ? seconds : undefined} />}>
      <PausedNote paused={paused} />
      {total > 0 && <TimerBar seconds={seconds} total={total / 1000} />}

      {playing && view.phase !== 'final' && <SecretCard card={myCard} />}

      {view.phase === 'intro' && (
        <div className={`rounded-3xl bg-white/10 p-5 mb-4 text-center font-fredoka ${isBoard ? 'text-5xl' : 'text-2xl'}`}>
          {isBoard ? '🤫 Everyone, peek at your secret card — don’t let anyone see!' : '🤫 Peek at your secret card — keep it hidden!'}
          <div className={`font-nunito text-violet-200 mt-2 ${isBoard ? 'text-3xl' : 'text-lg'}`}>Then take turns asking questions. Answer so friends know you’re a local — but don’t give the place away!</div>
        </div>
      )}

      {(view.phase === 'ask' || view.phase === 'answer') && (
        <TurnPanel room={room} view={view} big={isBoard} input={input} chips={iAnswer ? myChips : null} amSpy={amSpy} />
      )}

      {live && <QALog room={room} log={view.log} big={isBoard} />}

      {live && (
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {playing && view.qn >= EARLY_VOTE_AFTER && (
            <button type="button" onClick={() => { playClick(); input({ kind: 'callvote', round: view.round }); }}
              className="min-h-[52px] px-6 rounded-full font-fredoka text-xl bg-rose-500/80 active:scale-95">🗳️ Vote now!</button>
          )}
          <span className="self-center font-nunito text-lg text-violet-200">Question {Math.min(view.qn + 1, view.limit)}/{view.limit} · then everyone votes</span>
        </div>
      )}

      {live && amSpy && playing && <CallIt view={view} input={input} />}
      {(live || view.phase === 'vote') && <PlaceList options={view.options} big={isBoard} />}

      {view.phase === 'vote' && <VotePanel room={room} view={view} big={isBoard} canVote={playing} input={input} />}
      {view.phase === 'guess' && <GuessPanel room={room} view={view} big={isBoard} isSpy={amSpy && playing} input={input} />}
      {(view.phase === 'result' || view.phase === 'final') && view.place && (
        <ResultPanel room={room} view={view} big={isBoard} onNext={room.isHost && view.phase === 'result' ? () => { playClick(); input({ kind: 'next' }); } : undefined} />
      )}

      <div className={isBoard ? 'text-2xl' : ''}>
        <Scores room={room} scores={view.scores} ids={view.ids}
          note={id => (view.phase === 'result' && view.gained?.[id] ? <span className="font-fredoka text-green-300">+{view.gained[id]}</span> : null)} />
      </div>

      {view.phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />
      )}
    </PartyFrame>
  );
}

function SecretCard({ card }: { card: Card | null }) {
  const [open, setOpen] = useState(true);
  const place = card?.place ? placeById(card.place) : null;
  return (
    <button type="button" onClick={() => { playClick(); setOpen(o => !o); }} data-testid="ss-card"
      className={`w-full rounded-3xl p-4 mb-4 text-center border-4 border-dashed min-h-[72px] ${card?.spy ? 'bg-rose-500/25 border-rose-300' : 'bg-emerald-500/20 border-emerald-300'}`}>
      {!card ? <span className="font-fredoka text-xl">Getting your secret card… 🔍</span>
        : !open ? <span className="font-fredoka text-xl">🔒 Tap to peek at your secret card</span>
          : card.spy ? (
            <>
              <div className="font-fredoka text-3xl">🕵️ You’re the spy!</div>
              <div className="font-nunito text-lg">Listen carefully and blend in. Work out the place — or tap “I know the place!”</div>
            </>
          ) : (
            <>
              <div className="font-nunito text-lg">The secret place is</div>
              <div className="font-fredoka text-3xl" data-testid="ss-place">{place?.emoji} {place?.name}</div>
              <div className="font-nunito text-lg">You are the <b>{card.role}</b> · tap to hide</div>
            </>
          )}
    </button>
  );
}

function TurnPanel({ room, view, big, input, chips, amSpy }: {
  room: RoomApi; view: View; big: boolean; input: (d: Record<string, unknown>) => void; chips: string[] | null; amSpy: boolean;
}) {
  const asker = who(room.players, view.asker);
  const [q, setQ] = useState<SpyQuestionId | null>(null);
  const myAsk = view.phase === 'ask' && view.asker === room.myId && !big;
  const myAnswer = view.phase === 'answer' && view.target === room.myId && !big;
  if (view.phase === 'ask') {
    if (!myAsk) {
      return (
        <div className={`rounded-3xl bg-white/10 p-5 mb-4 text-center font-fredoka ${big ? 'text-5xl' : 'text-2xl'}`}>
          {asker.emoji} {asker.name} is picking a question… 🤔
        </div>
      );
    }
    return (
      <div className="rounded-3xl bg-amber-400/15 ring-4 ring-amber-300 p-4 mb-4">
        <div className="font-fredoka text-2xl text-center mb-3">🎯 Your turn to ask! {q ? 'Now pick who to ask:' : 'Pick a question:'}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {view.cards.map(id => {
            const x = qText(id);
            return (
              <button key={id} type="button" data-testid="ss-q" onClick={() => { playClick(); setQ(id); }}
                className={`min-h-[72px] rounded-2xl p-3 font-fredoka text-xl border-4 ${q === id ? 'bg-amber-400/40 border-amber-300' : 'bg-white/15 border-transparent'}`}>
                {x.emoji} {x.text}
              </button>
            );
          })}
        </div>
        {q && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {view.ids.filter(id => id !== room.myId && room.players.some(p => p.id === id)).map(id => {
              const w = who(room.players, id);
              return (
                <button key={id} type="button" data-testid="ss-who" onClick={() => { playClick(); input({ kind: 'ask', round: view.round, q, to: id }); }}
                  className="min-h-[56px] rounded-2xl bg-white/15 font-fredoka text-xl active:scale-95">{w.emoji} {w.name}</button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  const target = who(room.players, view.target ?? '');
  const question = view.q ? qText(view.q) : null;
  return (
    <div className={`rounded-3xl p-5 mb-4 ${myAnswer ? 'bg-amber-400/15 ring-4 ring-amber-300' : 'bg-white/10'}`}>
      <div className={`text-center font-nunito text-violet-200 ${big ? 'text-3xl' : 'text-lg'}`}>{asker.emoji} {asker.name} asks {myAnswer ? 'you' : `${target.emoji} ${target.name}`}:</div>
      <div className={`text-center font-fredoka mb-3 ${big ? 'text-6xl' : 'text-3xl'}`}>{question?.emoji} {question?.text}</div>
      {myAnswer && (chips ? <AnswerPicker key={`${view.round}-${view.qn}`} view={view} chips={chips} input={input} amSpy={amSpy} /> : <Waiting text="Getting your answer cards…" />)}
      {!myAnswer && <div className={`text-center font-fredoka ${big ? 'text-4xl' : 'text-xl'} animate-pulse`}>{target.name} is answering… 💭</div>}
    </div>
  );
}

function AnswerPicker({ view, chips, input, amSpy }: { view: View; chips: string[]; input: (d: Record<string, unknown>) => void; amSpy: boolean }) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const send = (word: string, typed: boolean) => { if (sent) return; playClick(); setSent(true); input({ kind: 'answer', round: view.round, word, typed }); };
  const onKey = useCallback((k: string) => { setMsg(null); setDraft(d => (k === ' ' || d.length >= MAX_WORD ? d : d + k.toLowerCase())); }, []);
  const onBackspace = useCallback(() => { setMsg(null); setDraft(d => d.slice(0, -1)); }, []);
  const onEnter = useCallback(() => {
    const r = checkWord(draft);
    if (r === 'empty') { setMsg('Type one word ✍️'); return; }
    if (r === 'unkind') { setMsg('Let’s keep it kind — try another word 🙂'); playWrong(); return; }
    send(tidyWord(draft), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  if (sent) return <div className="text-center font-fredoka text-2xl">✅ Answer sent!</div>;
  return (
    <div>
      <div className="font-nunito text-lg text-center text-violet-100 mb-2">{amSpy ? '🕵️ Pick an answer that sounds right — blend in!' : 'Pick an answer that fits — but don’t make it too obvious!'}</div>
      {!typing && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {chips.map(c => (
              <button key={c} type="button" data-testid="ss-chip" onClick={() => send(c, false)}
                className="min-h-[60px] rounded-2xl bg-white/20 font-fredoka text-2xl active:scale-95">{c}</button>
            ))}
          </div>
          <div className="text-center">
            <button type="button" onClick={() => { playClick(); setTyping(true); }} className="min-h-[48px] px-6 rounded-full bg-white/10 font-fredoka text-lg">✏️ Type my own word</button>
          </div>
        </>
      )}
      {typing && (
        <>
          <div className="min-h-[56px] rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-3xl text-center mb-2" data-testid="ss-draft">{draft ? showWord(draft) : <span className="text-white/30">One word…</span>}</div>
          {msg && <p className="font-nunito text-lg text-amber-200 text-center mb-2" role="status">{msg}</p>}
          <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} enterLabel="Send" />
          <div className="text-center mt-2">
            <button type="button" onClick={() => setTyping(false)} className="min-h-[48px] px-6 rounded-full bg-white/10 font-fredoka text-lg">↩ Back to the cards</button>
          </div>
        </>
      )}
    </div>
  );
}

function QALog({ room, log, big }: { room: RoomApi; log: QA[]; big: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [log.length]);
  if (!log.length) return null;
  return (
    <div ref={box} className={`rounded-3xl bg-black/25 p-3 mb-4 overflow-y-auto space-y-2 ${big ? 'max-h-[420px]' : 'max-h-64'}`} aria-label="Answers so far">
      {log.map(x => {
        const a = who(room.players, x.asker);
        const t = who(room.players, x.to);
        const q = qText(x.q);
        return (
          <motion.div key={x.k} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className={`rounded-2xl bg-white/10 px-3 py-2 font-nunito flex flex-wrap items-center gap-x-2 ${big ? 'text-2xl' : 'text-lg'}`}>
            <span>{a.emoji} {a.name} → {t.emoji} {t.name}:</span>
            <span className="text-violet-200">{q.emoji} {q.text}</span>
            <span className={`font-fredoka rounded-full bg-amber-400/30 px-3 ${big ? 'text-3xl' : 'text-xl'}`} data-testid="ss-answer">{x.answer}</span>
            {x.auto && <span className="text-base text-violet-300">⏰ auto</span>}
          </motion.div>
        );
      })}
    </div>
  );
}

function PlaceList({ options, big }: { options: string[]; big: boolean }) {
  return (
    <div className="rounded-3xl bg-white/5 p-3 mb-4">
      <div className={`font-fredoka text-center mb-2 ${big ? 'text-3xl' : 'text-lg'}`}>🗺️ It’s one of these places</div>
      <div className={`grid gap-2 ${big ? 'grid-cols-4' : 'grid-cols-3 md:grid-cols-4'}`}>
        {options.map(id => { const p = placeById(id)!; return <div key={id} className={`rounded-xl bg-white/10 px-2 py-1 text-center font-nunito ${big ? 'text-2xl' : 'text-base'}`}>{p.emoji} {p.name}</div>; })}
      </div>
    </div>
  );
}

function PlaceButtons({ options, onPick, disabled }: { options: string[]; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map(id => {
        const p = placeById(id)!;
        return (
          <button key={id} type="button" data-testid="ss-place-btn" disabled={disabled} onClick={() => onPick(id)}
            className="min-h-[56px] rounded-2xl bg-white/15 font-fredoka text-lg disabled:opacity-40 active:scale-95">{p.emoji} {p.name}</button>
        );
      })}
    </div>
  );
}

function CallIt({ view, input }: { view: View; input: (d: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  if (!open) {
    return (
      <div className="text-center mb-4">
        <button type="button" onClick={() => { playClick(); setOpen(true); }} className="min-h-[52px] px-6 rounded-full font-fredoka text-xl bg-rose-600 active:scale-95">🎯 I know the place!</button>
      </div>
    );
  }
  const p = sel ? placeById(sel) : null;
  return (
    <div className="rounded-3xl bg-rose-500/20 ring-4 ring-rose-300 p-4 mb-4">
      <div className="font-fredoka text-2xl text-center mb-1">🕵️ Call it! Where are we?</div>
      <div className="font-nunito text-lg text-center text-rose-100 mb-3">Right = you win the round. Wrong = the locals win. Only one try!</div>
      <PlaceButtons options={view.options} onPick={id => { playClick(); setSel(id); }} />
      <div className="flex justify-center gap-3 mt-3">
        <button type="button" onClick={() => { setOpen(false); setSel(null); }} className="min-h-[52px] px-6 rounded-full bg-white/15 font-fredoka text-lg">Not yet</button>
        {p && <button type="button" onClick={() => { playClick(); input({ kind: 'call', round: view.round, place: sel }); }} className="min-h-[52px] px-6 rounded-full bg-rose-600 font-fredoka text-lg">It’s the {p.name}! {p.emoji}</button>}
      </div>
    </div>
  );
}

function VotePanel({ room, view, big, canVote, input }: { room: RoomApi; view: View; big: boolean; canVote: boolean; input: (d: Record<string, unknown>) => void }) {
  const [mine, setMine] = useState<string | null>(null);
  const voted = mine !== null || view.voted.includes(room.myId);
  const caller = view.calledVote ? who(room.players, view.calledVote) : null;
  return (
    <div className="rounded-3xl bg-white/10 p-5 mb-4 text-center" aria-label="Vote">
      <div className={`font-fredoka mb-1 ${big ? 'text-6xl' : 'text-3xl'}`}>🗳️ Who is the spy?</div>
      {caller && <div className={`font-nunito text-violet-200 mb-2 ${big ? 'text-2xl' : 'text-lg'}`}>{caller.emoji} {caller.name} called the vote!</div>}
      {canVote && !voted && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-3">
          {view.ids.filter(id => id !== room.myId).map(id => {
            const w = who(room.players, id);
            return (
              <button key={id} type="button" data-testid="ss-vote" onClick={() => { playClick(); setMine(id); input({ kind: 'vote', round: view.round, who: id }); }}
                className="min-h-[60px] rounded-2xl bg-white/15 font-fredoka text-xl active:scale-95">{w.emoji} {w.name}</button>
            );
          })}
        </div>
      )}
      {voted && <div className="font-fredoka text-2xl my-2">🤞 You voted for {who(room.players, mine ?? '').name}</div>}
      <div className={`font-nunito text-violet-200 ${big ? 'text-3xl' : 'text-lg'}`}>{view.voted.length}/{view.ids.length} voted</div>
    </div>
  );
}

function GuessPanel({ room, view, big, isSpy, input }: { room: RoomApi; view: View; big: boolean; isSpy: boolean; input: (d: Record<string, unknown>) => void }) {
  const spy = who(room.players, view.spy ?? '');
  const [sent, setSent] = useState(false);
  return (
    <div className="rounded-3xl bg-rose-500/20 p-5 mb-4 text-center">
      <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className={`font-fredoka ${big ? 'text-6xl' : 'text-3xl'}`}>🚨 Caught! {spy.emoji} {spy.name} is the spy!</motion.div>
      <div className={`font-nunito my-2 ${big ? 'text-3xl' : 'text-lg'}`}>{isSpy ? 'One last chance: guess the place to steal the win!' : `${spy.name} gets one guess at the place to steal the win…`}</div>
      {isSpy && !sent && <PlaceButtons options={view.options} onPick={id => { playClick(); setSent(true); input({ kind: 'guess', round: view.round, place: id }); }} />}
      {isSpy && sent && <div className="font-fredoka text-2xl">🤞 Guess sent!</div>}
    </div>
  );
}

function ResultPanel({ room, view, big, onNext }: { room: RoomApi; view: View; big: boolean; onNext?: () => void }) {
  const place = placeById(view.place!)!;
  const spy = who(room.players, view.spy ?? '');
  const guess = view.guess ? placeById(view.guess) : null;
  const o = view.outcome;
  const headline = o === 'left' ? `👋 The spy had to go — no points this round.`
    : o === 'escaped' ? `🕵️ ${spy.name} was the spy and got away! +3`
      : o === 'caught_stole' ? `😮 Caught — but ${spy.name} guessed the ${place.name} and steals the win! +3`
        : o === 'caught_missed' ? `🎉 The locals caught ${spy.name}! Everyone else +2`
          : o === 'called_right' ? `🎯 ${spy.name} (the spy) worked out it was the ${place.name}! +3`
            : `🎉 ${spy.name} (the spy) guessed the ${guess?.name ?? 'wrong place'} — wrong! Locals +2`;
  const counts = view.tally?.counts ?? {};
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl bg-white/10 p-5 mb-4 text-center" aria-label="Result">
      <div className={big ? 'text-8xl' : 'text-6xl'}>{place.emoji}</div>
      <div className={`font-nunito text-violet-200 ${big ? 'text-3xl' : 'text-lg'}`}>The secret place was</div>
      <div className={`font-fredoka text-amber-300 ${big ? 'text-6xl' : 'text-4xl'}`} data-testid="ss-reveal">{place.name}</div>
      <p className={`font-fredoka mt-3 ${big ? 'text-4xl' : 'text-2xl'} ${o && o !== 'left' && spyWins(o) ? 'text-rose-200' : 'text-green-300'}`} data-testid="ss-outcome">{headline}</p>
      {guess && o !== 'called_wrong' && <p className={`font-nunito ${big ? 'text-2xl' : 'text-lg'}`}>Spy’s guess: {guess.emoji} {guess.name}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4 text-left">
        {view.ids.map(id => {
          const w = who(room.players, id);
          return (
            <div key={id} className={`rounded-2xl px-3 py-2 font-nunito ${big ? 'text-2xl' : 'text-base'} ${id === view.spy ? 'bg-rose-500/30 ring-2 ring-rose-300' : 'bg-black/20'}`}>
              <div className="font-fredoka">{w.emoji} {w.name}</div>
              <div>{id === view.spy ? '🕵️ Spy' : view.roles?.[id]}</div>
              {counts[id] ? <div className="text-violet-200">🗳️ {counts[id]} vote{counts[id] === 1 ? '' : 's'}</div> : null}
            </div>
          );
        })}
      </div>
      {onNext && <NextButton onClick={onNext} />}
    </motion.div>
  );
}
