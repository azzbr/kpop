// Quiz Party networking: the host device owns the game and broadcasts a snapshot (`qp_state`)
// after every change; players only send inputs. Snapshots never contain unrevealed answers.
// Because each snapshot is complete, a late joiner (or a reconnecting player) catches up from the
// next one — the host re-sends whenever someone joins or says hello.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomApi, GameMsg } from '../useRoom';
import type { QuizQuestion } from '../../data/quiz/types';
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';
import {
  newPlayer, prepare, publicQuestion, toOriginal, scoreAnswer, rollChests, chestNeedsTarget, openChest,
  buyUpgrade, rankPlayers, raceGoal, correctText, assignTeams,
} from './quizLogic';
import type { QuizMode, QPlayer, PreparedQuestion, PublicQuestion, PlayerAnswer, Chest, UpgradeKind } from './quizLogic';

export interface QuizSettings {
  mode: QuizMode;
  secs: number;
  teams: number; // 0 = no teams
  hostPlays: boolean;
  sourceTitle: string;
}

export type Phase = 'setup' | 'countdown' | 'question' | 'reveal' | 'podium';

export interface ChestView { picked?: number; opened?: { label: string; emoji: string }; needsTarget?: boolean; done?: boolean }

export interface QuizSnapshot {
  phase: Phase;
  settings: QuizSettings;
  n: number;
  total: number;
  /** Host clock; players only use it to draw their countdown. */
  endsAt: number;
  question: PublicQuestion | null;
  answeredIds: string[];
  reveal: { correctDisplay: number | null; correctText: string; counts: number[]; fact?: string } | null;
  players: QPlayer[];
  chests: Record<string, ChestView>;
  raceGoal: number;
}

const COUNTDOWN_MS = 3000;
/** The host's game is saved per tab so a refresh (or a sleeping iPad reloading) can carry on. */
const HOST_KEY = 'qp_host_state';

interface HostAnswer { a: PlayerAnswer; ms: number; display: number | null }

/** JSON turns Infinity into null; put it back. */
const fixPlayer = (p: QPlayer): QPlayer => ({ ...p, fastestMs: p.fastestMs ?? Infinity });

