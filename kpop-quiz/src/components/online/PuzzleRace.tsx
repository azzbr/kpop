// PuzzleRace: one engine for the Friends Arena "same puzzle, everyone races to solve it" games
// (Code Breaker, Make 24, Minesweeper, Sliding Puzzle, Sudoku Race, Hangman).
//
// - The host generates each round's puzzle from a seed and keeps the authoritative RaceState,
//   broadcast as a `pz_state` snapshot (coalesced to ≤ 4/s). Every device keeps the latest
//   snapshot, so a late / refreshed device just says `pz_hello` and gets everything, and a new
//   host can carry on from it.
// - Each player plays the puzzle LOCALLY (no host round trip per tap) and only reports progress
//   (`pz_prog`, throttled) and a solve claim (`pz_claim` with the answer). The host checks every
//   claim with the game's pure checker and times it on its own clock (fair across devices).
// - Rounds are scored with puzzleRaceLogic (1st solver most points, then by time; ties share).
// - At the end every device calls finishArenaGame once with the ranking from the final snapshot.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi, GameConfig, GameMsg } from '../../online/useRoom';
import type { RoundResult } from '../../store';
import { finishArenaGame } from '../../online/arenaRewards';
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';
import {
  addTotals, clamp01, fmtSecs, newSeed, placeOf, roundOver, roundSeed, scoreRound, standings,
} from '../../online/puzzleRaceLogic';
import type { LiveEntry, RoundScore } from '../../online/puzzleRaceLogic';
import { playClick, playCorrect, playWin, playWrong } from '../../utils/sounds';
import ConfettiBurst from '../ConfettiBurst';

// ---------- The plug-in interface each puzzle game implements ----------

export interface BoardProps<P, S> {
  puzzle: P;
  state: S;
  /** Update this player's board. Ignored while the board is locked. */
  setState: (next: S | ((s: S) => S)) => void;
  /** True once this player solved it / ran out, or between rounds. */
  locked: boolean;
}

export interface PuzzleDef<P, S> {
  /** The Arena game id (carried in every payload so stale messages from another game are ignored). */
  id: string;
  title: string;
  icon: string;
  /** Background classes for the screen. */
  bg: string;
  /** Max width class of the play area. */
  width?: string;
  /** One line under the title. */
  help: (difficulty: string | undefined) => string;
  rounds: (difficulty: string | undefined) => number;
  roundMs: (difficulty: string | undefined) => number;
  generate: (difficulty: string | undefined, rng: Rng, ctx: { gameSeed: number; round: number }) => P;
  init: (puzzle: P) => S;
  /** What a solve claim sends to the host. */
  answer: (state: S) => unknown;
  /** Host-side check of a claim. */
  check: (puzzle: P, answer: unknown) => boolean;
  progress: (puzzle: P, state: S) => number;
  solved: (puzzle: P, state: S) => boolean;
  failed?: (puzzle: P, state: S) => boolean;
  lives?: (puzzle: P, state: S) => number;
  Board: React.ComponentType<BoardProps<P, S>>;
  /** Shown between rounds (e.g. the secret code or the word). */
  Reveal?: React.ComponentType<{ puzzle: P }>;
}

// ---------- Shared state ----------

type Phase = 'wait' | 'play' | 'between' | 'final';

interface RaceState<P> {
  game: string;
  /** Bumped on every host change, so a returning host can tell which copy is newer. */
  v: number;
  seed: number;
  phase: Phase;
  round: number;
  total: number;
  roundMs: number;
  puzzle: P | null;
  /** Time left in the current phase when the snapshot was sent. */
  msLeft: number;
  /** Players whose game screen is up (said hello). */
  ready: string[];
  live: Record<string, LiveEntry>;
  /** Results of the round that just finished. */
  last: RoundScore[] | null;
  totals: Record<string, number>;
  ranked: string[][] | null;
  names: Record<string, { name: string; emoji: string }>;
}

/** Waiting for everyone's screen before round 1. */
const START_WAIT_MS = 3000;
const BETWEEN_MS = 6000;
const BROADCAST_EVERY_MS = 250;
const PROGRESS_EVERY_MS = 400;
const RESEND_MS = 1500;

const roundKey = (s: { seed: number; round: number } | null) => (s ? `${s.seed}:${s.round}` : '');

