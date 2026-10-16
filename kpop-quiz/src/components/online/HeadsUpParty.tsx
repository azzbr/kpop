import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi, GameConfig, GameMsg } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, msLeft } from '../../online/helloGate';
import { playClick, playPop, playCorrect, playTick } from '../../utils/sounds';
import { FinalCard } from './RaceParts';
import ConfettiBurst from '../ConfettiBurst';
import type { RoundResult } from '../../store';
import { Scores, Waiting } from './ArenaParts';
import { who } from './arenaHelpers';
import { PartyFrame, TimerBar, PausedNote, NextButton } from './partyParts';
import { useAskUntil, useBoard } from './partyHooks';
import {
  TURN_MS, READY_MS, RESULT_MS, TEAM_INFO,
  deckCards, deckName, deckHint, makeTeams, turnCount, guesserOrder, rankHeadsUp, teamOf, teamTotals,
} from './headsUpPartyLogic';

// Heads Up Party: one guesser sees only "GUESS!"; everyone else in the room sees the word and
// acts or explains it out loud. The current word is never in the view: the host sends it in
// `hp_word` with `hide: <guesser>` (and answers a device's `{ kind: 'word' }` ask the same way),
// and the guesser's device never shows it.

interface State {
  ids: string[];
  teams: [string[], string[]] | null;
  order: string[];
  turn: number;
  phase: 'ready' | 'play' | 'result' | 'final';
  endsAt: number;
  deck: string[];
  cur: string;
  wi: number;
  got: string[];
  passed: string[];
  points: Record<string, number>;
  ranked: string[][];
  shown: Record<string, number>;
}
interface View {
  turn: number; of: number; phase: State['phase']; ms: number; ids: string[]; teams: State['teams']; guesser: string;
  wi: number; gotN: number; passN: number; got?: string[]; passed?: string[];
  points: Record<string, number>; ranked?: string[][]; shown?: Record<string, number>;
}

type Present = () => string[];
interface Ctx { t: HostTools<State>; present: Present; send: RoomApi['send']; deck: string | undefined }

const shuffle = <T,>(a: T[]) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };

function draw(c: Ctx, s: State): State {
  let deck = s.deck;
  if (!deck.length) deck = shuffle(deckCards(c.deck).filter(w => w !== s.cur));
  const cur = deck[0];
  const n = { ...s, deck: deck.slice(1), cur, wi: s.wi + 1 };
  c.send({ t: 'hp_word', hide: s.order[s.turn], turn: s.turn, wi: n.wi, word: cur });
  return n;
}

function startReady(c: Ctx, s: State): State {
  const turn = s.turn + 1;
  c.t.after('phase', READY_MS, () => c.t.set(startPlay(c, c.t.get())));
  return { ...s, turn, phase: 'ready', endsAt: Date.now() + READY_MS, got: [], passed: [], cur: '' };
}

function startPlay(c: Ctx, s: State): State {
  if (s.phase !== 'ready') return s;
  c.t.after('phase', TURN_MS + 300, () => c.t.set(endTurn(c, c.t.get())));
  return draw(c, { ...s, phase: 'play', endsAt: Date.now() + TURN_MS });
}

function endTurn(c: Ctx, s: State): State {
  if (s.phase !== 'play') return s;
  c.t.after('phase', RESULT_MS, () => c.t.set(afterResult(c, c.t.get())));
  return { ...s, phase: 'result', endsAt: Date.now() + RESULT_MS };
}

function afterResult(c: Ctx, s: State): State {
  if (s.phase !== 'result') return s;
  let n = s;
  while (n.turn + 1 < n.order.length && !c.present().includes(n.order[n.turn + 1])) n = { ...n, turn: n.turn + 1 };
  if (n.turn + 1 >= n.order.length) {
    c.t.cancel('phase');
    const { ranked, shown } = rankHeadsUp(n.points, n.ids, n.teams);
    return { ...n, phase: 'final', ranked, shown };
  }
  return startReady(c, n);
}

