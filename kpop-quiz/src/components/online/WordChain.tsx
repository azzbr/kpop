import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, msLeft } from '../../online/helloGate';
import { START_WORDS } from '../../online/wordChainWords';
import { isRude } from '../../online/rudeWords';
import { playClick, playPop, playCorrect, playWrong } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { FinalCard } from './RaceParts';
import { ArenaFrame, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import {
  HEARTS, TURN_MS, VOTE_MS, WORD_CAP, MAX_LEN, checkWord, cleanWord, inDictionary, lastLetter, nextAlive,
  loseHeart, knockOut, resolveVote, chainRanking,
} from './wordChainLogic';

// Word Chain: take turns; your word must start with the last letter of the one before.
// The host owns one state and broadcasts all of it (nothing here is secret).

type Event =
  | { kind: 'word'; id: string; word: string }
  | { kind: 'voted_in'; id: string; word: string }
  | { kind: 'voted_out'; id: string; word: string }
  | { kind: 'timeout'; id: string }
  | { kind: 'left'; id: string };

interface State {
  order: string[];
  hearts: Record<string, number>;
  alive: string[];
  outAt: Record<string, number>;
  chain: { word: string; by: string }[];
  turnId: number;
  cur: string;
  phase: 'turn' | 'vote' | 'over';
  endsAt: number;
  vote: { word: string; by: string; yes: string[]; no: string[] } | null;
  event: Event | null;
  eventNo: number;
  ranked: (string | string[])[];
}
type View = Omit<State, 'endsAt'> & { ms: number };
type Present = () => string[];

const prevWord = (s: { chain: State['chain'] }) => s.chain[s.chain.length - 1]?.word ?? '';
const accepted = (s: State) => s.chain.length - 1;

function startTurn(t: HostTools<State>, s: State, cur: string, p: Present): State {
  const turnId = s.turnId + 1;
  t.cancel('vote');
  t.after('turn', TURN_MS + 400, () => {
    const c = t.get();
    if (c.phase !== 'turn' || c.turnId !== turnId) return;
    const n = loseHeart({ ...c, eventNo: c.eventNo + 1, event: { kind: 'timeout', id: c.cur } as Event }, c.cur, c.eventNo + 1);
    t.set(advance(t, n, c.cur, p));
  });
  return { ...s, turnId, cur, phase: 'turn', endsAt: Date.now() + TURN_MS, vote: null };
}

/** Next player's turn, or the end. */
function advance(t: HostTools<State>, s: State, from: string, p: Present): State {
  const next = nextAlive(s.order, s.alive, from);
  if (s.alive.length <= 1 || accepted(s) >= WORD_CAP || !next) {
    t.cancel('turn'); t.cancel('vote');
    return { ...s, phase: 'over', vote: null, ranked: chainRanking(s, s.order) };
  }
  return startTurn(t, s, next, p);
}

function resolve(t: HostTools<State>, s: State, p: Present): State {
  if (s.phase !== 'vote' || !s.vote) return s;
  t.cancel('vote');
  const { word, by, yes, no } = s.vote;
  if (resolveVote(yes.length, no.length)) {
    return advance(t, { ...s, chain: [...s.chain, { word, by }], event: { kind: 'voted_in', id: by, word } }, by, p);
  }
  const n = loseHeart({ ...s, eventNo: s.eventNo + 1, event: { kind: 'voted_out', id: by, word } as Event }, by, s.eventNo + 1);
  return advance(t, n, by, p);
}

/** Everyone in the room except the word's author has voted? */
const allVoted = (s: State, present: string[]) =>
  !!s.vote && present.filter(id => id !== s.vote!.by).every(id => s.vote!.yes.includes(id) || s.vote!.no.includes(id));

export default function WordChain({ room }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const present = useRef<Present>(() => presentRef.current).current;

  const { view, input, tools } = useHostGame<State, View>(room, 'wc', {
    start: (ids, t) => {
      const order = [...ids].sort(() => Math.random() - 0.5);
      const first = START_WORDS[Math.floor(Math.random() * START_WORDS.length)];
      return startTurn(t, {
        order, hearts: Object.fromEntries(order.map(id => [id, HEARTS])), alive: [...order], outAt: {},
        chain: [{ word: first, by: '' }], turnId: 0, cur: order[0], phase: 'turn', endsAt: 0, vote: null, event: null, eventNo: 0, ranked: [],
      }, order[0], present);
    },
    onInput: (s, from, m, t) => {
      if (m.turn !== s.turnId) return undefined;
      if (m.kind === 'word' && s.phase === 'turn' && from === s.cur && typeof m.word === 'string') {
        const word = cleanWord(m.word);
        if (checkWord(word, prevWord(s), s.chain.map(c => c.word)) !== 'ok' || isRude(word)) return undefined;
        if (inDictionary(word)) {
          t.cancel('turn');
          return advance(t, { ...s, chain: [...s.chain, { word, by: from }], event: { kind: 'word', id: from, word } }, from, present);
        }
        t.cancel('turn');
        t.after('vote', VOTE_MS + 300, () => t.set(resolve(t, t.get(), present)));
        const n: State = { ...s, phase: 'vote', endsAt: Date.now() + VOTE_MS, vote: { word, by: from, yes: [], no: [] } };
        return allVoted(n, presentRef.current) ? resolve(t, n, present) : n;
      }
      if (m.kind === 'vote' && s.phase === 'vote' && s.vote && from !== s.vote.by && s.order.includes(from)) {
        if (s.vote.yes.includes(from) || s.vote.no.includes(from)) return undefined;
        const v = m.yes ? { ...s.vote, yes: [...s.vote.yes, from] } : { ...s.vote, no: [...s.vote.no, from] };
        const n = { ...s, vote: v };
        return allVoted(n, presentRef.current) ? resolve(t, n, present) : n;
      }
      return undefined;
    },
    view: s => {
      const { endsAt, ...rest } = s;
      return { ...rest, ms: msLeft(endsAt) };
    },
  });

  // A player who leaves is out; if it was their turn (or their word being voted on), move on.
  const idsKey = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    let s = tools.get();
    if (!s || s.phase === 'over') return;
    const gone = s.alive.filter(id => !presentRef.current.includes(id));
    if (!gone.length) {
      if (s.phase === 'vote' && allVoted(s, presentRef.current)) tools.set(resolve(tools, s, present));
      return;
    }
    const eventNo = s.eventNo + 1;
    for (const id of gone) s = { ...knockOut(s, id, eventNo), event: { kind: 'left', id } };
    s = { ...s, eventNo };
    const actor = s.phase === 'vote' ? s.vote!.by : s.cur;
    if (gone.includes(actor) || s.alive.length <= 1) s = advance(tools, s, actor, present);
    else if (s.phase === 'vote' && allVoted(s, presentRef.current)) s = resolve(tools, s, present);
    tools.set(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  const seconds = useCountdown(view && view.phase !== 'over' ? view.ms : undefined, `${view?.turnId}-${view?.phase}`);
  const lastEvent = view?.event;
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.kind === 'word' || lastEvent.kind === 'voted_in') playPop();
    else if (lastEvent.id === room.myId && lastEvent.kind !== 'left') playWrong();
  }, [lastEvent, room.myId]);
  useEffect(() => { if (view?.phase === 'over' && view.ranked.length) { playCorrect(); finish(view.ranked); } }, [view?.phase, view?.ranked, finish]);

  if (!view) return <ArenaFrame title="Word Chain" icon="⛓️"><Waiting /></ArenaFrame>;

  const prev = prevWord(view);
  const myTurn = view.phase === 'turn' && view.cur === room.myId;
  const wordsBy = Object.fromEntries(view.order.map(id => [id, view.chain.filter(c => c.by === id).length]));

  return (
    <ArenaFrame title="Word Chain" icon="⛓️" subtitle="Start your word with the last letter of the one before!"
      right={<div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right">
        <div>{view.chain.length - 1}/{WORD_CAP} words</div>
        {view.phase !== 'over' && <div className={seconds <= 3 ? 'text-amber-300' : 'text-violet-200'}>⏱️ {seconds}s</div>}
      </div>}>
      <Chain chain={view.chain} />
      <Players room={room} view={view} />
      <EventLine room={room} event={view.event} />
      {view.phase === 'turn' && (
        <>
          <TimerBar seconds={seconds} total={TURN_MS / 1000} />
          {myTurn
            ? <MyTurn key={view.turnId} view={view} prev={prev} input={input} />
            : <div className="rounded-3xl bg-white/10 p-5 text-center font-fredoka text-2xl">
                {who(room.players, view.cur).emoji} {who(room.players, view.cur).name} is thinking of a word starting with <span className="text-amber-300 text-3xl">{lastLetter(prev).toUpperCase()}</span>…
              </div>}
        </>
      )}
      {view.phase === 'vote' && view.vote && <VoteCard room={room} view={view} input={input} seconds={seconds} />}
      {view.phase === 'over' && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={wordsBy} reward={reward} />
      )}
    </ArenaFrame>
  );
}

