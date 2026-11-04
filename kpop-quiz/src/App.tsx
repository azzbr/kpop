import { lazy, Suspense, useEffect, useRef } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from './store';
import type { GameState } from './store';
import WelcomeScreen from './components/WelcomeScreen';
import GameModeSelection from './components/GameModeSelection';
import MusicPlayer from './components/MusicPlayer';
import PlayTimeTracker from './components/PlayTimeTracker';
import BadgeToast from './components/BadgeToast';
import PumpkinHunt from './components/events/PumpkinHunt';
import { useEventTheme } from './events/useEventTheme';
import ScreenErrorBoundary from './components/ui/ScreenErrorBoundary';
import { getInstallState } from './utils/appInstall';
import { installBackGuard } from './utils/backGuard';
import type { BackGuard } from './utils/backGuard';

// Every screen except the first two loads on demand, so the iPad downloads only what she opens.
const SCREENS: Partial<Record<GameState, LazyExoticComponent<ComponentType>>> = {
  team_maker: lazy(() => import('./components/TeamMaker')),
  secret_menu: lazy(() => import('./components/SecretMenu')),
  doodle_pad: lazy(() => import('./components/draw/DoodlePad')),
  sticker_board: lazy(() => import('./components/draw/StickerBoard')),
  pixel_studio: lazy(() => import('./components/secret/PixelStudio')),
  theme_lab: lazy(() => import('./components/secret/ThemeLab')),
  my_stats: lazy(() => import('./components/secret/MyStats')),
  agent_hq: lazy(() => import('./components/AgentHQ')),
  kpop_rush: lazy(() => import('./components/KPopRushGame')),
  word_scramble: lazy(() => import('./components/WordScramble')),
  idol_personality_quiz: lazy(() => import('./components/IdolPersonalityQuiz')),
  beat_maker: lazy(() => import('./components/BeatMaker')),
  huntrx_splash: lazy(() => import('./components/HuntrxSplash')),
  truth_or_dare: lazy(() => import('./components/TruthOrDare')),
  trivia_battle: lazy(() => import('./components/TriviaBattle')),
  talent_show: lazy(() => import('./components/TalentShow')),
  zip_game: lazy(() => import('./components/ZipGame')),
  mini_sudoku: lazy(() => import('./components/MiniSudoku')),
  crossword_mini: lazy(() => import('./components/CrosswordMini')),
  word_ladder: lazy(() => import('./components/WordLadder')),
  memory_speed: lazy(() => import('./components/MemorySpeedRound')),
  reaction_duel: lazy(() => import('./components/ReactionDuel')),
  achievement_showcase: lazy(() => import('./components/AchievementShowcase')),
  pattern_memory: lazy(() => import('./components/PatternMemory')),
  ninja_slice: lazy(() => import('./components/NinjaSlice')),
  battle_arena: lazy(() => import('./components/BattleArena')),
  rocket_launch: lazy(() => import('./components/RocketLaunch')),
  style_studio: lazy(() => import('./components/StyleStudio')),
  sparkle_match: lazy(() => import('./components/SparkleMatch')),
  idol_diary: lazy(() => import('./components/IdolDiary')),
  jarvis_hq: lazy(() => import('./components/JarvisHQ')),
  guess_intro: lazy(() => import('./components/GuessTheIntro')),
  idol_profile: lazy(() => import('./components/IdolProfileCard')),
  freeze_dance: lazy(() => import('./components/FreezeDance')),
  chaotic_backstage: lazy(() => import('./components/ChaoticBackstage')),
  paper_clash: lazy(() => import('./components/games/PaperClash')),
  tug_of_war: lazy(() => import('./components/TugOfWar')),
  online_hub: lazy(() => import('./components/online/OnlineHub')),
  snake_arena: lazy(() => import('./components/games/SnakeArena')),
  game_2048: lazy(() => import('./components/games/Game2048')),
  block_blast: lazy(() => import('./components/games/BlockBlast')),
  quiz_arena: lazy(() => import('./components/games/QuizArena')),
  word_guess: lazy(() => import('./components/games/WordGuess')),
  would_you_rather: lazy(() => import('./components/games/WouldYouRather')),
  real_or_fake: lazy(() => import('./components/games/RealOrFake')),
  emoji_guess: lazy(() => import('./components/games/EmojiGuess')),
  quiz_maker: lazy(() => import('./components/QuizMaker')),
  locker: lazy(() => import('./components/Locker')),
  tower_defense: lazy(() => import('./components/games/TowerDefense')),
  pet_pal: lazy(() => import('./components/PetPal')),
  quest_map: lazy(() => import('./components/QuestMap')),
  parent_corner: lazy(() => import('./components/ParentCorner')),
  heads_up: lazy(() => import('./components/games/HeadsUp')),
  picture_puzzle: lazy(() => import('./components/games/PicturePuzzle')),
  bridges: lazy(() => import('./components/games/Bridges')),
  light_up: lazy(() => import('./components/games/LightUp')),
  untangle: lazy(() => import('./components/games/Untangle')),
  chess_academy: lazy(() => import('./components/games/ChessAcademy')),
  stack_lab: lazy(() => import('./components/games/StackLab')),
  robo_quest: lazy(() => import('./components/games/RoboQuest')),
  advent_calendar: lazy(() => import('./components/events/AdventCalendar')),
  snow_catch: lazy(() => import('./components/games/SnowCatch')),
};

