import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import { useRoom, SESSION_RESULT, savedRoom } from '../../online/useRoom';
import type { GameId, GameConfig, RoomApi, JoinResult } from '../../online/useRoom';
import { useClub } from '../../online/useClub';
import type { ClubMember } from '../../online/clubLogic';
import { safeName } from '../../online/names';
import { playClick, playUnlock, playWin, playNote, playPop } from '../../utils/sounds';
import OnlineCount from '../ui/OnlineCount';
import ClubPanel from './ClubPanel';
import TypeBox from './TypeBox';
import BalloonPop from './BalloonPop';
import { ReactionLayer, ReactionBar } from './Reactions';
import { useReactions } from '../../online/useReactions';
import { useClassroom } from '../../online/useClassroom';
import { GOLD_STAR_MAX } from '../../store';
import { ClassOverlays, TeacherBar, TeacherPanel, TeamDot, CupBoard } from './Classroom';
import { GAME_OPTIONS } from './arenaOptions';
// Each game is its own download, fetched when the host starts it (the hub stays small).
// They all take { room, config }.
type GameComp = React.ComponentType<{ room: RoomApi; config?: GameConfig }>;
const GAME_SCREENS: Partial<Record<GameId, React.LazyExoticComponent<GameComp>>> = {
  team_tug: lazy(() => import('./TeamTugOnline') as Promise<{ default: GameComp }>),
  world_tour: lazy(() => import('./WorldTourRace') as Promise<{ default: GameComp }>),
  quiz_party: lazy(() => import('./quiz/QuizParty') as Promise<{ default: GameComp }>),
  imposter: lazy(() => import('./Imposter') as Promise<{ default: GameComp }>),
  copy_cat: lazy(() => import('./CopyCat') as Promise<{ default: GameComp }>),
  tt_bingo: lazy(() => import('./TimesTableBingo') as Promise<{ default: GameComp }>),
  doodle_dash: lazy(() => import('./DoodleDash') as Promise<{ default: GameComp }>),
  penalty_duel: lazy(() => import('./PenaltyDuel') as Promise<{ default: GameComp }>),
  monopoly_deal: lazy(() => import('./PropertyDash') as Promise<{ default: GameComp }>),
  bluff_buster: lazy(() => import('./BluffBuster') as Promise<{ default: GameComp }>),
  category_blitz: lazy(() => import('./CategoryBlitz') as Promise<{ default: GameComp }>),
  word_chain: lazy(() => import('./WordChain') as Promise<{ default: GameComp }>),
  star_grab: lazy(() => import('./StarGrab') as Promise<{ default: GameComp }>),
  crowd_pleaser: lazy(() => import('./CrowdPleaser') as Promise<{ default: GameComp }>),
  rps_showdown: lazy(() => import('./RpsShowdown') as Promise<{ default: GameComp }>),
  fake_artist: lazy(() => import('./FakeArtist') as Promise<{ default: GameComp }>),
  quip_clash: lazy(() => import('./QuipClash') as Promise<{ default: GameComp }>),
  doodle_decoy: lazy(() => import('./DoodleDecoy') as Promise<{ default: GameComp }>),
  emoji_charades: lazy(() => import('./EmojiCharades') as Promise<{ default: GameComp }>),
  heads_up_party: lazy(() => import('./HeadsUpParty') as Promise<{ default: GameComp }>),
  monster_mash: lazy(() => import('./MonsterMash') as Promise<{ default: GameComp }>),
  spy_station: lazy(() => import('./SpyStation') as Promise<{ default: GameComp }>),
  emoji_detective: lazy(() => import('./EmojiDetective') as Promise<{ default: GameComp }>),
  word_scramble: lazy(() => import('./WordScramble') as Promise<{ default: GameComp }>),
  riddle_rush: lazy(() => import('./RiddleRush') as Promise<{ default: GameComp }>),
  picture_phone: lazy(() => import('./PictureTelephone') as Promise<{ default: GameComp }>),
  math_sprint: lazy(() => import('./MathSprint') as Promise<{ default: GameComp }>),
  code_breaker: lazy(() => import('./CodeBreaker') as Promise<{ default: GameComp }>),
  odd_one_out: lazy(() => import('./OddOneOut') as Promise<{ default: GameComp }>),
  whats_missing: lazy(() => import('./WhatsMissing') as Promise<{ default: GameComp }>),
  pattern_quest: lazy(() => import('./PatternQuest') as Promise<{ default: GameComp }>),
  memory_digits: lazy(() => import('./MemoryDigits') as Promise<{ default: GameComp }>),
  sudoku_mini: lazy(() => import('./SudokuMini') as Promise<{ default: GameComp }>),
  connect_four: lazy(() => import('./ConnectFour') as Promise<{ default: GameComp }>),
  make_24: lazy(() => import('./Make24') as Promise<{ default: GameComp }>),
  hangman: lazy(() => import('./Hangman') as Promise<{ default: GameComp }>),
  brain_buzzer: lazy(() => import('./BrainBuzzer') as Promise<{ default: GameComp }>),
  battleship: lazy(() => import('./Battleship') as Promise<{ default: GameComp }>),
  minesweeper: lazy(() => import('./Minesweeper') as Promise<{ default: GameComp }>),
  sliding_puzzle: lazy(() => import('./SlidingPuzzle') as Promise<{ default: GameComp }>),
  colour_clash: lazy(() => import('./ColourClash') as Promise<{ default: GameComp }>),
  dots_boxes: lazy(() => import('./DotsBoxes') as Promise<{ default: GameComp }>),
};

