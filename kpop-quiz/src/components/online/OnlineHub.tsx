import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import { useRoom } from '../../online/useRoom';
import type { GameId, GameConfig, RoomApi } from '../../online/useRoom';
import { playClick, playUnlock, playWin } from '../../utils/sounds';
import QuizDuelOnline from './QuizDuelOnline';
import TeamTugOnline from './TeamTugOnline';
import WorldTourRace from './WorldTourRace';
import ClassQuizShow from './ClassQuizShow';
import RocketTapRace from './RocketTapRace';
import CopyCat from './CopyCat';
import TimesTableBingo from './TimesTableBingo';
import DoodleDash from './DoodleDash';
import PenaltyDuel from './PenaltyDuel';
import MonopolyDeal from './MonopolyDeal';
import EmojiDetective from './EmojiDetective';
import WordScramble from './WordScramble';
import RiddleRush from './RiddleRush';
import PictureTelephone from './PictureTelephone';
import MathSprint from './MathSprint';
import CodeBreaker from './CodeBreaker';
import OddOneOut from './OddOneOut';
import WhatsMissing from './WhatsMissing';
import PatternQuest from './PatternQuest';
import ConnectFour from './ConnectFour';
import MemoryDigits from './MemoryDigits';
import SudokuMini from './SudokuMini';
import Battleship from './Battleship';
import Make24 from './Make24';
import Hangman from './Hangman';
import BrainBuzzer from './BrainBuzzer';
import Minesweeper from './Minesweeper';
import DotsBoxes from './DotsBoxes';
import ColourClash from './ColourClash';
import SlidingPuzzle from './SlidingPuzzle';

const EMOJIS = ['🎤', '🎸', '🥁', '🎹', '🎧', '🌟', '💖', '🔥', '🦄', '🐯', '🐰', '🦊'];

const GAMES: { id: GameId; icon: string; title: string; desc: string; min: number; max: number; tag: string }[] = [
  { id: 'class_show', icon: '🎤', title: 'Class Quiz Show', desc: 'Pick a subject — Maths, Science, English & more. Everyone answers on their device!', min: 2, max: 31, tag: 'whole class!' },
  { id: 'doodle_dash', icon: '🎨', title: 'Doodle Dash', desc: 'One draws, everyone guesses — the doodle appears live on every screen!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'tt_bingo', icon: '🔢', title: 'Times-Table Bingo', desc: 'Solve the call, find it on your card — first full line shouts BINGO!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'rocket_race', icon: '🚀', title: 'Rocket Tap Race', desc: 'Mash to blast off! Every rocket races on screen — first to the moon!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'copy_cat', icon: '🧠', title: 'Copy Cat', desc: 'Watch the pattern, repeat it perfectly. One slip = out. Last one standing wins!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'emoji_detective', icon: '🕵️', title: 'Emoji Detective', desc: 'Crack the emoji puzzle — 🦁👑, 🌧️🏹 — and race to type the answer first!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'word_scramble', icon: '🔤', title: 'Word Scramble', desc: 'The letters are jumbled — unscramble the word fastest to win the round!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'riddle_rush', icon: '🧩', title: 'Riddle Rush', desc: 'Solve the brain-teasing riddle and type your answer before your friends!', min: 2, max: 30, tag: 'whole class!' },
  { id: 'picture_phone', icon: '✏️', title: 'Picture Telephone', desc: 'Draw → guess → draw! Your word travels the room, then the silly reveal!', min: 3, max: 12, tag: 'pass it on!' },
  { id: 'math_sprint', icon: '➗', title: 'Math Sprint', desc: 'First to solve the sum wins the round! Pick Easy, Medium or Hard.', min: 2, max: 30, tag: 'brain game!' },
  { id: 'code_breaker', icon: '🔢', title: 'Code Breaker', desc: 'Crack the secret colour code with logic clues — everyone races!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'odd_one_out', icon: '🔎', title: 'Odd One Out', desc: 'Four things appear — tap the one that doesn’t belong. Think fast!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'whats_missing', icon: '🧠', title: 'What’s Missing?', desc: 'Memorise the tray, then spot which object vanished. Sharp eyes win!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'pattern_quest', icon: '🔢', title: 'Pattern Quest', desc: 'What comes next? Spot the number pattern and type the next one. Logic power!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'memory_digits', icon: '🧠', title: 'Memory Digits', desc: 'A number flashes up — memorise it and type it back. It grows every round!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'sudoku_mini', icon: '🔳', title: 'Sudoku Mini', desc: 'Fill the grid with logic — no repeats in a row, column or box. First to solve wins!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'make_24', icon: '🔢', title: 'Make 24', desc: 'Combine the numbers with + − × ÷ to hit the target. Mega number puzzle!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'hangman', icon: '🔡', title: 'Hangman', desc: 'Guess the hidden word letter by letter before your lives run out. Race to reveal it!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'brain_buzzer', icon: '🎯', title: 'Brain Buzzer', desc: 'TRUE or FALSE? Tap fast on maths & trivia before the buzzer. Sharp minds win!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'minesweeper', icon: '💣', title: 'Minesweeper', desc: 'Use the number clues to dodge the hidden mines and clear the field first!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'sliding_puzzle', icon: '🧩', title: 'Sliding Puzzle', desc: 'Slide the jumbled tiles back into order. First to solve the puzzle wins!', min: 2, max: 30, tag: 'brain game!' },
  { id: 'colour_clash', icon: '🌈', title: 'Colour Clash', desc: 'Tap the COLOUR of the word, not the word itself! Brain-bending and fast.', min: 2, max: 30, tag: 'brain game!' },
  { id: 'connect_four', icon: '♟️', title: 'Connect 4', desc: 'Line up four in a row before your rival blocks you. Classic strategy duel!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'battleship', icon: '🚢', title: 'Battleship', desc: 'Hide your fleet, then fire on the grid to sink your rival’s ships first. Deduction duel!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'dots_boxes', icon: '◻️', title: 'Dots & Boxes', desc: 'Draw lines, complete boxes to claim them and go again. Sneaky strategy!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'quiz_duel', icon: '⚔️', title: 'Quiz Duel', desc: 'School questions, two screens — fastest correct answer steals the round!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'penalty_duel', icon: '⚽', title: 'Penalty Duel', desc: 'Shooter vs keeper — pick your corner and outsmart your rival in 5 penalties!', min: 2, max: 2, tag: '1 vs 1' },
  { id: 'team_tug', icon: '🪢', title: 'Team Tug-of-War', desc: 'Two teams mash to pull the star. Teamwork = power!', min: 2, max: 8, tag: '2v2 up to 4v4' },
  { id: 'world_tour', icon: '✈️', title: 'World Tour Tycoon', desc: 'Board race Seoul → London — buy venues, charge rent, dodge traps!', min: 2, max: 4, tag: '2–4 players' },
  { id: 'monopoly_deal', icon: '🃏', title: 'Monopoly Deal', desc: 'The card game! Collect 3 full city sets — rent, sly deals & JUST SAY NO!', min: 2, max: 4, tag: '2–4 players' },
];

