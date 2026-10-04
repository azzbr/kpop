// Imposter networking: the host device owns the game and broadcasts a full public snapshot
// (`imp_state`) after every change; players only send inputs. The snapshot NEVER contains the
// secret word until the round's result. Each player's private role goes in its own message
// (`imp_role`, addressed with `to`) — every device ignores roles addressed to someone else.
// Late joiners say hello, get the next snapshot and watch the current round as spectators.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomApi, GameMsg } from '../useRoom';
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';
import {
  pickImposter, assignRoles, pickWord, turnOrder, guessOptions, validateClue, tallyVotes, canVote,
  scoreRound, rankPlayers, VOTE_MS, GUESS_MS, MIN_PLAYERS, MAX_PLAYERS,
} from './imposterLogic';
import type { ImposterCategory } from './words';

export const TURN_MS = 45_000;

export interface ImpSettings { category: ImposterCategory; rounds: number; laps: number }

export interface ImpPlayer { id: string; name: string; emoji: string; score: number; joinedAt: number }

export type ImpPhase = 'setup' | 'roles' | 'clues' | 'vote' | 'guess' | 'result' | 'final';

export interface ImpClue { id: string; text: string; skipped?: boolean }

export interface ImpResult {
  imposterId: string;
  word: string;
  counts: Record<string, number>;
  votes: Record<string, string>;
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
  readyIds: string[];
  order: string[];
  turn: number;
  clues: ImpClue[];
  votedIds: string[];
  /** Host clock; players only use it to draw their countdown. */
  endsAt: number;
  /** Public once the vote catches the imposter (guess phase) and at the result. */
  imposterId: string | null;
  counts: Record<string, number> | null;
  /** The imposter's last-chance options (guess phase onward). */
  options: string[] | null;
  /** Only at the result — includes the word. */
  result: ImpResult | null;
}

export interface MyRole { round: number; gameNo: number; spectator: boolean; word: string | null }

interface HostState {
  gameNo: number;
  settings: ImpSettings | null;
  phase: ImpPhase;
  round: number;
  players: Record<string, ImpPlayer>;
  roundIds: string[];
  ready: Set<string>;
  history: string[];
  usedWords: string[];
  word: string;
  imposterId: string;
  order: string[];
  turn: number;
  clues: ImpClue[];
  votes: Record<string, string>;
  endsAt: number;
  counts: Record<string, number> | null;
  options: string[] | null;
  result: ImpResult | null;
  rng: Rng;
}

const fresh = (gameNo = 0): HostState => ({
  gameNo, settings: null, phase: 'setup', round: 0, players: {}, roundIds: [], ready: new Set(), history: [],
  usedWords: [], word: '', imposterId: '', order: [], turn: 0, clues: [], votes: {}, endsAt: 0,
  counts: null, options: null, result: null, rng: createRng(Date.now() % 1e9),
});

