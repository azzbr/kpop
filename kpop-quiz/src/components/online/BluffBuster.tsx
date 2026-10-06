import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import type { BluffPrompt } from '../../online/bluffFacts';
import { playClick, playPop, playCorrect, playWrong } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { FinalCard } from './RaceParts';
import { ArenaFrame, RoundPill, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import {
  ROUNDS, WRITE_MS, PICK_MS, MAX_FAKE, REAL_KEY, revealMs, checkFake, buildOptions, canPick, scoreBluff, pickPrompts, fakeKey,
} from './bluffBusterLogic';
import type { BluffOption, FakeCheck } from './bluffBusterLogic';

// Bluff Buster: a weird true fact with a gap. Everyone types a fake answer, then everyone tries
// to spot the real one. The real answer, the fakes and who wrote them stay on the host until the
// reveal: the view only has the prompt text, who is done, and (when picking) the option texts.

interface State {
  ids: string[];
  prompts: BluffPrompt[];
  round: number;
  phase: 'write' | 'pick' | 'reveal' | 'final';
  endsAt: number;
  fakes: Record<string, string>;
  /** Latest refused fake per player: `n` is the player's try number. */
  notes: Record<string, { n: number; r: FakeCheck }>;
  options: BluffOption[];
  picks: Record<string, string>;
  /** How many times each player tried to pick their own fake (rare: only after a refresh). */
  refused: Record<string, number>;
  gained: Record<string, number>;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}

interface RevealOption { key: string; text: string; authors: string[]; pickers: string[] }
interface View {
  round: number; phase: State['phase']; ms: number;
  prompt: { id: string; text: string };
  done: string[];
  notes: State['notes'];
  refused: Record<string, number>;
  options?: { key: string; text: string }[];
  reveal?: { answer: string; fact: string; options: RevealOption[]; gained: Record<string, number> };
  scores: Record<string, number>;
  ranked?: (string | string[])[];
}

const here = (s: State, present: string[]) => s.ids.filter(id => present.includes(id));

function startWrite(t: HostTools<State>, s: State): State {
  t.after('phase', WRITE_MS + 500, () => t.set(startPick(t, t.get())));
  return { ...s, round: s.round + 1, phase: 'write', endsAt: Date.now() + WRITE_MS, fakes: {}, notes: {}, options: [], picks: {}, refused: {}, gained: {} };
}

function startPick(t: HostTools<State>, s: State): State {
  if (s.phase !== 'write') return s;
  const options = buildOptions(s.fakes, s.prompts[s.round - 1]);
  t.after('phase', PICK_MS + 500, () => t.set(startReveal(t, t.get())));
  return { ...s, phase: 'pick', endsAt: Date.now() + PICK_MS, options, picks: {} };
}

function startReveal(t: HostTools<State>, s: State): State {
  if (s.phase !== 'pick') return s;
  const gained = scoreBluff(s.options, s.picks);
  const scores = { ...s.scores };
  for (const [id, n] of Object.entries(gained)) scores[id] = (scores[id] ?? 0) + n;
  const ms = revealMs(s.options.length);
  t.after('phase', ms, () => t.set(afterReveal(t, t.get())));
  return { ...s, phase: 'reveal', endsAt: Date.now() + ms, gained, scores };
}

function afterReveal(t: HostTools<State>, s: State): State {
  if (s.phase !== 'reveal') return s;
  if (s.round >= s.prompts.length) {
    t.cancel('phase');
    return { ...s, phase: 'final', ranked: rankByScore(s.scores, s.ids) };
  }
  return startWrite(t, s);
}

/** Move on early once everyone still in the room is done. */
function maybeAdvance(t: HostTools<State>, s: State, present: string[]): State {
  const ids = here(s, present);
  if (s.phase === 'write' && ids.every(id => s.fakes[id] !== undefined)) return startPick(t, s);
  if (s.phase === 'pick' && ids.every(id => s.picks[id] !== undefined)) return startReveal(t, s);
  return s;
}

export default function BluffBuster({ room }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const hostId = useRef(room.myId);
  const myFakes = useRef<MyFakes>(new Map());

  const { view, input, tools } = useHostGame<State, View>(room, 'bb', {
    start: (ids, t) => startWrite(t, {
      ids, prompts: pickPrompts(ROUNDS), round: 0, phase: 'write', endsAt: 0, fakes: {}, notes: {}, options: [], picks: {},
      refused: {}, gained: {}, scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [],
    }),
    onInput: (s, from, m, t) => {
      if (m.kind === 'next') return from === hostId.current && s.phase === 'reveal' ? afterReveal(t, s) : undefined;
      if (!s.ids.includes(from) || m.round !== s.round) return undefined;
      if (m.kind === 'fake' && s.phase === 'write' && s.fakes[from] === undefined && typeof m.text === 'string') {
        const text = m.text.slice(0, MAX_FAKE);
        const r = checkFake(text, s.prompts[s.round - 1]);
        if (r !== 'ok') return { ...s, notes: { ...s.notes, [from]: { n: Number(m.n) || 0, r } } };
        return maybeAdvance(t, { ...s, fakes: { ...s.fakes, [from]: text } }, presentRef.current);
      }
      if (m.kind === 'pick' && s.phase === 'pick' && s.picks[from] === undefined && typeof m.key === 'string') {
        const opt = s.options.find(o => o.key === m.key);
        if (!opt) return undefined;
        if (!canPick(opt, from)) return { ...s, refused: { ...s.refused, [from]: (s.refused[from] ?? 0) + 1 } };
        return maybeAdvance(t, { ...s, picks: { ...s.picks, [from]: m.key } }, presentRef.current);
      }
      return undefined;
    },
    view: s => {
      const p = s.prompts[s.round - 1];
      const v: View = {
        round: s.round, phase: s.phase, ms: msLeft(s.endsAt), prompt: { id: p.id, text: p.text },
        done: Object.keys(s.phase === 'write' ? s.fakes : s.picks), notes: s.notes, refused: s.refused, scores: s.scores,
      };
      if (s.phase !== 'write') v.options = s.options.map(o => ({ key: o.key, text: o.text }));
      if (s.phase === 'reveal' || s.phase === 'final') {
        v.reveal = {
          answer: p.answer, fact: p.fact, gained: s.gained,
          options: s.options.map(o => ({ ...o, pickers: Object.keys(s.picks).filter(id => s.picks[id] === o.key) })),
        };
      }
      if (s.phase === 'final') v.ranked = s.ranked;
      return v;
    },
  });

  // Someone leaving can mean everyone left is done.
  const ids = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    const s = tools.get();
    if (!s) return;
    const n = maybeAdvance(tools, s, presentRef.current);
    if (n !== s) tools.set(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, room.isHost]);

  const seconds = useCountdown(view && view.phase !== 'final' ? view.ms : undefined, `${view?.round}-${view?.phase}`);
  useEffect(() => { if (view?.phase === 'reveal') playPop(); }, [view?.phase, view?.round]);
  useEffect(() => { if (view?.phase === 'final' && view.ranked) { playCorrect(); finish(view.ranked); } }, [view?.phase, view?.ranked, finish]);

  if (!view) return <ArenaFrame title="Bluff Buster" icon="🤥"><Waiting /></ArenaFrame>;

  return (
    <ArenaFrame title="Bluff Buster" icon="🤥" subtitle="Write a sneaky fake — then spot the real answer!"
      right={<RoundPill round={view.round} of={ROUNDS} seconds={view.phase !== 'final' ? seconds : undefined} />}>
      <PromptCard text={view.prompt.text} answer={view.reveal && view.phase !== 'write' ? view.reveal.answer : undefined} />
      {view.phase === 'write' && <WritePhase key={view.round} room={room} view={view} input={input} mine={myFakes.current} />}
      {view.phase === 'pick' && <PickPhase key={view.round} room={room} view={view} input={input} mine={myFakes.current} />}
      {(view.phase === 'reveal' || view.phase === 'final') && view.reveal && (
        <RevealPhase key={view.round} room={room} view={view} onNext={() => { playClick(); input({ kind: 'next' }); }} />
      )}
      <Scores room={room} scores={view.scores}
        note={id => view.phase === 'reveal' && view.reveal?.gained[id] ? (
          <motion.span initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-fredoka text-green-300">+{view.reveal.gained[id]}</motion.span>
        ) : null} />
      {view.phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />
      )}
    </ArenaFrame>
  );
}

