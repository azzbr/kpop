import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';

interface ScienceQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  category: 'animals' | 'planets' | 'weather' | 'basic_science';
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
  funFact: string;
}

const scienceQuestions: ScienceQuestion[] = [
  // Animals - Easy
  {
    id: 'animal_1',
    question: 'Which animal is known as the "King of the Jungle"?',
    options: ['Tiger', 'Lion', 'Elephant', 'Giraffe'],
    correctAnswer: 1,
    category: 'animals',
    difficulty: 'easy',
    explanation: 'Lions are called the "King of the Jungle" because they are strong leaders of their pride.',
    funFact: 'A group of lions is called a pride!'
  },
  {
    id: 'animal_2',
    question: 'What do caterpillars turn into?',
    options: ['Butterflies', 'Moths', 'Bees', 'Flies'],
    correctAnswer: 0,
    category: 'animals',
    difficulty: 'easy',
    explanation: 'Caterpillars undergo metamorphosis and become beautiful butterflies.',
    funFact: 'Butterflies taste with their feet!'
  },
  {
    id: 'animal_3',
    question: 'Which animal can fly without wings?',
    options: ['Eagle', 'Bat', 'Ostrich', 'Penguin'],
    correctAnswer: 1,
    category: 'animals',
    difficulty: 'easy',
    explanation: 'Bats are mammals that can fly using their wings made of skin stretched between their fingers.',
    funFact: 'Bats are the only mammals that can truly fly!'
  },
  {
    id: 'animal_4',
    question: 'What is the largest animal in the world?',
    options: ['Elephant', 'Giraffe', 'Blue Whale', 'Polar Bear'],
    correctAnswer: 2,
    category: 'animals',
    difficulty: 'easy',
    explanation: 'The blue whale is the largest animal ever known to have lived on Earth.',
    funFact: 'A blue whale\'s heart is as big as a small car!'
  },

  // Animals - Medium
  {
    id: 'animal_5',
    question: 'Which animal is a marsupial?',
    options: ['Rabbit', 'Kangaroo', 'Squirrel', 'Mouse'],
    correctAnswer: 1,
    category: 'animals',
    difficulty: 'medium',
    explanation: 'Kangaroos are marsupials, meaning they carry their babies in a pouch.',
    funFact: 'Baby kangaroos are called joeys!'
  },
  {
    id: 'animal_6',
    question: 'What type of animal is a Komodo dragon?',
    options: ['Snake', 'Lizard', 'Turtle', 'Crocodile'],
    correctAnswer: 1,
    category: 'animals',
    difficulty: 'medium',
    explanation: 'Komodo dragons are the largest lizards in the world.',
    funFact: 'Komodo dragons can grow up to 10 feet long!'
  },
  {
    id: 'animal_7',
    question: 'Which bird cannot fly?',
    options: ['Penguin', 'Ostrich', 'Emu', 'All of these'],
    correctAnswer: 3,
    category: 'animals',
    difficulty: 'medium',
    explanation: 'Penguins, ostriches, and emus are all flightless birds.',
    funFact: 'Penguins can swim faster than most fish!'
  },

  // Animals - Hard
  {
    id: 'animal_8',
    question: 'What is the only mammal that can fly?',
    options: ['Flying squirrel', 'Bat', 'Sugar glider', 'Colugo'],
    correctAnswer: 1,
    category: 'animals',
    difficulty: 'hard',
    explanation: 'Bats are the only mammals capable of true flight.',
    funFact: 'There are over 1,400 species of bats!'
  },
  {
    id: 'animal_9',
    question: 'Which animal has the longest neck?',
    options: ['Ostrich', 'Flamingo', 'Giraffe', 'Swan'],
    correctAnswer: 2,
    category: 'animals',
    difficulty: 'hard',
    explanation: 'Giraffes have the longest necks of any living animal.',
    funFact: 'A giraffe\'s neck can be 6 feet long!'
  },

  // Planets - Easy
  {
    id: 'planet_1',
    question: 'Which planet is known as the "Red Planet"?',
    options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswer: 1,
    category: 'planets',
    difficulty: 'easy',
    explanation: 'Mars appears red because of iron oxide (rust) on its surface.',
    funFact: 'Mars has the largest volcano in the solar system!'
  },
  {
    id: 'planet_2',
    question: 'How many planets are in our solar system?',
    options: ['7', '8', '9', '10'],
    correctAnswer: 1,
    category: 'planets',
    difficulty: 'easy',
    explanation: 'Our solar system has 8 planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.',
    funFact: 'Pluto is now classified as a dwarf planet!'
  },
  {
    id: 'planet_3',
    question: 'Which planet is closest to the Sun?',
    options: ['Venus', 'Earth', 'Mercury', 'Mars'],
    correctAnswer: 2,
    category: 'planets',
    difficulty: 'easy',
    explanation: 'Mercury is the closest planet to the Sun.',
    funFact: 'A day on Mercury lasts 59 Earth days!'
  },
  {
    id: 'planet_4',
    question: 'Which planet has rings around it?',
    options: ['Earth', 'Mars', 'Saturn', 'Venus'],
    correctAnswer: 2,
    category: 'planets',
    difficulty: 'easy',
    explanation: 'Saturn is famous for its beautiful system of rings made of ice and rock.',
    funFact: 'Saturn\'s rings are made mostly of ice!'
  },

  // Planets - Medium
  {
    id: 'planet_5',
    question: 'Which planet is known as the "Gas Giant"?',
    options: ['Earth', 'Mars', 'Jupiter', 'Mercury'],
    correctAnswer: 2,
    category: 'planets',
    difficulty: 'medium',
    explanation: 'Jupiter is the largest planet and is made mostly of gas.',
    funFact: 'Jupiter has at least 95 moons!'
  },
  {
    id: 'planet_6',
    question: 'What is Earth\'s natural satellite?',
    options: ['The Sun', 'The Moon', 'Mars', 'Venus'],
    correctAnswer: 1,
    category: 'planets',
    difficulty: 'medium',
    explanation: 'The Moon is Earth\'s only natural satellite.',
    funFact: 'The Moon is slowly moving away from Earth!'
  },
  {
    id: 'planet_7',
    question: 'Which planet rotates on its side?',
    options: ['Mars', 'Jupiter', 'Uranus', 'Saturn'],
    correctAnswer: 2,
    category: 'planets',
    difficulty: 'medium',
    explanation: 'Uranus rotates on its side, unlike other planets.',
    funFact: 'Uranus takes 84 Earth years to orbit the Sun!'
  },

  // Planets - Hard
  {
    id: 'planet_8',
    question: 'Which planet has the most moons?',
    options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'],
    correctAnswer: 1,
    category: 'planets',
    difficulty: 'hard',
    explanation: 'Saturn has the most confirmed moons with over 140.',
    funFact: 'Saturn\'s moon Titan has lakes of liquid methane!'
  },
  {
    id: 'planet_9',
    question: 'What is the Great Red Spot on Jupiter?',
    options: ['A mountain', 'A storm', 'A crater', 'A volcano'],
    correctAnswer: 1,
    category: 'planets',
    difficulty: 'hard',
    explanation: 'The Great Red Spot is a giant storm that has been raging for hundreds of years.',
    funFact: 'The Great Red Spot is larger than Earth!'
  },

  // Weather - Easy
  {
    id: 'weather_1',
    question: 'What do we call frozen rain that falls from clouds?',
    options: ['Rain', 'Snow', 'Hail', 'Sleet'],
    correctAnswer: 2,
    category: 'weather',
    difficulty: 'easy',
    explanation: 'Hail is frozen rain that forms in thunderstorms.',
    funFact: 'Hail can be as small as a pea or as large as a softball!'
  },
  {
    id: 'weather_2',
    question: 'What instrument measures temperature?',
    options: ['Barometer', 'Thermometer', 'Anemometer', 'Rain gauge'],
    correctAnswer: 1,
    category: 'weather',
    difficulty: 'easy',
    explanation: 'A thermometer measures how hot or cold something is.',
    funFact: 'The first thermometer was invented in 1593!'
  },
  {
    id: 'weather_3',
    question: 'What causes rainbows?',
    options: ['Wind', 'Sunlight and rain', 'Clouds', 'Snow'],
    correctAnswer: 1,
    category: 'weather',
    difficulty: 'easy',
    explanation: 'Rainbows form when sunlight passes through raindrops.',
    funFact: 'You can sometimes see rainbows at night called "moonbows"!'
  },
  {
    id: 'weather_4',
    question: 'What season comes after winter?',
    options: ['Summer', 'Fall', 'Spring', 'Winter'],
    correctAnswer: 2,
    category: 'weather',
    difficulty: 'easy',
    explanation: 'Spring comes after winter, bringing warmer weather and flowers.',
    funFact: 'Spring starts on the vernal equinox around March 20-21!'
  },

  // Weather - Medium
  {
    id: 'weather_5',
    question: 'What is a tornado?',
    options: ['Heavy rain', 'Strong wind', 'Rotating column of air', 'Snow storm'],
    correctAnswer: 2,
    category: 'weather',
    difficulty: 'medium',
    explanation: 'A tornado is a rapidly rotating column of air that touches the ground.',
    funFact: 'Tornadoes can travel at speeds up to 300 mph!'
  },
  {
    id: 'weather_6',
    question: 'What does a barometer measure?',
    options: ['Wind speed', 'Temperature', 'Air pressure', 'Rainfall'],
    correctAnswer: 2,
    category: 'weather',
    difficulty: 'medium',
    explanation: 'A barometer measures atmospheric pressure.',
    funFact: 'Falling air pressure often means bad weather is coming!'
  },
  {
    id: 'weather_7',
    question: 'What is humidity?',
    options: ['Wind speed', 'Air temperature', 'Water vapor in air', 'Rain amount'],
    correctAnswer: 2,
    category: 'weather',
    difficulty: 'medium',
    explanation: 'Humidity is the amount of water vapor in the air.',
    funFact: 'The most humid place on Earth is in Brazil!'
  },

  // Weather - Hard
  {
    id: 'weather_8',
    question: 'What is the eye of a hurricane?',
    options: ['The strongest winds', 'The calm center', 'The rain bands', 'The storm surge'],
    correctAnswer: 1,
    category: 'weather',
    difficulty: 'hard',
    explanation: 'The eye is the calm, clear center of a hurricane.',
    funFact: 'The eye of a hurricane can be up to 50 miles wide!'
  },
  {
    id: 'weather_9',
    question: 'What causes the Northern Lights?',
    options: ['Lightning', 'Solar wind particles', 'Clouds', 'Rainbows'],
    correctAnswer: 1,
    category: 'weather',
    difficulty: 'hard',
    explanation: 'The Northern Lights are caused by charged particles from the Sun hitting Earth\'s atmosphere.',
    funFact: 'The Northern Lights are also called Aurora Borealis!'
  },

  // Basic Science - Easy
  {
    id: 'science_1',
    question: 'What are the three states of matter?',
    options: ['Solid, liquid, gas', 'Hot, warm, cold', 'Big, medium, small', 'Fast, slow, still'],
    correctAnswer: 0,
    category: 'basic_science',
    difficulty: 'easy',
    explanation: 'Matter exists as solid, liquid, or gas depending on temperature.',
    funFact: 'Water can exist as all three states on Earth!'
  },
  {
    id: 'science_2',
    question: 'What do plants need to make their own food?',
    options: ['Darkness', 'Sunlight', 'Water', 'All of these'],
    correctAnswer: 3,
    category: 'basic_science',
    difficulty: 'easy',
    explanation: 'Plants use sunlight, water, and air to make food through photosynthesis.',
    funFact: 'Plants are the only organisms that can make their own food!'
  },
  {
    id: 'science_3',
    question: 'What is gravity?',
    options: ['A type of rock', 'A force that pulls objects together', 'A kind of light', 'A weather condition'],
    correctAnswer: 1,
    category: 'basic_science',
    difficulty: 'easy',
    explanation: 'Gravity is the force that pulls objects toward each other.',
    funFact: 'Gravity keeps planets orbiting around the Sun!'
  },
  {
    id: 'science_4',
    question: 'What do we call the process of water turning into vapor?',
    options: ['Freezing', 'Melting', 'Evaporation', 'Condensation'],
    correctAnswer: 2,
    category: 'basic_science',
    difficulty: 'easy',
    explanation: 'Evaporation is when liquid water turns into water vapor.',
    funFact: 'The Sun provides energy for evaporation!'
  },

  // Basic Science - Medium
  {
    id: 'science_5',
    question: 'What is the center of an atom called?',
    options: ['Electron', 'Neutron', 'Nucleus', 'Proton'],
    correctAnswer: 2,
    category: 'basic_science',
    difficulty: 'medium',
    explanation: 'The nucleus is the center of an atom containing protons and neutrons.',
    funFact: 'The nucleus is very small but contains almost all of the atom\'s mass!'
  },
  {
    id: 'science_6',
    question: 'What type of energy comes from the Sun?',
    options: ['Nuclear energy', 'Solar energy', 'Wind energy', 'Chemical energy'],
    correctAnswer: 1,
    category: 'basic_science',
    difficulty: 'medium',
    explanation: 'Solar energy is energy from the Sun that can be converted to electricity.',
    funFact: 'The Sun produces energy through nuclear fusion!'
  },
  {
    id: 'science_7',
    question: 'What is photosynthesis?',
    options: ['Plant growth', 'How plants make food', 'Plant reproduction', 'How plants sleep'],
    correctAnswer: 1,
    category: 'basic_science',
    difficulty: 'medium',
    explanation: 'Photosynthesis is the process where plants use sunlight to make food.',
    funFact: 'Photosynthesis produces the oxygen we breathe!'
  },

  // Basic Science - Hard
  {
    id: 'science_8',
    question: 'What is the speed of light?',
    options: ['300,000 km/s', '300,000 m/s', '300,000 mph', '300,000 kph'],
    correctAnswer: 1,
    category: 'basic_science',
    difficulty: 'hard',
    explanation: 'Light travels at 300,000 meters per second in a vacuum.',
    funFact: 'Light can travel around Earth 7.5 times in one second!'
  },
  {
    id: 'science_9',
    question: 'What is the smallest unit of matter?',
    options: ['Atom', 'Molecule', 'Cell', 'Electron'],
    correctAnswer: 0,
    category: 'basic_science',
    difficulty: 'hard',
    explanation: 'An atom is the smallest unit of matter that retains the properties of an element.',
    funFact: 'Atoms are so small that millions would fit on the head of a pin!'
  }
];