export default function HeadsUpParty({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const { boardMode, isBoard } = useBoard(room, config);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const present = useRef<Present>(() => presentRef.current).current;
  const hostId = useRef(room.myId);
  const [word, setWord] = useState<{ turn: number; wi: number; word: string } | null>(null);
  const ctx = (t: HostTools<State>): Ctx => ({ t, present, send: room.send, deck: config?.deck });

  const { view, input, tools, paused } = useHostGame<State, View>(room, 'hp', {
    board: boardMode,
    start: (ids, t) => {
      const teams = config?.teams === '2' && ids.length >= 2 ? makeTeams(ids) : null;
      const order = guesserOrder(ids, turnCount(config?.turns, ids.length, !!teams), teams);
      return startReady(ctx(t), {
        ids, teams, order, turn: -1, phase: 'ready', endsAt: 0, deck: shuffle(deckCards(config?.deck)), cur: '', wi: 0, got: [], passed: [],
        points: Object.fromEntries(ids.map(id => [id, 0])), ranked: [], shown: {},
      });
    },
    onInput: (s, from, m, t) => {
      const c = ctx(t);
      const guesser = s.order[s.turn];
      if (m.kind === 'next') return from === hostId.current && s.phase === 'result' ? afterResult(c, s) : undefined;
      if (m.kind === 'word') {
        if (s.phase === 'play' && from !== guesser) room.send({ t: 'hp_word', to: from, hide: guesser, turn: s.turn, wi: s.wi, word: s.cur });
        return undefined;
      }
      if (from !== guesser || m.turn !== s.turn) return undefined;
      if (m.kind === 'start' && s.phase === 'ready') return startPlay(c, s);
      if ((m.kind === 'got' || m.kind === 'pass') && s.phase === 'play' && m.wi === s.wi) {
        const n: State = m.kind === 'got'
          ? { ...s, got: [...s.got, s.cur], points: { ...s.points, [guesser]: (s.points[guesser] ?? 0) + 1 } }
          : { ...s, passed: [...s.passed, s.cur] };
        return draw(c, n);
      }
      return undefined;
    },
    onSkip: (s, t) => {
      const c = ctx(t);
      if (s.phase === 'ready') return startPlay(c, s);
      if (s.phase === 'play') return endTurn(c, s);
      if (s.phase === 'result') return afterResult(c, s);
      return undefined;
    },
    view: s => {
      const v: View = {
        turn: s.turn, of: s.order.length, phase: s.phase, ms: msLeft(s.endsAt), ids: s.ids, teams: s.teams, guesser: s.order[s.turn] ?? '',
        wi: s.wi, gotN: s.got.length, passN: s.passed.length, points: s.points,
      };
      if (s.phase === 'result' || s.phase === 'final') { v.got = s.got; v.passed = s.passed; }
      if (s.phase === 'final') { v.ranked = s.ranked; v.shown = s.shown; }
      return v;
    },
  });

  // The guesser leaving ends their turn.
  const idsKey = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    const s = tools.get();
    if (!s || s.phase === 'result' || s.phase === 'final' || presentRef.current.includes(s.order[s.turn])) return;
    const c = ctx(tools);
    tools.set(s.phase === 'play' ? endTurn(c, s) : endTurn(c, { ...s, phase: 'play' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  // Words: broadcast with `hide` (everyone but the guesser), or addressed after an ask.
  const { onMessage, myId } = room;
  useEffect(() => onMessage((m: GameMsg) => {
    if (m.t !== 'hp_word' || m.hide === myId || (m.to !== undefined && m.to !== myId)) return;
    setWord({ turn: Number(m.turn), wi: Number(m.wi), word: String(m.word) });
  }), [onMessage, myId]);

  const iGuess = !!view && view.guesser === room.myId && !isBoard;
  const myWord = view && word && word.turn === view.turn && word.wi === view.wi ? word.word : null;
  useAskUntil(!!view && view.phase === 'play' && !iGuess && !myWord, () => input({ kind: 'word' }), `${view?.turn}-${view?.wi}`);

  const seconds = useCountdown(view && view.phase !== 'final' ? view.ms : undefined, `${view?.turn}-${view?.phase}`);
  useEffect(() => { if (view?.phase === 'play' && seconds > 0 && seconds <= 5) playTick(); }, [seconds, view?.phase]);
  useEffect(() => { if (view && view.wi > 1 && view.phase === 'play') playPop(); }, [view?.wi, view?.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (view?.phase === 'final' && view.ranked) { playCorrect(); if (!isBoard) finish(view.ranked); }
  }, [view?.phase, view?.ranked, finish, isBoard]);

  if (!view) return <PartyFrame board={isBoard} title="Heads Up Party" icon="🙆"><Waiting /></PartyFrame>;

  const g = who(room.players, view.guesser);
  const team = teamOf(view.teams, view.guesser);
  const totals = view.teams ? teamTotals(view.points, view.teams) : null;
  const send = (kind: 'got' | 'pass' | 'start') => { playClick(); input({ kind, turn: view.turn, wi: view.wi }); };

  return (
    <PartyFrame board={isBoard} title="Heads Up Party" icon="🙆" subtitle={`${deckName(config?.deck)} · ${deckHint(config?.deck)}`}
      tint="from-fuchsia-950 via-purple-900 to-indigo-950"
      right={<div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right">
        <div>Turn {Math.min(view.turn + 1, view.of)}/{view.of}</div>
        {(view.phase === 'play' || view.phase === 'ready') && <div className={seconds <= 5 ? 'text-amber-300' : 'text-violet-200'}>⏱️ {seconds}s</div>}
      </div>}>
      <PausedNote paused={paused} />

      {view.phase === 'ready' && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`rounded-3xl p-6 mb-4 text-center ${team >= 0 ? `${TEAM_INFO[team].cls} ring-4` : 'bg-white/10'}`}>
          {team >= 0 && <div className={`font-fredoka ${isBoard ? 'text-4xl' : 'text-2xl'}`}>{TEAM_INFO[team].emoji} {TEAM_INFO[team].name}’s turn!</div>}
          <div className={`font-fredoka ${isBoard ? 'text-7xl' : 'text-4xl'} my-2`}>{iGuess ? '🙈 You’re the guesser!' : `${g.emoji} ${g.name} is the guesser!`}</div>
          <div className={`font-nunito ${isBoard ? 'text-3xl' : 'text-lg'} text-violet-100`}>
            {iGuess ? 'Don’t look at anyone else’s screen! Tap ✅ when you guess it, ⏭️ to pass.'
              : team >= 0 ? `${TEAM_INFO[team].short} team: act it out and explain — don’t say the word!` : 'Everyone else: act it out and explain — don’t say the word!'}
          </div>
          {iGuess && (
            <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => send('start')}
              className="mt-4 min-h-[72px] px-10 rounded-full font-fredoka text-3xl bg-gradient-to-r from-amber-400 to-pink-500">▶ I’m ready!</motion.button>
          )}
          <div className={`font-nunito mt-2 text-violet-200 ${isBoard ? 'text-2xl' : 'text-base'}`}>Starting in {seconds}s…</div>
        </motion.div>
      )}

      {view.phase === 'play' && (
        <>
          <TimerBar seconds={seconds} total={TURN_MS / 1000} />
          {iGuess ? (
            <div className="rounded-3xl bg-black/30 p-6 mb-4 text-center game-surface">
              <motion.div key={view.wi} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="font-fredoka text-7xl md:text-8xl text-amber-300 my-4" data-testid="hp-guess">GUESS!</motion.div>
              <div className="font-nunito text-xl mb-4">Listen to your friends… ✅ {view.gotN} so far</div>
              <div className="grid grid-cols-2 gap-4">
                <motion.button type="button" whileTap={{ scale: 0.92 }} onPointerDown={() => send('got')} data-testid="hp-got"
                  className="min-h-[140px] rounded-3xl bg-green-500 font-fredoka text-3xl shadow-xl">✅ Got it!</motion.button>
                <motion.button type="button" whileTap={{ scale: 0.92 }} onPointerDown={() => send('pass')} data-testid="hp-pass"
                  className="min-h-[140px] rounded-3xl bg-slate-500 font-fredoka text-3xl shadow-xl">⏭️ Pass</motion.button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-white/10 p-6 mb-4 text-center">
              <div className={`rounded-2xl bg-amber-400 text-stone-900 font-fredoka mb-4 py-2 ${isBoard ? 'text-4xl' : 'text-xl'}`} role="status">
                🙈 {g.name}, look away! {team >= 0 ? `${TEAM_INFO[team].emoji} ${TEAM_INFO[team].short} team, give clues!` : 'Everyone, give clues!'}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={view.wi} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
                  className={`font-fredoka break-words ${isBoard ? 'text-8xl md:text-9xl py-8' : 'text-6xl md:text-7xl py-4'}`} data-testid="hp-word">
                  {myWord ?? '…'}
                </motion.div>
              </AnimatePresence>
              <div className={`font-fredoka ${isBoard ? 'text-4xl' : 'text-2xl'}`}>✅ {view.gotN} · ⏭️ {view.passN}</div>
            </div>
          )}
        </>
      )}

      {(view.phase === 'result' || view.phase === 'final') && view.got && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl bg-white/10 p-5 mb-4 text-center" aria-label="Turn result">
          <div className={`font-fredoka ${isBoard ? 'text-5xl' : 'text-3xl'}`}>⏰ Time! {g.emoji} {g.name} got {view.got.length}!</div>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {view.got.map((w, i) => <span key={`g${i}`} className={`rounded-full bg-green-500/40 px-3 py-1 font-nunito ${isBoard ? 'text-2xl' : 'text-lg'}`}>✅ {w}</span>)}
            {view.passed?.map((w, i) => <span key={`p${i}`} className={`rounded-full bg-white/10 px-3 py-1 font-nunito text-white/70 ${isBoard ? 'text-2xl' : 'text-lg'}`}>⏭️ {w}</span>)}
          </div>
          {room.isHost && view.phase === 'result' && <NextButton onClick={() => { playClick(); input({ kind: 'next' }); }} />}
        </motion.div>
      )}

      {view.teams && totals && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {view.teams.map((members, i) => (
            <div key={i} className={`rounded-3xl p-4 ring-4 ${TEAM_INFO[i].cls} ${team === i && view.phase !== 'final' ? '' : 'ring-transparent'}`}>
              <div className={`font-fredoka ${isBoard ? 'text-4xl' : 'text-2xl'}`}>{TEAM_INFO[i].emoji} {TEAM_INFO[i].short}: {totals[i]}</div>
              <div className={`font-nunito ${isBoard ? 'text-2xl' : 'text-base'}`}>{members.map(id => who(room.players, id).emoji + ' ' + who(room.players, id).name).join(' · ')}</div>
            </div>
          ))}
        </div>
      )}
      {!view.teams && (
        <div className={isBoard ? 'text-2xl' : ''}>
          <Scores room={room} scores={view.points} ids={view.ids} note={id => (id === view.guesser && view.phase !== 'final' ? <span>🙈</span> : null)} />
        </div>
      )}

      {view.phase === 'final' && view.ranked && (view.teams && totals
        ? <TeamFinalCard room={room} teams={view.teams} totals={totals} points={view.points} reward={reward} />
        : <FinalCard room={room} ranked={view.ranked} scores={view.shown ?? view.points} reward={reward} />)}
    </PartyFrame>
  );
}