const Loading = () => (
  <div className="arcade-bg min-h-screen-d flex items-center justify-center text-white font-fredoka text-2xl">
    Loading… 🎮
  </div>
);

function App() {
  const gameState = useGameStore(s => s.gameState);
  useEventTheme();

  // A refresh while in a Friends Arena room (or iPad Safari reloading a sleeping tab) goes
  // straight back into the room instead of the welcome screen. (Key from online/useRoom.ts.)
  useEffect(() => {
    try { if (sessionStorage.getItem('kpop_room')) useGameStore.getState().setGameState('online_hub'); } catch { /* ignore */ }
  }, []);

  // Installed app: the back gesture pauses the game or presses the screen's Back, instead of
  // closing the app (utils/backGuard.ts).
  const guard = useRef<BackGuard | null>(null);
  useEffect(() => {
    if (!getInstallState().asApp) return;
    const g = installBackGuard({
      isHome: () => ['welcome', 'game_mode'].includes(useGameStore.getState().gameState),
      fallback: () => {
        const s = useGameStore.getState();
        if (s.secretReturn) s.leaveSecret(); else s.setGameState('game_mode');
      },
    });
    guard.current = g;
    g.sync();
    return () => { g.dispose(); guard.current = null; };
  }, []);
  useEffect(() => { guard.current?.sync(); }, [gameState]);

  const goHome = () => {
    const s = useGameStore.getState();
    s.setGameState(s.gameState === 'game_mode' ? 'welcome' : 'game_mode');
  };

  const renderCurrentScreen = () => {
    if (gameState === 'welcome') return <WelcomeScreen key="welcome" />;
    if (gameState === 'game_mode') return <GameModeSelection key="game_mode" />;
    const Screen = SCREENS[gameState];
    return Screen ? <Screen key={gameState} /> : <WelcomeScreen key="welcome" />;
  };

  return (
    <div className="App">
      <ScreenErrorBoundary screen={gameState} onHome={goHome}>
        <Suspense fallback={<Loading />}>
          <AnimatePresence mode="wait">
            {renderCurrentScreen()}
          </AnimatePresence>
        </Suspense>
      </ScreenErrorBoundary>
      <MusicPlayer />
      <PlayTimeTracker />
      <BadgeToast />
      <PumpkinHunt screen={gameState} />
    </div>
  );
}

export default App;
