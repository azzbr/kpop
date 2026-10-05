import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameConfig, GameMsg, RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';
import { useHelloGate, useArenaFinish, msLeft, placeOf } from '../../online/helloGate';
import {
  WIN_SCORE, ROCKET_GOAL, modeOf, assignTeams, teamSizes, applyPull, goalReached, clampTaps, tugRanking,
  addRocketTaps, rocketRanking, type Team, type TugMode,
} from './teamTugLogic';

// Two modes (config.mode):
// - 'tug': two teams mash to pull the star to their flag, best of 3.
// - 'rocket': everyone mashes, rockets race to the moon, first to 150 taps wins (2–30 players).
// Taps are counted on each device and sent at most every 250 ms; the host is authoritative.

const COUNTDOWN_MS = 3500;
const TAP_FLUSH_MS = 250;
const TUG_TICK_MS = 130;
const ROCKET_TICK_MS = 200;

const TEAM_INFO = [
  { name: 'Pink Sparks', heart: '💗', text: 'text-pink-300', grad: 'from-pink-500 to-rose-600' },
  { name: 'Blue Thunder', heart: '💙', text: 'text-blue-300', grad: 'from-blue-500 to-indigo-600' },
];

type Phase = 'wait' | 'countdown' | 'battle' | 'round_end' | 'final';

interface Snapshot {
  phase: Phase;
  round: number;
  teams: Record<string, Team>;
  scores: number[];
  pos: number;
  progress: Record<string, number>;
  ms: number; // until the countdown ends
  winTeam?: Team;
  winnerId?: string;
  ranked?: (string | string[])[];
}

// Messages (all prefixed tug_)
type TugMsg = { from?: string } & (
  | { t: 'tug_start'; round: number; teams: Record<string, Team>; scores: number[]; progress: Record<string, number>; ms: number }
  | { t: 'tug_pos'; pos: number }
  | { t: 'tug_rpos'; p: Record<string, number> }
  | { t: 'tug_taps'; n: number }
  | { t: 'tug_round_end'; team: Team; scores: number[]; pos: number }
  | { t: 'tug_rematch' }
  | { t: 'tug_final'; ranked: (string | string[])[]; team?: Team; scores?: number[]; winnerId?: string; p?: Record<string, number> }
  | ({ t: 'tug_sync'; to: string } & Snapshot)
);