function PromptCard({ text, answer }: { text: string; answer?: string }) {
  const [a, b] = text.split('___');
  return (
    <div className="rounded-3xl bg-white/10 p-5 mb-4 text-center" data-testid="bb-prompt">
      <p className="font-fredoka text-2xl md:text-3xl leading-snug">
        {a}
        {answer
          ? <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="inline-block px-2 rounded-xl bg-green-500/40 text-green-100">{answer}</motion.span>
          : <span className="inline-block min-w-[5ch] border-b-4 border-amber-300 mx-1 text-amber-300">?</span>}
        {b}
      </p>
    </div>
  );
}

/** The fake this device wrote, by prompt id (to grey out its own option when picking). */
type MyFakes = Map<string, string>;

function WritePhase({ room, view, input, mine }: { room: RoomApi; view: View; input: (d: Record<string, unknown>) => void; mine: MyFakes }) {
  const [draft, setDraft] = useState('');
  const [tries, setTries] = useState(0);
  const [local, setLocal] = useState<FakeCheck | null>(null);
  const done = view.done.includes(room.myId);
  const note = view.notes[room.myId];
  const answered = note && note.n === tries ? note.r : null;
  const checking = tries > 0 && !done && !answered;

  const onKey = useCallback((k: string) => {
    setLocal(null);
    setDraft(d => (d.length >= MAX_FAKE || (k === ' ' && (d === '' || d.endsWith(' '))) ? d : d + k));
  }, []);
  const onBackspace = useCallback(() => { setLocal(null); setDraft(d => d.slice(0, -1)); }, []);
  const onEnter = useCallback(() => {
    const r = checkFake(draft);
    if (r !== 'ok') { setLocal(r); playWrong(); return; }
    playClick();
    const n = tries + 1;
    setTries(n);
    mine.set(view.prompt.id, draft);
    input({ kind: 'fake', round: view.round, text: draft, n });
  }, [draft, tries, input, mine, view.round, view.prompt.id]);

  const msg = local === 'empty' ? 'Type a fake answer first ✍️'
    : local === 'unkind' || answered === 'unkind' ? 'Let’s keep it kind — try another one 🙂'
      : answered === 'real' ? 'That’s the real answer — sneaky! 🤫 Try a fake one.'
        : null;

  if (done) {
    return (
      <div className="rounded-3xl bg-white/10 p-5 mb-4 text-center">
        <div className="font-fredoka text-2xl">✅ Fake locked in!</div>
        <div className="font-nunito text-lg text-violet-200 mt-1">Waiting for friends… {view.done.length}/{room.players.length} done</div>
      </div>
    );
  }
  return (
    <div className="rounded-3xl bg-white/10 p-4 mb-4">
      <div className="font-nunito text-lg text-violet-200 text-center mb-2">Type a FAKE answer that sounds true:</div>
      <div className="min-h-[56px] rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-3xl text-center tracking-wide mb-2" data-testid="bb-draft">
        {draft || <span className="text-white/30">…</span>}
      </div>
      {msg && <p className="font-nunito text-lg text-amber-200 text-center mb-2" role="status">{msg}</p>}
      {checking && <p className="font-nunito text-lg text-violet-200 text-center mb-2">Checking… 🔍</p>}
      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={checking} enterLabel="Send ✍️" />
      <div className="font-nunito text-base text-violet-200 text-center mt-2">{view.done.length}/{room.players.length} done</div>
    </div>
  );
}

