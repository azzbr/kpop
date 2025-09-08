import { AnimatePresence } from 'framer-motion';
import { useGameStore } from './store';
import WelcomeScreen from './components/WelcomeScreen';
import DifficultyScreen from './components/DifficultyScreen';
import QuizView from './components/QuizView';
import ResultScreen from './components/ResultScreen';

function App() {
  const { gameState } = useGameStore();

  const renderCurrentScreen = () => {
    switch (gameState) {
      case 'welcome':
        return <WelcomeScreen key="welcome" />;
      case 'difficulty':
        return <DifficultyScreen key="difficulty" />;
      case 'quiz':
        return <QuizView key="quiz" />;
      case 'result':
        return <ResultScreen key="result" />;
      default:
        return <WelcomeScreen key="welcome" />;
    }
  };

  return (
    <div className="App">
      <AnimatePresence mode="wait">
        {renderCurrentScreen()}
      </AnimatePresence>
    </div>
  );
}

export default App;