/** FinalCard reads a team's rung as a tie, so teams get their own end card. */
function TeamFinalCard({ room, teams, totals, points, reward }: {
  room: RoomApi; teams: [string[], string[]]; totals: [number, number]; points: Record<string, number>; reward: RoundResult | null;
}) {
  const win = totals[0] === totals[1] ? -1 : totals[0] > totals[1] ? 0 : 1;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 px-4">
      <ConfettiBurst count={90} durationMs={4500} />
      <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-6 md:p-8 text-center max-w-md w-full text-white" data-testid="race-final">
        <div className="text-7xl mb-3">🏆</div>
        <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-3">{win < 0 ? 'It’s a tie — both teams were brilliant!' : `${TEAM_INFO[win].emoji} ${TEAM_INFO[win].name} wins!`}</h2>
        <div className="grid grid-cols-2 gap-3 mb-4 text-left">
          {teams.map((members, i) => (
            <div key={i} className={`rounded-2xl p-3 ring-2 ${TEAM_INFO[i].cls} ${win === i ? '' : 'ring-transparent'}`}>
              <div className="font-fredoka text-2xl">{TEAM_INFO[i].emoji} {totals[i]}</div>
              {members.map(id => (
                <div key={id} className={`font-nunito text-lg truncate ${id === room.myId ? 'text-amber-200 font-bold' : ''}`}>
                  {who(room.players, id).emoji} {who(room.players, id).name} <span className="text-white/70">✅{points[id] ?? 0}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {reward && <p className="font-fredoka text-xl text-green-300 mb-5">+{reward.xp} XP · +{reward.coins} 🪙{reward.isBest ? ' · New best! ⭐' : ''}</p>}
        {room.isHost ? (
          <button type="button" onClick={() => { playClick(); room.send({ t: 'to_lobby' }); }}
            className="min-h-[52px] px-8 py-3 rounded-full font-fredoka font-bold text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl active:scale-95">Back to Lobby 🏠</button>
        ) : <div className="font-nunito text-lg text-slate-300">Waiting for the host…</div>}
      </motion.div>
    </motion.div>
  );
}
