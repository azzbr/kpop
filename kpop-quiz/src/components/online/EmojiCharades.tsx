import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame, useCountdown } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, rankByScore, msLeft } from '../../online/helloGate';
import { CHARADE_CATS, EMOJI_GROUPS } from '../../online/charadePhrases';
import type { CharadePhrase } from '../../online/charadePhrases';
import { playClick, playPop, playCorrect, playWrong } from '../../utils/sounds';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { FinalCard } from './RaceParts';
import { Scores, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import { PartyFrame, TimerBar, PausedNote, NextButton } from './partyParts';
import { useAddressed, useAskUntil, useBoard } from './partyHooks';
import {
  TURN_MS, HINT_WORDS_MS, HINT_LETTER_MS, REVEAL_MS, MAX_EMOJI, MAX_GUESS, TELLER_POINTS,
  cleanEmojiList, judgeGuess, guessPoints, hintFor, turnCount, tellerOrder, pickPhrases, tidyGuess, guessOk,
} from './emojiCharadesLogic';
import type { GuessResult, Hint } from './emojiCharadesLogic';

// Emoji Charades: the teller "says" a secret phrase with emoji only; everyone else types guesses.
// The phrase stays on the host (only the teller's device gets it, as an addressed `ec_card`)
// until the reveal. Guesses are never shown to others: the feed only says who guessed and who
// got it, and each guesser hears back privately ("So close!") through `ec_note`.

interface FeedItem { id: string; ok: boolean; k: number }
interface State {
  ids: string[];
  order: string[];
  phrases: CharadePhrase[];
  turn: number;
  phase: 'tell' | 'reveal' | 'final';
  endsAt: number;
  hint: number;
  emojis: string[];
  correct: string[];
  gained: Record<string, number>;
  feed: FeedItem[];
  k: number;
  tellerLeft: boolean;
  scores: Record<string, number>;
  ranked: (string | string[])[];
}
interface View {
  turn: number; of: number; phase: State['phase']; ms: number; ids: string[]; teller: string;
  emojis: string[]; hint: Hint; correct: string[]; feed: FeedItem[]; gained: Record<string, number>;
  phrase?: string; tellerLeft?: boolean;
  scores: Record<string, number>; ranked?: (string | string[])[];
}

type Present = () => string[];
interface Ctx { t: HostTools<State>; present: Present }

const guessers = (s: State, present: string[]) => s.ids.filter(id => id !== s.order[s.turn] && present.includes(id));

function startTurn(c: Ctx, s: State): State {
  const turn = s.turn + 1;
  c.t.after('hint1', HINT_WORDS_MS, () => { const x = c.t.get(); if (x.phase === 'tell' && x.turn === turn) c.t.set({ ...x, hint: Math.max(x.hint, 1) }); });
  c.t.after('hint2', HINT_LETTER_MS, () => { const x = c.t.get(); if (x.phase === 'tell' && x.turn === turn) c.t.set({ ...x, hint: 2 }); });
  c.t.after('phase', TURN_MS + 400, () => c.t.set(reveal(c, c.t.get())));
  return { ...s, turn, phase: 'tell', endsAt: Date.now() + TURN_MS, hint: 0, emojis: [], correct: [], gained: {}, feed: [], tellerLeft: false };
}

function reveal(c: Ctx, s: State, tellerLeft = false): State {
  if (s.phase !== 'tell') return s;
  c.t.cancel('hint1');
  c.t.cancel('hint2');
  c.t.after('phase', REVEAL_MS, () => c.t.set(afterReveal(c, c.t.get())));
  return { ...s, phase: 'reveal', endsAt: Date.now() + REVEAL_MS, tellerLeft };
}

function afterReveal(c: Ctx, s: State): State {
  if (s.phase !== 'reveal') return s;
  // Skip tellers who have left.
  let n = s;
  while (n.turn + 1 < n.order.length && !c.present().includes(n.order[n.turn + 1])) n = { ...n, turn: n.turn + 1 };
  if (n.turn + 1 >= n.order.length) { c.t.cancel('phase'); return { ...n, phase: 'final', ranked: rankByScore(n.scores, n.ids) }; }
  return startTurn(c, n);
}

const pushFeed = (feed: FeedItem[], item: FeedItem) => [...feed, item].slice(-8);

export default function EmojiCharades({ room, config }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const { boardMode, isBoard } = useBoard(room, config);
  const presentRef = useRef<string[]>([]);
  presentRef.current = room.players.map(p => p.id);
  const present = useRef<Present>(() => presentRef.current).current;
  const hostId = useRef(room.myId);
  const [card, setCard] = useState<{ turn: number; text: string; cat: string } | null>(null);
  const [note, setNote] = useState<{ turn: number; n: number; r: GuessResult; pts?: number } | null>(null);

  const { view, input, tools, paused } = useHostGame<State, View>(room, 'ec', {
    board: boardMode,
    start: (ids, t) => {
      const order = tellerOrder(ids, turnCount(ids.length, config?.rounds));
      return startTurn({ t, present }, {
        ids, order, phrases: pickPhrases(order.length, config?.difficulty), turn: -1, phase: 'tell', endsAt: 0, hint: 0, emojis: [], correct: [],
        gained: {}, feed: [], k: 0, tellerLeft: false, scores: Object.fromEntries(ids.map(id => [id, 0])), ranked: [],
      });
    },
    onInput: (s, from, m, t) => {
      const c = { t, present };
      const teller = s.order[s.turn];
      if (m.kind === 'next') return from === hostId.current && s.phase === 'reveal' ? afterReveal(c, s) : undefined;
      if (m.kind === 'card') {
        if (from === teller && s.phase === 'tell') {
          const p = s.phrases[s.turn];
          room.send({ t: 'ec_card', to: from, turn: s.turn, text: p.text, cat: CHARADE_CATS[p.cat].name });
        }
        return undefined;
      }
      if (s.phase !== 'tell' || m.turn !== s.turn || !s.ids.includes(from)) return undefined;
      if (m.kind === 'emojis' && from === teller) {
        const list = cleanEmojiList(m.list);
        return list ? { ...s, emojis: list } : undefined;
      }
      if (m.kind === 'guess' && from !== teller && !s.correct.includes(from) && typeof m.text === 'string') {
        const text = tidyGuess(m.text);
        const r = judgeGuess(text, s.phrases[s.turn]);
        const k = s.k + 1;
        if (r !== 'right') {
          room.send({ t: 'ec_note', to: from, turn: s.turn, n: Number(m.n) || 0, r });
          return { ...s, k, feed: pushFeed(s.feed, { id: from, ok: false, k }) };
        }
        const pts = guessPoints(msLeft(s.endsAt));
        room.send({ t: 'ec_note', to: from, turn: s.turn, n: Number(m.n) || 0, r, pts });
        const scores = { ...s.scores, [from]: (s.scores[from] ?? 0) + pts, [teller]: (s.scores[teller] ?? 0) + TELLER_POINTS };
        const gained = { ...s.gained, [from]: pts, [teller]: (s.gained[teller] ?? 0) + TELLER_POINTS };
        const n: State = { ...s, k, scores, gained, correct: [...s.correct, from], feed: pushFeed(s.feed, { id: from, ok: true, k }) };
        return guessers(n, presentRef.current).every(id => n.correct.includes(id)) ? reveal(c, n) : n;
      }
      return undefined;
    },
    onSkip: (s, t) => {
      const c = { t, present };
      if (s.phase === 'tell') return reveal(c, s);
      if (s.phase === 'reveal') return afterReveal(c, s);
      return undefined;
    },
    view: s => {
      const p = s.phrases[Math.max(0, s.turn)];
      const v: View = {
        turn: s.turn, of: s.order.length, phase: s.phase, ms: msLeft(s.endsAt), ids: s.ids, teller: s.order[s.turn] ?? '',
        emojis: s.emojis, hint: hintFor(p, s.phase === 'tell' ? s.hint : 2), correct: s.correct, feed: s.feed, gained: s.gained, scores: s.scores,
      };
      if (s.phase !== 'tell') { v.phrase = p.text; v.tellerLeft = s.tellerLeft; }
      if (s.phase === 'final') v.ranked = s.ranked;
      return v;
    },
  });

  // The teller leaving ends the turn; everyone else leaving can mean everyone left got it.
  const idsKey = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (!room.isHost) return;
    const s = tools.get();
    if (!s || s.phase !== 'tell') return;
    const c = { t: tools, present };
    if (!presentRef.current.includes(s.order[s.turn])) tools.set(reveal(c, s, true));
    else if (guessers(s, presentRef.current).every(id => s.correct.includes(id))) tools.set(reveal(c, s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, room.isHost]);

  useAddressed(room, 'ec_card', m => setCard({ turn: Number(m.turn), text: String(m.text), cat: String(m.cat) }));
  useAddressed(room, 'ec_note', m => {
    const r = m.r as GuessResult;
    setNote({ turn: Number(m.turn), n: Number(m.n), r, pts: typeof m.pts === 'number' ? m.pts : undefined });
    if (r === 'right') playCorrect(); else if (r === 'close' || r === 'part') playPop(); else playWrong();
  });

  const iTell = !!view && view.phase === 'tell' && view.teller === room.myId;
  useAskUntil(iTell && card?.turn !== view?.turn, () => input({ kind: 'card' }), view?.turn);

  const seconds = useCountdown(view && view.phase !== 'final' ? view.ms : undefined, `${view?.turn}-${view?.phase}`);
  useEffect(() => { if (view?.phase === 'reveal') playPop(); }, [view?.phase, view?.turn]);
  useEffect(() => {
    if (view?.phase === 'final' && view.ranked) { playCorrect(); if (!isBoard) finish(view.ranked); }
  }, [view?.phase, view?.ranked, finish, isBoard]);

  if (!view) return <PartyFrame board={isBoard} title="Emoji Charades" icon="😀"><Waiting /></PartyFrame>;

  const teller = who(room.players, view.teller);
  const playing = view.ids.includes(room.myId);
  const myNote = note && note.turn === view.turn ? note : null;
  const iGotIt = view.correct.includes(room.myId);

  return (
    <PartyFrame board={isBoard} title="Emoji Charades" icon="😀" subtitle="Say it with emoji only — guess what it is!"
      right={<div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right">
        <div>Turn {Math.min(view.turn + 1, view.of)}/{view.of}</div>
        {view.phase === 'tell' && <div className={seconds <= 10 ? 'text-amber-300' : 'text-violet-200'}>⏱️ {seconds}s</div>}
      </div>}>
      <PausedNote paused={paused} />
      {view.phase === 'tell' && <TimerBar seconds={seconds} total={TURN_MS / 1000} />}

      {view.phase === 'tell' && (
        <div className={`text-center font-fredoka mb-2 ${isBoard ? 'text-4xl' : 'text-2xl'}`}>
          {iTell ? '🎬 You are the teller!' : `${teller.emoji} ${teller.name} is telling…`}
        </div>
      )}

      {view.phase === 'tell' && iTell && card?.turn === view.turn && (
        <TellerPanel key={view.turn} view={view} card={card} input={input} seconds={seconds} />
      )}
      {view.phase === 'tell' && iTell && card?.turn !== view.turn && <Waiting text="Getting your secret phrase…" />}

      {view.phase === 'tell' && !iTell && (
        <>
          <EmojiLine emojis={view.emojis} big={isBoard} />
          <HintRow hint={view.hint} big={isBoard} />
          {playing && !isBoard && (iGotIt
            ? <div className="rounded-3xl bg-green-500/25 ring-4 ring-green-300 p-4 text-center font-fredoka text-2xl mb-3">✅ You got it!{myNote?.pts ? ` +${myNote.pts}` : ''} Shh — don’t tell! 🤫</div>
            : <GuessBox key={view.turn} view={view} input={input} note={myNote} />)}
        </>
      )}

      {view.phase === 'tell' && <Feed room={room} feed={view.feed} correct={view.correct} big={isBoard} />}

      {view.phase !== 'tell' && view.phrase && (
        <RevealCard room={room} view={view} big={isBoard} onNext={room.isHost && view.phase === 'reveal' ? () => { playClick(); input({ kind: 'next' }); } : undefined} />
      )}

      <div className={isBoard ? 'text-2xl' : ''}>
        <Scores room={room} scores={view.scores} ids={view.ids}
          note={id => (id === view.teller && view.phase !== 'final' ? <span title="Teller">🎬</span> : view.correct.includes(id) && view.phase === 'tell' ? <span>✅</span> : null)} />
      </div>

      {view.phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores} reward={reward} />
      )}
    </PartyFrame>
  );
}

