// Imposter networking: the host device owns the game and broadcasts a full public snapshot
// (`imp_state`) after every change; players only send inputs. The snapshot NEVER contains a
// secret word until the round's result.
//
// Private cards: rooms are broadcast-only (every device receives every message), so each
// player's card (`imp_card`, addressed with `to`) is SEALED with a key only that player's
// device and the host share (online/sealed.ts: ECDH + AES-GCM). Every device makes a fresh key
// pair when the game mounts and sends its public key in `imp_hello`; the host answers every
// hello with the snapshot and that player's sealed card, so late joiners and refreshed tabs
// get their card back. Without WebCrypto (plain-http LAN testing) the card goes unsealed but
// still addressed, and other devices ignore it.
//
// Late joiners say hello, get the next snapshot and watch the current round as spectators.
// A refreshed host restores its state from sessionStorage (`imp_host_state`) and carries on;
// a NEW host (the old one left) restarts the current round with fresh cards, keeping scores.
//
// Teacher controls: ARENA_CTL pause / resume / skip (see useHostGame). Board mode
// (`settings.board`): the host's device is the big screen and is never dealt in.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomApi, GameMsg } from '../useRoom';
import { ARENA_CTL } from '../useHostGame';
import { createRng } from '../../games/engine/rng';
import { makeKeyPair, seal, unseal } from '../sealed';
import type { KeyPair, Sealed } from '../sealed';
import {
  pickImposters, imposterCount, dealCards, pickWord, pickPair, turnOrder, guessOptions, validateClue, validateEmojiClue,
  cleanStroke, tallyVotes, canVote, scoreRound, rankPlayers, revealOrder, revealMs,
  TURN_MS, VOTE_MS, GUESS_MS, MIN_PLAYERS, MAX_PLAYERS,
} from './imposterLogic';
import type { Card, ImpMode, ImpCountSetting, StrokePt } from './imposterLogic';
import type { ImposterCategory } from './words';

export { TURN_MS };

export interface ImpSettings {
  category: ImposterCategory;
  rounds: number;
  laps: number;
  mode: ImpMode;
  imposters: ImpCountSetting;
  /** The host's device is a big screen and doesn't play. */
  board: boolean;
}

export interface ImpPlayer { id: string; name: string; emoji: string; score: number; joinedAt: number }

export type ImpPhase = 'setup' | 'roles' | 'clues' | 'vote' | 'reveal' | 'guess' | 'result' | 'final';

export interface ImpClue { id: string; text?: string; stroke?: StrokePt[]; skipped?: boolean }

/** The drumroll: every vote, flipped over one by one, then who was voted out. */
export interface ImpReveal {
  votes: Record<string, string>;
  order: string[];
  counts: Record<string, number>;
  out: string | null;
  /** The voted-out player is an imposter. */
  caught: boolean;
}

export interface ImpResult {
  imposterIds: string[];
  word: string;
  /** Undercover: the imposters' word. */
  impWord: string | null;
  counts: Record<string, number>;
  votes: Record<string, string>;
  out: string | null;
  caught: boolean;
  guess: string | null;
  guessedRight: boolean;
  deltas: Record<string, number>;
}

export interface ImpSnapshot {
  gameNo: number;
  phase: ImpPhase;
  settings: ImpSettings;
  round: number;
  totalRounds: number;
  players: ImpPlayer[];
  /** Playing this round; everyone else spectates until the next round. */
  roundIds: string[];
  /** How many imposters are hiding this round (public). */
  imposters: number;
  readyIds: string[];
  order: string[];
  turn: number;
  clues: ImpClue[];
  votedIds: string[];
  /** Ms left on the current timer when the host sent this (0 = no timer). */
  ms: number;
  /** This device's clock: when the timer ends (filled in on arrival). */
  endsAt: number;
  paused: boolean;
  /** The host's public key, for opening sealed cards. */
  hostPk: string | null;
  /** From the reveal phase on. */
  reveal: ImpReveal | null;
  /** The voted-out imposter (guess phase on). */
  caughtId: string | null;
  /** The imposter's last-chance options (guess phase on). */
  options: string[] | null;
  /** Only at the result — includes the words. */
  result: ImpResult | null;
}