// Host-chosen setup for games that support it. Sent inside the `start` message.
interface OptionGroup {
  key: string;
  label: string;
  choices: { value: string; label: string }[];
}
const STD = [
  { value: 'easy', label: '😀 Easy' }, { value: 'medium', label: '🙂 Medium' }, { value: 'hard', label: '🤓 Hard' }, { value: 'expert', label: '🧠 Expert' }, { value: 'master', label: '🔥 Master' }, { value: 'legend', label: '💀 Legend' },
];
const GAME_OPTIONS: Partial<Record<GameId, OptionGroup[]>> = {
  math_sprint: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  pattern_quest: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  make_24: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  hangman: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  brain_buzzer: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  minesweeper: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  sliding_puzzle: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  colour_clash: [{ key: 'difficulty', label: 'Difficulty', choices: STD }],
  dots_boxes: [{ key: 'difficulty', label: 'Board size', choices: [
    { value: 'small', label: '▫️ Small · 3×3' }, { value: 'medium', label: '◻️ Medium · 4×4' }, { value: 'large', label: '⬜ Large · 5×5' },
  ] }],
  code_breaker: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy · 3' }, { value: 'normal', label: '🙂 Normal · 4' }, { value: 'hard', label: '🤓 Hard · 4+' }, { value: 'expert', label: '🧠 Expert · 5' }, { value: 'master', label: '🔥 Master · 5/8' }, { value: 'legend', label: '💀 Legend · 6/8' },
  ] }],
  odd_one_out: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy' }, { value: 'hard', label: '🤓 Tricky' }, { value: 'expert', label: '🧠 Genius' }, { value: 'master', label: '🔥 Master' }, { value: 'legend', label: '💀 Legend' },
  ] }],
  whats_missing: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy · 5' }, { value: 'medium', label: '🙂 Medium · 7' }, { value: 'hard', label: '🤓 Hard · 9' }, { value: 'expert', label: '🧠 Expert · 11' }, { value: 'master', label: '🔥 Master · 13' }, { value: 'legend', label: '💀 Legend · 15' },
  ] }],
  memory_digits: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy · 3' }, { value: 'medium', label: '🙂 Medium · 4' }, { value: 'hard', label: '🤓 Hard · 5' }, { value: 'expert', label: '🧠 Expert · 6' }, { value: 'master', label: '🔥 Master · 7' }, { value: 'legend', label: '💀 Legend · 8' },
  ] }],
  sudoku_mini: [{ key: 'difficulty', label: 'Difficulty', choices: [
    { value: 'easy', label: '😀 Easy · 4×4' }, { value: 'medium', label: '🙂 Medium · 4×4' }, { value: 'hard', label: '🤓 Hard · 6×6' }, { value: 'expert', label: '🧠 Expert · 6×6' }, { value: 'master', label: '🔥 Master · 6×6' }, { value: 'legend', label: '💀 Legend · 6×6' },
  ] }],
};