const COLOURS = ['bg-pink-500', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-teal-500'];

function Chain({ chain }: { chain: State['chain'] }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [chain.length]);
  return (
    <div ref={box} className="rounded-3xl bg-black/25 p-3 mb-3 max-h-48 overflow-y-auto flex flex-wrap gap-2 items-center" aria-label="Chain">
      {chain.map((c, i) => {
        const last = i === chain.length - 1;
        return (
          <motion.span key={i} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} data-testid="wc-word"
            className={`rounded-full px-4 py-1.5 font-fredoka text-xl text-white ${COLOURS[i % COLOURS.length]} ${last ? 'ring-4 ring-white/70 text-2xl' : ''}`}>
            {c.word.slice(0, -1)}<span className={last ? 'text-yellow-200 underline' : ''}>{c.word.slice(-1)}</span>
          </motion.span>
        );
      })}
    </div>
  );
}

function Players({ room, view }: { room: RoomApi; view: View }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
      {view.order.map(id => {
        const w = who(room.players, id);
        const out = !view.alive.includes(id);
        const turn = view.phase !== 'over' && view.cur === id && view.phase === 'turn';
        return (
          <div key={id} className={`rounded-2xl px-3 py-2 font-nunito text-lg flex items-center gap-2 ${turn ? 'bg-amber-400/30 ring-4 ring-amber-300 shadow-[0_0_20px_rgba(252,211,77,0.6)]' : id === room.myId ? 'bg-white/15 ring-2 ring-white/30' : 'bg-white/10'} ${out ? 'opacity-50' : ''}`}>
            <span className="text-2xl">{w.emoji}</span>
            <span className="flex-1 truncate">{w.name}{turn && <span className="block text-base text-amber-200">🎯 turn</span>}</span>
            <span aria-label={`${view.hearts[id] ?? 0} hearts`}>{out ? '💤 out' : Array.from({ length: HEARTS }, (_, i) => (i < (view.hearts[id] ?? 0) ? '❤️' : '🤍')).join('')}</span>
          </div>
        );
      })}
    </div>
  );
}