function EmojiLine({ emojis, big }: { emojis: string[]; big: boolean }) {
  return (
    <div className={`rounded-3xl bg-black/30 p-4 mb-3 flex flex-wrap justify-center items-center gap-2 ${big ? 'min-h-[180px]' : 'min-h-[110px]'}`} aria-label="Emoji clue" data-testid="ec-line">
      <AnimatePresence initial={false}>
        {emojis.length === 0
          ? <motion.span key="empty" className={`font-nunito text-violet-200 ${big ? 'text-3xl' : 'text-lg'}`}>Waiting for the first emoji… 🤔</motion.span>
          : emojis.map((e, i) => (
            <motion.span key={`${i}-${e}`} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
              className={big ? 'text-8xl' : 'text-5xl md:text-6xl'}>{e}</motion.span>
          ))}
      </AnimatePresence>
    </div>
  );
}

function HintRow({ hint, big }: { hint: Hint; big: boolean }) {
  const cls = `rounded-full bg-white/15 px-4 py-1 font-fredoka ${big ? 'text-3xl' : 'text-lg'}`;
  return (
    <div className="flex flex-wrap justify-center gap-2 mb-3" aria-label="Hints">
      <span className={cls}>{hint.catEmoji} {hint.cat}</span>
      <span className={cls}>{hint.words ? `🔢 ${hint.words} word${hint.words === 1 ? '' : 's'}` : '🔒 word count at 20s'}</span>
      <span className={cls}>{hint.first ? `🔤 starts with ${hint.first}` : '🔒 first letter at 40s'}</span>
    </div>
  );
}

