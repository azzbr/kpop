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
import WordScramble from './components/WordScramble';
import LightningQuiz from './components/LightningQuiz';
import AnimalSoundQuiz from './components/AnimalSoundQuiz';
import SongTitleGenerator from './components/SongTitleGenerator';
import IdolPersonalityQuiz from './components/IdolPersonalityQuiz';
import DanceBattleSimulator from './components/DanceBattleSimulator';
import DailySpinWheel from './components/DailySpinWheel';
import BeatMaker from './components/BeatMaker';
import HuntrxSplash from './components/HuntrxSplash';
import KoreanWordOfDay from './components/KoreanWordOfDay';
import TruthOrDare from './components/TruthOrDare';
import TriviaBattle from './components/TriviaBattle';
import TalentShow from './components/TalentShow';

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
      case 'word_scramble':
        return <WordScramble key="word_scramble" />;
      case 'lightning_quiz':
        return <LightningQuiz key="lightning_quiz" />;
      case 'animal_sound_quiz':
        return <AnimalSoundQuiz key="animal_sound_quiz" />;
      case 'song_title_generator':
        return <SongTitleGenerator key="song_title_generator" />;
      case 'idol_personality_quiz':
        return <IdolPersonalityQuiz key="idol_personality_quiz" />;
      case 'dance_battle':
        return <DanceBattleSimulator key="dance_battle" />;
      case 'daily_spin_wheel':
        return <DailySpinWheel key="daily_spin_wheel" />;
      case 'beat_maker':
        return <BeatMaker key="beat_maker" />;
      case 'huntrx_splash':
        return <HuntrxSplash key="huntrx_splash" />;
      case 'korean_word':
        return <KoreanWordOfDay key="korean_word" />;
      case 'truth_or_dare':
        return <TruthOrDare key="truth_or_dare" />;
      case 'trivia_battle':
        return <TriviaBattle key="trivia_battle" />;
      case 'talent_show':
        return <TalentShow key="talent_show" />;
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
