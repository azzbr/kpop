import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig, GameMsg } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { playClick, playPop, playCorrect, playWrong, playUnlock } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas';
import { FinalCard } from './RaceParts';
import { ArenaFrame, Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { usePictures, snapPicture, type Pictures } from './arenaPictures';
import {
  DRAW_MS, TITLE_MS, VOTE_MS, GRACE_MS, MAX_TITLE, REAL_KEY, revealMs, titleKey, tidyTitle, checkTitle, buildOptions,
  canVote, votersFor, scoreDrawing, dealPrompts, drawingOrder, picId, type DecoyOption, type TitleCheck,
} from './doodleDecoyLogic';

// Doodle Decoy: everyone draws a secret silly prompt. Then, for each drawing in turn, everyone
// except the artist writes a fake title, and everyone votes for the real one.
// Host-authoritative on useHostGame (prefix decoy). Secret prompts go to each device alone
// (`decoy_mine { to }`); the view never holds the real title until the vote (where it is just
// one of the shuffled options) and never says who wrote what until the reveal.
// Drawings: one `decoy_pic` each (arenaPictures), the view only names the picture id.

const PREFIX = 'decoy';
type Phase = 'draw' | 'title' | 'vote' | 'reveal' | 'final';

interface State {
  ids: string[];
  prompts: Record<string, string>;
  phase: Phase;
  endsAt: number;
  closing: boolean;
  drew: Record<string, string>;
  order: string[];
  turn: number;
  fakes: Record<string, string>;
  notes: Record<string, { n: number; r: TitleCheck | 'real' }>;
  options: DecoyOption[];
  typedReal: string[];
  votes: Record<string, string>;
  gained: Record<string, number>;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}

interface RevealOption extends DecoyOption { pickers: string[] }
interface View {
  phase: Phase; ms: number; closing: boolean; ids: string[];
  turn: number; turns: number; artist?: string; pic?: string;
  done: string[];
  notes: State['notes'];
  options?: { key: string; text: string }[];
  reveal?: { real: string; options: RevealOption[]; typedReal: string[]; gained: Record<string, number> };
  scores: Record<string, number>;
  ranked?: (string | string[])[];
}

interface G { t: HostTools<State>; send: (m: GameMsg) => void; present: () => string[] }

const artistOf = (s: State) => s.order[s.turn];
const here = (g: G, ids: string[]) => ids.filter(id => g.present().includes(id));

function sendPrompts(g: G, s: State, only?: string) {
  for (const id of s.ids) if (!only || id === only) g.send({ t: 'decoy_mine', to: id, prompt: s.prompts[id] });
}

/** Time's up: devices send what they have; GRACE_MS later we move on. */
function close(g: G, s: State, then: (g: G, s: State) => State): State {
  if (s.closing) return s;
  g.t.after('phase', GRACE_MS, () => g.t.set(then(g, g.t.get())));
  return { ...s, closing: true };
}

function endDraw(g: G, s: State): State {
  if (s.phase !== 'draw') return s;
  g.t.cancel('phase');
  const order = drawingOrder(s.ids, s.drew);
  if (!order.length) return { ...s, phase: 'final', closing: false, ranked: rankByScore(s.scores, s.ids) };
  return startTitle(g, { ...s, order }, 0);
}

function startTitle(g: G, s: State, turn: number): State {
  g.t.after('phase', TITLE_MS + 300, () => { const c = g.t.get(); if (c.phase === 'title' && c.turn === turn) g.t.set(close(g, c, startVote)); });
  return maybeAdvance(g, {
    ...s, phase: 'title', turn, endsAt: Date.now() + TITLE_MS, closing: false, fakes: {}, notes: {}, options: [], typedReal: [], votes: {}, gained: {},
  });
}

function startVote(g: G, s: State): State {
  if (s.phase !== 'title') return s;
  g.t.cancel('phase');
  const { options, typedReal } = buildOptions(s.prompts[artistOf(s)], s.fakes);
  const n: State = { ...s, phase: 'vote', endsAt: Date.now() + VOTE_MS, closing: false, options, typedReal, votes: {} };
  if (!votersFor(s.ids, artistOf(s), typedReal).length || options.length < 2) return reveal(g, n);
  g.t.after('phase', VOTE_MS + 300, () => g.t.set(reveal(g, g.t.get())));
  return maybeAdvance(g, n);
}

function reveal(g: G, s: State): State {
  if (s.phase !== 'vote') return s;
  g.t.cancel('phase');
  const gained = scoreDrawing(s.options, s.votes, s.typedReal, artistOf(s));
  const scores = { ...s.scores };
  for (const [id, n] of Object.entries(gained)) scores[id] = (scores[id] ?? 0) + n;
  const ms = revealMs(s.options.length);
  g.t.after('phase', ms, () => g.t.set(afterReveal(g, g.t.get())));
  return { ...s, phase: 'reveal', endsAt: Date.now() + ms, gained, scores };
}

function afterReveal(g: G, s: State): State {
  if (s.phase !== 'reveal') return s;
  g.t.cancel('phase');
  if (s.turn + 1 >= s.order.length) return { ...s, phase: 'final', ranked: rankByScore(s.scores, s.ids) };
  return startTitle(g, s, s.turn + 1);
}

/** Move on early once everyone still in the room is done. */
function maybeAdvance(g: G, s: State): State {
  if (s.phase === 'draw' && here(g, s.ids).every(id => s.drew[id] !== undefined)) return endDraw(g, s);
  if (s.phase === 'title' && here(g, s.ids).every(id => id === artistOf(s) || s.fakes[id] !== undefined)) return startVote(g, s);
  if (s.phase === 'vote' && here(g, votersFor(s.ids, artistOf(s), s.typedReal)).every(id => s.votes[id] !== undefined)) return reveal(g, s);
  return s;
}

function Pic({ id, pics, className = '' }: { id?: string; pics: Pictures; className?: string }) {
  const src = id ? pics.get(id) : undefined;
  if (src) return <img src={src} alt="a friend's drawing" className={`block aspect-[4/3] bg-white rounded-2xl shadow-2xl object-contain ${className}`} />;
  return <div className={`aspect-[4/3] bg-white/80 rounded-2xl flex items-center justify-center text-gray-600 font-nunito text-lg ${className}`}>🖼️ Picture on its way…</div>;
}

export default function DoodleDecoy({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const board = config?.board === '1';
  const { finish, reward } = useArenaFinish(room);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const hostId = useRef(room.myId);
  const mk = (t: HostTools<State>): G => ({ t, send: room.send, present: () => presentRef.current });
  const myFakes = useRef(new Map<number, string>());

  const { view, input, tools, paused } = useHostGame<State, View>(room, PREFIX, {
    board,
    start: (ids, t) => {
      const g = mk(t);
      const deal = dealPrompts(ids.length);
      const s: State = {
        ids, prompts: Object.fromEntries(ids.map((id, i) => [id, deal[i]])), phase: 'draw', endsAt: Date.now() + DRAW_MS, closing: false,
        drew: {}, order: [], turn: 0, fakes: {}, notes: {}, options: [], typedReal: [], votes: {}, gained: {},
        scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [],
      };
      t.after('phase', DRAW_MS + 300, () => { const c = t.get(); if (c.phase === 'draw') t.set(close(g, c, endDraw)); });
      sendPrompts(g, s);
      return s;
    },
    onInput: (s, from, m, t) => {
      const g = mk(t);
      if (m.kind === 'next') return from === hostId.current && s.phase === 'reveal' ? afterReveal(g, s) : undefined;
      if (!s.ids.includes(from)) return undefined;
      if (m.kind === 'mine') { sendPrompts(g, s, from); return undefined; }
      if (m.kind === 'drew') {
        if (s.phase !== 'draw' || s.drew[from] !== undefined) return undefined;
        return maybeAdvance(g, { ...s, drew: { ...s.drew, [from]: m.pic === picId(from) ? m.pic : '' } });
      }
      if (m.turn !== s.turn) return undefined;
      if (m.kind === 'title' && s.phase === 'title' && from !== artistOf(s) && s.fakes[from] === undefined && typeof m.text === 'string') {
        const text = tidyTitle(m.text.slice(0, MAX_TITLE * 2));
        const r = checkTitle(text);
        const n = Number(m.n) || 0;
        if (r !== 'ok') return { ...s, notes: { ...s.notes, [from]: { n, r } } };
        const real = titleKey(text) === titleKey(s.prompts[artistOf(s)]);
        return maybeAdvance(g, { ...s, fakes: { ...s.fakes, [from]: text }, notes: { ...s.notes, [from]: { n, r: real ? 'real' : 'ok' } } });
      }
      if (m.kind === 'vote' && s.phase === 'vote' && s.votes[from] === undefined && typeof m.key === 'string') {
        if (!canVote(s.options.find(o => o.key === m.key), from, artistOf(s), s.typedReal)) return undefined;
        return maybeAdvance(g, { ...s, votes: { ...s.votes, [from]: m.key } });
      }
      return undefined;
    },
    onSkip: (s, t) => {
      const g = mk(t);
      if (s.phase === 'draw') return s.closing ? endDraw(g, s) : close(g, s, endDraw);
      if (s.phase === 'title') return s.closing ? startVote(g, s) : close(g, s, startVote);
      if (s.phase === 'vote') return reveal(g, s);
      if (s.phase === 'reveal') return afterReveal(g, s);
      return undefined;
    },
    view: s => {
      const artist = artistOf(s);
      const v: View = {
        phase: s.phase, ms: msLeft(s.endsAt), closing: s.closing, ids: s.ids, turn: s.turn, turns: s.order.length,
        done: [], notes: s.phase === 'title' ? s.notes : {}, scores: s.scores,
      };
      if (s.phase === 'draw') v.done = Object.keys(s.drew);
      if (s.phase !== 'draw' && artist) { v.artist = artist; v.pic = s.drew[artist]; }
      if (s.phase === 'title') v.done = Object.keys(s.fakes);
      if (s.phase === 'vote') { v.done = Object.keys(s.votes); v.options = s.options.map(o => ({ key: o.key, text: o.text })); }
      if (s.phase === 'vote') v.notes = Object.fromEntries(s.typedReal.map(id => [id, { n: 0, r: 'real' as const }]));
      if (s.phase === 'reveal') {
        v.reveal = {
          real: s.prompts[artist], typedReal: s.typedReal, gained: s.gained,
          options: s.options.map(o => ({ ...o, pickers: Object.keys(s.votes).filter(id => s.votes[id] === o.key) })),
        };
      }
      if (s.phase === 'final') v.ranked = s.ranked;
      return v;
    },
  });

  // Someone leaving can mean everyone left is done.
  const idsKey = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    const s = tools.get();
    if (!s) return;
    const n = maybeAdvance(mk(tools), s);
    if (n !== s) tools.set(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  // My secret prompt (sent to this device only); ask again if it got lost.
  const [prompt, setPrompt] = useState('');
  const { onMessage, myId } = room;
  useEffect(() => onMessage((m: GameMsg) => {
    if (m.t === 'decoy_mine' && m.to === myId && typeof m.prompt === 'string') setPrompt(m.prompt);
  }), [onMessage, myId]);
  const amPlayer = !!view?.ids.includes(myId);
  const needPrompt = !!view && amPlayer && !prompt && view.phase !== 'final';
  useEffect(() => {
    if (!needPrompt) return;
    const ask = () => input({ kind: 'mine' });
    const first = window.setTimeout(ask, 900);
    const iv = window.setInterval(ask, 2500);
    return () => { window.clearTimeout(first); window.clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needPrompt]);

  const hostState = room.isHost ? tools.get() : null;
  const wanted = [...(hostState ? Object.values(hostState.drew).filter(Boolean) : []), ...(view?.pic ? [view.pic] : [])];
  const pics = usePictures(room, PREFIX, [...new Set(wanted)]);

  const seconds = useCountdown(view && view.phase !== 'final' && !view.closing ? view.ms : undefined, `${view?.phase}-${view?.turn}-${view?.closing}`);
  useEffect(() => { if (view?.phase === 'draw' || view?.phase === 'title') playUnlock(); }, [view?.phase, view?.turn]);
  useEffect(() => { if (view?.phase === 'reveal') playPop(); }, [view?.phase, view?.turn]);
  // The big screen doesn't play, so it gets no reward.
  const watching = board && room.isHost;
  useEffect(() => { if (view?.phase === 'final' && view.ranked) { playCorrect(); if (!watching) finish(view.ranked); } }, [view?.phase, view?.ranked, finish, watching]);

  if (!view) return <ArenaFrame title="Doodle Decoy" icon="🖼️" tint={TINT}><Waiting /></ArenaFrame>;

  const pill = (
    <div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right" aria-label="Timer">
      <div>{view.phase === 'draw' ? '🎨 Draw!' : `Drawing ${Math.min(view.turn + 1, view.turns)}/${view.turns}`}</div>
      {paused ? <div className="text-amber-300">⏸️ Paused</div>
        : view.closing ? <div className="text-amber-300">📨 Sending…</div>
          : view.phase !== 'final' && <div className={seconds <= 5 ? 'text-amber-300' : 'text-sky-200'}>⏱️ {seconds}s</div>}
    </div>
  );
  const isArtist = view.artist === myId;
  const artist = view.artist ? who(room.players, view.artist) : null;

  return (
    <ArenaFrame title="Doodle Decoy" icon="🖼️" tint={TINT} right={pill}
      subtitle={view.phase === 'draw' ? 'Draw your secret prompt — shh!' : 'Write a sneaky fake title — then spot the real one!'}>
      {paused && <div className="rounded-2xl bg-amber-400/25 ring-2 ring-amber-300 px-4 py-2 mb-3 text-center font-fredoka text-xl">⏸️ The game is paused — back in a moment!</div>}

      {view.phase === 'draw' && (amPlayer
        ? <DrawPhase room={room} view={view} prompt={prompt} pics={pics} input={input} paused={paused} />
        : <Progress room={room} ids={view.ids} done={view.done} icon="✏️" text="Everyone is drawing a secret prompt…" />)}

      {view.phase !== 'draw' && view.phase !== 'final' && artist && (
        <div className="mb-3">
          <div className="text-center font-fredoka text-2xl mb-2" data-testid="decoy-artist">🎨 {artist.emoji} {artist.name}’s drawing</div>
          <Pic id={view.pic} pics={pics} className={`w-full mx-auto ${board ? 'max-w-3xl' : 'max-w-lg'}`} />
        </div>
      )}

      {view.phase === 'title' && (amPlayer && !isArtist
        ? <TitlePhase key={view.turn} room={room} view={view} input={input} mine={myFakes.current} paused={paused} />
        : <Progress room={room} ids={view.ids.filter(id => id !== view.artist)} done={view.done} icon={isArtist ? '🤫' : '✍️'}
          text={isArtist ? `This is your drawing! Keep a straight face… (it was “${prompt}”)` : 'Everyone is writing a sneaky fake title…'} />)}

      {view.phase === 'vote' && view.options && (
        <VotePhase key={view.turn} room={room} view={view} input={input} mine={myFakes.current} isArtist={isArtist} amPlayer={amPlayer} big={board} />
      )}

      {(view.phase === 'reveal') && view.reveal && artist && (
        <RevealPhase room={room} view={view} artistName={artist.name} big={board}
          onNext={room.isHost ? () => { playClick(); input({ kind: 'next' }); } : undefined} />
      )}

      <Scores room={room} scores={view.scores} ids={view.ids}
        note={id => view.phase === 'reveal' && view.reveal?.gained[id] ? (
          <motion.span initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-fredoka text-green-300">+{view.reveal.gained[id]}</motion.span>
        ) : null} />

      {view.phase === 'final' && view.ranked && <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />}
    </ArenaFrame>
  );
}

const TINT = 'from-sky-950 via-indigo-900 to-fuchsia-950';

function Progress({ room, ids, done, icon, text }: { room: RoomApi; ids: string[]; done: string[]; icon: string; text: string }) {
  return (
    <div className="rounded-3xl bg-white/10 p-6 mb-4 text-center">
      <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 1.4, repeat: Infinity }} className="text-6xl mb-2">{icon}</motion.div>
      <div className="font-fredoka text-2xl md:text-3xl mb-3">{text}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {ids.map(id => (
          <span key={id} className={`rounded-full px-3 py-1 font-nunito text-lg ${done.includes(id) ? 'bg-green-500/40' : 'bg-black/25'}`}>
            {done.includes(id) ? '✅' : '⏳'} {who(room.players, id).emoji} {who(room.players, id).name}
          </span>
        ))}
      </div>
    </div>
  );
}

function DrawPhase({ room, view, prompt, pics, input, paused }: {
  room: RoomApi; view: View; prompt: string; pics: Pictures; input: (d: Record<string, unknown>) => void; paused: boolean;
}) {
  const canvasRef = useRef<DrawCanvasHandle>(null);
  const [sent, setSent] = useState(false);
  const last = useRef<Record<string, unknown> | null>(null);
  const done = view.done.includes(room.myId);
  const submit = useCallback((auto: boolean) => {
    if (sent) return;
    const img = snapPicture(canvasRef.current);
    const id = picId(room.myId);
    if (img) pics.send(id, img);
    if (!auto) playClick();
    last.current = { kind: 'drew', pic: img ? id : '' };
    setSent(true);
    input(last.current);
  }, [sent, pics, room.myId, input]);
  useEffect(() => { if (view.closing && !sent && !done) submit(true); }, [view.closing, sent, done, submit]);
  useEffect(() => {
    if (!sent || done || paused) return;
    const iv = window.setInterval(() => { if (last.current) input(last.current); }, 3500);
    return () => window.clearInterval(iv);
  }, [sent, done, paused, input]);

  if (sent || done) return <Progress room={room} ids={view.ids} done={view.done} icon="📨" text="Sent! Waiting for the other artists…" />;
  return (
    <div className="mb-4">
      <div className="text-center mb-3">
        <div className="inline-block bg-amber-400/20 border-2 border-amber-400 rounded-2xl px-5 py-2 font-fredoka text-xl" data-testid="decoy-prompt">
          🤫 Draw: <span className="font-bold text-amber-300 text-2xl">{prompt || '…'}</span>
        </div>
        <div className="font-nunito text-lg text-sky-200 mt-1">Don’t write any words — just draw!</div>
      </div>
      <DrawCanvas ref={canvasRef} />
      <button onClick={() => submit(false)} disabled={paused || !prompt}
        className="mt-4 w-full min-h-[56px] rounded-full font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl active:scale-95 disabled:opacity-50">
        ✅ Done drawing!
      </button>
    </div>
  );
}

function TitlePhase({ room, view, input, mine, paused }: { room: RoomApi; view: View; input: (d: Record<string, unknown>) => void; mine: Map<number, string>; paused: boolean }) {
  const [draft, setDraft] = useState('');
  const [tries, setTries] = useState(0);
  const [local, setLocal] = useState<TitleCheck | null>(null);
  const done = view.done.includes(room.myId);
  const note = view.notes[room.myId];
  const answered = note && note.n === tries ? note.r : null;
  const checking = tries > 0 && !done && !answered;

  const send = useCallback((auto: boolean) => {
    const r = checkTitle(draft);
    if (r !== 'ok') { if (!auto) { setLocal(r); playWrong(); } return; }
    if (!auto) playClick();
    const n = tries + 1;
    setTries(n);
    mine.set(view.turn, draft);
    input({ kind: 'title', turn: view.turn, text: draft, n });
  }, [draft, tries, input, mine, view.turn]);
  useEffect(() => { if (view.closing && !done && !checking) send(true); }, [view.closing]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = useCallback((k: string) => {
    setLocal(null);
    setDraft(d => (d.length >= MAX_TITLE || (k === ' ' && (d === '' || d.endsWith(' '))) ? d : d + k.toLowerCase()));
  }, []);
  const onBackspace = useCallback(() => { setLocal(null); setDraft(d => d.slice(0, -1)); }, []);
  const onEnter = useCallback(() => send(false), [send]);

  if (done) {
    const found = note?.r === 'real';
    return (
      <div className="rounded-3xl bg-white/10 p-5 mb-4 text-center">
        <div className="font-fredoka text-2xl">{found ? '🎉 You typed the REAL title! +2 coming your way' : '✅ Fake title locked in!'}</div>
        <div className="font-nunito text-lg text-sky-200 mt-1">Waiting for friends… {view.done.length}/{view.ids.length - 1} done</div>
      </div>
    );
  }
  const msg = local === 'empty' ? 'Type a title first ✍️' : local === 'unkind' || answered === 'unkind' ? 'Let’s keep it kind — try another one 🙂' : null;
  return (
    <div className="rounded-3xl bg-white/10 p-4 mb-4">
      <div className="font-nunito text-lg text-sky-100 text-center mb-2">What could this drawing be called? Write a FAKE title to fool everyone:</div>
      <div className="min-h-[56px] rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-3xl text-center tracking-wide mb-2" data-testid="decoy-draft">
        {draft || <span className="text-white/30">a…</span>}
      </div>
      {msg && <p className="font-nunito text-lg text-amber-200 text-center mb-2" role="status">{msg}</p>}
      {checking && <p className="font-nunito text-lg text-sky-200 text-center mb-2">Checking… 🔍</p>}
      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={checking || paused} enterLabel="Send ✍️" />
    </div>
  );
}

function VotePhase({ room, view, input, mine, isArtist, amPlayer, big }: {
  room: RoomApi; view: View; input: (d: Record<string, unknown>) => void; mine: Map<number, string>; isArtist: boolean; amPlayer: boolean; big: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = view.done.includes(room.myId);
  const found = view.notes[room.myId]?.r === 'real';
  const own = mine.get(view.turn);
  const ownKey = own ? titleKey(own) : null;
  const canPick = amPlayer && !isArtist && !found && !done && !picked;
  const voters = view.ids.filter(id => id !== view.artist && view.notes[id]?.r !== 'real');
  const pick = (key: string) => {
    if (!canPick) return;
    playClick();
    setPicked(key);
    input({ kind: 'vote', turn: view.turn, key });
  };
  return (
    <div className="rounded-3xl bg-white/10 p-4 mb-4">
      <div className="font-fredoka text-2xl text-center mb-3">
        {isArtist ? '🤫 Which one will they pick?' : found ? '🎉 You already found the real title!' : !amPlayer ? 'Which title is REAL?' : done || picked ? '🤞 Locked in!' : 'Which title is REAL?'}
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${big ? 'md:text-3xl' : ''}`}>
        {view.options?.map(o => {
          const isOwn = ownKey !== null && titleKey(o.text) === ownKey;
          return (
            <motion.button key={o.key} data-testid="decoy-opt" whileTap={{ scale: 0.95 }} disabled={!canPick || isOwn} onClick={() => pick(o.key)}
              className={`min-h-[64px] rounded-2xl px-4 py-3 font-fredoka text-2xl border-4 ${picked === o.key ? 'bg-amber-400/40 border-amber-300' : isOwn ? 'bg-white/5 border-transparent opacity-50' : 'bg-white/15 border-white/20'} ${!canPick && !isOwn && picked !== o.key ? 'opacity-80' : ''}`}>
              {o.text}{isOwn && <span className="block font-nunito text-base">✍️ yours</span>}
            </motion.button>
          );
        })}
      </div>
      <div className="font-nunito text-base text-sky-200 text-center mt-3">{view.done.length}/{voters.length} voted</div>
    </div>
  );
}

function RevealPhase({ room, view, artistName, big, onNext }: { room: RoomApi; view: View; artistName: string; big: boolean; onNext?: () => void }) {
  const r = view.reveal!;
  const fakes = r.options.filter(o => o.key !== REAL_KEY);
  const truth = r.options.find(o => o.key === REAL_KEY);
  const names = (ids: string[]) => ids.map(id => who(room.players, id).name).join(' & ');
  const spotted = [...r.typedReal, ...(truth?.pickers ?? [])];
  return (
    <div className="mb-4" aria-label="Reveal">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {fakes.map((o, i) => (
          <motion.div key={o.key} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: 0.4 + i * 1.1 }}
            className={`rounded-2xl p-3 ${o.authors.includes(room.myId) ? 'bg-amber-400/20 ring-2 ring-amber-300' : 'bg-black/25'}`}>
            <div className={`font-fredoka ${big ? 'text-3xl' : 'text-2xl'}`}>“{o.text}” <span className="text-base text-rose-200">🙃 decoy</span></div>
            <div className="font-nunito text-lg text-sky-200">✍️ by {names(o.authors)}</div>
            <div className="font-nunito text-lg mt-1 flex flex-wrap gap-1 items-center">
              {o.pickers.length === 0 ? <span className="text-white/60">Nobody was fooled</span> : <>
                <span>fooled:</span>
                {o.pickers.map(id => <span key={id} className="rounded-full bg-white/15 px-2 py-0.5">{who(room.players, id).emoji} {who(room.players, id).name}</span>)}
              </>}
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.8 + fakes.length * 1.1, type: 'spring', stiffness: 200 }}
        className="rounded-3xl p-4 bg-green-500/25 ring-4 ring-green-300 shadow-[0_0_30px_rgba(74,222,128,0.5)] text-center" data-testid="decoy-real">
        <div className="font-nunito text-lg">🥁 The REAL title was…</div>
        <div className={`font-fredoka ${big ? 'text-5xl' : 'text-3xl'} my-1`}>✅ “{r.real}”</div>
        <p className="font-nunito text-lg text-green-100">
          {spotted.length ? `🕵️ Spotted by ${names(spotted)} — ${artistName} gets +${spotted.length}!` : `Nobody spotted it — those decoys were sneaky!`}
        </p>
      </motion.div>
      {onNext && (
        <div className="text-center mt-3">
          <button onClick={onNext} className="min-h-[56px] px-8 rounded-full font-fredoka text-xl bg-gradient-to-r from-amber-400 to-pink-500 active:scale-95">Next ▶</button>
        </div>
      )}
    </div>
  );
}
