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
import MusicPlayer from './components/MusicPlayer';

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
      default:
        return <WelcomeScreen key="welcome" />;
    }
  };

  return (
    <div className="App">
      <AnimatePresence mode="wait">
        {renderCurrentScreen()}
      </AnimatePresence>
      <MusicPlayer />
    </div>
  );
}

export default App;