const EMOJIS = ['🎤', '🎸', '🥁', '🎹', '🎧', '🌟', '💖', '🔥', '🦄', '🐯', '🐰', '🦊'];

const GAMES: { id: GameId; icon: string; title: string; desc: string; min: number; max: number; tag: string; isNew?: boolean }[] = [
  { id: 'imposter', icon: '🤫', title: 'Imposter', desc: 'Everyone gets the secret word — except the imposter! Give clues, then vote out the bluffer.', min: 3, max: 12, tag: 'party!' },
  { id: 'quiz_party', icon: '🎉', title: 'Quiz Party', desc: 'Kahoot-style quiz on a big screen or everyone\'s iPad — Classic, Gold Quest, Racing & Cash Climb. Topics, school subjects or your own quiz!', min: 2, max: 40, tag: 'whole class!' },
  { id: 'quip_clash', icon: '🎤', title: 'Quip Clash', desc: 'Two friends answer the same funny prompt — everyone votes for the funniest. Get every vote for a QUIPLASH!', min: 3, max: 12, tag: 'new! party!', isNew: true },
  { id: 'spy_station', icon: '🕵️', title: 'Spy Station', desc: 'Everyone knows the secret place except the spy. Ask questions, answer carefully, then vote out the spy!', min: 4, max: 10, tag: 'new! party!', isNew: true },
  { id: 'emoji_charades', icon: '😀', title: 'Emoji Charades', desc: 'Say a secret phrase using only emoji — friends race to guess it. Hints unlock as the clock ticks!', min: 3, max: 20, tag: 'new! party!', isNew: true },
  { id: 'heads_up_party', icon: '🙆', title: 'Heads Up Party', desc: 'One guesser, everyone else acts it out! Tap ✅ or ⏭️ before time runs out. Solo or two teams — great for a classroom.', min: 3, max: 30, tag: 'new! class!', isNew: true },
  { id: 'doodle_decoy', icon: '🖼️', title: 'Doodle Decoy', desc: 'Draw your secret silly prompt — then everyone writes fake titles. Can you spot the real one?', min: 3, max: 8, tag: 'new! party!', isNew: true },
  { id: 'monster_mash', icon: '🧟', title: 'Monster Mash', desc: 'Everyone secretly draws one part — head, body, legs… then meet your silly monster and give it a name!', min: 3, max: 6, tag: 'new! draw together!', isNew: true },
  { id: 'bluff_buster', icon: '🤥', title: 'Bluff Buster', desc: 'A weird true fact with a gap — everyone types a fake answer, then spot the real one. Fool your friends for points!', min: 3, max: 12, tag: 'new! party!', isNew: true },
  { id: 'crowd_pleaser', icon: '🧑‍🤝‍🧑', title: 'Crowd Pleaser', desc: 'Would you rather…? Pick your side AND guess what most of the room picked!', min: 3, max: 30, tag: 'new! whole class!', isNew: true },
  { id: 'star_grab', icon: '⭐', title: 'Star Grab', desc: 'Musical chairs on screen! When the music stops, grab a star — one too few every round.', min: 3, max: 20, tag: 'new! party!', isNew: true },
  { id: 'category_blitz', icon: '🔠', title: 'Category Blitz', desc: 'One letter, five categories, 60 seconds. Answers nobody else thought of score double!', min: 2, max: 20, tag: 'new! brain game!', isNew: true },
  { id: 'word_chain', icon: '⛓️', title: 'Word Chain', desc: 'Take turns: your word must start with the last letter of the one before. Don’t run out of time!', min: 2, max: 10, tag: 'new! brain game!', isNew: true },
  { id: 'rps_showdown', icon: '✊', title: 'Rock Paper Scissors Showdown', desc: 'Everyone picks at once and plays everyone else. Best of 5 rounds — read the room!', min: 2, max: 30, tag: 'new! quick!', isNew: true },
  { id: 'doodle_dash', icon: '🎨', title: 'Doodle Dash', desc: 'One draws, everyone guesses — the doodle appears live on every screen!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'tt_bingo', icon: '🎱', title: 'Times-Table Bingo', desc: 'Solve the call, find it on your card — first full line shouts BINGO!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'copy_cat', icon: '🧠', title: 'Copy Cat', desc: 'Watch the pattern, repeat it perfectly. One slip = out. Last one standing wins!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'emoji_detective', icon: '🕵️', title: 'Emoji Detective', desc: 'Crack the emoji puzzle — 🦁👑, 🌧️🏹 — and race to type the answer first!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'word_scramble', icon: '🔤', title: 'Scramble Race', desc: 'The letters are jumbled — unscramble the word fastest to win the round!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'riddle_rush', icon: '🤔', title: 'Riddle Rush', desc: 'Solve the brain-teasing riddle and type your answer before your friends!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'picture_phone', icon: '✏️', title: 'Picture Telephone', desc: 'Draw → guess → draw! Turn the pages together, vote for the funniest moment, save your book.', min: 3, max: 12, tag: 'new! pass it on!', isNew: true },
  { id: 'math_sprint', icon: '➗', title: 'Math Sprint', desc: 'First to solve the sum wins the round! Six levels, from Easy to Legend.', min: 2, max: 30, tag: 'brain game!' },
  { id: 'code_breaker', icon: '🔢', title: 'Code Breaker', desc: 'Crack the secret colour code with logic clues — everyone races!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'odd_one_out', icon: '🔎', title: 'Odd One Out', desc: 'Four things appear — tap the one that doesn’t belong. Think fast!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'whats_missing', icon: '👀', title: 'What’s Missing?', desc: 'Memorise the tray, then spot which object vanished. Sharp eyes win!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'pattern_quest', icon: '📈', title: 'Pattern Quest', desc: 'What comes next? Spot the number pattern and type the next one. Logic power!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'memory_digits', icon: '💭', title: 'Memory Digits', desc: 'A number flashes up — memorise it and type it back. It grows every round!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'sudoku_mini', icon: '🔳', title: 'Sudoku Race', desc: 'Fill the grid with logic — no repeats in a row, column or box. First to solve wins!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'make_24', icon: '🧮', title: 'Make 24', desc: 'Combine the numbers with + − × ÷ to hit the target. Mega number puzzle!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'hangman', icon: '🔡', title: 'Hangman', desc: 'Guess the hidden word letter by letter before your lives run out. Race to reveal it!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'brain_buzzer', icon: '✅', title: 'True or False Race', desc: 'TRUE or FALSE? Tap fast on maths & trivia before the buzzer. Sharp minds win!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'minesweeper', icon: '💣', title: 'Minesweeper', desc: 'Use the number clues to dodge the hidden mines and clear the field first!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'sliding_puzzle', icon: '🧩', title: 'Sliding Puzzle', desc: 'Slide the jumbled tiles back into order. First to solve the puzzle wins!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'colour_clash', icon: '🌈', title: 'Colour Clash', desc: 'Tap the COLOUR of the word, not the word itself! Brain-bending and fast.', min: 2, max: 30, tag: 'brain game!' },
  { id: 'connect_four', icon: '♟️', title: 'Connect 4', desc: 'Line up four in a row before your rival blocks you. Classic strategy duel!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'battleship', icon: '🚢', title: 'Battleship', desc: 'Hide your fleet, then fire on the grid to sink your rival’s ships first. Deduction duel!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'dots_boxes', icon: '◻️', title: 'Dots & Boxes', desc: 'Draw lines, complete boxes to claim them and go again. Sneaky strategy!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'penalty_duel', icon: '⚽', title: 'Penalty Duel', desc: 'Shooter vs keeper — pick your corner and outsmart your rival in 5 penalties!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'team_tug', icon: '🪢', title: 'Team Tug & Rocket Race', desc: 'Mash to win! Team tug-of-war (up to 4 v 4), or everyone races a rocket to the moon.', min: 2, max: 30, tag: 'mash it!' },
  { id: 'world_tour', icon: '✈️', title: 'World Tour Tycoon', desc: 'Board race from Home Town around the world to London — buy venues, charge rent, dodge traps!', min: 2, max: 4, tag: '2–4 players' },
  { id: 'monopoly_deal', icon: '🃏', title: 'Property Dash', desc: 'The card game! Collect 3 full street sets — charge rent, pull sneaky swaps and say “No way!”', min: 2, max: 4, tag: '2–4 players' },
];


// Games that can take late joiners and survive a host change (they sync from a snapshot).
const LATE_JOIN_GAMES: GameId[] = ['quiz_party', 'imposter'];

type HubScreen = 'menu' | 'join' | 'lobby';

const JOIN_ERRORS: Record<Exclude<JoinResult, 'ok'>, string> = {
  not_found: 'Room not found — check the code! 🔍',
  error: 'Could not connect — check your internet and try again!',
  locked: 'This room is locked 🔒 — ask the host to let you in from your club!',
  removed: 'The host has started a new group — find another room! 🙂',
};

const panel = 'bg-white/10 rounded-3xl p-5 border border-white/20';

const OnlineHub: React.FC = () => {
  const setGameState = useGameStore(s => s.setGameState);
  const storeName = useGameStore(s => s.userName);
  const setUserName = useGameStore(s => s.setUserName);
  const clubs = useGameStore(s => s.clubs);
  const joinClub = useGameStore(s => s.joinClub);
  const leaveClub = useGameStore(s => s.leaveClub);
  const teacher = useGameStore(s => (s.teacherOn ? s.teacher : null));
  const room = useRoom();
  const [screen, setScreen] = useState<HubScreen>('menu');
  const [name, setName] = useState(() => (teacher ? teacher.name : safeName(storeName)));
  const [editingName, setEditingName] = useState(false);
  const [emoji, setEmoji] = useState(() => (teacher ? '🍎' : useGameStore.getState().equipped.avatar || '🎤'));
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  const role = teacher ? ('teacher' as const) : undefined;
  const me = { name: name || 'Player', emoji, role };
  // After a refresh, start straight back in the game this tab was playing (read synchronously,
  // before the effect below would clear it).
  const [restored] = useState<{ game: GameId; config: GameConfig } | null>(() => {
    try { return savedRoom() ? JSON.parse(sessionStorage.getItem('kpop_active_game') || 'null') : null; } catch { return null; }
  });
  // Only games that can resync from the host (LATE_JOIN_GAMES) reopen after a refresh. For the
  // rest this device waits in the lobby for the next game (a refreshed host ends the game).
  const canResume = !!restored && LATE_JOIN_GAMES.includes(restored.game);
  const [activeGame, setActiveGame] = useState<GameId | null>(canResume ? restored!.game : null);
  const [waitingFor, setWaitingFor] = useState<GameId | null>(restored && !canResume ? restored.game : null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [selGame, setSelGame] = useState<GameId>('quiz_party');
  const [opts, setOpts] = useState<Record<string, string>>({});
  const [gameConfig, setGameConfig] = useState<GameConfig>(restored?.config ?? {});
  // Session leaderboard across games played in this room: 3/2/1 points for 1st/2nd/3rd.
  const [session, setSession] = useState<Record<string, { pts: number; wins: number }>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(cur => (cur === t ? null : cur)), 4000);
  };

  // ---- Joining (by code, by a club knock being answered, or by an invite) ----
  const joinCode = async (code: string): Promise<string | null> => {
    if (busy) return null;
    setBusy(true);
    setJoinError('');
    playClick();
    if (room.status !== 'idle') room.leaveRoom();
    const r = await room.joinRoom(code, me);
    setBusy(false);
    if (r === 'ok') {
      playWin();
      setScreen('lobby');
      return null;
    }
    setScreen(s => (s === 'lobby' ? 'menu' : s));
    return JOIN_ERRORS[r];
  };

  // ---- Club ----
  const [activeClub, setActiveClub] = useState<string | null>(null);
  const club = clubs.find(c => c.code === activeClub) ?? clubs[0] ?? null;
  const inRoom = room.status === 'lobby';
  const clubMe = useMemo(() => ({
    name: me.name,
    emoji,
    status: (activeGame && inRoom ? 'playing' : inRoom ? 'lobby' : 'menu') as ClubMember['status'],
    ...(inRoom && room.code ? { room: { code: room.code, game: activeGame ?? undefined, players: room.players.length, host: room.isHost, locked: room.meta.locked } } : {}),
    ...(role ? { role } : {}),
  }), [me.name, emoji, activeGame, inRoom, room.code, room.players.length, room.isHost, room.meta.locked, role]);
  const clubApi = useClub(name ? club?.code ?? null : null, clubMe, {
    onAdmit: (code) => { showToast('✅ You\'re in! Joining…'); joinCode(code).then(err => err && showToast(err)); },
    onDeny: () => showToast('Not right now — try another room! 🙂'),
  });
  const [pending, setPending] = useState<Record<string, 'knock' | 'invite'>>({});
  const markPending = (id: string, kind: 'knock' | 'invite') => {
    setPending(p => ({ ...p, [id]: kind }));
    window.setTimeout(() => setPending(p => { const n = { ...p }; delete n[id]; return n; }), 15000);
  };
  const knock = (m: ClubMember) => {
    if (!clubApi.knock(m)) return false;
    markPending(m.id, 'knock');
    showToast(`🙋 Asked ${m.name} to let you in…`);
    return true;
  };
  const invite = (m: ClubMember) => {
    if (!room.code || !clubApi.invite(m, activeGame ?? undefined)) return false;
    room.allowPlayer(m.id);
    markPending(m.id, 'invite');
    showToast(`✉️ Invited ${m.name}!`);
    return true;
  };

  // ---- Surviving refreshes / sleeping iPads ----
  // The running game is remembered per tab so a refresh drops you back into it.
  const ACTIVE_KEY = 'kpop_active_game';
  useEffect(() => {
    try {
      if (activeGame) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ game: activeGame, config: gameConfig }));
      else sessionStorage.removeItem(ACTIVE_KEY);
    } catch { /* ignore */ }
  }, [activeGame, gameConfig]);

  // On mount: if this tab was in a room, go straight back in.
  const rejoined = useRef(false);
  useEffect(() => {
    if (rejoined.current || !savedRoom()) return;
    rejoined.current = true;
    setScreen('lobby');
    setBusy(true);
    room.rejoin(role).then((r) => {
      setBusy(false);
      if (r !== 'ok') {
        setScreen('menu'); setActiveGame(null); setWaitingFor(null);
        setJoinError(r === 'locked' || r === 'removed' ? JOIN_ERRORS[r] : 'That room has closed — make a new one!');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A refreshed host can't rebuild a game that isn't resumable: end it for everyone.
  const endedStale = useRef(false);
  useEffect(() => {
    if (endedStale.current || !waitingFor || room.status !== 'lobby' || !room.hostId) return;
    endedStale.current = true;
    if (room.isHost) { room.send({ t: 'to_lobby' }); setWaitingFor(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, room.hostId, room.isHost, waitingFor]);

  // A new host took over (the old one left, or passed the crown). Games that can't move to a new
  // host send everyone back to the lobby; Quiz Party ends itself with the latest standings.
  const prevHost = useRef<string | null>(null);
  const [hostChanged, setHostChanged] = useState(false);
  useEffect(() => {
    const before = prevHost.current;
    prevHost.current = room.hostId;
    if (!before || !room.hostId || before === room.hostId) return;
    // When presence arrives out of order a device can briefly think it's the host before the
    // real (earlier-joined) host shows up. A crown passed on, or a teacher arriving, is real.
    const newHost = room.players.find(p => p.id === room.hostId);
    if (room.players.some(p => p.id === before) && !newHost?.role && !passed.current) return;
    passed.current = false;
    setHostChanged(true);
    window.setTimeout(() => setHostChanged(false), 5000);
    if (room.isHost && activeGame && !LATE_JOIN_GAMES.includes(activeGame)) room.send({ t: 'to_lobby' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.hostId]);
  const passed = useRef(false);

  // Route lobby-level messages (game start / return to lobby)
  useEffect(() => {
    return room.onMessage((m) => {
      if (m.t === 'start') {
        setWaitingFor(null);
        setActiveGame(prev => {
          if (prev !== m.game) playUnlock();
          return m.game as GameId;
        });
        setGameConfig((m.config as GameConfig) || {});
      } else if (m.t === 'to_lobby') {
        setActiveGame(null);
        setWaitingFor(null);
      } else if (m.t === 'room_host') {
        passed.current = true;
      } else if (m.t === SESSION_RESULT) {
        // Best first; an entry can be a rung of tied players, who share that place's points.
        const ranked = ((m.ranked as (string | string[])[]) || []).map(r => (Array.isArray(r) ? r : [r]));
        setSession(prev => {
          const next = { ...prev };
          ranked.slice(0, 3).forEach((rung, i) => {
            for (const id of rung) {
              const cur = next[id] ?? { pts: 0, wins: 0 };
              next[id] = { pts: cur.pts + 3 - i, wins: cur.wins + (i === 0 ? 1 : 0) };
            }
          });
          return next;
        });
      }
    });
    // Only re-subscribe if the room's message bus changes (room itself is a new object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.onMessage]);

  // Late joiners: games that can sync mid-game get the start message re-sent when someone
  // new arrives, so their device opens the game too (see LATE_JOIN_GAMES).
  const playerIds = room.players.map(p => p.id).join(',');
  useEffect(() => {
    if (room.isHost && activeGame && LATE_JOIN_GAMES.includes(activeGame)) {
      room.send({ t: 'start', game: activeGame, config: gameConfig });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerIds]);

  // A friendly "ding" when someone arrives in the room.
  const prevCount = useRef(0);
  useEffect(() => {
    const n = room.players.length;
    if (inRoom && prevCount.current && n > prevCount.current) { playNote(660, 0.12); window.setTimeout(() => playNote(880, 0.18), 120); }
    prevCount.current = n;
  }, [room.players.length, inRoom]);

  const reactions = useReactions({ myId: room.myId, players: room.players, send: room.send, onMessage: room.onMessage });
  const cls = useClassroom({ isHost: room.isHost, myId: room.myId, code: room.code || '', players: room.players, send: room.send, onMessage: room.onMessage }, {
    teacher: !!teacher,
    onStar: (from, paid) => { playUnlock(); showToast(paid ? `⭐ ${from} gave you a gold star! +5 🪙` : `⭐ ${from} gave you a gold star!`); },
  });
  const teacherName = room.players.find(p => p.role === 'teacher')?.name ?? teacher?.name ?? 'your teacher';

  const selectGame = (g: GameId) => {
    playClick();
    setSelGame(g);
    setOpts({});
  };

  const buildConfig = (g: GameId): GameConfig => {
    const cfg: GameConfig = {};
    for (const grp of GAME_OPTIONS[g] || []) cfg[grp.key] = opts[grp.key] ?? grp.choices[0].value;
    return cfg;
  };

  const exitHub = () => {
    playClick();
    room.leaveRoom();
    setGameState('game_mode');
  };

  const leaveToMenu = () => {
    playClick();
    room.leaveRoom();
    setActiveGame(null);
    setScreen('menu');
  };

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    setJoinError('');
    playClick();
    const c = await room.createRoom(me);
    setBusy(false);
    if (c) {
      playWin();
      setScreen('lobby');
    } else {
      setJoinError('Could not connect — check your internet and try again!');
    }
  };

  const saveName = (t: string) => {
    const n = safeName(t);
    if (!n) return "Let's pick a different name 🙂 (first names only)";
    setName(n);
    if (!teacher) setUserName(n);
    setEditingName(false);
    playPop();
    return null;
  };

  const startGame = () => {
    playClick();
    room.send({ t: 'start', game: selGame, config: buildConfig(selGame) });
  };

  const playerCount = room.players.length;
  const canStart = (g: GameId) => {
    const def = GAMES.find((x) => x.id === g)!;
    // On a big screen the host only watches.
    const n = g === selGame && buildConfig(g).board === '1' ? playerCount - 1 : playerCount;
    return n >= def.min && n <= def.max;
  };
  const gameTitle = (id?: string) => GAMES.find(g => g.id === id)?.title;

  const api: RoomApi = {
    code: room.code || '',
    players: room.players,
    isHost: room.isHost,
    myId: room.myId,
    send: room.send,
    onMessage: room.onMessage,
    reportResult: room.reportResult,
  };

  const hostName = room.players.find(p => p.isHost)?.name ?? 'Someone';
  const knocks = clubApi.knocks.filter(k => k.room === room.code);
  const banner = (key: string, cls: string, text: string) => (
    <motion.div key={key} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3 pointer-events-none">
      <div className={`rounded-full font-fredoka text-lg px-5 py-2 shadow-xl ${cls}`} role="status">{text}</div>
    </motion.div>
  );
  // Banners and club requests, shown in the lobby and during games.
  const statusOverlay = (
    <>
      <ReactionLayer floaters={reactions.floaters} />
      {inRoom && <ClassOverlays cls={cls} teacherName={teacherName} gameTitle={gameTitle} session={session} players={room.players} />}
      <AnimatePresence>
        {room.hostAway && banner('away', 'bg-amber-500 text-stone-900', '⏳ The host is reconnecting… hang on!')}
        {hostChanged && !room.hostAway && banner('new', 'bg-emerald-500 text-white', room.isHost ? "👑 You're the host now!" : `👑 ${hostName} is the host now`)}
        {toast && !hostChanged && !room.hostAway && banner('toast', 'bg-indigo-500 text-white', toast)}
      </AnimatePresence>
      <div className="fixed z-[65] inset-x-0 flex flex-col items-center gap-2 px-3 pointer-events-none" style={{ top: 'max(4.5rem, env(safe-area-inset-top))' }}>
        {room.isHost && knocks.map(k => (
          <motion.div key={k.from} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-3xl bg-white text-stone-900 shadow-2xl px-4 py-3" role="alertdialog" aria-label={`${k.name} wants to join`}>
            <span className="font-fredoka text-xl">{k.emoji} {k.name} wants to join!</span>
            <button type="button" className="min-h-[48px] px-4 rounded-full bg-emerald-500 text-white font-fredoka text-lg"
              onClick={() => { playClick(); room.allowPlayer(k.from); clubApi.answerKnock(k, true); }}>✅ Let in</button>
            <button type="button" className="min-h-[48px] px-4 rounded-full bg-stone-200 font-fredoka text-lg"
              onClick={() => { playClick(); clubApi.answerKnock(k, false); }}>❌ Not now</button>
          </motion.div>
        ))}
        {!inRoom && clubApi.invites.map(i => (
          <motion.div key={i.from} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-3xl bg-white text-stone-900 shadow-2xl px-4 py-3" role="alertdialog" aria-label={`${i.name} invites you`}>
            <span className="font-fredoka text-xl">{i.emoji} {i.name} invites you{i.game && gameTitle(i.game) ? ` to play ${gameTitle(i.game)}` : ''}!</span>
            <button type="button" className="min-h-[48px] px-4 rounded-full bg-emerald-500 text-white font-fredoka text-lg"
              onClick={() => { clubApi.dismissInvite(i); joinCode(i.room).then(err => err && showToast(err)); }}>🚀 Join</button>
            <button type="button" className="min-h-[48px] px-4 rounded-full bg-stone-200 font-fredoka text-lg"
              onClick={() => { playClick(); clubApi.dismissInvite(i); }}>No thanks</button>
          </motion.div>
        ))}
      </div>
    </>
  );

  // Active game takes over the whole screen
  const GameScreen = activeGame ? GAME_SCREENS[activeGame] : undefined;
  if (activeGame && inRoom) {
    return (
      <div className="relative">
        {statusOverlay}
        {GameScreen && (
          <Suspense fallback={<div className="min-h-screen-d arcade-bg flex items-center justify-center text-white font-fredoka text-2xl">Loading the game… 🎮</div>}>
            <GameScreen room={api} config={gameConfig} />
          </Suspense>
        )}
        <ReactionBar react={reactions.react} compact />
        <TeacherBar cls={cls} />
        <button
          onClick={() => {
            if (confirmLeave) { setConfirmLeave(false); leaveToMenu(); return; }
            playClick();
            setConfirmLeave(true);
            window.setTimeout(() => setConfirmLeave(false), 3000);
          }}
          className={`fixed z-50 min-h-[48px] px-4 rounded-full font-fredoka text-base text-white shadow-lg ${confirmLeave ? 'bg-red-600' : 'bg-black/50'}`}
          style={{ top: 'max(8px, env(safe-area-inset-top))', right: 'max(8px, env(safe-area-inset-right))' }}
        >
          {confirmLeave ? 'Tap again to leave' : '✖ Leave'}
        </button>
      </div>
    );
  }

  const needName = !name || editingName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen-d bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-950 text-white px-4"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <button
        onClick={screen === 'lobby' ? leaveToMenu : screen === 'join' ? () => { playClick(); setScreen('menu'); } : exitHub}
        className="absolute left-4 bg-white/10 hover:bg-white/20 rounded-full px-5 min-h-[48px] font-fredoka text-lg z-20"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        ← {screen === 'lobby' ? 'Exit room' : 'Back'}
      </button>

      <div className="max-w-3xl mx-auto pt-14">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-5xl mb-1">🌐 Friends Arena</h1>
        <p className="text-center font-nunito text-lg text-teal-200 mb-3">Play together — every player on their own device!</p>
        <div className="flex justify-center mb-6"><OnlineCount rooms /></div>

        {screen !== 'lobby' && needName && (
          <div className="max-w-xl mx-auto mb-6">
            <TypeBox label={name ? '✨ Change your name' : '✨ What should friends call you? (first name)'} initial={name} placeholder="Your name" max={12} space
              onDone={saveName} onCancel={name ? () => setEditingName(false) : undefined} />
          </div>
        )}

        {screen === 'menu' && !needName && (
          <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid gap-5">
            <div className={`${panel} flex flex-wrap items-center gap-3`}>
              <span className="text-4xl">{emoji}</span>
              <div className="flex-1 min-w-[8rem]">
                <div className="font-nunito text-base text-teal-200">Playing as</div>
                <div className="font-fredoka text-2xl">{name}{teacher && ' 🍎'}</div>
              </div>
              {!teacher && (
                <button type="button" onClick={() => { playClick(); setEditingName(true); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">✏️ Change name</button>
              )}
              <div className="w-full grid grid-cols-6 sm:grid-cols-12 gap-2">
                {Array.from(new Set([useGameStore.getState().equipped.avatar, ...EMOJIS])).map((e) => (
                  <button key={e} type="button" aria-label={`Avatar ${e}`} onClick={() => { playClick(); setEmoji(e); }}
                    className={`min-h-[48px] text-2xl md:text-3xl rounded-2xl transition-all ${emoji === e ? 'bg-amber-400/90 scale-110 shadow-lg' : 'bg-white/10'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            {joinError && (
              <div className="bg-red-500/20 border border-red-400 rounded-2xl p-3 font-nunito text-lg text-red-100 text-center" role="alert">{joinError}</div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreate} disabled={busy}
                className="rounded-3xl p-6 bg-gradient-to-br from-emerald-400 to-teal-600 shadow-2xl text-left">
                <div className="text-4xl mb-2">👑</div>
                <div className="font-fredoka font-bold text-2xl">{busy ? 'Connecting… 📡' : 'Create a Room'}</div>
                <div className="font-nunito text-lg text-emerald-100">{clubs.length ? 'Club friends will see it — or share the code!' : 'Get a 4-letter code to share with friends!'}</div>
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => { playClick(); setJoinError(''); setScreen('join'); }}
                className="rounded-3xl p-6 bg-gradient-to-br from-cyan-400 to-blue-600 shadow-2xl text-left">
                <div className="text-4xl mb-2">🎟️</div>
                <div className="font-fredoka font-bold text-2xl">Join with a code</div>
                <div className="font-nunito text-lg text-cyan-100">Type the code your friend shared!</div>
              </motion.button>
            </div>
            <ClubPanel clubs={clubs} active={club} setActive={setActiveClub} onJoinClub={(c) => { joinClub(c); setActiveClub(c.code); }}
              onLeaveClub={(code) => { leaveClub(code); setActiveClub(null); }}
              members={clubApi.members} connected={clubApi.connected} gameTitle={gameTitle} myRoom={null} isHost={false}
              onKnock={knock} onInvite={invite} pending={pending} />
          </motion.div>
        )}

        {screen === 'join' && !needName && (
          <div className="max-w-xl mx-auto">
            <TypeBox label="🎟️ Room code" placeholder="ABCD" max={4} code enterLabel="🚀 Join"
              onDone={async (t) => (t.length !== 4 ? 'Room codes have 4 letters' : joinCode(t))}
              onCancel={() => setScreen('menu')} />
          </div>
        )}

        {statusOverlay}
        {screen === 'lobby' && room.status === 'connecting' && (
          <div className="text-center font-fredoka text-2xl py-10">📡 Getting you into the room…</div>
        )}
        {screen === 'lobby' && inRoom && (
          <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {waitingFor && !room.isHost && (
              <div className="rounded-3xl bg-amber-400/90 text-stone-900 p-5 mb-6 text-center font-fredoka text-xl" role="status">
                👀 A game of {GAMES.find(g => g.id === waitingFor)?.title ?? 'something fun'} is still going — you'll join the next one!
              </div>
            )}
            <div className={`${panel} mb-6 text-center`}>
              <div className="font-nunito text-lg text-teal-200 mb-1">{clubs.length ? 'Club friends can ask to join — or share the code:' : 'Tell your friends to join with code:'}</div>
              <div className="font-fredoka font-bold text-5xl md:text-7xl tracking-[0.35em] text-amber-300 select-all">
                {room.code}
              </div>
              {room.isHost && (
                <button type="button" onClick={() => { playClick(); room.setLocked(!room.meta.locked); }}
                  className={`mt-3 min-h-[48px] px-5 rounded-full font-fredoka text-lg ${room.meta.locked ? 'bg-amber-400 text-stone-900' : 'bg-white/15'}`}>
                  {room.meta.locked ? '🔒 Locked — only people you let in' : '🔓 Open — tap to lock the room'}
                </button>
              )}
              {!room.isHost && room.meta.locked && <div className="mt-2 font-nunito text-lg text-amber-200">🔒 The host locked this room</div>}
            </div>

            <div className={`${panel} mb-6`}>
              <div className="font-fredoka text-lg mb-3">
                👥 Players in the room ({playerCount})
              </div>
              <div className="flex flex-wrap gap-2">
                {room.players.map((p) => (
                  <motion.button
                    type="button"
                    key={p.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    disabled={!room.isHost || p.id === room.myId}
                    onClick={() => { playClick(); setPicked(x => (x === p.id ? null : p.id)); setConfirmRemove(null); }}
                    className={`flex items-center gap-2 rounded-full px-4 min-h-[48px] font-nunito text-lg ${p.id === room.myId ? 'bg-amber-400/30 border border-amber-300' : picked === p.id ? 'bg-white/25 border border-white' : 'bg-white/10'}`}
                  >
                    <span className="text-xl">{p.emoji}</span>
                    <span className="font-bold">{p.name}</span>
                    <TeamDot cls={cls} id={p.id} />
                    {p.role === 'teacher' && <span title="Teacher">🍎</span>}
                    {p.isHost && <span title="Host">👑</span>}
                  </motion.button>
                ))}
              </div>
              {room.isHost && picked && room.players.some(p => p.id === picked) && (() => {
                const p = room.players.find(x => x.id === picked)!;
                return (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-black/20 p-3">
                    <span className="font-fredoka text-lg mr-2">{p.emoji} {p.name}:</span>
                    {cls.isTeacherHost && (
                      <button type="button" disabled={(cls.starsGiven[p.id] ?? 0) >= GOLD_STAR_MAX}
                        onClick={() => { if (cls.giveStar(p.id)) { playUnlock(); showToast(`⭐ Gold star for ${p.name}!`); } }}
                        className="min-h-[48px] px-4 rounded-full bg-yellow-400 text-stone-900 font-fredoka text-lg disabled:opacity-40">
                        ⭐ Gold star ({cls.starsGiven[p.id] ?? 0}/{GOLD_STAR_MAX})
                      </button>
                    )}
                    {!teacher && (
                      <button type="button" onClick={() => { playClick(); passed.current = true; room.passHost(p.id); setPicked(null); }}
                        className="min-h-[48px] px-4 rounded-full bg-amber-400 text-stone-900 font-fredoka text-lg">👑 Make host</button>
                    )}
                    <button type="button" onClick={() => {
                      if (confirmRemove === p.id) { room.removePlayer(p.id); setPicked(null); setConfirmRemove(null); showToast(`${p.name} has left the room`); return; }
                      playClick(); setConfirmRemove(p.id);
                    }} className={`min-h-[48px] px-4 rounded-full font-fredoka text-lg ${confirmRemove === p.id ? 'bg-red-600' : 'bg-white/15'}`}>
                      {confirmRemove === p.id ? 'Tap again to remove' : '🚪 Remove from room'}
                    </button>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-center mb-6"><ReactionBar react={reactions.react} /></div>
            {clubs.length > 0 && (
              <div className="mb-6">
              <ClubPanel clubs={clubs} active={club} setActive={setActiveClub} onJoinClub={(c) => { joinClub(c); setActiveClub(c.code); }}
                onLeaveClub={(code) => { leaveClub(code); setActiveClub(null); }}
                members={clubApi.members} connected={clubApi.connected} gameTitle={gameTitle} myRoom={room.code} isHost={room.isHost}
                onKnock={knock} onInvite={invite} pending={pending} />
              </div>
            )}

            {Object.keys(session).length > 0 && (
              <div className={`${panel} mb-6`}>
                <div className="font-fredoka text-lg mb-2">🏆 Tonight's leaderboard</div>
                {Object.entries(session)
                  .sort((a, b) => b[1].pts - a[1].pts)
                  .map(([id, v], i) => {
                    const p = room.players.find(x => x.id === id);
                    if (!p) return null;
                    return (
                      <div key={id} className={`flex items-center gap-3 font-fredoka text-lg ${id === room.myId ? 'text-amber-300' : ''}`}>
                        <span className="w-6">{i + 1}.</span>
                        <span className="flex-1">{p.emoji} {p.name}</span>
                        <span className="text-base font-nunito text-teal-200">{v.wins} 🥇</span>
                        <span>{v.pts} pts</span>
                      </div>
                    );
                  })}
                <div className="font-nunito text-base text-teal-300 mt-1">3 points for 1st, 2 for 2nd, 1 for 3rd in each game.</div>
              </div>
            )}

            {cls.isTeacherHost && (
              <TeacherPanel cls={cls} gameTitle={gameTitle} selectedTitle={gameTitle(selGame) ?? 'game'}
                onQueueSelected={() => cls.queue({ game: selGame, config: buildConfig(selGame) })} />
            )}
            {!cls.isTeacherHost && cls.state.n > 0 && <div className="mb-6"><CupBoard cls={cls} /></div>}

            {room.isHost ? (
              <>
                <div className="font-fredoka text-lg mb-3">🎮 Pick a game:</div>
                <div className="grid md:grid-cols-2 gap-3 mb-6">
                  {GAMES.map((g) => {
                    const ok = canStart(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() => selectGame(g.id)}
                        className={`text-left rounded-3xl p-4 border-2 transition-all ${
                          selGame === g.id ? 'border-amber-400 bg-amber-400/15 shadow-lg' : 'border-white/15 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-fredoka font-bold text-lg">
                            {g.icon} {g.title}
                            {g.isNew && <span className="ml-2 align-middle rounded-full bg-fuchsia-500 px-2 py-0.5 font-fredoka text-xs text-white">NEW</span>}
                          </span>
                          <span className={`text-sm font-nunito rounded-full px-2 py-0.5 ${ok ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-teal-300'}`}>
                            {g.tag.replace(/^new! /, '')}
                          </span>
                        </div>
                        <div className="font-nunito text-base text-teal-100">{g.desc}</div>
                        {!ok && (
                          <div className="font-nunito text-base text-amber-300 mt-1">
                            Needs {g.min}–{g.max} players (you have {playerCount})
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {(GAME_OPTIONS[selGame] || []).map((grp) => (
                  <div key={grp.key} className="mb-5">
                    <div className="font-fredoka text-base text-teal-200 mb-2">⚙️ {grp.label}:</div>
                    <div className="flex flex-wrap gap-2">
                      {grp.choices.map((ch) => {
                        const active = (opts[grp.key] ?? grp.choices[0].value) === ch.value;
                        return (
                          <button
                            key={ch.value}
                            onClick={() => { playClick(); setOpts((o) => ({ ...o, [grp.key]: ch.value })); }}
                            className={`px-4 min-h-[44px] rounded-full font-fredoka text-base border-2 transition-all ${
                              active ? 'bg-amber-400/25 border-amber-400 text-amber-100' : 'bg-white/5 border-white/15 text-teal-100 hover:bg-white/10'
                            }`}
                          >
                            {ch.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <motion.button
                  whileTap={{ scale: canStart(selGame) ? 0.96 : 1 }}
                  onClick={startGame}
                  disabled={!canStart(selGame)}
                  className={`w-full py-4 mb-6 rounded-full font-fredoka font-bold text-xl shadow-xl ${
                    canStart(selGame) ? 'bg-gradient-to-r from-amber-400 to-pink-500' : 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  ⚡ START {GAMES.find((g) => g.id === selGame)!.title.toUpperCase()}! ⚡
                </motion.button>
              </>
            ) : (
              <div className={`${panel} text-center mb-6`}>
                <div className="font-fredoka text-xl">⏳ Waiting for the host to start a game…</div>
                <div className="font-nunito text-lg text-teal-200 mt-1 mb-4">Stay ready, superstar!</div>
                <BalloonPop />
              </div>
            )}

          </motion.div>
        )}
      </div>

      {/* Turned away or removed */}
      <AnimatePresence>
        {room.status === 'closed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          >
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm mx-4" role="alertdialog">
              <div className="text-6xl mb-3">{room.closedReason === 'locked' ? '🔒' : '🙂'}</div>
              <h2 className="font-fredoka font-bold text-2xl mb-2">{room.closedReason === 'locked' ? 'This room is locked' : 'Time for a new room!'}</h2>
              <p className="font-nunito text-lg text-slate-300 mb-6">
                {room.closedReason === 'locked' ? 'Ask the host to let you in from your club, or make your own room!' : 'The host has started a new group — find another room or make your own!'}
              </p>
              <button
                onClick={leaveToMenu}
                className="px-8 min-h-[52px] rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
              >
                OK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default OnlineHub;
