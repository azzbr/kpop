import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { RoomApi, GameConfig } from '../../online/useRoom';
import { useHostGame } from '../../online/useHostGame';
import type { HostTools } from '../../online/useHostGame';
import { useArenaFinish, msLeft } from '../../online/helloGate';
import { playPop, playCorrect, playNote, playTick } from '../../utils/sounds';
import { FinalCard } from './RaceParts';
import { ArenaFrame, Waiting } from './ArenaParts';
import { toRungs, who } from './arenaHelpers';
import {
  GRAB_MS, GRACE_MS, OOPS_MS, REVEAL_MS, MAX_TAPS, DANCE_TUNE,
  musicMs, starLayout, awardStars, starRanking, roundsLasted,
} from './starGrabLogic';
import type { Tap } from './starGrabLogic';

// Star Grab: musical chairs. Everyone dances while the tune plays; when it stops there is one
// star fewer than players. Each device times its own tap from the moment it showed the stars,
// and the host hands out stars fastest-first. Whoever is left without a star cheers from the side.

interface State {
  ids: string[];
  alive: string[];
  round: number;
  phase: 'music' | 'grab' | 'result' | 'final';
  seed: number;
  stars: number;
  musicEndsAt: number;
  grabEndsAt: number;
  taps: Tap[];
  owner: Record<number, string>;
  out: string[];
  again: boolean;
  closing: boolean;
  outRound: Record<string, number>;
  ranked: (string | string[])[];
}
interface View {
  round: number; phase: State['phase']; ms: number; seed: number; stars: number;
  alive: string[]; owner: Record<number, string>; out: string[]; again: boolean;
  outRound: Record<string, number>; scores?: Record<string, number>; ranked?: (string | string[])[];
}

function finalState(s: State): State {
  return { ...s, phase: 'final', ranked: starRanking(s.outRound, s.ids) };
}

type Present = () => string[];

function nextRound(t: HostTools<State>, s: State, present: Present): State {
  // Anyone who left the room since the last round counts as out this round.
  const here = present();
  const outRound = { ...s.outRound };
  const round = s.round + 1;
  for (const id of s.alive) if (!here.includes(id)) outRound[id] = round;
  const alive = s.alive.filter(id => here.includes(id));
  if (alive.length <= 1) return finalState({ ...s, alive, outRound });
  const music = musicMs(Math.random);
  const now = Date.now();
  t.after('grab', music, () => {
    const cur = t.get();
    if (cur.phase === 'music' && cur.round === round) t.set({ ...cur, phase: 'grab' });
  });
  t.after('close', music + GRAB_MS + GRACE_MS, () => t.set(close(t, t.get(), present)));
  return {
    ...s, alive, outRound, round, phase: 'music', seed: Math.floor(Math.random() * 1e9), stars: alive.length - 1,
    musicEndsAt: now + music, grabEndsAt: now + music + GRAB_MS, taps: [], owner: {}, out: [], again: false, closing: false,
  };
}

function close(t: HostTools<State>, s: State, present: Present): State {
  if (s.phase !== 'music' && s.phase !== 'grab') return s;
  t.cancel('grab');
  t.cancel('close');
  const { owner, out } = awardStars(s.taps, s.stars, s.alive);
  // Nobody tapped at all: no one goes out, dance again.
  const again = s.taps.length === 0;
  const outRound = { ...s.outRound };
  if (!again) for (const id of out) outRound[id] = s.round;
  const alive = again ? s.alive : s.alive.filter(id => !out.includes(id));
  t.after('next', REVEAL_MS, () => {
    const cur = t.get();
    t.set(cur.alive.length <= 1 ? finalState(cur) : nextRound(t, cur, present));
  });
  return { ...s, phase: 'result', owner, out: again ? [] : out, again, alive, outRound };
}

/** The dance tune on the shared audio context (volume follows the grown-ups' sound setting). */
function startDanceMusic(): () => void {
  let i = 0;
  let stopped = false;
  let timer: number | undefined;
  const beat = 0.2;
  const tick = () => {
    if (stopped) return;
    const [f, beats] = DANCE_TUNE[i % DANCE_TUNE.length];
    playNote(f, beat * beats * 0.9, 'square', 0.05);
    if (i % 4 === 0) playNote(f / 4, beat * 3, 'triangle', 0.14);
    if (i % 2 === 1) playNote(2200, 0.03, 'square', 0.02);
    i++;
    timer = window.setTimeout(tick, beat * beats * 1000);
  };
  tick();
  return () => { stopped = true; window.clearTimeout(timer); };
}