export interface MyRole { round: number; gameNo: number; spectator: boolean; word: string | null; imposter: boolean }

interface HostState {
  code: string;
  gameNo: number;
  settings: ImpSettings | null;
  phase: ImpPhase;
  round: number;
  players: Record<string, ImpPlayer>;
  roundIds: string[];
  ready: string[];
  history: string[][];
  usedWords: string[];
  word: string;
  impWord: string | null;
  imposterIds: string[];
  cards: Record<string, Card>;
  order: string[];
  turn: number;
  clues: ImpClue[];
  votes: Record<string, string>;
  endsAt: number;
  reveal: ImpReveal | null;
  options: string[] | null;
  result: ImpResult | null;
  /** Paused at (ms) and the timer's ms left then. */
  paused: { at: number; left: number } | null;
}

const fresh = (code: string, gameNo = 0): HostState => ({
  code, gameNo, settings: null, phase: 'setup', round: 0, players: {}, roundIds: [], ready: [], history: [], usedWords: [],
  word: '', impWord: null, imposterIds: [], cards: {}, order: [], turn: 0, clues: [], votes: {}, endsAt: 0,
  reveal: null, options: null, result: null, paused: null,
});

const SAVE_KEY = 'imp_host_state';
const SAVE_MAX_AGE = 15 * 60_000;
function loadSaved(code: string): HostState | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null') as { at: number; s: HostState } | null;
    if (!raw || raw.s.code !== code || Date.now() - raw.at > SAVE_MAX_AGE || !raw.s.settings) return null;
    return { ...raw.s, paused: null };
  } catch { return null; }
}
const save = (s: HostState) => { try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), s })); } catch { /* ignore */ } };
const unsave = () => { try { sessionStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } };

export function useImposter(room: RoomApi) {
  const { isHost, myId, send, onMessage, players: roomPlayers } = room;
  const [snap, setSnap] = useState<ImpSnapshot | null>(null);
  const [role, setRole] = useState<MyRole | null>(null);
  const [clueError, setClueError] = useState<string | null>(null);
  const [ctlPaused, setCtlPaused] = useState(false);

  const S = useRef<HostState>(fresh(room.code));
  const rng = useRef(createRng(Date.now() % 1e9));
  const timer = useRef<{ id: number; due: number; fn: () => void } | null>(null);
  const flushTimer = useRef<number | undefined>(undefined);
  const presentRef = useRef<Set<string>>(new Set(roomPlayers.map(p => p.id)));
  presentRef.current = new Set(roomPlayers.map(p => p.id));
  const roomPlayersRef = useRef(roomPlayers);
  roomPlayersRef.current = roomPlayers;
  const keys = useRef<KeyPair | null>(null);
  const keysReady = useRef<Promise<KeyPair | null> | null>(null);
  /** Host: each player's public key ('' = their device can't seal). */
  const pubs = useRef<Record<string, string>>({});
  const snapRef = useRef<ImpSnapshot | null>(null);
  snapRef.current = snap;

  if (!keysReady.current) keysReady.current = makeKeyPair().then(k => { keys.current = k; return k; });

  const buildSnapshot = useCallback((): ImpSnapshot | null => {
    const s = S.current;
    if (!s.settings) return null;
    const later = (...ph: ImpPhase[]) => ph.includes(s.phase);
    const now = s.paused ? s.paused.at : Date.now();
    const msLeft = s.endsAt ? Math.max(0, s.endsAt - now) : 0;
    return {
      gameNo: s.gameNo,
      phase: s.phase,
      settings: s.settings,
      round: s.round,
      totalRounds: s.settings.rounds,
      players: rankPlayers(Object.values(s.players)),
      roundIds: s.roundIds,
      imposters: s.imposterIds.length,
      readyIds: s.ready,
      order: s.order,
      turn: s.turn,
      clues: s.clues,
      votedIds: Object.keys(s.votes),
      ms: msLeft,
      endsAt: 0,
      paused: !!s.paused,
      hostPk: keys.current?.pub ?? null,
      reveal: later('reveal', 'guess', 'result', 'final') ? s.reveal : null,
      caughtId: later('guess', 'result', 'final') && s.reveal?.caught ? s.reveal.out : null,
      options: later('guess', 'result', 'final') ? s.options : null,
      result: later('result', 'final') ? s.result : null,
    };
  }, []);

  const broadcast = useCallback((now = false) => {
    const go = () => {
      flushTimer.current = undefined;
      const snapshot = buildSnapshot();
      if (snapshot) { send({ t: 'imp_state', snap: snapshot }); save(S.current); }
    };
    if (now) { window.clearTimeout(flushTimer.current); flushTimer.current = undefined; go(); return; }
    if (flushTimer.current === undefined) flushTimer.current = window.setTimeout(go, 120);
  }, [buildSnapshot, send]);

  // ---- private cards ----
  const sendCard = useCallback((id: string) => {
    const s = S.current;
    if (!s.settings || s.round === 0 || s.phase === 'final') return;
    const playing = s.roundIds.includes(id);
    const head = { t: 'imp_card', to: id, round: s.round, gameNo: s.gameNo, spectator: !playing };
    if (id === myId) {
      const c = s.cards[id];
      setRole({ round: s.round, gameNo: s.gameNo, spectator: !playing, word: c?.word ?? null, imposter: !!c?.imposter });
      return;
    }
    if (!playing) { send(head); return; }
    const card = s.cards[id];
    if (!card) return;
    const pub = pubs.current[id];
    const mine = keys.current;
    if (pub && mine) {
      const { round, gameNo } = s;
      seal(mine, pub, JSON.stringify(card)).then(box => {
        if (S.current.round === round && S.current.gameNo === gameNo) send({ ...head, hpk: mine.pub, box });
      }).catch(() => { /* they'll ask again */ });
    } else if (pub === '' || !mine) {
      send({ ...head, card }); // this device can't seal: addressed only
    }
    // Otherwise we don't have their key yet; their hello brings it and we answer then.
  }, [myId, send]);

  // ---- host timer (pausable) ----
  const setTimer = (fn: () => void, ms: number) => {
    if (timer.current) window.clearTimeout(timer.current.id);
    const s = S.current;
    if (s.paused) { s.paused.left = ms; timer.current = { id: 0, due: 0, fn }; return; }
    timer.current = { id: window.setTimeout(() => { timer.current = null; fn(); }, ms), due: Date.now() + ms, fn };
  };
  const clearTimer = () => { if (timer.current) window.clearTimeout(timer.current.id); timer.current = null; };

  // ---- host flow (functions reference each other through a ref so timers see the latest) ----
  const flow = useRef<{
    startRound: (r: number) => void; startClues: () => void; nextTurn: () => void; skipTurn: () => void;
    startVote: () => void; endVote: () => void; afterReveal: () => void; finish: (guess: string | null) => void;
    next: () => void; arm: () => void; toFinal: () => void;
  } | null>(null);

  flow.current = {
    toFinal: () => {
      const s = S.current;
      clearTimer();
      s.phase = 'final';
      s.endsAt = 0;
      broadcast(true);
    },
    startRound: (r: number) => {
      const s = S.current;
      if (!s.settings) return;
      const ids = Object.keys(s.players).filter(id => presentRef.current.has(id)).slice(0, MAX_PLAYERS);
      if (ids.length < 2) { flow.current!.toFinal(); return; }
      const st = s.settings;
      s.round = r;
      s.roundIds = ids;
      s.imposterIds = pickImposters(ids, imposterCount(st.imposters, ids.length), s.history, rng.current);
      s.history.push(s.imposterIds);
      if (st.mode === 'undercover') {
        const [crew, imp] = pickPair(s.usedWords, rng.current);
        s.word = crew; s.impWord = imp;
        s.usedWords.push(crew, imp);
      } else {
        s.word = pickWord(st.category, s.usedWords, rng.current);
        s.impWord = null;
        s.usedWords.push(s.word);
      }
      s.cards = dealCards(st.mode, ids, s.imposterIds, s.word, s.impWord);
      s.ready = [];
      s.order = []; s.turn = 0; s.clues = []; s.votes = {};
      s.reveal = null; s.options = null; s.result = null;
      s.phase = 'roles';
      s.endsAt = 0;
      clearTimer();
      broadcast(true);
      for (const id of new Set([...Object.keys(s.players), ...roomPlayersRef.current.map(p => p.id)])) sendCard(id);
    },
    startClues: () => {
      const s = S.current;
      if (s.phase !== 'roles' || !s.settings) return;
      s.phase = 'clues';
      s.order = turnOrder(s.roundIds, s.imposterIds, s.settings.laps, rng.current);
      s.turn = -1;
      flow.current!.nextTurn();
    },
    nextTurn: () => {
      const s = S.current;
      if (s.phase !== 'clues') return;
      let t = s.turn + 1;
      // Skip anyone who has left the room.
      while (t < s.order.length && !presentRef.current.has(s.order[t])) {
        s.clues.push({ id: s.order[t], skipped: true });
        t++;
      }
      s.turn = t;
      if (t >= s.order.length) { flow.current!.startVote(); return; }
      s.endsAt = Date.now() + TURN_MS;
      setTimer(() => flow.current!.skipTurn(), TURN_MS + 300);
      broadcast(true);
    },
    skipTurn: () => {
      const s = S.current;
      if (s.phase !== 'clues' || s.turn >= s.order.length) return;
      s.clues.push({ id: s.order[s.turn], skipped: true });
      flow.current!.nextTurn();
    },
    startVote: () => {
      const s = S.current;
      s.phase = 'vote';
      s.votes = {};
      s.endsAt = Date.now() + VOTE_MS;
      setTimer(() => flow.current!.endVote(), VOTE_MS + 300);
      broadcast(true);
    },
    endVote: () => {
      const s = S.current;
      if (s.phase !== 'vote' || !s.settings) return;
      const tally = tallyVotes(s.votes, s.imposterIds);
      const order = revealOrder(s.votes, s.roundIds);
      s.reveal = { votes: { ...s.votes }, order, counts: tally.counts, out: tally.out, caught: tally.caught };
      s.phase = 'reveal';
      const ms = revealMs(order.length);
      s.endsAt = Date.now() + ms;
      setTimer(() => flow.current!.afterReveal(), ms);
      broadcast(true);
    },
    afterReveal: () => {
      const s = S.current;
      if (s.phase !== 'reveal' || !s.settings || !s.reveal) return;
      if (s.reveal.caught && s.settings.mode !== 'undercover') {
        s.phase = 'guess';
        s.options = guessOptions(s.word, s.settings.category, rng.current);
        s.endsAt = Date.now() + GUESS_MS;
        setTimer(() => flow.current!.finish(null), GUESS_MS + 300);
        broadcast(true);
      } else {
        flow.current!.finish(null);
      }
    },
    finish: (guess: string | null) => {
      const s = S.current;
      if (s.phase !== 'reveal' && s.phase !== 'guess') return;
      clearTimer();
      const tally = tallyVotes(s.votes, s.imposterIds);
      const guessedRight = tally.caught && guess === s.word;
      const deltas = scoreRound({ roundIds: s.roundIds, imposterIds: s.imposterIds, votes: s.votes, out: tally.out, guessedRight });
      for (const [id, d] of Object.entries(deltas)) if (s.players[id]) s.players[id].score += d;
      s.result = {
        imposterIds: [...s.imposterIds], word: s.word, impWord: s.impWord, counts: tally.counts, votes: { ...s.votes },
        out: tally.out, caught: tally.caught, guess, guessedRight, deltas,
      };
      s.phase = 'result';
      s.endsAt = 0;
      broadcast(true);
    },
    next: () => {
      const s = S.current;
      if (s.phase !== 'result' || !s.settings) return;
      if (s.round >= s.settings.rounds) flow.current!.toFinal();
      else flow.current!.startRound(s.round + 1);
    },
    /** After a restore: set the timer the current phase needs. */
    arm: () => {
      const s = S.current;
      const left = Math.max(0, s.endsAt - Date.now());
      const f = flow.current!;
      if (s.phase === 'clues') setTimer(() => f.skipTurn(), left + 300);
      else if (s.phase === 'vote') setTimer(() => f.endVote(), left + 300);
      else if (s.phase === 'reveal') setTimer(() => f.afterReveal(), left);
      else if (s.phase === 'guess') setTimer(() => f.finish(null), left + 300);
    },
  };

  // ---- host actions ----
  const start = useCallback((settings: ImpSettings) => {
    if (!isHost) return;
    const seats = roomPlayers.filter(p => !(settings.board && p.id === myId)).slice(0, MAX_PLAYERS);
    if (seats.length < MIN_PLAYERS) return;
    const s = fresh(room.code, S.current.gameNo + 1);
    s.settings = settings;
    for (const p of seats) s.players[p.id] = { id: p.id, name: p.name, emoji: p.emoji, score: 0, joinedAt: p.joinedAt };
    S.current = s;
    flow.current!.startRound(1);
  }, [isHost, roomPlayers, myId, room.code]);

  const startClues = useCallback(() => { if (isHost && !S.current.paused) flow.current!.startClues(); }, [isHost]);
  const skipTurn = useCallback(() => { if (isHost && !S.current.paused) flow.current!.skipTurn(); }, [isHost]);
  const endVoteNow = useCallback(() => { if (isHost && !S.current.paused) flow.current!.endVote(); }, [isHost]);
  const next = useCallback(() => { if (isHost) flow.current!.next(); }, [isHost]);

  const backToSetup = useCallback(() => {
    if (!isHost) return;
    clearTimer();
    S.current = { ...fresh(room.code, S.current.gameNo), settings: null };
    unsave();
    setSnap(null);
    setRole(null);
    send({ t: 'imp_reset' });
  }, [isHost, send, room.code]);

  // ---- teacher controls ----
  const control = useCallback((op: unknown) => {
    const s = S.current;
    if (!s.settings) return;
    if (op === 'pause' && !s.paused && s.phase !== 'result' && s.phase !== 'final') {
      const t = timer.current;
      s.paused = { at: Date.now(), left: t ? Math.max(0, t.due - Date.now()) : 0 };
      if (t) window.clearTimeout(t.id);
      broadcast(true);
    } else if (op === 'resume' && s.paused) {
      const p = s.paused;
      s.paused = null;
      if (s.endsAt) s.endsAt += Date.now() - p.at;
      const t = timer.current;
      if (t) setTimer(t.fn, p.left);
      broadcast(true);
    } else if (op === 'skip' && !s.paused) {
      const f = flow.current!;
      if (s.phase === 'roles') f.startClues();
      else if (s.phase === 'clues') f.skipTurn();
      else if (s.phase === 'vote') f.endVote();
      else if (s.phase === 'reveal') f.afterReveal();
      else if (s.phase === 'guess') f.finish(null);
      else if (s.phase === 'result') f.next();
    }
  }, [broadcast]);

  // ---- inputs (host handles) ----
  const handleInput = useCallback((m: GameMsg) => {
    const s = S.current;
    const from = m.from as string;
    if (!from) return;
    if (m.t === 'imp_hello') {
      pubs.current[from] = typeof m.pk === 'string' ? m.pk : '';
      if (!s.settings) return;
      broadcast();
      sendCard(from);
      return;
    }
    if (!s.settings || s.paused) return;
    if (m.round !== s.round || !s.roundIds.includes(from)) return;
    const mode = s.settings.mode;

    if (m.t === 'imp_ready' && s.phase === 'roles') {
      if (!s.ready.includes(from)) s.ready.push(from);
      const present = s.roundIds.filter(id => presentRef.current.has(id));
      if (present.every(id => s.ready.includes(id))) flow.current!.startClues();
      else broadcast();
    } else if (m.t === 'imp_clue' && s.phase === 'clues' && s.order[s.turn] === from) {
      const earlier = s.clues.filter(c => !c.skipped && c.text).map(c => c.text!);
      if (mode === 'doodle') {
        const stroke = cleanStroke(m.stroke);
        if (!stroke) { send({ t: 'imp_clue_bad', to: from, reason: 'Draw one line on the picture!' }); return; }
        s.clues.push({ id: from, stroke });
      } else {
        const check = mode === 'emoji'
          ? validateEmojiClue(m.emoji, earlier)
          : validateClue(String(m.text ?? ''), s.cards[from]?.word ?? null, earlier);
        if (!check.ok) { send({ t: 'imp_clue_bad', to: from, reason: check.reason }); return; }
        s.clues.push({ id: from, text: check.clue });
      }
      flow.current!.nextTurn();
    } else if (m.t === 'imp_vote' && s.phase === 'vote' && !s.votes[from]) {
      const target = String(m.target ?? '');
      if (!canVote(from, target, s.roundIds)) return;
      s.votes[from] = target;
      const present = s.roundIds.filter(id => presentRef.current.has(id));
      if (present.every(id => s.votes[id])) flow.current!.endVote();
      else broadcast();
    } else if (m.t === 'imp_guess' && s.phase === 'guess' && s.reveal?.caught && from === s.reveal.out) {
      const g = String(m.word ?? '');
      if (s.options?.includes(g)) flow.current!.finish(g);
    }
  }, [broadcast, send, sendCard]);

  const openCard = useCallback(async (m: GameMsg) => {
    const head = { round: Number(m.round), gameNo: Number(m.gameNo), spectator: !!m.spectator };
    if (m.spectator) { setRole({ ...head, word: null, imposter: false }); return; }
    let card: Card | null = null;
    if (m.box && typeof m.hpk === 'string') {
      const mine = keys.current ?? await keysReady.current;
      const text = mine ? await unseal(mine, m.hpk, m.box as Sealed) : null;
      try { card = text ? JSON.parse(text) as Card : null; } catch { card = null; }
    } else if (m.card && typeof m.card === 'object') {
      card = m.card as Card;
    }
    if (card) setRole({ ...head, word: typeof card.word === 'string' ? card.word : null, imposter: !!card.imposter });
  }, []);

  const hello = useCallback(() => {
    keysReady.current!.then(k => send({ t: 'imp_hello', pk: k?.pub ?? '' }));
  }, [send]);

  useEffect(() => onMessage((m) => {
    if (m.t === 'imp_state') {
      const sn = m.snap as ImpSnapshot;
      setSnap({ ...sn, endsAt: sn.ms ? Date.now() + sn.ms : 0 });
      setCtlPaused(sn.paused);
    } else if (m.t === 'imp_card') {
      if (m.to !== myId) return; // not for me — and sealed, so it couldn't be read anyway
      void openCard(m);
    } else if (m.t === 'imp_clue_bad') {
      if (m.to === myId) setClueError(String(m.reason));
    } else if (m.t === 'imp_reset') {
      setSnap(null);
      setRole(null);
    } else if (m.t === 'to_lobby') {
      unsave();
    } else if (m.t === 'imp_rehello') {
      if (!isHost) hello();
    } else if (m.t === ARENA_CTL) {
      if (m.op === 'pause' || m.op === 'resume') setCtlPaused(m.op === 'pause');
      if (isHost && m.from === myId) control(m.op);
      return;
    }
    if (isHost) handleInput(m);
  }), [onMessage, isHost, myId, handleInput, openCard, hello, control]);

  // Players say hello on mount (with their public key) so they get the snapshot and their card.
  useEffect(() => { if (!isHost) hello(); }, [isHost, hello]);

  // No card yet for a round I'm in (a lost message, a slow key)? Ask again.
  const needCard = !!snap && !isHost && snap.round > 0 && snap.phase !== 'final' && snap.roundIds.includes(myId)
    && !(role && role.round === snap.round && role.gameNo === snap.gameNo);
  useEffect(() => {
    if (!needCard) return;
    const id = window.setInterval(hello, 2500);
    return () => window.clearInterval(id);
  }, [needCard, hello]);

  // Becoming the host mid-game: a refreshed host restores its saved state and carries on; a
  // brand-new host (the old one left) restarts the current round with fresh cards.
  useEffect(() => {
    if (!isHost) return;
    const s = S.current;
    if (s.settings) { if (!timer.current) flow.current!.arm(); return; }
    const saved = loadSaved(room.code);
    if (saved) {
      S.current = saved;
      send({ t: 'imp_rehello' });
      flow.current!.arm();
      broadcast(true);
      sendCard(myId);
      return;
    }
    const last = snapRef.current;
    if (last && last.phase !== 'final' && last.phase !== 'setup') {
      const n = fresh(room.code, last.gameNo);
      n.settings = { ...last.settings, board: false };
      for (const p of last.players) n.players[p.id] = { ...p };
      for (const p of roomPlayersRef.current) if (!n.players[p.id] && Object.keys(n.players).length < MAX_PLAYERS) n.players[p.id] = { id: p.id, name: p.name, emoji: p.emoji, score: 0, joinedAt: p.joinedAt };
      S.current = n;
      send({ t: 'imp_rehello' });
      flow.current!.startRound(Math.max(1, last.round));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  // Late joiners join the scoreboard and spectate this round; leavers are skipped.
  useEffect(() => {
    if (!isHost) return;
    const s = S.current;
    if (!s.settings || s.phase === 'final') return;
    let added = false;
    for (const p of roomPlayers) {
      if (s.settings.board && p.id === myId) continue;
      if (!s.players[p.id] && Object.keys(s.players).length < MAX_PLAYERS) {
        s.players[p.id] = { id: p.id, name: p.name, emoji: p.emoji, score: 0, joinedAt: p.joinedAt };
        sendCard(p.id);
        added = true;
      }
    }
    if (s.paused) { if (added) broadcast(); return; }
    // Someone left: don't wait for them.
    const present = s.roundIds.filter(id => presentRef.current.has(id));
    if (s.phase === 'clues' && s.turn < s.order.length && !presentRef.current.has(s.order[s.turn])) {
      flow.current!.skipTurn();
      return;
    }
    if (s.phase === 'roles' && present.length && present.every(id => s.ready.includes(id))) { flow.current!.startClues(); return; }
    if (s.phase === 'vote' && present.length && present.every(id => s.votes[id])) { flow.current!.endVote(); return; }
    if (added) broadcast();
  }, [isHost, roomPlayers, broadcast, sendCard, myId]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current.id);
    timer.current = null;
    window.clearTimeout(flushTimer.current);
    // The saved state is kept on unmount (a remount or refresh picks it up again); it's
    // cleared when the room goes back to the lobby.
  }, []);

  // ---- player actions ----
  const ready = useCallback(() => { if (snap) send({ t: 'imp_ready', round: snap.round }); }, [snap, send]);
  const giveClue = useCallback((clue: { text?: string; emoji?: string[]; stroke?: StrokePt[] }) => {
    if (!snap) return;
    setClueError(null);
    send({ t: 'imp_clue', round: snap.round, ...clue });
  }, [snap, send]);
  const vote = useCallback((target: string) => { if (snap) send({ t: 'imp_vote', round: snap.round, target }); }, [snap, send]);
  const guess = useCallback((word: string) => { if (snap) send({ t: 'imp_guess', round: snap.round, word }); }, [snap, send]);

  // A role from an old round is no use.
  const myRole = role && snap && role.round === snap.round && role.gameNo === snap.gameNo ? role : null;
  /** This device is the big screen (host in board mode): it never plays. */
  const isBoard = isHost && !!snap?.settings.board;

  return {
    snap, role: myRole, clueError, setClueError, paused: ctlPaused || !!snap?.paused, isBoard,
    start, startClues, skipTurn, endVoteNow, next, backToSetup,
    ready, giveClue, vote, guess,
  };
}