type HubScreen = 'menu' | 'create' | 'join' | 'lobby';

const OnlineHub: React.FC = () => {
  const { setGameState } = useGameStore();
  const room = useRoom();
  const [screen, setScreen] = useState<HubScreen>('menu');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎤');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [selGame, setSelGame] = useState<GameId>('class_show');
  const [opts, setOpts] = useState<Record<string, string>>({});
  const [gameConfig, setGameConfig] = useState<GameConfig>({});

  // Route lobby-level messages (game start / return to lobby)
  useEffect(() => {
    return room.onMessage((m) => {
      if (m.t === 'start') {
        setActiveGame(m.game as GameId);
        setGameConfig((m.config as GameConfig) || {});
        playUnlock();
      } else if (m.t === 'to_lobby') {
        setActiveGame(null);
      }
    });
  }, [room.onMessage]);

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
    playClick();
    const c = await room.createRoom({ name: name.trim() || 'Host', emoji });
    setBusy(false);
    if (c) {
      playWin();
      setScreen('lobby');
    } else {
      setJoinError('Could not connect — check your internet and try again!');
    }
  };

  const handleJoin = async () => {
    if (busy || joinCode.trim().length !== 4) return;
    setBusy(true);
    setJoinError('');
    playClick();
    const ok = await room.joinRoom(joinCode, { name: name.trim() || 'Player', emoji });
    setBusy(false);
    if (ok) {
      playWin();
      setScreen('lobby');
    } else {
      setJoinError(room.status === 'not_found' ? "Room not found — check the code! 🔍" : 'Could not connect — try again!');
    }
  };

  const startGame = () => {
    playClick();
    room.send({ t: 'start', game: selGame, config: buildConfig(selGame) });
  };

  const playerCount = room.players.length;
  const canStart = (g: GameId) => {
    const def = GAMES.find((x) => x.id === g)!;
    return playerCount >= def.min && playerCount <= def.max;
  };

  const api: RoomApi = {
    code: room.code || '',
    players: room.players,
    isHost: room.isHost,
    myId: room.myId,
    send: room.send,
    onMessage: room.onMessage,
  };

  // Active game takes over the whole screen
  if (activeGame && room.status === 'lobby') {
    return (
      <div className="relative">
        {activeGame === 'quiz_duel' && <QuizDuelOnline room={api} />}
        {activeGame === 'team_tug' && <TeamTugOnline room={api} />}
        {activeGame === 'world_tour' && <WorldTourRace room={api} />}
        {activeGame === 'class_show' && <ClassQuizShow room={api} />}
        {activeGame === 'rocket_race' && <RocketTapRace room={api} />}
        {activeGame === 'copy_cat' && <CopyCat room={api} />}
        {activeGame === 'tt_bingo' && <TimesTableBingo room={api} />}
        {activeGame === 'doodle_dash' && <DoodleDash room={api} />}
        {activeGame === 'penalty_duel' && <PenaltyDuel room={api} />}
        {activeGame === 'monopoly_deal' && <MonopolyDeal room={api} />}
        {activeGame === 'emoji_detective' && <EmojiDetective room={api} />}
        {activeGame === 'word_scramble' && <WordScramble room={api} />}
        {activeGame === 'riddle_rush' && <RiddleRush room={api} />}
        {activeGame === 'picture_phone' && <PictureTelephone room={api} />}
        {activeGame === 'math_sprint' && <MathSprint room={api} config={gameConfig} />}
        {activeGame === 'code_breaker' && <CodeBreaker room={api} config={gameConfig} />}
        {activeGame === 'odd_one_out' && <OddOneOut room={api} config={gameConfig} />}
        {activeGame === 'whats_missing' && <WhatsMissing room={api} config={gameConfig} />}
        {activeGame === 'pattern_quest' && <PatternQuest room={api} config={gameConfig} />}
        {activeGame === 'memory_digits' && <MemoryDigits room={api} config={gameConfig} />}
        {activeGame === 'sudoku_mini' && <SudokuMini room={api} config={gameConfig} />}
        {activeGame === 'connect_four' && <ConnectFour room={api} />}
        {activeGame === 'make_24' && <Make24 room={api} config={gameConfig} />}
        {activeGame === 'hangman' && <Hangman room={api} config={gameConfig} />}
        {activeGame === 'brain_buzzer' && <BrainBuzzer room={api} config={gameConfig} />}
        {activeGame === 'battleship' && <Battleship room={api} />}
        {activeGame === 'minesweeper' && <Minesweeper room={api} config={gameConfig} />}
        {activeGame === 'sliding_puzzle' && <SlidingPuzzle room={api} config={gameConfig} />}
        {activeGame === 'colour_clash' && <ColourClash room={api} config={gameConfig} />}
        {activeGame === 'dots_boxes' && <DotsBoxes room={api} config={gameConfig} />}
        <button
          onClick={leaveToMenu}
          className="fixed top-2 right-2 z-50 bg-black/40 hover:bg-black/60 text-white/80 rounded-full px-3 py-1 font-fredoka text-xs"
        >
          ✖ Leave room
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-950 text-white px-4 py-6"
    >
      <button
        onClick={screen === 'menu' ? exitHub : leaveToMenu}
        className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 rounded-full px-4 py-2 font-fredoka text-sm z-20"
      >
        ← {screen === 'menu' ? 'Back' : 'Exit room'}
      </button>

      <div className="max-w-3xl mx-auto pt-10">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-5xl mb-1">🌐 Friends Arena</h1>
        <p className="text-center font-nunito text-teal-200 mb-8">
          Play together — every player on their own device!
        </p>

        {screen === 'menu' && (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid gap-5 max-w-md mx-auto">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => { playClick(); setJoinError(''); setScreen('create'); }}
              className="rounded-3xl p-6 bg-gradient-to-br from-emerald-400 to-teal-600 shadow-2xl text-left"
            >
              <div className="text-4xl mb-2">👑</div>
              <div className="font-fredoka font-bold text-2xl">Create a Room</div>
              <div className="font-nunito text-emerald-100">Get a 4-letter code and invite your friends!</div>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => { playClick(); setJoinError(''); setScreen('join'); }}
              className="rounded-3xl p-6 bg-gradient-to-br from-cyan-400 to-blue-600 shadow-2xl text-left"
            >
              <div className="text-4xl mb-2">🎟️</div>
              <div className="font-fredoka font-bold text-2xl">Join a Room</div>
              <div className="font-nunito text-cyan-100">Type the code your friend shared!</div>
            </motion.button>
          </motion.div>
        )}

        {(screen === 'create' || screen === 'join') && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md mx-auto bg-white/10 rounded-3xl p-6 border border-white/20"
          >
            {screen === 'join' && (
              <div className="mb-5">
                <label className="block font-fredoka text-cyan-200 mb-2">🎟️ Room code</label>
                <input
                  type="text"
                  value={joinCode}
                  maxLength={4}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  placeholder="ABCD"
                  className="w-full px-4 py-3 rounded-2xl bg-white/90 text-gray-800 font-fredoka font-bold text-2xl text-center tracking-[0.5em] border-2 border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-300 uppercase"
                  autoFocus
                />
              </div>
            )}
            <div className="mb-5">
              <label className="block font-fredoka text-teal-200 mb-2">✨ Your name</label>
              <input
                type="text"
                value={name}
                maxLength={14}
                onChange={(e) => setName(e.target.value)}
                placeholder="Superstar name..."
                className="w-full px-4 py-3 rounded-2xl bg-white/90 text-gray-800 font-nunito border-2 border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-300"
                autoFocus={screen === 'create'}
              />
            </div>
            <div className="mb-6">
              <label className="block font-fredoka text-teal-200 mb-2">🎭 Pick your avatar</label>
              <div className="grid grid-cols-6 gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { playClick(); setEmoji(e); }}
                    className={`text-2xl md:text-3xl rounded-2xl p-2 transition-all ${emoji === e ? 'bg-amber-400/90 scale-110 shadow-lg' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            {joinError && (
              <div className="mb-4 bg-red-500/20 border border-red-400 rounded-2xl p-3 font-nunito text-red-200 text-center">
                {joinError}
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={screen === 'create' ? handleCreate : handleJoin}
              disabled={busy || !name.trim() || (screen === 'join' && joinCode.length !== 4)}
              className={`w-full py-4 rounded-full font-fredoka font-bold text-xl shadow-xl ${
                busy || !name.trim() || (screen === 'join' && joinCode.length !== 4)
                  ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 to-pink-500'
              }`}
            >
              {busy ? 'Connecting… 📡' : screen === 'create' ? '👑 Create Room!' : '🚀 Join Room!'}
            </motion.button>
          </motion.div>
        )}

        {screen === 'lobby' && room.status === 'lobby' && (
          <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="bg-white/10 rounded-3xl p-6 border border-white/20 mb-6 text-center">
              <div className="font-nunito text-teal-200 mb-1">Tell your friends to join with code:</div>
              <div className="font-fredoka font-bold text-5xl md:text-7xl tracking-[0.35em] text-amber-300 select-all">
                {room.code}
              </div>
            </div>

            <div className="bg-white/10 rounded-3xl p-5 border border-white/20 mb-6">
              <div className="font-fredoka text-lg mb-3">
                👥 Players in the room ({playerCount})
              </div>
              <div className="flex flex-wrap gap-2">
                {room.players.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 font-nunito ${p.id === room.myId ? 'bg-amber-400/30 border border-amber-300' : 'bg-white/10'}`}
                  >
                    <span className="text-xl">{p.emoji}</span>
                    <span className="font-bold">{p.name}</span>
                    {p.isHost && <span title="Host">👑</span>}
                  </motion.div>
                ))}
              </div>
            </div>

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
                          <span className="font-fredoka font-bold text-lg">{g.icon} {g.title}</span>
                          <span className={`text-xs font-nunito rounded-full px-2 py-0.5 ${ok ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-teal-300'}`}>
                            {g.tag}
                          </span>
                        </div>
                        <div className="font-nunito text-sm text-teal-100">{g.desc}</div>
                        {!ok && (
                          <div className="font-nunito text-xs text-amber-300 mt-1">
                            Needs {g.min}–{g.max} players (you have {playerCount})
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {(GAME_OPTIONS[selGame] || []).map((grp) => (
                  <div key={grp.key} className="mb-5">
                    <div className="font-fredoka text-sm text-teal-200 mb-2">⚙️ {grp.label}:</div>
                    <div className="flex flex-wrap gap-2">
                      {grp.choices.map((ch) => {
                        const active = (opts[grp.key] ?? grp.choices[0].value) === ch.value;
                        return (
                          <button
                            key={ch.value}
                            onClick={() => { playClick(); setOpts((o) => ({ ...o, [grp.key]: ch.value })); }}
                            className={`px-4 py-2 rounded-full font-fredoka text-sm border-2 transition-all ${
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
                  whileHover={{ scale: canStart(selGame) ? 1.04 : 1 }}
                  whileTap={{ scale: canStart(selGame) ? 0.96 : 1 }}
                  onClick={startGame}
                  disabled={!canStart(selGame)}
                  className={`w-full py-4 rounded-full font-fredoka font-bold text-xl shadow-xl ${
                    canStart(selGame) ? 'bg-gradient-to-r from-amber-400 to-pink-500' : 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  ⚡ START {GAMES.find((g) => g.id === selGame)!.title.toUpperCase()}! ⚡
                </motion.button>
              </>
            ) : (
              <div className="text-center bg-white/10 rounded-3xl p-6 border border-white/20">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="text-5xl mb-3"
                >
                  ⏳
                </motion.div>
                <div className="font-fredoka text-xl">Waiting for the host to start a game…</div>
                <div className="font-nunito text-teal-200 text-sm mt-1">Stay ready, superstar!</div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Host left the room */}
      <AnimatePresence>
        {room.status === 'closed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          >
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-red-400 rounded-3xl p-8 text-center max-w-sm mx-4">
              <div className="text-6xl mb-3">😢</div>
              <h2 className="font-fredoka font-bold text-2xl mb-2">The host left the room</h2>
              <p className="font-nunito text-slate-300 mb-6">Ask them to make a new room, or create your own!</p>
              <button
                onClick={leaveToMenu}
                className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
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