export function useImposter(room: RoomApi) {
  const { isHost, myId, send, onMessage, players: roomPlayers } = room;
  const [snap, setSnap] = useState<ImpSnapshot | null>(null);
  const [role, setRole] = useState<MyRole | null>(null);
  const [clueError, setClueError] = useState<string | null>(null);

  const S = useRef<HostState>(fresh());
  const timer = useRef<number | undefined>(undefined);
  const flushTimer = useRef<number | undefined>(undefined);
  const presentRef = useRef<Set<string>>(new Set(roomPlayers.map(p => p.id)));
  presentRef.current = new Set(roomPlayers.map(p => p.id));

  const buildSnapshot = useCallback((): ImpSnapshot | null => {
    const s = S.current;
    if (!s.settings) return null;
    const showImp = s.phase === 'guess' || s.phase === 'result' || s.phase === 'final';
    return {
      gameNo: s.gameNo,
      phase: s.phase,
      settings: s.settings,
      round: s.round,
      totalRounds: s.settings.rounds,
      players: rankPlayers(Object.values(s.players)),
      roundIds: s.roundIds,
      readyIds: [...s.ready],
      order: s.order,
      turn: s.turn,
      clues: s.clues,
      votedIds: Object.keys(s.votes),
      endsAt: s.endsAt,
      imposterId: showImp ? s.imposterId : null,
      counts: showImp ? s.counts : null,
      options: showImp ? s.options : null,
      result: s.phase === 'result' || s.phase === 'final' ? s.result : null,
    };
  }, []);

  const broadcast = useCallback((now = false) => {
    const go = () => {
      flushTimer.current = undefined;
      const snapshot = buildSnapshot();
      if (snapshot) send({ t: 'imp_state', snap: snapshot });
    };
    if (now) { window.clearTimeout(flushTimer.current); flushTimer.current = undefined; go(); return; }
    if (flushTimer.current === undefined) flushTimer.current = window.setTimeout(go, 120);
  }, [buildSnapshot, send]);

  const sendRole = useCallback((id: string) => {
    const s = S.current;
    if (!s.settings || s.round === 0) return;
    const playing = s.roundIds.includes(id);
    send({
      t: 'imp_role', to: id, round: s.round, gameNo: s.gameNo,
      spectator: !playing, word: playing && id !== s.imposterId ? s.word : null,
    });
  }, [send]);

  const setTimer = (fn: () => void, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  };

  // ---- host flow (functions reference each other through a ref so timers see the latest) ----
  const flow = useRef<{
    startRound: (r: number) => void; startClues: () => void; nextTurn: () => void;
    startVote: () => void; endVote: () => void; finishRound: (guess: string | null) => void;
  } | null>(null);

  flow.current = {
    startRound: (r: number) => {
      const s = S.current;
      if (!s.settings) return;
      const ids = Object.keys(s.players).filter(id => presentRef.current.has(id)).slice(0, MAX_PLAYERS);
      if (ids.length < 2) {
        s.phase = 'final';
        broadcast(true);
        room.reportResult(rankPlayers(Object.values(s.players)).map(p => p.id));
        return;
      }
      s.round = r;
      s.roundIds = ids;
      s.imposterId = pickImposter(ids, s.history, s.rng);
      s.history.push(s.imposterId);
      s.word = pickWord(s.settings.category, s.usedWords, s.rng);
      s.usedWords.push(s.word);
      s.ready = new Set();
      s.order = []; s.turn = 0; s.clues = []; s.votes = {};
      s.counts = null; s.options = null; s.result = null;
      s.phase = 'roles';
      s.endsAt = 0;
      window.clearTimeout(timer.current);
      const roles = assignRoles(ids, s.imposterId, s.word);
      broadcast(true);
      for (const id of Object.keys(s.players)) {
        if (id in roles) send({ t: 'imp_role', to: id, round: r, gameNo: s.gameNo, spectator: false, word: roles[id] });
        else sendRole(id);
      }
    },
    startClues: () => {
      const s = S.current;
      if (s.phase !== 'roles' || !s.settings) return;
      s.phase = 'clues';
      s.order = turnOrder(s.roundIds, s.imposterId, s.settings.laps, s.rng);
      s.turn = -1;
      flow.current!.nextTurn();
    },
    nextTurn: () => {
      const s = S.current;
      if (s.phase !== 'clues') return;
      let t = s.turn + 1;
      // Skip anyone who has left the room.
      while (t < s.order.length && !presentRef.current.has(s.order[t])) {
        s.clues.push({ id: s.order[t], text: '—', skipped: true });
        t++;
      }
      s.turn = t;
      if (t >= s.order.length) { flow.current!.startVote(); return; }
      s.endsAt = Date.now() + TURN_MS;
      setTimer(() => {
        if (S.current.phase !== 'clues' || S.current.turn !== t) return;
        S.current.clues.push({ id: s.order[t], text: '…', skipped: true });
        flow.current!.nextTurn();
      }, TURN_MS + 300);
      broadcast(true);
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
      const tally = tallyVotes(s.votes, s.imposterId);
      s.counts = tally.counts;
      if (tally.caught) {
        s.phase = 'guess';
        s.options = guessOptions(s.word, s.settings.category, s.rng);
        s.endsAt = Date.now() + GUESS_MS;
        setTimer(() => flow.current!.finishRound(null), GUESS_MS + 300);
        broadcast(true);
      } else {
        flow.current!.finishRound(null);
      }
    },
    finishRound: (guess: string | null) => {
      const s = S.current;
      if (s.phase !== 'vote' && s.phase !== 'guess') return;
      window.clearTimeout(timer.current);
      const tally = tallyVotes(s.votes, s.imposterId);
      const guessedRight = tally.caught && guess === s.word;
      const deltas = scoreRound({ roundIds: s.roundIds, imposterId: s.imposterId, votes: s.votes, caught: tally.caught, guessedRight });
      for (const [id, d] of Object.entries(deltas)) if (s.players[id]) s.players[id].score += d;
      s.result = { imposterId: s.imposterId, word: s.word, counts: tally.counts, votes: { ...s.votes }, caught: tally.caught, guess, guessedRight, deltas };
      s.counts = tally.counts;
      s.phase = 'result';
      s.endsAt = 0;
      broadcast(true);
    },
  };

  // ---- host actions ----
  const start = useCallback((settings: ImpSettings) => {
    if (!isHost || roomPlayers.length < MIN_PLAYERS) return;
    const s = fresh(S.current.gameNo + 1);
    s.settings = settings;
    for (const p of roomPlayers.slice(0, MAX_PLAYERS)) s.players[p.id] = { id: p.id, name: p.name, emoji: p.emoji, score: 0, joinedAt: p.joinedAt };
    S.current = s;
    flow.current!.startRound(1);
  }, [isHost, roomPlayers]);

  const startClues = useCallback(() => { if (isHost) flow.current!.startClues(); }, [isHost]);
  const skipTurn = useCallback(() => {
    const s = S.current;
    if (!isHost || s.phase !== 'clues') return;
    s.clues.push({ id: s.order[s.turn], text: '…', skipped: true });
    flow.current!.nextTurn();
  }, [isHost]);
  const endVoteNow = useCallback(() => { if (isHost) flow.current!.endVote(); }, [isHost]);

  const next = useCallback(() => {
    const s = S.current;
    if (!isHost || s.phase !== 'result' || !s.settings) return;
    if (s.round >= s.settings.rounds) {
      s.phase = 'final';
      broadcast(true);
      room.reportResult(rankPlayers(Object.values(s.players)).map(p => p.id));
      return;
    }
    flow.current!.startRound(s.round + 1);
  }, [isHost, broadcast, room]);

  const backToSetup = useCallback(() => {
    if (!isHost) return;
    window.clearTimeout(timer.current);
    S.current = { ...fresh(S.current.gameNo), settings: null };
    setSnap(null);
    setRole(null);
    send({ t: 'imp_reset' });
  }, [isHost, send]);

  // ---- inputs (host handles) ----
  const handleInput = useCallback((m: GameMsg) => {
    const s = S.current;
    const from = m.from as string;
    if (!s.settings || !from) return;
    if (m.t === 'imp_hello') { broadcast(); sendRole(from); return; }
    if (m.round !== s.round || !s.roundIds.includes(from)) return;

    if (m.t === 'imp_ready' && s.phase === 'roles') {
      s.ready.add(from);
      const present = s.roundIds.filter(id => presentRef.current.has(id));
      if (present.every(id => s.ready.has(id))) flow.current!.startClues();
      else broadcast();
    } else if (m.t === 'imp_clue' && s.phase === 'clues' && s.order[s.turn] === from) {
      const check = validateClue(String(m.text ?? ''), from === s.imposterId ? null : s.word, s.clues.filter(c => !c.skipped).map(c => c.text));
      if (!check.ok) { send({ t: 'imp_clue_bad', to: from, reason: check.reason }); return; }
      s.clues.push({ id: from, text: check.clue });
      flow.current!.nextTurn();
    } else if (m.t === 'imp_vote' && s.phase === 'vote' && !s.votes[from]) {
      const target = String(m.target ?? '');
      if (!canVote(from, target, s.roundIds)) return;
      s.votes[from] = target;
      const present = s.roundIds.filter(id => presentRef.current.has(id));
      if (present.every(id => s.votes[id])) flow.current!.endVote();
      else broadcast();
    } else if (m.t === 'imp_guess' && s.phase === 'guess' && from === s.imposterId) {
      const g = String(m.word ?? '');
      if (s.options?.includes(g)) flow.current!.finishRound(g);
    }
  }, [broadcast, send, sendRole]);

  useEffect(() => onMessage((m) => {
    if (m.t === 'imp_state') {
      setSnap(m.snap as ImpSnapshot);
    } else if (m.t === 'imp_role') {
      if (m.to !== myId) return; // not for me — never look at it
      setRole({ round: m.round as number, gameNo: m.gameNo as number, spectator: !!m.spectator, word: (m.word as string | null) ?? null });
    } else if (m.t === 'imp_clue_bad') {
      if (m.to === myId) setClueError(String(m.reason));
    } else if (m.t === 'imp_reset') {
      setSnap(null);
      setRole(null);
    }
    if (isHost) handleInput(m);
  }), [onMessage, isHost, myId, handleInput]);

  // Players say hello on mount so they get the current snapshot (and their role) straight away.
  useEffect(() => { if (!isHost) send({ t: 'imp_hello' }); }, [isHost, send]);

  // Late joiners join the scoreboard and spectate this round; leavers are skipped.
  useEffect(() => {
    if (!isHost) return;
    const s = S.current;
    if (!s.settings || s.phase === 'final') return;
    let added = false;
    for (const p of roomPlayers) {
      if (!s.players[p.id] && Object.keys(s.players).length < MAX_PLAYERS) {
        s.players[p.id] = { id: p.id, name: p.name, emoji: p.emoji, score: 0, joinedAt: p.joinedAt };
        sendRole(p.id);
        added = true;
      }
    }
    // Someone left: don't wait for them.
    const present = s.roundIds.filter(id => presentRef.current.has(id));
    if (s.phase === 'clues' && !presentRef.current.has(s.order[s.turn])) {
      s.clues.push({ id: s.order[s.turn], text: '—', skipped: true });
      flow.current!.nextTurn();
      return;
    }
    if (s.phase === 'roles' && present.length && present.every(id => s.ready.has(id))) { flow.current!.startClues(); return; }
    if (s.phase === 'vote' && present.length && present.every(id => s.votes[id])) { flow.current!.endVote(); return; }
    if (added) broadcast();
  }, [isHost, roomPlayers, broadcast, sendRole]);

  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(flushTimer.current); }, []);

  // ---- player actions ----
  const ready = useCallback(() => { if (snap) send({ t: 'imp_ready', round: snap.round }); }, [snap, send]);
  const giveClue = useCallback((text: string) => {
    if (!snap) return;
    setClueError(null);
    send({ t: 'imp_clue', round: snap.round, text });
  }, [snap, send]);
  const vote = useCallback((target: string) => { if (snap) send({ t: 'imp_vote', round: snap.round, target }); }, [snap, send]);
  const guess = useCallback((word: string) => { if (snap) send({ t: 'imp_guess', round: snap.round, word }); }, [snap, send]);

  // A role from an old round is no use.
  const myRole = role && snap && role.round === snap.round && role.gameNo === snap.gameNo ? role : null;

  return {
    snap, role: myRole, clueError, setClueError,
    start, startClues, skipTurn, endVoteNow, next, backToSetup,
    ready, giveClue, vote, guess,
  };
}
