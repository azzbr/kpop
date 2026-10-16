// Teacher mode in a Friends Arena room. The teacher's device is always the host (useRoom ranks
// `role: 'teacher'` first) and keeps a small ClassState it broadcasts as `class_state`:
// "👀 Eyes on me" (every screen freezes), pause, Class Cup teams + points, the lesson playlist's
// "next up" countdown, and the end-of-lesson screen. Gold stars are sent to one player.
// Pause / resume / skip go to the running game as ARENA_CTL (see useHostGame).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMsg, RoomPlayer } from './useRoom';
import { SESSION_RESULT } from './useRoom';
import { ARENA_CTL } from './useHostGame';
import type { ArenaCtlOp } from './useHostGame';
import { assignTeams, addToTeams, cupPoints, addCup, lessonId } from './classLogic';
import { useGameStore, GOLD_STAR_MAX } from '../store';
import { localDateKey } from '../utils/dates';

export const CLASS_STATE = 'class_state';
export const GOLD_STAR = 'gold_star';

export interface PlaylistItem { game: string; config: Record<string, string> }

export interface ClassState {
  eyes: boolean;
  paused: boolean;
  /** Number of Class Cup teams (0 = no teams). */
  n: number;
  teams: Record<string, number>;
  cup: Record<number, number>;
  /** The playlist's next game and when it starts (ms from when this was sent). */
  next?: { game: string; ms: number };
  ended: boolean;
}

export const EMPTY_CLASS: ClassState = { eyes: false, paused: false, n: 0, teams: {}, cup: {}, ended: false };

/** Pause between games on a playlist: the final card, then the lobby scoreboard. */
export const NEXT_GAME_MS = 15000;
const LOBBY_MS = 6000;

interface Room { isHost: boolean; myId: string; code: string; players: RoomPlayer[]; send: (m: GameMsg) => void; onMessage: (h: (m: GameMsg) => void) => () => void }

export function useClassroom(room: Room, opts: { teacher: boolean; onStar: (from: string, paid: boolean) => void }) {
  const { isHost, myId, send, onMessage } = room;
  const isTeacherHost = isHost && opts.teacher;
  const [state, setState] = useState<ClassState>(EMPTY_CLASS);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const [running, setRunning] = useState(false);
  const runningRef = useRef(running);
  runningRef.current = running;
  const [starsGiven, setStarsGiven] = useState<Record<string, number>>({});
  const timers = useRef<number[]>([]);
  const playersRef = useRef(room.players);
  playersRef.current = room.players;
  const onStarRef = useRef(opts.onStar);
  onStarRef.current = opts.onStar;
  const lesson = lessonId(room.code, localDateKey());

  const publish = useCallback((next: ClassState) => {
    stateRef.current = next;
    setState(next);
    send({ t: CLASS_STATE, s: next as unknown as GameMsg[string] });
  }, [send]);
  const patch = useCallback((p: Partial<ClassState>) => publish({ ...stateRef.current, ...p }), [publish]);

  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);

  useEffect(() => onMessage((m) => {
    const from = playersRef.current.find(p => p.id === m.from);
    if (m.t === CLASS_STATE && m.from !== myId && from?.isHost) {
      setState(m.s as unknown as ClassState);
    } else if (m.t === ARENA_CTL && from?.isHost && (m.op === 'pause' || m.op === 'resume')) {
      // Everyone shows the paused banner; the teacher's device also saves it in the state.
      setState(s => ({ ...s, paused: m.op === 'pause' }));
    } else if (m.t === GOLD_STAR && m.to === myId && from?.role === 'teacher' && typeof m.lesson === 'string') {
      onStarRef.current(from.name, useGameStore.getState().receiveGoldStar(m.lesson));
    } else if (m.t === SESSION_RESULT && isTeacherHost) {
      const s = stateRef.current;
      const ranked = (m.ranked as (string | string[])[]) || [];
      const next: Partial<ClassState> = s.n ? { cup: addCup(s.cup, cupPoints(ranked, s.teams)) } : {};
      // Playlist: the next game starts by itself after a short break.
      const item = runningRef.current ? playlistRef.current[0] : undefined;
      if (item) {
        next.next = { game: item.game, ms: NEXT_GAME_MS };
        timers.current.push(window.setTimeout(() => send({ t: 'to_lobby' }), NEXT_GAME_MS - LOBBY_MS));
        timers.current.push(window.setTimeout(() => {
          setPlaylist(p => p.slice(1));
          if (playlistRef.current.length <= 1) setRunning(false);
          publish({ ...stateRef.current, next: undefined });
          send({ t: 'start', game: item.game, config: item.config });
        }, NEXT_GAME_MS));
      }
      patch(next);
    }
  }), [onMessage, myId, isTeacherHost, send, patch, publish]);

  // Teacher: newcomers get the current state (and a team).
  const ids = room.players.filter(p => p.role !== 'teacher').map(p => p.id).join(',');
  useEffect(() => {
    if (!isTeacherHost) return;
    const s = stateRef.current;
    const list = ids ? ids.split(',') : [];
    if (s.n && list.some(id => s.teams[id] === undefined)) patch({ teams: addToTeams(s.teams, list, s.n) });
    else publish(s);
  }, [ids, isTeacherHost, patch, publish]);

  const control = (op: ArenaCtlOp) => send({ t: ARENA_CTL, op });

  return {
    state,
    isTeacherHost,
    lesson,
    setEyes: (on: boolean) => patch({ eyes: on }),
    setTeams: (n: number) => {
      const list = playersRef.current.filter(p => p.role !== 'teacher').map(p => p.id);
      patch({ n, teams: n ? assignTeams(list, n) : {}, cup: {} });
    },
    pause: () => { control('pause'); patch({ paused: true }); },
    resume: () => { control('resume'); patch({ paused: false }); },
    skip: () => control('skip'),
    starsGiven,
    giveStar: (id: string) => {
      if ((starsGiven[id] ?? 0) >= GOLD_STAR_MAX) return false;
      setStarsGiven(g => ({ ...g, [id]: (g[id] ?? 0) + 1 }));
      send({ t: GOLD_STAR, to: id, lesson });
      return true;
    },
    playlist,
    running,
    queue: (item: PlaylistItem) => setPlaylist(p => (p.length >= 5 ? p : [...p, item])),
    unqueue: (i: number) => setPlaylist(p => p.filter((_, k) => k !== i)),
    /** Starts the first game; each next one starts by itself when a game ends. */
    startPlaylist: () => {
      const [first, ...rest] = playlistRef.current;
      if (!first) return;
      setPlaylist(rest);
      setRunning(rest.length > 0);
      send({ t: 'start', game: first.game, config: first.config });
    },
    stopPlaylist: () => { setRunning(false); timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; patch({ next: undefined }); },
    endLesson: () => patch({ ended: true, eyes: false }),
    closeEnd: () => (isTeacherHost ? patch({ ended: false }) : setState(s => ({ ...s, ended: false }))),
  };
}