function EventLine({ room, event }: { room: RoomApi; event: Event | null }) {
  if (!event) return null;
  const n = who(room.players, event.id).name;
  const text = event.kind === 'word' ? `✅ ${n} played ${event.word.toUpperCase()}`
    : event.kind === 'voted_in' ? `🗳️ Friends said ${event.word.toUpperCase()} counts — nice one, ${n}!`
      : event.kind === 'voted_out' ? `🗳️ Friends weren’t sure about ${event.word.toUpperCase()} — ${n} loses a heart`
        : event.kind === 'timeout' ? `⏰ Time ran out for ${n} — one heart gone`
          : `👋 ${n} left the game`;
  return <p className="font-nunito text-lg text-violet-100 text-center mb-2" role="status">{text}</p>;
}

function TimerBar({ seconds, total }: { seconds: number; total: number }) {
  return (
    <div className="h-3 rounded-full bg-black/30 mb-3 overflow-hidden">
      <div className={`h-full transition-all duration-300 ${seconds <= 3 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, (seconds / total) * 100)}%` }} />
    </div>
  );
}

function MyTurn({ view, prev, input }: { view: View; prev: string; input: (d: Record<string, unknown>) => void }) {
  const first = lastLetter(prev);
  const [draft, setDraft] = useState(first);
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const onKey = useCallback((k: string) => { if (k === ' ') return; setMsg(null); setDraft(d => (d.length >= MAX_LEN ? d : d + k.toLowerCase())); }, []);
  const onBackspace = useCallback(() => { setMsg(null); setDraft(d => (d.length > first.length ? d.slice(0, -1) : d)); }, [first]);
  const onEnter = useCallback(() => {
    const r = checkWord(draft, prev, view.chain.map(c => c.word));
    const m = isRude(draft) ? 'Let’s pick a different word 🙂'
      : r === 'short' ? 'Words need at least 3 letters ✍️'
        : r === 'used' ? 'That one’s already in the chain — think of another! 🤔'
          : r === 'letter' ? `Start with ${first.toUpperCase()}!` : null;
    if (m) { setMsg(m); playWrong(); return; }
    playClick();
    setSent(true);
    input({ kind: 'word', turn: view.turnId, word: cleanWord(draft) });
  }, [draft, prev, view.chain, view.turnId, first, input]);
  return (
    <div className="rounded-3xl bg-amber-400/15 ring-4 ring-amber-300 p-4">
      <div className="font-fredoka text-2xl text-center mb-2">🎯 Your turn! A word starting with <span className="text-amber-300 text-3xl">{first.toUpperCase()}</span></div>
      <div className="min-h-[60px] rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-4xl text-center tracking-wider mb-2" data-testid="wc-draft">
        <span className="text-amber-300">{draft.slice(0, first.length).toUpperCase()}</span>{draft.slice(first.length).toUpperCase()}
      </div>
      {msg && <p className="font-nunito text-lg text-amber-200 text-center mb-2" role="status">{msg}</p>}
      {sent && <p className="font-nunito text-lg text-violet-200 text-center mb-2">Checking… 🔍</p>}
      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} disabled={sent} enterLabel="Go!" />
    </div>
  );
}