export function useQuizParty(room: RoomApi) {
  const { isHost, myId, send, onMessage, players: roomPlayers } = room;
  const [snap, setSnap] = useState<QuizSnapshot | null>(null);

  // ---- host-only state (refs so timers always see the latest) ----
  const S = useRef<{
    settings: QuizSettings | null;
    phase: Phase;
    n: number;
    questions: PreparedQuestion[];
    startedAt: number;
    endsAt: number;
    answers: Record<string, HostAnswer>;
    players: Record<string, QPlayer>;
    chestRolls: Record<string, Chest[]>;
    chestView: Record<string, ChestView>;
    reveal: QuizSnapshot['reveal'];
    rng: Rng;
    /** Set when a new host ends a game it didn't start (it never had the questions). */
    totalOverride: number | null;
  }>({ settings: null, phase: 'setup', n: 0, questions: [], startedAt: 0, endsAt: 0, answers: {}, players: {}, chestRolls: {}, chestView: {}, reveal: null, rng: createRng(Date.now() % 1e9), totalOverride: null });
  const timer = useRef<number | undefined>(undefined);
  const flushTimer = useRef<number | undefined>(undefined);

  const buildSnapshot = useCallback((): QuizSnapshot | null => {
    const s = S.current;
    if (!s.settings) return null;
    const cur = s.questions[s.n - 1];
    return {
      phase: s.phase,
      settings: s.settings,
      n: s.n,
      total: s.totalOverride ?? s.questions.length,
      endsAt: s.endsAt,
      question: cur && (s.phase === 'question' || s.phase === 'reveal') ? publicQuestion(cur) : null,
      answeredIds: Object.keys(s.answers),
      reveal: s.phase === 'reveal' ? s.reveal : null,
      players: Object.values(s.players),
      chests: s.chestView,
      raceGoal: raceGoal(s.questions.length),
    };
  }, []);

  // Coalesce bursts (e.g. 25 answers in a second) into one broadcast to stay under rate limits.
  const broadcast = useCallback((now = false) => {
    const go = () => {
      flushTimer.current = undefined;
      const snapshot = buildSnapshot();
      if (snapshot) send({ t: 'qp_state', snap: snapshot });
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { rng, ...rest } = S.current;
        sessionStorage.setItem(HOST_KEY, JSON.stringify({ code: room.code, ...rest }));
      } catch { /* ignore */ }
    };
    if (now) { window.clearTimeout(flushTimer.current); go(); return; }
    if (flushTimer.current === undefined) flushTimer.current = window.setTimeout(go, 150);
  }, [buildSnapshot, send, room.code]);

  const activeIds = useCallback(() => Object.keys(S.current.players), []);

  const doReveal = useCallback(() => {
    const s = S.current;
    if (s.phase !== 'question' || !s.settings) return;
    window.clearTimeout(timer.current);
    const prep = s.questions[s.n - 1];
    const limit = s.settings.secs * 1000;
    const counts = new Array(prep.q.options?.length ?? 0).fill(0);
    for (const id of activeIds()) {
      const ans = s.answers[id];
      if (ans && ans.display !== null && ans.display < counts.length) counts[ans.display]++;
      s.players[id] = scoreAnswer(s.settings.mode, s.players[id], prep.q, ans?.a, ans?.ms ?? limit, limit, s.n, s.questions.length);
    }
    s.chestRolls = {};
    s.chestView = {};
    if (s.settings.mode === 'gold') {
      for (const id of activeIds()) {
        if (s.players[id].lastCorrect) { s.chestRolls[id] = rollChests(s.rng); s.chestView[id] = {}; }
      }
    }
    const correctDisplay = prep.q.type === 'choice' || prep.q.type === 'truefalse' ? prep.display.indexOf(prep.q.correct!) : null;
    s.reveal = { correctDisplay, correctText: correctText(prep.q), counts, fact: prep.q.fact };
    s.phase = 'reveal';
    broadcast(true);
  }, [activeIds, broadcast]);

  const askQuestion = useCallback(() => {
    const s = S.current;
    if (!s.settings) return;
    s.phase = 'question';
    s.answers = {};
    s.startedAt = Date.now();
    s.endsAt = s.startedAt + s.settings.secs * 1000;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(doReveal, s.settings.secs * 1000 + 300);
    broadcast(true);
  }, [broadcast, doReveal]);

  const countdownTo = useCallback((n: number) => {
    const s = S.current;
    s.n = n;
    s.phase = 'countdown';
    s.endsAt = Date.now() + COUNTDOWN_MS;
    s.reveal = null;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(askQuestion, COUNTDOWN_MS);
    broadcast(true);
  }, [askQuestion, broadcast]);

  const addPlayer = useCallback((id: string, name: string, emoji: string) => {
    const s = S.current;
    if (!s.settings || s.players[id]) return;
    let team = -1;
    if (s.settings.teams > 0) {
      // Join the smallest team.
      const sizes = new Array(s.settings.teams).fill(0);
      Object.values(s.players).forEach(p => { if (p.team >= 0) sizes[p.team]++; });
      team = sizes.indexOf(Math.min(...sizes));
    }
    s.players[id] = newPlayer(id, name, emoji, team);
  }, []);

  // ---- host actions ----
  const start = useCallback((questions: QuizQuestion[], settings: QuizSettings) => {
    if (!isHost || questions.length === 0) return;
    const s = S.current;
    s.settings = settings;
    s.rng = createRng(Date.now() % 1e9);
    s.questions = questions.map(q => prepare(q, s.rng));
    s.players = {};
    const ids = roomPlayers.filter(p => settings.hostPlays || p.id !== myId);
    const teams = settings.teams > 0 ? assignTeams(ids.map(p => p.id), settings.teams) : {};
    for (const p of ids) s.players[p.id] = newPlayer(p.id, p.name, p.emoji, teams[p.id] ?? -1);
    countdownTo(1);
  }, [isHost, roomPlayers, myId, countdownTo]);

  const next = useCallback(() => {
    const s = S.current;
    if (!isHost || s.phase !== 'reveal') return;
    const raceOver = s.settings?.mode === 'racing' && Object.values(s.players).some(p => p.finishedAt);
    if (raceOver || s.n >= s.questions.length) {
      s.phase = 'podium';
      window.clearTimeout(timer.current);
      broadcast(true);
      room.reportResult(rankPlayers(s.settings!.mode, Object.values(s.players)).map(p => p.id));
      return;
    }
    countdownTo(s.n + 1);
  }, [isHost, broadcast, countdownTo, room]);

  const revealNow = useCallback(() => { if (isHost) doReveal(); }, [isHost, doReveal]);

  const backToSetup = useCallback(() => {
    if (!isHost) return;
    window.clearTimeout(timer.current);
    S.current.phase = 'setup';
    S.current.settings = null;
    S.current.totalOverride = null;
    try { sessionStorage.removeItem(HOST_KEY); } catch { /* ignore */ }
    setSnap(null);
    send({ t: 'qp_reset' });
  }, [isHost, send]);

  // ---- inputs from players (host handles) ----
  const handleInput = useCallback((m: GameMsg) => {
    const s = S.current;
    const from = m.from as string;
    if (!s.settings) return;
    if (m.t === 'qp_hello') { broadcast(); return; }
    const p = s.players[from];
    if (!p) return;
    if (m.t === 'qp_ans' && s.phase === 'question' && m.n === s.n && !s.answers[from]) {
      const prep = s.questions[s.n - 1];
      const raw = { choice: m.choice as number | undefined, order: m.order as number[] | undefined, text: m.text as string | undefined };
      s.answers[from] = { a: toOriginal(prep, raw), ms: Date.now() - s.startedAt, display: raw.choice ?? null };
      if (Object.keys(s.answers).length >= activeIds().length) doReveal();
      else broadcast();
    } else if (m.t === 'qp_chest' && s.phase === 'reveal' && m.n === s.n) {
      const view = s.chestView[from];
      const rolls = s.chestRolls[from];
      const i = m.i as number;
      if (!view || !rolls || view.picked !== undefined || i < 0 || i > 2) return;
      const chest = rolls[i];
      view.picked = i;
      view.opened = { label: chest.label, emoji: chest.emoji };
      const others = Object.keys(s.players).filter(id => id !== from);
      if (chestNeedsTarget(chest) && others.length) view.needsTarget = true;
      else { s.players = openChest(s.players, from, chest); view.done = true; }
      broadcast();
    } else if (m.t === 'qp_target' && s.phase === 'reveal' && m.n === s.n) {
      const view = s.chestView[from];
      const rolls = s.chestRolls[from];
      if (!view?.needsTarget || view.done || view.picked === undefined) return;
      s.players = openChest(s.players, from, rolls[view.picked], m.id as string);
      const target = s.players[m.id as string];
      if (target) view.opened = { label: `${view.opened?.label} (${target.emoji} ${target.name})`, emoji: view.opened?.emoji ?? '' };
      view.needsTarget = false;
      view.done = true;
      broadcast();
    } else if (m.t === 'qp_buy' && s.settings.mode === 'cash' && (s.phase === 'reveal' || s.phase === 'countdown')) {
      const bought = buyUpgrade(p, m.kind as UpgradeKind);
      if (bought) { s.players[from] = bought; broadcast(); }
    }
  }, [activeIds, broadcast, doReveal]);

  useEffect(() => onMessage((m) => {
    if (m.t === 'qp_state') {
      const sn = m.snap as QuizSnapshot;
      setSnap({ ...sn, players: sn.players.map(fixPlayer) });
    } else if (m.t === 'qp_reset') {
      setSnap(null);
    } else if (isHost) {
      handleInput(m);
    }
  }), [onMessage, isHost, handleInput]);

  // Players say hello on mount so they get the current snapshot straight away.
  useEffect(() => { if (!isHost) send({ t: 'qp_hello' }); }, [isHost, send]);

  // Late joiners: when someone new appears, add them (if the game is running) and re-send.
  useEffect(() => {
    if (!isHost) return;
    const s = S.current;
    if (!s.settings || s.phase === 'podium') return;
    for (const p of roomPlayers) {
      if (p.id === myId && !s.settings.hostPlays) continue;
      addPlayer(p.id, p.name, p.emoji);
    }
    broadcast();
  }, [isHost, roomPlayers, myId, addPlayer, broadcast]);

  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(flushTimer.current); }, []);

  // Becoming host mid-game: either this tab WAS the host and just refreshed (restore and carry
  // on), or the old host left for good (we never had the questions — end with the standings).
  const lastSnap = useRef<QuizSnapshot | null>(null);
  lastSnap.current = snap;
  useEffect(() => {
    if (!isHost || S.current.settings) return;
    let saved: (Omit<typeof S.current, 'rng'> & { code: string }) | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(HOST_KEY) || 'null'); } catch { /* ignore */ }
    if (saved && saved.code === room.code && saved.settings && saved.phase !== 'setup') {
      const s = S.current;
      Object.assign(s, saved, { rng: createRng(Date.now() % 1e9) });
      for (const id of Object.keys(s.players)) s.players[id] = fixPlayer(s.players[id]);
      const left = s.endsAt - Date.now();
      if (s.phase === 'question') timer.current = window.setTimeout(doReveal, Math.max(0, left) + 300);
      if (s.phase === 'countdown') timer.current = window.setTimeout(askQuestion, Math.max(0, left));
      broadcast(true);
      return;
    }
    const last = lastSnap.current;
    if (last && last.phase !== 'podium') {
      const s = S.current;
      s.settings = last.settings;
      s.players = Object.fromEntries(last.players.map(p => [p.id, p]));
      s.n = last.n;
      s.totalOverride = last.total;
      s.phase = 'podium';
      broadcast(true);
      room.reportResult(rankPlayers(last.settings.mode, last.players).map(p => p.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  // ---- player actions ----
  const answer = useCallback((a: { choice?: number; order?: number[]; text?: string }) => {
    if (!snap || snap.phase !== 'question') return;
    send({ t: 'qp_ans', n: snap.n, ...a });
  }, [snap, send]);
  const pickChest = useCallback((i: number) => { if (snap) send({ t: 'qp_chest', n: snap.n, i }); }, [snap, send]);
  const pickTarget = useCallback((id: string) => { if (snap) send({ t: 'qp_target', n: snap.n, id }); }, [snap, send]);
  const buy = useCallback((kind: UpgradeKind) => send({ t: 'qp_buy', kind }), [send]);

  return { snap, start, next, revealNow, backToSetup, answer, pickChest, pickTarget, buy };
}
