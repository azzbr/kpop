import { AnimatePresence } from 'framer-motion';
import { useGameStore } from './store';
import WelcomeScreen from './components/WelcomeScreen';
import GameModeSelection from './components/GameModeSelection';
import DifficultyScreen from './components/DifficultyScreen';
import QuizView from './components/QuizView';
import ResultScreen from './components/ResultScreen';
import MemoryGame from './components/MemoryGame';
import RhythmGame from './components/RhythmGame';
import TriviaCards from './components/TriviaCards';
import InstrumentsTutorial from './components/InstrumentsTutorial';
import TeamMaker from './components/TeamMaker';
import FriendsTrivia from './components/FriendsTrivia';
import MathChallenge from './components/MathChallenge';
import SpellingBee from './components/SpellingBee';
import ReadingComprehension from './components/ReadingComprehension';
import ScienceQuiz from './components/ScienceQuiz';
import SecretMenu from './components/SecretMenu';
import MusicPlayer from './components/MusicPlayer';
import LivingMural from './components/LivingMural';
import AgentHQ from './components/AgentHQ';
import Shop from './components/Shop';
import KPopRushGame from './components/KPopRushGame';

function App() {
  const { gameState } = useGameStore();

  const renderCurrentScreen = () => {
    switch (gameState) {
      case 'welcome':
        return <WelcomeScreen key="welcome" />;
      case 'game_mode':
        return <GameModeSelection key="game_mode" />;
      case 'difficulty':
        return <DifficultyScreen key="difficulty" />;
      case 'quiz':
        return <QuizView key="quiz" />;
      case 'result':
        return <ResultScreen key="result" />;
      case 'memory_game':
        return <MemoryGame key="memory_game" />;
      case 'rhythm_game':
        return <RhythmGame key="rhythm_game" />;
      case 'trivia_cards':
        return <TriviaCards key="trivia_cards" />;
      case 'instruments_tutorial':
        return <InstrumentsTutorial key="instruments_tutorial" />;
      case 'team_maker':
        return <TeamMaker key="team_maker" />;
      case 'friends_trivia':
        return <FriendsTrivia key="friends_trivia" />;
      case 'math_challenge':
        return <MathChallenge key="math_challenge" />;
      case 'spelling_bee':
        return <SpellingBee key="spelling_bee" />;
      case 'reading_comprehension':
        return <ReadingComprehension key="reading_comprehension" />;
      case 'science_quiz':
        return <ScienceQuiz key="science_quiz" />;
      case 'secret_menu':
        return <SecretMenu key="secret_menu" />;
      case 'living_mural':
        return <LivingMural key="living_mural" />;
      case 'agent_hq':
        return <AgentHQ key="agent_hq" />;
      case 'shop':
        return <Shop key="shop" />;
      case 'kpop_rush':
        return <KPopRushGame key="kpop_rush" />;
      default:
        return <WelcomeScreen key="welcome" />;
    }
  };

  return (
    <div className="App">
      <AnimatePresence mode="wait">
        {renderCurrentScreen()}
      </AnimatePresence>
      {gameState !== 'living_mural' && <MusicPlayer />}
    </div>
  );
}

export default App;