function VoteCard({ room, view, input, seconds }: { room: RoomApi; view: View; input: (d: Record<string, unknown>) => void; seconds: number }) {
  const v = view.vote!;
  const mine = v.by === room.myId;
  const voted = v.yes.includes(room.myId) || v.no.includes(room.myId);
  const voters = room.players.filter(p => p.id !== v.by).length;
  const cast = (yes: boolean) => { if (voted || mine) return; playClick(); input({ kind: 'vote', turn: view.turnId, yes }); };
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl bg-white/10 p-5 text-center" aria-label="Vote">
      <div className="font-nunito text-lg text-violet-200 mb-1">That word isn’t in our dictionary…</div>
      <div className="font-fredoka text-3xl mb-3">
        {mine ? <>Friends are voting on <span className="text-amber-300">{v.word.toUpperCase()}</span>… 🤞</>
          : <>Is <span className="text-amber-300">{v.word.toUpperCase()}</span> a real word?</>}
      </div>
      {!mine && (
        <div className="flex justify-center gap-4 mb-3">
          <button type="button" disabled={voted} onClick={() => cast(true)} aria-label="Yes, real word"
            className="min-w-[120px] min-h-[72px] rounded-3xl text-5xl bg-green-500/40 disabled:opacity-40 active:scale-95">👍</button>
          <button type="button" disabled={voted} onClick={() => cast(false)} aria-label="No, not a word"
            className="min-w-[120px] min-h-[72px] rounded-3xl text-5xl bg-rose-500/40 disabled:opacity-40 active:scale-95">👎</button>
        </div>
      )}
      <div className="font-nunito text-lg text-violet-200">{voted ? 'Thanks for voting! ' : ''}{v.yes.length + v.no.length}/{voters} voted · ⏱️ {seconds}s</div>
    </motion.div>
  );
}