function PickPhase({ room, view, input, mine: myFakes }: { room: RoomApi; view: View; input: (d: Record<string, unknown>) => void; mine: MyFakes }) {
  const [mine, setMine] = useState<{ key: string; refused: number } | null>(null);
  const refused = view.refused[room.myId] ?? 0;
  const done = view.done.includes(room.myId);
  const waiting = !!mine && !done && mine.refused === refused;
  const own = myFakes.get(view.prompt.id);
  const ownKey = own ? fakeKey(own) : null;
  const pick = (key: string) => {
    if (done || waiting) return;
    playClick();
    setMine({ key, refused });
    input({ kind: 'pick', round: view.round, key });
  };
  return (
    <div className="rounded-3xl bg-white/10 p-4 mb-4">
      <div className="font-fredoka text-2xl text-center mb-3">{done || waiting ? '🤞 Locked in!' : 'Which one is TRUE?'}</div>
      {refused > 0 && !done && !waiting && <p className="font-nunito text-lg text-amber-200 text-center mb-2">That one’s your own fake — pick another! 😄</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {view.options?.map(o => {
          const isOwn = ownKey !== null && fakeKey(o.text) === ownKey;
          const chosen = mine?.key === o.key && (done || waiting);
          return (
            <motion.button key={o.key} data-testid="bb-opt" whileTap={{ scale: 0.95 }} disabled={isOwn || done || waiting} onClick={() => pick(o.key)}
              className={`min-h-[64px] rounded-2xl px-4 py-3 font-fredoka text-2xl border-4 ${chosen ? 'bg-amber-400/40 border-amber-300' : isOwn ? 'bg-white/5 border-transparent opacity-50' : 'bg-white/15 border-white/20'}`}>
              {o.text}{isOwn && <span className="block font-nunito text-base">✍️ yours</span>}
            </motion.button>
          );
        })}
      </div>
      <div className="font-nunito text-base text-violet-200 text-center mt-3">{view.done.length}/{room.players.length} picked</div>
    </div>
  );
}

function RevealPhase({ room, view, onNext }: { room: RoomApi; view: View; onNext: () => void }) {
  const r = view.reveal!;
  const fakes = r.options.filter(o => o.key !== REAL_KEY);
  const truth = r.options.find(o => o.key === REAL_KEY);
  const names = (ids: string[]) => ids.map(id => who(room.players, id).name).join(' & ');
  return (
    <div className="mb-4" aria-label="Reveal">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {fakes.map((o, i) => (
          <motion.div key={o.key} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.7 }}
            className={`rounded-2xl p-3 ${o.authors.includes(room.myId) ? 'bg-amber-400/20 ring-2 ring-amber-300' : 'bg-black/25'}`}>
            <div className="font-fredoka text-2xl">{o.text} <span className="text-base text-rose-200">🙃 fake</span></div>
            <div className="font-nunito text-base text-violet-200">✍️ by {names(o.authors)}</div>
            <div className="font-nunito text-base mt-1 flex flex-wrap gap-1 items-center">
              {o.pickers.length === 0 ? <span className="text-white/60">Nobody was fooled</span> : <>
                <span>fooled:</span>
                {o.pickers.map(id => <span key={id} className="rounded-full bg-white/15 px-2 py-0.5">{who(room.players, id).emoji} {who(room.players, id).name}</span>)}
              </>}
            </div>
          </motion.div>
        ))}
      </div>
      {truth && (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5 + fakes.length * 0.7, type: 'spring', stiffness: 200 }}
          className="rounded-3xl p-4 bg-green-500/25 ring-4 ring-green-300 shadow-[0_0_30px_rgba(74,222,128,0.5)] text-center">
          <div className="font-fredoka text-3xl">✅ {r.answer}</div>
          <p className="font-nunito text-lg mt-1">{r.fact}</p>
          <p className="font-nunito text-lg text-green-200 mt-2">
            {truth.pickers.length ? `🕵️ Spotted by ${names(truth.pickers)}` : 'Nobody spotted it — great bluffing, everyone!'}
          </p>
        </motion.div>
      )}
      {room.isHost && view.phase === 'reveal' && (
        <div className="text-center mt-3">
          <button onClick={onNext} className="min-h-[52px] px-8 rounded-full font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 active:scale-95">Next ▶</button>
        </div>
      )}
    </div>
  );
}
