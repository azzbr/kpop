import { lazy, Suspense } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from './store';
import type { GameState } from './store';
import WelcomeScreen from './components/WelcomeScreen';
import GameModeSelection from './components/GameModeSelection';
import MusicPlayer from './components/MusicPlayer';

// Every screen except the first two loads on demand, so the iPad downloads only what she opens.
const SCREENS: Partial<Record<GameState, LazyExoticComponent<ComponentType>>> = {
  difficulty: lazy(() => import('./components/DifficultyScreen')),
  quiz: lazy(() => import('./components/QuizView')),
  result: lazy(() => import('./components/ResultScreen')),
  team_maker: lazy(() => import('./components/TeamMaker')),
  secret_menu: lazy(() => import('./components/SecretMenu')),
  living_mural: lazy(() => import('./components/LivingMural')),
  agent_hq: lazy(() => import('./components/AgentHQ')),
  shop: lazy(() => import('./components/Shop')),
  kpop_rush: lazy(() => import('./components/KPopRushGame')),
  word_scramble: lazy(() => import('./components/WordScramble')),
  lightning_quiz: lazy(() => import('./components/LightningQuiz')),
  idol_personality_quiz: lazy(() => import('./components/IdolPersonalityQuiz')),
  dance_battle: lazy(() => import('./components/DanceBattleSimulator')),
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
  streak_calendar: lazy(() => import('./components/DailyStreakCalendar')),
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
  fm_radio: lazy(() => import('./components/FMRadio')),
  freeze_dance: lazy(() => import('./components/FreezeDance')),
  chaotic_backstage: lazy(() => import('./components/ChaoticBackstage')),
  paper_clash: lazy(() => import('./components/games/PaperClash')),
};

const Loading = () => (
  <div className="arcade-bg min-h-screen-d flex items-center justify-center text-white font-fredoka text-2xl">
    Loading… 🎮
  </div>
);

function App() {
  const gameState = useGameStore(s => s.gameState);

  const renderCurrentScreen = () => {
    if (gameState === 'welcome') return <WelcomeScreen key="welcome" />;
    if (gameState === 'game_mode') return <GameModeSelection key="game_mode" />;
    const Screen = SCREENS[gameState];
    return Screen ? <Screen key={gameState} /> : <WelcomeScreen key="welcome" />;
  };

  return (
    <div className="App">
      <Suspense fallback={<Loading />}>
        <AnimatePresence mode="wait">
          {renderCurrentScreen()}
        </AnimatePresence>
      </Suspense>
      <MusicPlayer hidden={gameState === 'living_mural' || gameState === 'fm_radio'} />
    </div>
  );
}

export default App;