export default function StarGrab({ room }: { room: RoomApi; config?: GameConfig }) {
  const { finish, reward } = useArenaFinish(room);
  const playersRef = useRef(room.players);
  playersRef.current = room.players;
  const present: Present = () => playersRef.current.map(p => p.id);

  const { view, input } = useHostGame<State, View>(room, 'sg', {
    start: (ids, t) => nextRound(t, {
      ids, alive: ids, round: 0, phase: 'music', seed: 0, stars: 0, musicEndsAt: 0, grabEndsAt: 0,
      taps: [], owner: {}, out: [], again: false, closing: false, outRound: {}, ranked: [],
    }, present),
    onInput: (s, from, m, t) => {
      if ((s.phase !== 'music' && s.phase !== 'grab') || m.round !== s.round || !s.alive.includes(from)) return;
      const star = m.star;
      const reactMs = m.reactMs;
      if (typeof star !== 'number' || !Number.isInteger(star) || star < 0 || star >= s.stars) return;
      if (typeof reactMs !== 'number' || !(reactMs >= 0) || reactMs > GRAB_MS + 100) return;
      if (s.taps.filter(x => x.id === from).length >= MAX_TAPS) return;
      const taps = [...s.taps, { id: from, star, reactMs }];
      const { owner } = awardStars(taps, s.stars, s.alive);
      const n: State = { ...s, taps, owner };
      // Every star is taken: wait a moment for faster taps still on the way, then close.
      if (!s.closing && Object.keys(owner).length >= s.stars) {
        n.closing = true;
        t.after('close', GRACE_MS, () => t.set(close(t, t.get(), present)));
      }
      return n;
    },
    view: s => ({
      round: s.round, phase: s.phase, seed: s.seed, stars: s.stars, alive: s.alive, owner: s.owner, out: s.out,
      again: s.again, outRound: s.outRound,
      ms: s.phase === 'music' ? msLeft(s.musicEndsAt) : s.phase === 'grab' ? msLeft(s.grabEndsAt) : 0,
      ...(s.phase === 'final' ? { ranked: s.ranked, scores: roundsLasted(s.outRound, s.ids, s.round) } : {}),
    }),
  });

  // ── This device's round: music → stars shown (local clock) → taps.
  const [stoppedRound, setStoppedRound] = useState(0);
  const [shownAt, setShownAt] = useState<{ round: number; at: number } | null>(null);
  const [frozenUntil, setFrozenUntil] = useState(0);
  const [myTaps, setMyTaps] = useState<{ round: number; stars: number[] }>({ round: 0, stars: [] });
  const [now, setNow] = useState(() => performance.now());

  const round = view?.round ?? 0;
  const phase = view?.phase;
  const meAlive = !!view?.alive.includes(room.myId);
  const dancing = phase === 'music' && stoppedRound !== round;
  const starsUp = !!view && (phase === 'grab' || (phase === 'music' && stoppedRound === round));

  // Local music timer + tune.
  const musicMsLeft = phase === 'music' ? view?.ms : undefined;
  useEffect(() => {
    if (musicMsLeft === undefined) return;
    const stop = startDanceMusic();
    const timer = window.setTimeout(() => { stop(); setStoppedRound(round); }, musicMsLeft);
    return () => { stop(); window.clearTimeout(timer); };
  }, [round, musicMsLeft]);

  // The moment this device showed the stars is when its reaction clock starts.
  useEffect(() => {
    if (starsUp && shownAt?.round !== round) {
      // A device that arrives mid-grab gets only the time that is left.
      const late = phase === 'grab' && view ? GRAB_MS - view.ms : 0;
      setShownAt({ round, at: performance.now() - Math.max(0, late) });
      playTick();
    }
  }, [starsUp, round, phase, view, shownAt?.round]);

  // Re-render a few times a second while frozen or grabbing (for the countdown / unfreeze).
  const ticking = starsUp || frozenUntil > now;
  useEffect(() => {
    if (!ticking) return;
    const iv = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(iv);
  }, [ticking]);

  useEffect(() => { if (phase === 'result') playPop(); }, [phase, round]);
  useEffect(() => { if (phase === 'final' && view?.ranked) { playCorrect(); finish(view.ranked); } }, [phase, view?.ranked, finish]);

  const layout = view ? starLayout(view.seed, view.stars) : [];

  if (!view) return <ArenaFrame title="Star Grab" icon="⭐"><Waiting /></ArenaFrame>;

  const t = performance.now();
  const frozen = frozenUntil > t;
  const mineTaps = myTaps.round === round ? myTaps.stars : [];
  const myStar = Object.entries(view.owner).find(([, id]) => id === room.myId)?.[0];
  const grabLeft = shownAt?.round === round ? Math.max(0, GRAB_MS - (t - shownAt.at)) : GRAB_MS;
  const grabOver = starsUp && grabLeft <= 0;

  const tapStar = (i: number) => {
    if (!meAlive || (phase !== 'music' && phase !== 'grab')) return;
    if (performance.now() < frozenUntil) return;
    if (!starsUp) {
      // Too early! A short freeze on this device only.
      setFrozenUntil(performance.now() + OOPS_MS);
      setNow(performance.now());
      playNote(330, 0.15, 'triangle', 0.15);
      return;
    }
    if (!shownAt || shownAt.round !== round || grabOver) return;
    if (myStar !== undefined || mineTaps.length >= MAX_TAPS || mineTaps.includes(i)) return;
    const taken = view.owner[i];
    if (taken !== undefined && taken !== room.myId) return;
    playPop();
    setMyTaps({ round, stars: [...mineTaps, i] });
    input({ round, star: i, reactMs: Math.round(performance.now() - shownAt.at) });
  };

  const outNames = view.out.map(id => who(room.players, id).name);
  let status: string;
  if (phase === 'final') status = '🏁 Game over!';
  else if (phase === 'result') {
    if (view.again) status = '🙃 Nobody grabbed a star — let’s dance again!';
    else if (view.out.includes(room.myId)) status = '💫 No star this time — great dancing! Cheer from the side 📣';
    else status = `💫 ${outNames.join(' & ')} ${view.out.length > 1 ? 'are' : 'is'} cheering from the side now!`;
  } else if (!meAlive) status = '📣 You’re cheering from the side — watch who grabs a star!';
  else if (frozen) status = '🙈 Oops, too early! Wait a sec…';
  else if (dancing) status = '🎵 Dance! Grab a star when the music stops…';
  else if (myStar !== undefined) status = '🌟 You got a star!';
  else if (grabOver) status = '⏰ Time’s up!';
  else if (mineTaps.length > 0) status = mineTaps.length >= MAX_TAPS ? '🤞 Fingers crossed…' : '😮 Taken? Try another star!';
  else status = '⭐ GRAB A STAR!';

  const showField = phase === 'music' || phase === 'grab' || phase === 'result';
  const cheering = room.players.filter(p => !view.alive.includes(p.id));

  return (
    <ArenaFrame title="Star Grab" icon="⭐" subtitle="When the music stops, grab a star!"
      tint="from-indigo-950 via-fuchsia-900 to-amber-900"
      right={<div className="shrink-0 rounded-2xl bg-black/30 px-4 py-2 font-fredoka text-lg text-right">
        <div>Round {round}</div><div className="text-violet-200">{view.alive.length} still in</div>
      </div>}>
      <div className="game-surface">
        <div className={`text-center font-fredoka text-2xl md:text-3xl mb-3 min-h-[2.5rem] ${frozen ? 'text-amber-300' : ''}`} data-testid="sg-status">
          {status}
        </div>

        {/* Dancers */}
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {view.alive.map((id, k) => {
            const w = who(room.players, id);
            return (
              <motion.div key={id}
                animate={dancing ? { y: [0, -14, 0], rotate: [0, k % 2 ? 8 : -8, 0] } : { y: 0, rotate: 0 }}
                transition={dancing ? { duration: 0.4, repeat: Infinity, delay: (k % 4) * 0.1 } : { duration: 0.2 }}
                className={`rounded-2xl px-3 py-1 flex flex-col items-center min-w-[72px] ${id === room.myId ? 'bg-amber-400/25 ring-2 ring-amber-300' : 'bg-white/10'}`}>
                <span className="text-4xl">{w.emoji}</span>
                <span className="font-nunito text-base max-w-[88px] truncate">{w.name}</span>
              </motion.div>
            );
          })}
        </div>

        {showField && (
          <div className="relative w-full h-[50vh] min-h-[340px] rounded-3xl bg-black/25 border-2 border-white/10 overflow-hidden mb-3" data-testid="sg-field">
            {layout.map((p, i) => {
              const owner = view.owner[i];
              const ow = owner !== undefined ? who(room.players, owner) : null;
              const mine = owner === room.myId;
              const visible = starsUp || phase === 'result';
              return (
                <motion.button key={`${round}-${i}`} type="button" aria-label={`Star ${i + 1}`} data-testid="sg-star"
                  onPointerDown={e => { e.preventDefault(); tapStar(i); }}
                  initial={false}
                  animate={visible ? { scale: [0.4, 1.15, 1], opacity: 1 } : { scale: 0.8, opacity: 0.25 }}
                  transition={{ duration: 0.25 }}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full flex items-center justify-center border-4 ${
                    !visible ? 'border-dashed border-white/40 bg-white/5'
                      : mine ? 'border-amber-300 bg-amber-400/40'
                        : ow ? 'border-white/30 bg-white/15'
                          : mineTaps.includes(i) ? 'border-amber-200 bg-amber-200/20'
                            : 'border-yellow-200 bg-yellow-300/25 shadow-[0_0_24px_rgba(253,224,71,0.6)]'}`}>
                  <span className="text-6xl leading-none">{visible ? (ow ? ow.emoji : '⭐') : '☆'}</span>
                  {ow && <span className="absolute -bottom-7 font-nunito text-base whitespace-nowrap bg-black/50 rounded-full px-2">{mine ? 'You!' : ow.name}</span>}
                </motion.button>
              );
            })}
          </div>
        )}

        {cheering.length > 0 && (
          <div className="rounded-2xl bg-white/10 p-3 font-nunito text-lg text-center">
            📣 Cheering section: {cheering.map(p => `${p.emoji} ${p.name}`).join(' · ')}
          </div>
        )}
      </div>

      {phase === 'final' && view.ranked && (
        <FinalCard room={room} ranked={toRungs(view.ranked)} scores={view.scores ?? {}} reward={reward} />
      )}
    </ArenaFrame>
  );
}