const TeamTugOnline: React.FC<{ room: RoomApi; config?: GameConfig }> = ({ room, config }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const mode: TugMode = modeOf(config);
  const rocket = mode === 'rocket';
  const { finish, reward, reset } = useArenaFinish(room);

  const [phase, setPhase] = useState<Phase>('wait');
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [pos, setPos] = useState(50);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [scores, setScores] = useState([0, 0]);
  const [round, setRound] = useState(1);
  const [startsAt, setStartsAt] = useState(0);
  const [countLeft, setCountLeft] = useState(3);
  const [roundWinner, setRoundWinner] = useState<Team | null>(null);
  const [matchWinner, setMatchWinner] = useState<Team | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [ranked, setRanked] = useState<(string | string[])[] | null>(null);
  const [myTaps, setMyTaps] = useState(0);
  const tapBuf = useRef(0);

  const playersRef = useRef(players);
  playersRef.current = players;

  // Host-side authoritative state
  const hd = useRef({
    ids: [] as string[],
    teams: {} as Record<string, Team>,
    sizes: [1, 1] as [number, number],
    pos: 50,
    lastSent: 50,
    buf: [0, 0] as [number, number],
    progress: {} as Record<string, number>,
    dirty: false,
    scores: [0, 0],
    round: 1,
    phase: 'wait' as Phase,
    startsAt: 0,
    winTeam: undefined as Team | undefined,
    winnerId: undefined as string | undefined,
    ranked: undefined as (string | string[])[] | undefined,
    tick: 0,
    timer: 0,
  });

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: 'Friend', emoji: '🙂', isHost: false, joinedAt: 0 };

  const myTeam: Team | undefined = teams[myId];
  const inRace = rocket ? progress[myId] !== undefined : myTeam !== undefined;

  // ---- HOST ----
  const hostBegin = (r: number) => {
    const h = hd.current;
    h.round = r;
    h.pos = 50;
    h.lastSent = 50;
    h.buf = [0, 0];
    h.progress = {};
    if (rocket) h.ids.forEach((id) => (h.progress[id] = 0));
    h.dirty = false;
    h.winTeam = undefined;
    h.winnerId = undefined;
    h.ranked = undefined;
    h.startsAt = Date.now() + COUNTDOWN_MS;
    h.phase = 'battle';
    send({ t: 'tug_start', round: r, teams: h.teams, scores: [...h.scores], progress: { ...h.progress }, ms: COUNTDOWN_MS });
  };

  const hostTick = () => {
    const h = hd.current;
    if (h.phase !== 'battle' || Date.now() < h.startsAt) return;
    if (rocket) {
      if (h.dirty) {
        h.dirty = false;
        send({ t: 'tug_rpos', p: { ...h.progress } });
      }
      return;
    }
    if (h.buf[0] || h.buf[1]) {
      h.pos = applyPull(h.pos, h.buf, h.sizes);
      h.buf = [0, 0];
    }
    if (Math.abs(h.pos - h.lastSent) > 0.05) {
      h.lastSent = h.pos;
      send({ t: 'tug_pos', pos: h.pos });
    }
    const w = goalReached(h.pos);
    if (w === null) return;
    h.phase = 'round_end';
    h.scores[w] += 1;
    send({ t: 'tug_round_end', team: w, scores: [...h.scores], pos: h.pos });
    window.clearTimeout(h.timer);
    if (h.scores[w] >= WIN_SCORE) {
      h.timer = window.setTimeout(() => {
        h.phase = 'final';
        h.winTeam = w;
        h.ranked = tugRanking(h.teams, w);
        send({ t: 'tug_final', ranked: h.ranked, team: w, scores: [...h.scores] });
      }, 2200);
    } else {
      h.timer = window.setTimeout(() => hostBegin(h.round + 1), 2600);
    }
  };

  const hostSnapshot = (): Snapshot => {
    const h = hd.current;
    return {
      phase: h.phase === 'battle' && Date.now() < h.startsAt ? 'countdown' : h.phase,
      round: h.round, teams: h.teams, scores: [...h.scores], pos: h.pos, progress: { ...h.progress },
      ms: msLeft(h.startsAt), winTeam: h.winTeam, winnerId: h.winnerId, ranked: h.ranked,
    };
  };

  useHelloGate(room, 'tug', {
    onStart: () => {
      const h = hd.current;
      h.ids = playersRef.current.map((p) => p.id);
      h.teams = rocket ? {} : assignTeams(h.ids);
      h.sizes = teamSizes(h.teams);
      hostBegin(1);
      h.tick = window.setInterval(hostTick, rocket ? ROCKET_TICK_MS : TUG_TICK_MS);
    },
    onHello: (from) => send({ t: 'tug_sync', to: from, ...hostSnapshot() }),
  });

  // Host rematch (after final)
  const hostRematch = () => {
    playClick();
    const h = hd.current;
    h.scores = [0, 0];
    send({ t: 'tug_rematch' });
    hostBegin(1);
  };

  const hostHandle = (m: TugMsg) => {
    const h = hd.current;
    if (m.t !== 'tug_taps' || !m.from || h.phase !== 'battle' || Date.now() < h.startsAt) return;
    if (rocket) {
      const r = addRocketTaps(h.progress, m.from, m.n);
      h.progress = r.progress;
      h.dirty = true;
      if (r.landed) {
        h.phase = 'final';
        h.winnerId = m.from;
        h.ranked = rocketRanking(h.progress, m.from);
        send({ t: 'tug_final', ranked: h.ranked, winnerId: m.from, p: { ...h.progress } });
      }
    } else {
      const team = h.teams[m.from];
      if (team !== undefined) h.buf[team] += clampTaps(m.n);
    }
  };

  // ---- EVERYONE: message handling ----
  const applyFinal = (rk: (string | string[])[], team?: Team, wid?: string) => {
    setRanked(rk);
    setPhase('final');
    if (team !== undefined) setMatchWinner(team);
    if (wid) setWinnerId(wid);
    const won = placeOf(rk, myId) === 1;
    if (won) playWin();
    else playCorrect();
    finish(rk);
  };

  const handle = (m: TugMsg) => {
    if (isHost) hostHandle(m);
    switch (m.t) {
      case 'tug_start':
        setTeams(m.teams);
        setRound(m.round);
        setScores(m.scores);
        setProgress(m.progress);
        setPos(50);
        setRoundWinner(null);
        setStartsAt(Date.now() + m.ms);
        setCountLeft(Math.ceil(m.ms / 1000));
        setMyTaps(0);
        tapBuf.current = 0;
        setPhase('countdown');
        break;
      case 'tug_pos':
        setPos(m.pos);
        break;
      case 'tug_rpos':
        setProgress(m.p);
        break;
      case 'tug_round_end':
        setPos(m.pos);
        setScores(m.scores);
        setRoundWinner(m.team);
        setPhase('round_end');
        playCorrect();
        break;
      case 'tug_rematch':
        reset();
        setMatchWinner(null);
        setWinnerId(null);
        setRanked(null);
        break;
      case 'tug_final':
        if (m.scores) setScores(m.scores);
        if (m.p) setProgress(m.p);
        applyFinal(m.ranked, m.team, m.winnerId);
        break;
      case 'tug_sync':
        if (m.to !== myId) break;
        setTeams(m.teams);
        setRound(m.round);
        setScores(m.scores);
        setPos(m.pos);
        setProgress(m.progress);
        if (m.phase === 'final' && m.ranked) applyFinal(m.ranked, m.winTeam, m.winnerId);
        else if (m.phase === 'countdown') {
          setStartsAt(Date.now() + m.ms);
          setPhase('countdown');
        } else if (m.phase === 'battle') setPhase('battle');
        else if (m.phase === 'round_end') setPhase('round_end');
        break;
    }
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    const off = onMessage((raw: GameMsg) => handleRef.current(raw as unknown as TugMsg));
    const h = hd.current;
    return () => {
      off();
      window.clearInterval(h.tick);
      window.clearTimeout(h.timer);
    };
  }, [onMessage]);

  // Countdown → battle transition (local)
  useEffect(() => {
    if (phase !== 'countdown') return;
    const iv = window.setInterval(() => {
      const left = startsAt - Date.now();
      setCountLeft(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        playCorrect();
        setPhase('battle');
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, [phase, startsAt]);

  // Flush my taps to the host at most every 250 ms
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (tapBuf.current > 0) {
        send({ t: 'tug_taps', n: tapBuf.current });
        tapBuf.current = 0;
      }
    }, TAP_FLUSH_MS);
    return () => window.clearInterval(iv);
  }, [send]);

  const tap = () => {
    if (phase !== 'battle' || !inRace) return;
    tapBuf.current += 1;
    setMyTaps((n) => n + 1);
    if (tapBuf.current % 3 === 0) playPop();
  };

  const roster = (team: Team) => players.filter((p) => teams[p.id] === team);

  // Rocket: my rocket moves with my own taps right away (the host's number catches up)
  const shownProgress = (id: string) => Math.min(ROCKET_GOAL, id === myId && phase === 'battle' ? Math.max(progress[id] || 0, myTaps) : progress[id] || 0);
  const racers = Object.keys(progress).length ? Object.keys(progress) : players.map((p) => p.id);
  const sorted = [...racers].sort((a, b) => shownProgress(b) - shownProgress(a));
  const flatRank = ranked ? ranked.flatMap((r) => (Array.isArray(r) ? r : [r])) : [];

  const mashButton = (label: string, sub: string, grad: string, icon: string) => (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onPointerDown={(e) => { e.preventDefault(); tap(); }}
      onContextMenu={(e) => e.preventDefault()}
      disabled={phase !== 'battle'}
      className={`game-surface w-full h-44 md:h-56 rounded-3xl bg-gradient-to-br ${grad} shadow-2xl font-fredoka ${phase !== 'battle' ? 'opacity-50' : 'active:brightness-110'}`}
    >
      <div className="text-4xl md:text-5xl mb-2">{icon}</div>
      <div className="text-2xl md:text-3xl font-bold">{label}</div>
      <div className="text-lg opacity-90 font-nunito mt-1">{sub}</div>
    </motion.button>
  );

  return (
    <div className="min-h-screen-d bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 text-white px-4 py-6 select-none"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-5xl mx-auto pt-6">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1">{rocket ? '🚀 Rocket Race' : '🪢 Team Tug-of-War'}</h1>
        <p className="text-center font-nunito text-purple-200 text-lg mb-5">
          {rocket
            ? 'Mash the button — first rocket to the moon wins!'
            : phase === 'wait' ? 'Setting up teams…' : `Round ${round} · first team to ${WIN_SCORE} ⭐`}
        </p>

        {rocket ? (
          /* Race track */
          <div className="bg-white/5 rounded-3xl border border-white/15 p-4 mb-5">
            <div className="flex justify-between items-center mb-2 font-fredoka text-base text-indigo-200">
              <span>🌍 Launch pad</span>
              <span>🌕 The Moon</span>
            </div>
            <div className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
              {sorted.map((id) => {
                const p = byId(id);
                const pct = Math.min(100, (shownProgress(id) / ROCKET_GOAL) * 100);
                return (
                  <div key={id} className="relative h-11 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ${id === myId ? 'bg-amber-400/40' : 'bg-indigo-500/30'}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute top-1/2 -translate-y-1/2 text-2xl transition-all duration-200" style={{ left: `calc(${pct}% - ${pct > 5 ? 18 : 0}px)` }}>
                      🚀
                    </div>
                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 font-nunito text-base ${id === myId ? 'font-bold text-amber-300' : 'text-white/80'}`}>
                      {p.emoji} {p.name}
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xl">🌕</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Team rosters */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {([0, 1] as const).map((team) => (
                <div key={team} className={`rounded-3xl p-3 border ${team === 0 ? 'bg-pink-500/15 border-pink-400/40' : 'bg-blue-500/15 border-blue-400/40'}`}>
                  <div className={`font-fredoka font-bold text-lg mb-2 ${TEAM_INFO[team].text}`}>
                    {TEAM_INFO[team].heart} {TEAM_INFO[team].name} {'⭐'.repeat(scores[team])}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {roster(team).map((p) => (
                      <span key={p.id} className={`text-base font-nunito rounded-full px-2 py-1 ${p.id === myId ? 'bg-amber-400/40 font-bold' : 'bg-white/10'}`}>
                        {p.emoji} {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Track */}
            <div className="relative h-24 md:h-28 rounded-full bg-white/10 border-2 border-white/20 overflow-hidden mb-6">
              <div className="absolute inset-y-0 left-0 w-[10%] bg-gradient-to-r from-pink-500/80 to-transparent flex items-center justify-center text-2xl">🚩</div>
              <div className="absolute inset-y-0 right-0 w-[10%] bg-gradient-to-l from-blue-500/80 to-transparent flex items-center justify-center text-2xl">🚩</div>
              <div className="absolute inset-y-2 left-1/2 w-0.5 bg-white/30 -translate-x-1/2" />
              <div className="absolute top-1/2 left-[5%] right-[5%] h-2 -translate-y-1/2 bg-gradient-to-r from-pink-400 via-amber-300 to-blue-400 rounded-full opacity-60" />
              <div
                className="absolute top-1/2 text-5xl md:text-6xl"
                style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)', transition: 'left 140ms linear', filter: 'drop-shadow(0 0 12px rgba(255, 220, 100, 0.9))' }}
              >
                🌟
              </div>
            </div>
          </>
        )}

        {/* Mash button */}
        {rocket ? (
          inRace || phase === 'wait' || phase === 'countdown' ? (
            mashButton(
              phase === 'battle' ? 'TAP TO BLAST OFF!!!' : 'Get ready…',
              `${Math.round((shownProgress(myId) / ROCKET_GOAL) * 100)}% to the moon`,
              'from-orange-500 to-red-600',
              '🚀🔥',
            )
          ) : (
            <div className="text-center font-nunito text-lg text-purple-200 bg-white/10 rounded-3xl p-6">👀 Cheer them on — you can race in the next one!</div>
          )
        ) : myTeam !== undefined ? (
          mashButton(
            `PULL FOR ${TEAM_INFO[myTeam].name.toUpperCase()}!`,
            phase === 'battle' ? 'TAP TAP TAP!!!' : 'wait for it…',
            TEAM_INFO[myTeam].grad,
            myTeam === 0 ? '👈🌟' : '🌟👉',
          )
        ) : (
          <div className="text-center font-nunito text-lg text-purple-200 bg-white/10 rounded-3xl p-6">
            {phase === 'wait' ? '🪢 Picking teams…' : '👀 Cheer them on — you can pull in the next match!'}
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'countdown' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 pointer-events-none">
            <motion.div
              key={countLeft}
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-fredoka font-bold text-8xl md:text-9xl text-amber-300"
              style={{ textShadow: '0 0 30px rgba(255,200,0,0.8)' }}
            >
              {countLeft > 0 ? countLeft : rocket ? 'GO!' : 'PULL!'}
            </motion.div>
          </motion.div>
        )}

        {phase === 'round_end' && roundWinner !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
            <motion.div
              initial={{ scale: 0.5, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260 }}
              className="bg-gradient-to-br from-purple-800 to-fuchsia-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm mx-4"
            >
              <div className="text-6xl mb-3">{TEAM_INFO[roundWinner].heart}</div>
              <h2 className="font-fredoka font-bold text-3xl mb-2 text-amber-300">{TEAM_INFO[roundWinner].name} take the round! ⭐</h2>
              <p className="font-nunito text-lg text-purple-200">{scores[0]} — {scores[1]} · next round starting…</p>
            </motion.div>
          </motion.div>
        )}

        {phase === 'final' && ranked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
            <ConfettiBurst count={80} durationMs={4000} />
            <motion.div
              initial={{ scale: 0.5, rotate: -4 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-purple-800 to-fuchsia-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full"
            >
              <motion.div
                animate={rocket ? { y: [0, -14, 0] } : { rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: rocket ? 0.7 : 1, repeat: Infinity, repeatDelay: rocket ? 0 : 0.4 }}
                className="text-7xl mb-3"
              >
                {rocket ? '🌕🚀' : '🏆'}
              </motion.div>
              {rocket && winnerId ? (
                <>
                  <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-3">{byId(winnerId).emoji} {byId(winnerId).name} reached the moon!</h2>
                  <div className="bg-black/25 rounded-2xl p-3 mb-4 text-left max-h-44 overflow-y-auto">
                    {flatRank.slice(0, 8).map((id) => (
                      <div key={id} className={`flex justify-between font-nunito text-base py-0.5 ${id === myId ? 'text-amber-200 font-bold' : ''}`}>
                        <span>#{placeOf(ranked, id)} {byId(id).emoji} {byId(id).name}</span>
                        <span>{Math.round(((progress[id] || 0) / ROCKET_GOAL) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : matchWinner !== null ? (
                <>
                  <h2 className="font-fredoka font-bold text-3xl mb-1 text-amber-300">{TEAM_INFO[matchWinner].name} WIN!</h2>
                  <p className="font-nunito text-lg text-purple-200 mb-2">{scores[0]} — {scores[1]}</p>
                </>
              ) : null}
              {reward ? (
                <p className="font-fredoka text-lg text-green-300 mb-6">
                  {placeOf(ranked, myId) === 1 ? '🎉 ' : 'So close! '}+{reward.xp} XP · +{reward.coins} 🪙
                </p>
              ) : (
                <p className="font-fredoka text-lg text-green-300 mb-6">What a match!</p>
              )}
              {isHost ? (
                <div className="flex gap-3 justify-center">
                  <button onClick={hostRematch} className="min-h-[52px] px-6 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl">
                    {rocket ? 'Race Again! ⚡' : 'Rematch! ⚡'}
                  </button>
                  <button onClick={() => { playClick(); send({ t: 'to_lobby' }); }} className="min-h-[52px] px-6 py-3 rounded-full font-fredoka font-bold text-lg bg-white/15 border border-white/30">
                    Lobby 🏠
                  </button>
                </div>
              ) : (
                <div className="font-nunito text-lg text-purple-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeamTugOnline;