const ss = {
  get(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* full / blocked */ } },
  del(k: string) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

const MEDAL = ['🥇', '🥈', '🥉'];

function PuzzleRace<P, S>({ room, config, def }: { room: RoomApi; config?: GameConfig; def: PuzzleDef<P, S> }) {
  const { players, isHost, myId, send, onMessage, code } = room;
  const difficulty = config?.difficulty;

  const [view, setView] = useState<RaceState<P> | null>(null);
  const stateRef = useRef<RaceState<P> | null>(null);
  /** Local clock time when the current phase ends. */
  const deadlineRef = useRef(0);
  const [deadline, setDeadline] = useState(0);
  const playersRef = useRef(players);
  useEffect(() => { playersRef.current = players; }, [players]);

  const HOST_KEY = `pz_host:${code}:${def.id}`;
  const BOARD_KEY = `pz_board:${code}:${def.id}`;

  const adopt = useCallback((s: RaceState<P>, deadlineAt: number) => {
    stateRef.current = s;
    deadlineRef.current = deadlineAt;
    setView(s);
    setDeadline(deadlineAt);
  }, []);

  // ======================= HOST =======================
  const host = useRef({ timer: 0, sendTimer: 0, lastSent: 0 });
  const hostApi = useRef<{ recheck: () => void } | null>(null);

  useEffect(() => {
    if (!isHost) return;
    const h = host.current;
    let alive = true;

    const nameMap = (base: RaceState<P>['names']) => {
      const next = { ...base };
      for (const p of playersRef.current) next[p.id] = { name: p.name, emoji: p.emoji };
      return next;
    };

    const sendNow = () => {
      const s = stateRef.current;
      if (!s || !alive) return;
      window.clearTimeout(h.sendTimer);
      h.sendTimer = 0;
      h.lastSent = Date.now();
      send({ t: 'pz_state', game: def.id, s: { ...s, msLeft: Math.max(0, deadlineRef.current - Date.now()) } });
    };
    const broadcast = (immediate = false) => {
      const wait = h.lastSent + BROADCAST_EVERY_MS - Date.now();
      if (immediate || wait <= 0) sendNow();
      else if (!h.sendTimer) h.sendTimer = window.setTimeout(sendNow, wait);
    };

    const commit = (patch: Partial<RaceState<P>>, opts: { deadline?: number; immediate?: boolean } = {}) => {
      const cur = stateRef.current!;
      const next: RaceState<P> = { ...cur, ...patch, v: cur.v + 1 };
      adopt(next, opts.deadline ?? deadlineRef.current);
      ss.set(HOST_KEY, JSON.stringify({ s: next, deadline: deadlineRef.current }));
      if (patch.phase) arm();
      broadcast(!!opts.immediate || !!patch.phase);
    };

    /** Everyone still in the room whose game screen is up (`ready` drops players who leave). */
    const roster = () => {
      const s = stateRef.current!;
      const here = new Set(playersRef.current.map(p => p.id));
      return s.ready.filter(id => here.has(id));
    };

    const startRound = (r: number) => {
      const s = stateRef.current!;
      const puzzle = def.generate(difficulty, createRng(roundSeed(s.seed, r)), { gameSeed: s.seed, round: r });
      const totals = { ...s.totals };
      for (const id of roster()) totals[id] ??= 0;
      commit({ phase: 'play', round: r, puzzle, live: {}, totals, names: nameMap(s.names) }, { deadline: Date.now() + s.roundMs });
    };

    const endRound = () => {
      const s = stateRef.current!;
      if (s.phase !== 'play') return;
      const ids = [...new Set([...roster(), ...Object.keys(s.live), ...Object.keys(s.totals)])];
      const last = scoreRound(s.live, ids, s.roundMs);
      commit({ phase: 'between', last, totals: addTotals(s.totals, last), names: nameMap(s.names) }, { deadline: Date.now() + BETWEEN_MS });
    };

    const finish = () => {
      const s = stateRef.current!;
      commit({ phase: 'final', ranked: standings(s.totals, Object.keys(s.totals)), names: nameMap(s.names) }, { deadline: 0 });
    };

    function arm() {
      window.clearTimeout(h.timer);
      const s = stateRef.current;
      if (!s || s.phase === 'final') return;
      const ms = Math.max(0, deadlineRef.current - Date.now());
      h.timer = window.setTimeout(() => {
        const cur = stateRef.current!;
        if (cur.phase === 'wait') startRound(1);
        else if (cur.phase === 'play') endRound();
        else if (cur.phase === 'between') {
          if (cur.round < cur.total) startRound(cur.round + 1);
          else finish();
        }
      }, ms);
    }

    const maybeStart = () => {
      const s = stateRef.current!;
      if (s.phase !== 'wait') return;
      const ids = playersRef.current.map(p => p.id);
      if (ids.length && ids.every(id => s.ready.includes(id))) startRound(1);
    };

    const checkRoundOver = () => {
      const s = stateRef.current!;
      if (s.phase === 'play' && roundOver(s.live, roster())) endRound();
    };

    // ---- Pick up where we are: this tab's saved host state (refresh), the last snapshot from a
    // previous host (host change), or a brand-new game.
    let saved: { s: RaceState<P>; deadline: number } | null = null;
    try { saved = JSON.parse(ss.get(HOST_KEY) || 'null'); } catch { saved = null; }
    if (saved && (saved.s?.game !== def.id || saved.s.phase === 'final')) saved = null;
    const snap = stateRef.current;
    if (saved && (!snap || saved.s.v > snap.v)) adopt(saved.s, saved.deadline);
    else if (!snap) {
      const s: RaceState<P> = {
        game: def.id, v: 0, seed: newSeed(), phase: 'wait', round: 0, total: def.rounds(difficulty), roundMs: def.roundMs(difficulty),
        puzzle: null, msLeft: START_WAIT_MS, ready: [myId], live: {}, last: null, totals: {}, ranked: null, names: nameMap({}),
      };
      adopt(s, Date.now() + START_WAIT_MS);
    }
    const s0 = stateRef.current!;
    if (!s0.ready.includes(myId)) adopt({ ...s0, ready: [...s0.ready, myId] }, deadlineRef.current);
    hostApi.current = {
      recheck: () => {
        // Someone who left (or refreshed back to the lobby) isn't waited for any more; they're
        // ready again once their game screen says hello.
        const s = stateRef.current!;
        const here = new Set(playersRef.current.map(p => p.id));
        const ready = s.ready.filter(id => here.has(id));
        if (ready.length !== s.ready.length) commit({ ready });
        maybeStart();
        checkRoundOver();
      },
    };
    arm();
    sendNow();
    maybeStart();

    const off = onMessage((m: GameMsg) => {
      if (m.game !== def.id || !m.from) return;
      const s = stateRef.current;
      if (!s) return;
      const from = m.from;
      if (m.t === 'pz_hello') {
        const ready = s.ready.includes(from) ? s.ready : [...s.ready, from];
        commit({ ready, names: nameMap(s.names) }, { immediate: true });
        maybeStart();
      } else if (m.t === 'pz_prog') {
        if (s.phase !== 'play' || m.key !== roundKey(s)) return;
        const prev = s.live[from];
        if (prev && typeof prev.solvedMs === 'number') return;
        const entry: LiveEntry = { p: clamp01(Number(m.p)) };
        if (typeof m.lives === 'number') entry.lives = m.lives;
        if (m.failed) entry.failed = true;
        commit({ live: { ...s.live, [from]: entry }, ready: s.ready.includes(from) ? s.ready : [...s.ready, from] });
        checkRoundOver();
      } else if (m.t === 'pz_claim') {
        if (s.phase !== 'play' || m.key !== roundKey(s) || !s.puzzle) return;
        const prev = s.live[from];
        if (prev && typeof prev.solvedMs === 'number') { broadcast(true); return; }
        let ok = false;
        try { ok = def.check(s.puzzle, m.answer); } catch { ok = false; }
        if (!ok) { send({ t: 'pz_reject', game: def.id, to: from, key: m.key }); return; }
        const solvedMs = Math.max(0, s.roundMs - Math.max(0, deadlineRef.current - Date.now()));
        const entry: LiveEntry = { p: 1, solvedMs };
        if (typeof m.lives === 'number') entry.lives = m.lives;
        commit({ live: { ...s.live, [from]: entry }, ready: s.ready.includes(from) ? s.ready : [...s.ready, from] }, { immediate: true });
        checkRoundOver();
      }
    });

    return () => {
      alive = false;
      hostApi.current = null;
      off();
      window.clearTimeout(h.timer);
      window.clearTimeout(h.sendTimer);
      h.sendTimer = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  // Host: someone left — the round may now be over (or everyone left may now be ready).
  const playerIds = players.map(p => p.id).join(',');
  useEffect(() => {
    if (isHost) hostApi.current?.recheck();
  }, [playerIds, isHost]);

  // ======================= EVERYONE (snapshots) =======================
  useEffect(() => {
    return onMessage((m: GameMsg) => {
      if (m.game !== def.id) return;
      if (m.t === 'pz_state' && !isHostRef.current) {
        const s = m.s as RaceState<P>;
        if (!s || s.game !== def.id) return;
        adopt(s, s.phase === 'final' ? 0 : Date.now() + (s.msLeft || 0));
      } else if (m.t === 'pz_reject' && m.to === myId) {
        if (m.key === claimedKey.current) {
          rejectedKey.current = m.key as string;
          claimedKey.current = '';
          setNote('Hmm, that didn’t check out — keep going! 💪');
          playWrong();
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);
  const isHostRef = useRef(isHost);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  // Say hello until the host's snapshot lists us as ready (the host may still be loading the game).
  const amReady = !!view?.ready.includes(myId);
  useEffect(() => {
    if (isHost || amReady) return;
    const hello = () => send({ t: 'pz_hello', game: def.id });
    hello();
    const iv = window.setInterval(hello, 2000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, amReady]);

  // ======================= THIS PLAYER'S BOARD =======================
  const key = view && view.puzzle && view.round > 0 ? roundKey(view) : '';
  const puzzle = view?.puzzle ?? null;
  const [board, setBoardRaw] = useState<{ key: string; s: S } | null>(null);
  if (key && puzzle && board?.key !== key) {
    // New round (or first snapshot): restore this tab's board after a refresh, else start fresh.
    let restored: S | null = null;
    try {
      const saved = JSON.parse(ss.get(BOARD_KEY) || 'null');
      if (saved && saved.key === key) restored = saved.s as S;
    } catch { restored = null; }
    setBoardRaw({ key, s: restored ?? def.init(puzzle) });
  }
  const bs = board && board.key === key ? board.s : null;

  const mySolved = !!(puzzle && bs && def.solved(puzzle, bs));
  const myFailed = !!(puzzle && bs && !mySolved && def.failed?.(puzzle, bs));
  const phase = view?.phase ?? 'wait';
  const locked = phase !== 'play' || mySolved || myFailed;

  const setBoard = useCallback((next: S | ((s: S) => S)) => {
    setBoardRaw(cur => {
      if (!cur) return cur;
      const s = typeof next === 'function' ? (next as (s: S) => S)(cur.s) : next;
      ss.set(BOARD_KEY, JSON.stringify({ key: cur.key, s }));
      return { key: cur.key, s };
    });
  }, [BOARD_KEY]);
  const guardedSet = useCallback((next: S | ((s: S) => S)) => { if (!locked) setBoard(next); }, [locked, setBoard]);

  // Clean up this tab's saved boards / host state when the game is closed normally.
  useEffect(() => () => { ss.del(BOARD_KEY); ss.del(HOST_KEY); }, [BOARD_KEY, HOST_KEY]);

  // Report progress (throttled) and claim a solve.
  const claimedKey = useRef('');
  const claimedAt = useRef(0);
  const rejectedKey = useRef('');
  const lastProg = useRef<{ key: string; p: number; lives?: number; failed: boolean; at: number }>({ key: '', p: -1, failed: false, at: 0 });
  const progTimer = useRef(0);
  const [note, setNote] = useState('');

  const myP = puzzle && bs ? clamp01(def.progress(puzzle, bs)) : 0;
  const myLives = puzzle && bs && def.lives ? def.lives(puzzle, bs) : undefined;

  const sendProg = useCallback(() => {
    window.clearTimeout(progTimer.current);
    progTimer.current = 0;
    if (!key) return;
    lastProg.current = { key, p: myP, lives: myLives, failed: myFailed, at: Date.now() };
    send({ t: 'pz_prog', game: def.id, key, p: myP, ...(myLives !== undefined ? { lives: myLives } : {}), ...(myFailed ? { failed: true } : {}) });
  }, [key, myP, myLives, myFailed, send, def.id]);
  const sendProgRef = useRef(sendProg);
  useEffect(() => { sendProgRef.current = sendProg; }, [sendProg]);

  const sendClaim = useCallback(() => {
    if (!puzzle || !bs || !key) return;
    claimedKey.current = key;
    claimedAt.current = Date.now();
    send({ t: 'pz_claim', game: def.id, key, answer: def.answer(bs), ...(myLives !== undefined ? { lives: myLives } : {}) });
  }, [puzzle, bs, key, myLives, send, def]);

  useEffect(() => {
    if (phase !== 'play' || !key || !bs) return;
    if (mySolved) {
      if (claimedKey.current !== key && rejectedKey.current !== key) {
        playCorrect();
        sendClaim();
      }
      return;
    }
    const lp = lastProg.current;
    if (lp.key === key && lp.p === myP && lp.lives === myLives && lp.failed === myFailed) return;
    if (myFailed && !lp.failed) playWrong();
    const wait = lp.at + PROGRESS_EVERY_MS - Date.now();
    if (wait <= 0 || myFailed) sendProg();
    else if (!progTimer.current) progTimer.current = window.setTimeout(() => sendProgRef.current(), wait);
  }, [phase, key, bs, mySolved, myFailed, myP, myLives, sendClaim, sendProg]);
  useEffect(() => () => window.clearTimeout(progTimer.current), []);
  useEffect(() => { setNote(''); }, [key]);

  // Lost messages: if the host's snapshot doesn't show what we sent, send it again.
  const mine = view?.live[myId];
  const mineRef = useRef(mine);
  useEffect(() => { mineRef.current = mine; }, [mine]);
  const resend = useRef({ sendClaim, mySolved, myP, myFailed });
  useEffect(() => { resend.current = { sendClaim, mySolved, myP, myFailed }; }, [sendClaim, mySolved, myP, myFailed]);
  useEffect(() => {
    if (phase !== 'play' || !key) return;
    const iv = window.setInterval(() => {
      const r = resend.current;
      const e = mineRef.current;
      if (r.mySolved) {
        if (rejectedKey.current !== key && !(e && typeof e.solvedMs === 'number') && Date.now() - claimedAt.current > RESEND_MS) r.sendClaim();
      } else if (!e || Math.abs(e.p - r.myP) > 0.001 || !!e.failed !== r.myFailed) {
        sendProgRef.current();
      }
    }, RESEND_MS);
    return () => window.clearInterval(iv);
  }, [phase, key]);

  // ======================= Countdown =======================
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const iv = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(iv);
  }, [deadline]);
  const secsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const clock = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`;

  // ======================= Rewards =======================
  const [reward, setReward] = useState<RoundResult | null>(null);
  const rewarded = useRef(false);
  useEffect(() => {
    if (!view || view.phase !== 'final' || !view.ranked || rewarded.current) return;
    rewarded.current = true;
    playWin();
    const k = `pz_rewarded:${code}:${view.seed}`;
    if (ss.get(k)) return; // already rewarded before a refresh
    ss.set(k, '1');
    setReward(finishArenaGame(room, view.ranked));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.phase, view?.ranked]);

  // ======================= UI =======================
  const who = (id: string) => {
    const p = players.find(x => x.id === id);
    if (p) return { name: p.name, emoji: p.emoji };
    return view?.names[id] ?? { name: 'A friend', emoji: '🙂' };
  };

  const Board = def.Board;
  const Reveal = def.Reveal;
  const readyCount = view ? players.filter(p => view.ready.includes(p.id)).length : 0;
  const myPlace = mine && typeof mine.solvedMs === 'number' && view
    ? 1 + Object.values(view.live).filter(e => typeof e.solvedMs === 'number' && Math.round(e.solvedMs / 100) < Math.round(mine.solvedMs! / 100)).length
    : null;

  const raceRows = useMemo(() => {
    if (!view) return [];
    const ids = [...new Set([...players.map(p => p.id).filter(id => view.ready.includes(id) || view.live[id]), ...Object.keys(view.live)])];
    return ids
      .map(id => ({ id, e: view.live[id] ?? { p: 0 } }))
      .sort((a, b) => {
        const sa = a.e.solvedMs, sb = b.e.solvedMs;
        if (sa !== undefined && sb !== undefined) return sa - sb;
        if (sa !== undefined) return -1;
        if (sb !== undefined) return 1;
        return (b.e.p - a.e.p) || (a.id < b.id ? -1 : 1);
      });
  }, [view, players]);

  return (
    <div className={`min-h-screen-d text-white px-3 pb-10 ${def.bg}`} style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
      <div className={`${def.width ?? 'max-w-xl'} mx-auto`}>
        <header className="text-center pt-14 md:pt-3 mb-3">
          <h1 className="font-fredoka font-bold text-3xl md:text-4xl">{def.icon} {def.title}</h1>
          <p className="font-nunito text-base md:text-lg text-white/80 mt-1">
            {phase === 'play' && view
              ? <>Round {view.round}/{view.total} · ⏱️ {clock}{myLives !== undefined ? <> · {myLives > 0 ? '❤️'.repeat(myLives) : '💔'}</> : null}</>
              : def.help(difficulty)}
          </p>
        </header>

        {(!view || phase === 'wait') && (
          <div className="bg-white/10 border border-white/15 rounded-3xl p-6 text-center">
            <div className="text-5xl mb-2 animate-pulse">{def.icon}</div>
            <div className="font-fredoka text-2xl mb-1">Get ready…</div>
            <div className="font-nunito text-lg text-white/80">
              {view ? `${readyCount}/${players.length} players ready` : 'Connecting to the host…'}
            </div>
            <div className="font-nunito text-base text-white/70 mt-3">{def.help(difficulty)}</div>
          </div>
        )}

        {phase === 'play' && view && puzzle && bs && (
          <>
            <AnimatePresence>
              {(mySolved || myFailed || note) && (
                <motion.div
                  key={mySolved ? 'solved' : myFailed ? 'failed' : 'note'}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                  className={`rounded-2xl p-3 mb-3 text-center font-fredoka text-lg border-2 ${
                    mySolved ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                      : myFailed ? 'bg-rose-500/20 border-rose-400 text-rose-100'
                        : 'bg-amber-500/20 border-amber-400 text-amber-100'}`}
                >
                  {mySolved
                    ? <>🎉 Solved{myPlace ? <> — {myPlace <= 3 ? MEDAL[myPlace - 1] : `#${myPlace}`} in {fmtSecs(mine!.solvedMs!)}</> : '!'} Cheer on the others…</>
                    : myFailed ? <>💥 Out of lives this round — great try! Cheer on the others.</> : note}
                </motion.div>
              )}
            </AnimatePresence>
            <Board key={key} puzzle={puzzle} state={bs} setState={guardedSet} locked={locked} />
          </>
        )}

        {phase === 'between' && view && (
          <div className="bg-black/30 border border-white/15 rounded-3xl p-5">
            <h2 className="font-fredoka text-2xl text-center text-amber-300 mb-3">
              {view.round < view.total ? `Round ${view.round} done!` : 'Last round done!'}
            </h2>
            {Reveal && view.puzzle && <div className="mb-4"><Reveal puzzle={view.puzzle} /></div>}
            <div className="space-y-1.5 mb-4">
              {(view.last ?? []).map(r => (
                <div key={r.id} className={`flex items-center justify-between rounded-xl px-3 py-2 font-nunito text-base ${r.id === myId ? 'bg-white/20' : 'bg-white/5'}`}>
                  <span className="truncate">
                    {r.place ? (r.place <= 3 ? MEDAL[r.place - 1] : `#${r.place}`) : r.failed ? '💥' : '⏳'} {who(r.id).emoji} {who(r.id).name}
                  </span>
                  <span className="shrink-0 ml-2">
                    {r.ms !== null ? <span className="text-white/70 mr-2">{fmtSecs(r.ms)}</span> : <span className="text-white/60 mr-2">{Math.round(r.p * 100)}%</span>}
                    <b className="text-amber-300">+{r.points}</b>
                  </span>
                </div>
              ))}
            </div>
            <Standings view={view} who={who} myId={myId} />
            <p className="text-center font-nunito text-lg text-white/80 mt-4">
              {view.round < view.total ? `Next round in ${secsLeft}s…` : `Final results in ${secsLeft}s…`}
            </p>
          </div>
        )}

        {(phase === 'play' || phase === 'wait') && view && raceRows.length > 0 && (
          <RaceStrip rows={raceRows.slice(0, 12)} more={raceRows.length - 12} who={who} myId={myId} />
        )}
      </div>

      <AnimatePresence>
        {phase === 'final' && view?.ranked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-6 text-center max-w-sm w-full">
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 mb-3">
                {view.ranked[0]?.length > 1
                  ? `${view.ranked[0].map(id => `${who(id).emoji} ${who(id).name}`).join(' & ')} tie for 1st!`
                  : view.ranked[0]?.[0] ? `${who(view.ranked[0][0]).emoji} ${who(view.ranked[0][0]).name} wins!` : 'Great game!'}
              </h2>
              <div className="bg-black/25 rounded-2xl p-3 mb-3 text-left max-h-56 overflow-y-auto">
                {view.ranked.flatMap(rung => rung).map(id => {
                  const place = placeOf(view.ranked!, id)!;
                  return (
                    <div key={id} className={`flex justify-between font-nunito text-base py-1 px-2 rounded-lg ${id === myId ? 'bg-white/15' : ''}`}>
                      <span className="truncate">{place <= 3 ? MEDAL[place - 1] : `#${place}`} {who(id).emoji} {who(id).name}</span>
                      <span className="text-amber-200 ml-2">{view.totals[id] ?? 0}</span>
                    </div>
                  );
                })}
              </div>
              {reward && (
                <p className="font-fredoka text-lg text-green-300 mb-4">+{reward.xp} XP · +{reward.coins} 🪙</p>
              )}
              {isHost ? (
                <button onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="min-h-[52px] px-8 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl active:scale-95 transition-transform">
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-lg text-slate-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type Who = (id: string) => { name: string; emoji: string };

function RaceStrip({ rows, more, who, myId }: { rows: { id: string; e: LiveEntry }[]; more: number; who: Who; myId: string }) {
  let solvedPlace = 0;
  return (
    <div className="bg-black/25 rounded-2xl p-3 mt-4">
      <div className="font-fredoka text-base text-white/80 mb-2">The race 🏁</div>
      <div className="space-y-1.5">
        {rows.map(({ id, e }) => {
          const solved = typeof e.solvedMs === 'number';
          if (solved) solvedPlace++;
          return (
            <div key={id} className="flex items-center gap-2 font-nunito text-base">
              <span className={`w-32 truncate ${id === myId ? 'font-bold' : ''}`}>{who(id).emoji} {who(id).name}</span>
              <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${solved ? 'bg-emerald-400' : e.failed ? 'bg-rose-400' : 'bg-sky-400'}`}
                  style={{ width: `${Math.round(clamp01(e.p) * 100)}%` }} />
              </div>
              <span className="w-20 text-right text-sm">
                {solved ? <>{solvedPlace <= 3 ? MEDAL[solvedPlace - 1] : '✅'} {fmtSecs(e.solvedMs!)}</>
                  : e.failed ? '💥' : e.lives !== undefined ? `${'❤️'.repeat(Math.min(e.lives, 3))}${e.lives > 3 ? `×${e.lives}` : ''}` : `${Math.round(clamp01(e.p) * 100)}%`}
              </span>
            </div>
          );
        })}
        {more > 0 && <div className="font-nunito text-sm text-white/60">…and {more} more</div>}
      </div>
    </div>
  );
}

function Standings<P>({ view, who, myId }: { view: RaceState<P>; who: Who; myId: string }) {
  const ranked = standings(view.totals);
  return (
    <div className="bg-white/5 rounded-2xl p-3">
      <div className="font-fredoka text-base text-white/80 mb-1">Total so far</div>
      {ranked.flatMap(r => r).slice(0, 10).map(id => {
        const place = placeOf(ranked, id)!;
        return (
          <div key={id} className={`flex justify-between font-nunito text-base py-0.5 ${id === myId ? 'font-bold' : ''}`}>
            <span className="truncate">{place}. {who(id).emoji} {who(id).name}</span>
            <span className="text-amber-200 ml-2">{view.totals[id] ?? 0}</span>
          </div>
        );
      })}
    </div>
  );
}

export default PuzzleRace;