const ScienceQuiz: React.FC = () => {
  const { setGameState } = useGameStore();

  const [currentQuestions, setCurrentQuestions] = useState<ScienceQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [scienceLevel, setScienceLevel] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [showExplanation, setShowExplanation] = useState(false);

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && !isCorrect) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleTimeUp();
    }
  }, [timeLeft, isCorrect]);

  const getButtonClass = (index: number) => {
    const baseClass = 'p-4 rounded-2xl font-fredoka font-bold text-lg shadow-lg transition-all duration-300 text-left';

    if (selectedAnswer === index) {
      return baseClass + (isCorrect ? ' bg-green-500 text-white shadow-green-300' : ' bg-red-500 text-white shadow-red-300');
    } else if (isCorrect === false && index === currentQuestion.correctAnswer) {
      return baseClass + ' bg-green-500 text-white shadow-green-300';
    } else {
      return baseClass + ' bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600 text-white';
    }
  };

  const getCategoryClass = (category: string) => {
    return `bg-gradient-to-r ${getCategoryColor(category)} text-white px-4 py-2 rounded-full font-fredoka font-bold text-sm flex items-center space-x-2`;
  };

  const getQuestionsForLevel = (level: 'easy' | 'medium' | 'hard'): ScienceQuestion[] => {
    return scienceQuestions.filter(q => q.difficulty === level);
  };

  const startQuiz = (level: 'easy' | 'medium' | 'hard') => {
    setScienceLevel(level);
    const availableQuestions = getQuestionsForLevel(level);
    // Shuffle and take 10 questions
    const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, 10);

    setCurrentQuestions(selectedQuestions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setStreak(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setTimeLeft(30);
    setShowExplanation(false);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (isCorrect !== null) return;

    setSelectedAnswer(answerIndex);
    const correct = answerIndex === currentQuestions[currentQuestionIndex].correctAnswer;

    setIsCorrect(correct);
    setShowExplanation(true);

    if (correct) {
      const timeBonus = Math.max(0, timeLeft * 2);
      const streakBonus = streak * 3;
      const points = 10 + timeBonus + streakBonus;

      setScore(prev => prev + points);
      setStreak(prev => prev + 1);

      setTimeout(() => {
        nextQuestion();
      }, 4000);
    } else {
      setStreak(0);
      setTimeout(() => {
        nextQuestion();
      }, 4000);
    }
  };

  const handleTimeUp = () => {
    if (currentQuestions[currentQuestionIndex] && isCorrect === null) {
      setIsCorrect(false);
      setStreak(0);
      setShowExplanation(true);
      setTimeout(() => {
        nextQuestion();
      }, 4000);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex >= currentQuestions.length - 1) {
      // Quiz complete
      setShowExplanation(false);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setTimeLeft(30);
      setShowExplanation(false);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setScore(0);
    setStreak(0);
    setTimeLeft(30);
    setShowExplanation(false);
  };

  const handleBackToMenu = () => {
    setGameState('game_mode');
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'animals': return '🦁';
      case 'planets': return '🪐';
      case 'weather': return '🌤️';
      case 'basic_science': return '🧪';
      default: return '🔬';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'animals': return 'from-orange-400 to-red-500';
      case 'planets': return 'from-blue-400 to-purple-500';
      case 'weather': return 'from-cyan-400 to-blue-500';
      case 'basic_science': return 'from-green-400 to-teal-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  if (currentQuestions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-kid-pattern"
      >
        <div className="max-w-4xl mx-auto w-full">
          {/* Header */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl md:text-5xl font-fredoka font-bold text-purple-600 mb-2 text-kid-glow">
              🔬 Science Quiz! 🧪
            </h1>
            <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
              Discover Amazing Science Facts!
            </p>
          </motion.div>

          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mb-6"
          >
            <button
              onClick={handleBackToMenu}
              className="btn-kid-secondary font-fredoka text-lg"
            >
              ← Back to Games
            </button>
          </motion.div>

          {/* Game Over Screen */}
          {currentQuestionIndex > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl shadow-lg p-6 mb-6 text-center"
            >
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-fredoka font-bold text-purple-600 mb-4">
                Science Quiz Complete!
              </h2>
              <div className="text-2xl font-bold text-pink-500 mb-2">
                Final Score: {score} points
              </div>
              <div className="text-lg text-gray-600 mb-6">
                You answered {currentQuestionIndex} science questions!
              </div>
              <div className="text-sm text-gray-500 mb-6">
                Longest Streak: {streak} correct answers in a row!
              </div>
            </motion.div>
          )}

          {/* Science Level Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="bg-white rounded-3xl shadow-lg p-6"
          >
            <h2 className="text-2xl font-fredoka font-bold text-purple-600 mb-6 text-center">
              Choose Your Science Level
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startQuiz('easy')}
                className="bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟢</div>
                  <div className="text-xl mb-1">Easy</div>
                  <div className="text-sm opacity-80">Basic Facts</div>
                  <div className="text-xs opacity-70 mt-1">Grades 1-3</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startQuiz('medium')}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟡</div>
                  <div className="text-xl mb-1">Medium</div>
                  <div className="text-sm opacity-80">Advanced Facts</div>
                  <div className="text-xs opacity-70 mt-1">Grades 4-5</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startQuiz('hard')}
                className="bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🔴</div>
                  <div className="text-xl mb-1">Hard</div>
                  <div className="text-sm opacity-80">Expert Facts</div>
                  <div className="text-xs opacity-70 mt-1">Grades 5-6</div>
                </div>
              </motion.button>
            </div>

            <div className="text-center text-gray-600">
              <p className="mb-2">🔬 <strong>How to Play:</strong></p>
              <ul className="text-sm space-y-1">
                <li>• Answer science questions from 4 categories</li>
                <li>• Learn amazing facts about our world</li>
                <li>• Earn points for correct answers</li>
                <li>• Build streaks for bonus points!</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  const currentQuestion = currentQuestions[currentQuestionIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-kid-pattern"
    >
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-6"
        >
          <h1 className="text-3xl md:text-4xl font-fredoka font-bold text-purple-600 mb-2 text-kid-glow">
            🔬 Science Quiz! 🧪
          </h1>
        </motion.div>

        {/* Game Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex justify-between items-center mb-6 bg-white rounded-2xl p-4 shadow-lg"
        >
          <div className="text-center">
            <div className="text-2xl font-fredoka font-bold text-purple-600">{score}</div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-fredoka font-bold text-blue-600">{(currentQuestionIndex + 1) + '/10'}</div>
            <div className="text-sm text-gray-600">Question</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-fredoka font-bold text-green-600">{streak}</div>
            <div className="text-sm text-gray-600">Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-fredoka font-bold text-red-600">{timeLeft}s</div>
            <div className="text-sm text-gray-600">Time</div>
          </div>
        </motion.div>

        {/* Question Card */}
        {currentQuestion && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-lg p-8 mb-6"
          >
            {/* Category Badge */}
            <div className="flex justify-center mb-6">
              <div className={getCategoryClass(currentQuestion.category)}>
                <span className="text-lg">{getCategoryIcon(currentQuestion.category)}</span>
                <span className="capitalize">{currentQuestion.category.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-fredoka font-bold text-purple-600 mb-6">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-1 gap-4 mb-6">
              {currentQuestion.options.map((option, index) => (
                <motion.button
                  key={index}
                  initial={{ scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={isCorrect !== null}
                  className={getButtonClass(index)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl bg-white bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{option}</span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Feedback */}
            {isCorrect !== null && showExplanation && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="text-6xl mb-4">
                  {isCorrect ? '🎉' : '😅'}
                </div>
    <div className={isCorrect ? 'text-2xl font-fredoka font-bold mb-2 text-green-600' : 'text-2xl font-fredoka font-bold mb-2 text-red-600'}>
      {isCorrect ? 'Correct!' : 'Not quite right!'}
    </div>
                {!isCorrect && (
                  <div className="text-lg text-gray-600 mb-4">
                    The correct answer was: <span className="font-bold text-purple-600">
                      {String.fromCharCode(65 + currentQuestion.correctAnswer)} {currentQuestion.options[currentQuestion.correctAnswer]}
                    </span>
                  </div>
                )}
                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl mb-4">
                  💡 {currentQuestion.explanation}
                </div>
                <div className="text-sm text-blue-600 bg-blue-50 p-4 rounded-xl">
                  🌟 Fun Fact: {currentQuestion.funFact}
                </div>
                {isCorrect && streak > 1 && (
                  <div className="text-lg text-orange-600 font-bold mt-4">
                    🔥 {streak} correct answers in a row! 🔥
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="bg-gray-200 rounded-full h-4 shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: ((currentQuestionIndex + 1) / 10) * 100 + '%' }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-r from-purple-400 to-pink-500 h-4 rounded-full shadow-lg"
            ></motion.div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-600">
            Progress: {(currentQuestionIndex + 1) + '/10'} questions completed
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={resetQuiz}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-600"
          >
            Choose New Quiz
          </button>
          <button
            onClick={() => setGameState('game_mode')}
            className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-purple-600"
          >
            Back to Games
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ScienceQuiz;