function GuessBox({ view, input, note }: { view: View; input: (d: Record<string, unknown>) => void; note: { n: number; r: GuessResult } | null }) {
  const [draft, setDraft] = useState('');
  const [last, setLast] = useState('');
  const [n, setN] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const waiting = n > 0 && (!note || note.n !== n);
  const onKey = useCallback((k: string) => {
    setMsg(null);
    setDraft(d => (d.length >= MAX_GUESS || (k === ' ' && (d === '' || d.endsWith(' '))) ? d : d + k.toLowerCase()));
  }, []);
  const onBackspace = useCallback(() => { setMsg(null); setDraft(d => d.slice(0, -1)); }, []);
  const onEnter = useCallback(() => {
    const text = tidyGuess(draft);
    if (!text) { setMsg('Type a guess first ✍️'); return; }
    if (!guessOk(text)) { setMsg('Let’s keep it kind — try another guess 🙂'); playWrong(); return; }
    playClick();
    const next = n + 1;
    setN(next);
    setLast(text);
    input({ kind: 'guess', turn: view.turn, text, n: next });
    setDraft('');
  }, [draft, n, input, view.turn]);

  const fb = note && note.n === n ? note : null;
  const fbText = fb?.r === 'close' ? `🔥 So close! “${last}” is nearly it — check the spelling!`
    : fb?.r === 'part' ? `✨ You’ve got part of it with “${last}” — keep going!`
      : fb?.r === 'wrong' ? `🤔 Not “${last}” — try again!` : null;
  return (
    <div className="rounded-3xl bg-white/10 p-4 mb-3">
      <div className="min-h-[56px] rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-3xl text-center mb-2" data-testid="ec-draft">
        {draft || <span className="text-white/30">Your guess…</span>}
      </div>
      {(msg || fbText) && <p className="font-nunito text-lg text-amber-200 text-center mb-2" role="status">{msg ?? fbText}</p>}
      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space disabled={waiting} enterLabel="Guess!" />
    </div>
  );
}

function TellerPanel({ view, card, input, seconds }: { view: View; card: { text: string; cat: string }; input: (d: Record<string, unknown>) => void; seconds: number }) {
  const [list, setList] = useState<string[]>(view.emojis);
  const [sel, setSel] = useState<number | null>(null);
  const [group, setGroup] = useState(0);
  const send = (next: string[]) => { setList(next); input({ kind: 'emojis', turn: view.turn, list: next }); };
  const add = (e: string) => { if (list.length >= MAX_EMOJI) { playWrong(); return; } playClick(); send([...list, e]); setSel(null); };
  const move = (d: -1 | 1) => {
    if (sel === null) return;
    const j = sel + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[sel], next[j]] = [next[j], next[sel]];
    playClick();
    send(next);
    setSel(j);
  };
  const remove = () => { if (sel === null) return; playClick(); send(list.filter((_, i) => i !== sel)); setSel(null); };
  const ctl = 'min-h-[48px] min-w-[48px] px-4 rounded-2xl font-fredoka text-lg bg-white/15 disabled:opacity-30 active:scale-95';
  return (
    <div className="mb-3">
      <div className="rounded-3xl bg-amber-400/15 ring-4 ring-amber-300 p-4 mb-3 text-center">
        <div className="font-nunito text-lg text-amber-100">🤫 Your secret phrase ({card.cat}):</div>
        <div className="font-fredoka text-4xl uppercase tracking-wide" data-testid="ec-secret">{card.text}</div>
        <div className="font-nunito text-base text-violet-100 mt-1">Use emoji only — {view.correct.length} friend{view.correct.length === 1 ? '' : 's'} got it · ⏱️ {seconds}s</div>
      </div>
      <div className="rounded-3xl bg-black/30 p-3 mb-2 flex flex-wrap justify-center gap-2 min-h-[96px] items-center" aria-label="Your emoji clue" data-testid="ec-mine">
        {list.length === 0 && <span className="font-nunito text-lg text-violet-200">Tap emoji below to build your clue (up to {MAX_EMOJI})</span>}
        {list.map((e, i) => (
          <button key={`${i}-${e}`} type="button" onClick={() => { playClick(); setSel(sel === i ? null : i); }} aria-label={`Emoji ${i + 1}`}
            className={`text-5xl min-w-[64px] min-h-[64px] rounded-2xl ${sel === i ? 'bg-amber-400/40 ring-4 ring-amber-300' : 'bg-white/10'}`}>{e}</button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2 mb-3">
        <button type="button" className={ctl} disabled={sel === null || sel === 0} onClick={() => move(-1)} aria-label="Move left">◀ Move</button>
        <button type="button" className={ctl} disabled={sel === null || sel === list.length - 1} onClick={() => move(1)} aria-label="Move right">Move ▶</button>
        <button type="button" className={ctl} disabled={sel === null} onClick={remove}>🗑️ Remove</button>
        <button type="button" className={ctl} disabled={list.length === 0} onClick={() => { playClick(); send([]); setSel(null); }}>🧹 Clear</button>
        <span className="self-center font-nunito text-lg text-violet-200">{list.length}/{MAX_EMOJI}</span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 mb-2" role="tablist" aria-label="Emoji groups">
        {EMOJI_GROUPS.map((g, i) => (
          <button key={g.name} type="button" role="tab" aria-selected={group === i} aria-label={g.name} onClick={() => setGroup(i)}
            className={`shrink-0 min-w-[56px] min-h-[52px] rounded-2xl text-3xl ${group === i ? 'bg-white/30 ring-2 ring-white' : 'bg-white/10'}`}>{g.icon}</button>
        ))}
      </div>
      <div className="font-fredoka text-lg mb-1">{EMOJI_GROUPS[group].name}</div>
      <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-10 gap-1 max-h-[280px] overflow-y-auto rounded-2xl bg-black/20 p-2" data-testid="ec-picker">
        {EMOJI_GROUPS[group].emoji.map(e => (
          <button key={e} type="button" onClick={() => add(e)} className="min-h-[52px] rounded-xl text-3xl bg-white/5 active:scale-90 active:bg-white/20">{e}</button>
        ))}
      </div>
    </div>
  );
}

function Feed({ room, feed, correct, big }: { room: RoomApi; feed: FeedItem[]; correct: string[]; big: boolean }) {
  if (!feed.length) return null;
  return (
    <div className={`rounded-2xl bg-black/20 p-3 mb-3 flex flex-wrap gap-2 justify-center ${big ? 'text-2xl' : 'text-lg'}`} aria-label="Guesses">
      {feed.slice(-6).map(f => {
        const w = who(room.players, f.id);
        return (
          <motion.span key={f.k} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className={`rounded-full px-3 py-1 font-nunito ${f.ok ? 'bg-green-500/40' : 'bg-white/10'}`}>
            {w.emoji} {w.name} {f.ok ? `got it! (#${correct.indexOf(f.id) + 1})` : 'guessed 💭'}
          </motion.span>
        );
      })}
    </div>
  );
}

function RevealCard({ room, view, big, onNext }: { room: RoomApi; view: View; big: boolean; onNext?: () => void }) {
  const t = who(room.players, view.teller);
  return (
    <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl bg-white/10 p-5 mb-4 text-center" aria-label="Reveal">
      <div className={big ? 'text-7xl mb-2' : 'text-5xl mb-2'}>{view.emojis.join(' ') || '🤷'}</div>
      <div className={`font-nunito text-violet-200 ${big ? 'text-3xl' : 'text-lg'}`}>{t.emoji} {t.name}’s phrase was</div>
      <div className={`font-fredoka uppercase text-amber-300 ${big ? 'text-7xl' : 'text-4xl'}`} data-testid="ec-answer">{view.phrase}</div>
      <p className={`font-nunito mt-2 ${big ? 'text-3xl' : 'text-lg'}`}>
        {view.tellerLeft ? `👋 ${t.name} had to go — on to the next one!`
          : view.correct.length === 0 ? 'Nobody got it this time — tricky one! 😅'
            : `🎉 ${view.correct.map(id => who(room.players, id).name).join(', ')} got it!`}
      </p>
      {view.gained[view.teller] ? <p className={`font-fredoka text-green-300 ${big ? 'text-3xl' : 'text-xl'}`}>🎬 {t.name} +{view.gained[view.teller]}</p> : null}
      {onNext && <NextButton onClick={onNext} />}
    </motion.div>
  );
}
