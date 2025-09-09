import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

interface Story {
  id: string;
  title: string;
  content: string;
  level: 'easy' | 'medium' | 'hard';
  category: string;
  wordCount: number;
}

interface ComprehensionQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  type: 'main_idea' | 'detail' | 'inference' | 'vocabulary' | 'prediction';
  explanation: string;
}

const stories: Story[] = [
  // Easy Stories
  {
    id: 'lost_puppy',
    title: 'The Lost Puppy',
    content: `One sunny afternoon, little Timmy was playing in the park. He saw a small brown puppy running around all alone. The puppy looked scared and hungry.

Timmy walked over to the puppy and said, "Hello, little puppy. Are you lost?" The puppy wagged its tail and licked Timmy's hand. Timmy knew he had to help the lost puppy find its way home.

Timmy picked up the puppy and carried it to his house. He gave the puppy some water and food. Then he made posters that said "LOST PUPPY - PLEASE HELP!" He put the posters all around the neighborhood.

The next day, a little girl named Sarah saw one of the posters. "That's my puppy!" she cried. She had been looking for her puppy for two days. Timmy was so happy to help reunite the puppy with its owner.

Sarah gave Timmy a big hug and said, "Thank you for being such a kind friend." From that day on, Timmy and Sarah became best friends, and they often played with the puppy in the park.`,
    level: 'easy',
    category: 'Friendship',
    wordCount: 198
  },
  {
    id: 'magic_garden',
    title: 'The Magic Garden',
    content: `In a quiet neighborhood, there was a small house with a beautiful garden. But this was no ordinary garden. It was a magic garden that only appeared when the moon was full.

Every month, when the moon was big and round, the garden would sparkle with colorful flowers that sang soft songs. The trees would dance gently in the breeze, and friendly animals would come to visit.

One night, a curious girl named Lily couldn't sleep. She looked out her window and saw the magic garden glowing. "I have to see it up close!" she whispered to herself.

Lily quietly slipped out of her house and into the garden. The flowers sang a welcome song just for her. A wise old owl flew down and said, "Welcome to our magic garden, Lily. You have a kind heart, so you can see our magic."

Lily spent the whole night exploring. She danced with the trees and sang with the flowers. When morning came, the magic garden faded away, but Lily knew it would return next month.

From then on, Lily looked forward to every full moon. She knew that magic exists in the world, especially in the hearts of kind people.`,
    level: 'easy',
    category: 'Fantasy',
    wordCount: 212
  },

  // Medium Stories
  {
    id: 'brave_explorer',
    title: 'The Brave Little Explorer',
    content: `Young Alex dreamed of being a great explorer. Every day after school, he would study maps and read books about famous adventurers. "One day, I will discover something amazing," he would tell his friends.

One summer, Alex's family went camping in the mountains. While hiking, Alex found an old, rusty key hidden under a rock. The key looked very old and had strange markings on it.

"That key must open something special!" Alex thought. He searched everywhere but couldn't find what the key opened. He asked the park ranger about it.

The ranger smiled and said, "That key is from an old cabin that stood here many years ago. The cabin was home to a famous explorer who discovered a beautiful waterfall in these mountains."

Alex was amazed. He had found something that connected him to his hero. From that day on, Alex worked even harder on his dreams. He started a club for young explorers at school and helped his friends discover the wonders of nature.

Years later, Alex became a real explorer. He never forgot that rusty key that started his amazing journey. It taught him that sometimes the greatest discoveries are right in front of you, waiting to be found.`,
    level: 'medium',
    category: 'Adventure',
    wordCount: 224
  },
  {
    id: 'wise_old_tree',
    title: 'The Wise Old Tree',
    content: `In a peaceful forest, there stood a magnificent oak tree that was over 200 years old. The animals called him Grandfather Oak because he was so wise and had seen so much in his long life.

One day, a young squirrel named Nutty came to Grandfather Oak with a problem. "I can't find enough nuts for winter," Nutty complained. "What should I do?"

Grandfather Oak rustled his leaves thoughtfully. "Young squirrel, you must plan ahead. Summer is the time to gather and store. Watch how the bees make honey and the birds build nests. They prepare for the future."

Nutty listened carefully and started gathering nuts every day. He stored them in a special hiding place and even helped his friends do the same.

As winter came, Nutty was warm and well-fed. He thanked Grandfather Oak and said, "You taught me that preparation is the key to happiness."

Grandfather Oak smiled with his branches. "Remember, little one, wisdom comes from experience, and the greatest wisdom is sharing what you have learned with others."

From that day on, Nutty became known as a wise squirrel who helped others prepare for winter. And Grandfather Oak continued to share his wisdom with all the forest creatures who sought his advice.`,
    level: 'medium',
    category: 'Wisdom',
    wordCount: 236
  },

  // Hard Stories
  {
    id: 'mystery_island',
    title: 'The Mystery of Treasure Island',
    content: `Captain Amelia had sailed the seven seas for twenty years, but she had never encountered a mystery as puzzling as the one on Treasure Island. The island appeared on maps only during full moons and vanished during the rest of the month.

Legends spoke of a magnificent treasure hidden by the pirate Blackbeard himself. Many adventurers had sought it, but none had returned. Captain Amelia was determined to solve the mystery.

As her ship approached the misty shores, strange things began to happen. The compass spun wildly, and the crew heard whispers on the wind. "Follow the stars that dance," the whispers said.

Captain Amelia noticed that certain stars seemed to move in patterns, creating a map in the sky. She followed the star map through dense jungles and across raging rivers. Finally, she reached a hidden cave.

Inside the cave, instead of gold and jewels, she found an ancient library filled with books of wisdom and knowledge. The "treasure" was not gold, but the accumulated wisdom of generations of explorers.

Captain Amelia realized that the true treasure was knowledge and understanding. She shared the books with the world, and Treasure Island became a place of learning rather than greed.

The mystery was solved, and Captain Amelia became known not as a treasure hunter, but as a bringer of wisdom to all who sought knowledge.`,
    level: 'hard',
    category: 'Mystery',
    wordCount: 248
  }
];

const comprehensionQuestions: ComprehensionQuestion[] = [
  // Lost Puppy Questions
  {
    id: 'puppy_1',
    question: 'What is the main idea of the story?',
    options: ['Timmy found a lost dog', 'Timmy helped a lost puppy find its owner', 'Timmy got a new pet', 'Sarah lost her puppy'],
    correctAnswer: 1,
    type: 'main_idea',
    explanation: 'The story is about Timmy helping a lost puppy find its way home to Sarah.'
  },
  {
    id: 'puppy_2',
    question: 'What did Timmy do to help the puppy?',
    options: ['He kept the puppy', 'He made posters and helped find the owner', 'He took the puppy to the vet', 'He gave the puppy away'],
    correctAnswer: 1,
    type: 'detail',
    explanation: 'Timmy made posters saying "LOST PUPPY - PLEASE HELP!" and put them around the neighborhood.'
  },
  {
    id: 'puppy_3',
    question: 'Why do you think the puppy licked Timmy\'s hand?',
    options: ['It was hungry', 'It liked Timmy and was happy to see him', 'It was scared', 'It wanted to play'],
    correctAnswer: 1,
    type: 'inference',
    explanation: 'The puppy wagged its tail and licked Timmy\'s hand, which shows it was friendly and happy.'
  },

  // Magic Garden Questions
  {
    id: 'garden_1',
    question: 'When did the magic garden appear?',
    options: ['Every day', 'Only when the moon was full', 'At night', 'During the day'],
    correctAnswer: 1,
    type: 'detail',
    explanation: 'The story says the garden appeared "only when the moon was full."'
  },
  {
    id: 'garden_2',
    question: 'What does "curious" mean in the story?',
    options: ['Tired', 'Wanting to learn or know more', 'Happy', 'Sad'],
    correctAnswer: 1,
    type: 'vocabulary',
    explanation: 'Lily was curious about the magic garden, so she wanted to learn more about it.'
  },

  // Brave Explorer Questions
  {
    id: 'explorer_1',
    question: 'What did Alex find while hiking?',
    options: ['A treasure chest', 'An old rusty key', 'A map', 'A waterfall'],
    correctAnswer: 1,
    type: 'detail',
    explanation: 'Alex found an old, rusty key hidden under a rock while hiking.'
  },
  {
    id: 'explorer_2',
    question: 'What lesson did Alex learn from the key?',
    options: ['Keys are valuable', 'Sometimes discoveries are right in front of you', 'Hiking is dangerous', 'Old things are not important'],
    correctAnswer: 1,
    type: 'inference',
    explanation: 'The key connected Alex to his hero and showed him that great discoveries can be found unexpectedly.'
  },

  // Wise Old Tree Questions
  {
    id: 'tree_1',
    question: 'What did Grandfather Oak teach Nutty?',
    options: ['How to climb trees', 'The importance of planning ahead', 'How to find nuts', 'How to make friends'],
    correctAnswer: 1,
    type: 'main_idea',
    explanation: 'Grandfather Oak taught Nutty that he must plan ahead and prepare for winter.'
  },
  {
    id: 'tree_2',
    question: 'What does "preparation" mean?',
    options: ['Having fun', 'Getting ready for something', 'Being lazy', 'Making plans'],
    correctAnswer: 1,
    type: 'vocabulary',
    explanation: 'Preparation means getting ready for something that will happen in the future.'
  },

  // Mystery Island Questions
  {
    id: 'island_1',
    question: 'What was the real "treasure" on the island?',
    options: ['Gold and jewels', 'Ancient books of wisdom', 'A pirate ship', 'A magic key'],
    correctAnswer: 1,
    type: 'detail',
    explanation: 'Instead of gold, Captain Amelia found ancient books filled with wisdom and knowledge.'
  },
  {
    id: 'island_2',
    question: 'What do you think Captain Amelia learned?',
    options: ['Treasure is always gold', 'True treasure is knowledge and wisdom', 'Islands are dangerous', 'Pirates are bad'],
    correctAnswer: 1,
    type: 'inference',
    explanation: 'Captain Amelia learned that the greatest treasure is knowledge and understanding, not material wealth.'
  }
];

const ReadingComprehension: React.FC = () => {
  const { setGameState } = useGameStore();

  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<ComprehensionQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [showStory, setShowStory] = useState(true);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(45);

  // Timer effect
  useEffect(() => {
    if (!showStory && timeLeft > 0 && !isCorrect) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleTimeUp();
    }
  }, [timeLeft, showStory, isCorrect]);

  const getButtonClass = (index: number) => {
    const baseClass = 'p-4 rounded-2xl font-fredoka font-bold text-lg shadow-lg transition-all duration-300 text-left';

    if (selectedAnswer === index) {
      return baseClass + (isCorrect ? ' bg-green-500 text-white shadow-green-300' : ' bg-red-500 text-white shadow-red-300');
    } else if (isCorrect === false && index === currentQuestions[currentQuestionIndex].correctAnswer) {
      return baseClass + ' bg-green-500 text-white shadow-green-300';
    } else {
      return baseClass + ' bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600 text-white';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Friendship': return 'from-pink-400 to-purple-500';
      case 'Fantasy': return 'from-blue-400 to-indigo-500';
      case 'Adventure': return 'from-green-400 to-teal-500';
      case 'Wisdom': return 'from-yellow-400 to-orange-500';
      case 'Mystery': return 'from-gray-400 to-gray-500';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const getStoriesForLevel = (level: 'easy' | 'medium' | 'hard'): Story[] => {
    return stories.filter(story => story.level === level);
  };

  const getQuestionsForStory = (storyId: string): ComprehensionQuestion[] => {
    // Map story IDs to their corresponding question prefixes
    const storyToQuestionMap: { [key: string]: string } = {
      'lost_puppy': 'puppy',
      'magic_garden': 'garden',
      'brave_explorer': 'explorer',
      'wise_old_tree': 'tree',
      'mystery_island': 'island'
    };
    
    const questionPrefix = storyToQuestionMap[storyId];
    if (!questionPrefix) return [];
    
    return comprehensionQuestions.filter(q => q.id.startsWith(questionPrefix + '_'));
  };

  const startReading = (level: 'easy' | 'medium' | 'hard') => {
    const availableStories = getStoriesForLevel(level);
    const randomStory = availableStories[Math.floor(Math.random() * availableStories.length)];

    setCurrentStory(randomStory);
    setCurrentQuestions(getQuestionsForStory(randomStory.id));
    setShowStory(true);
    setScore(0);
    setStreak(0);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setTimeLeft(45);
  };

  const startQuestions = () => {
    setShowStory(false);
    setTimeLeft(45);
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (isCorrect !== null) return;

    setSelectedAnswer(answerIndex);
    const correct = answerIndex === currentQuestions[currentQuestionIndex].correctAnswer;

    setIsCorrect(correct);

    if (correct) {
      const timeBonus = Math.max(0, timeLeft * 2);
      const streakBonus = streak * 5;
      const points = 10 + timeBonus + streakBonus;

      setScore(prev => prev + points);
      setStreak(prev => prev + 1);

      setTimeout(() => {
        nextQuestion();
      }, 3000);
    } else {
      setStreak(0);
      setTimeout(() => {
        nextQuestion();
      }, 3000);
    }
  };

  const handleTimeUp = () => {
    if (currentQuestions[currentQuestionIndex] && isCorrect === null) {
      setIsCorrect(false);
      setStreak(0);
      setTimeout(() => {
        nextQuestion();
      }, 3000);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex >= currentQuestions.length - 1) {
      // Quiz complete
      setShowStory(false);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setTimeLeft(45);
    }
  };

  const resetGame = () => {
    setCurrentStory(null);
    setCurrentQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setScore(0);
    setShowStory(true);
    setStreak(0);
    setTimeLeft(45);
  };

  const handleBackToMenu = () => {
    setGameState('game_mode');
  };

  if (!currentStory) {
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
              📖 Reading Comprehension! 📚
            </h1>
            <p className="text-xl md:text-2xl font-fredoka font-semibold text-pink-500">
              Read Stories & Answer Questions!
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
                Reading Complete!
              </h2>
              <div className="text-2xl font-bold text-pink-500 mb-2">
                Final Score: {score} points
              </div>
              <div className="text-lg text-gray-600 mb-6">
                You answered {currentQuestionIndex} comprehension questions!
              </div>
              <div className="text-sm text-gray-500 mb-6">
                Longest Streak: {streak} correct answers in a row!
              </div>
            </motion.div>
          )}

          {/* Reading Level Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="bg-white rounded-3xl shadow-lg p-6"
          >
            <h2 className="text-2xl font-fredoka font-bold text-purple-600 mb-6 text-center">
              Choose Your Reading Level
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startReading('easy')}
                className="bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟢</div>
                  <div className="text-xl mb-1">Easy</div>
                  <div className="text-sm opacity-80">Simple Stories</div>
                  <div className="text-xs opacity-70 mt-1">Grades 2-3</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startReading('medium')}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🟡</div>
                  <div className="text-xl mb-1">Medium</div>
                  <div className="text-sm opacity-80">Adventure Stories</div>
                  <div className="text-xs opacity-70 mt-1">Grades 4-5</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => startReading('hard')}
                className="bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white p-6 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">🔴</div>
                  <div className="text-xl mb-1">Hard</div>
                  <div className="text-sm opacity-80">Mystery Stories</div>
                  <div className="text-xs opacity-70 mt-1">Grades 5-6</div>
                </div>
              </motion.button>
            </div>

            <div className="text-center text-gray-600">
              <p className="mb-2">📖 <strong>How to Play:</strong></p>
              <ul className="text-sm space-y-1">
                <li>• Read the story carefully</li>
                <li>• Answer comprehension questions</li>
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

  if (showStory) {
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
              📖 Reading Time! 📚
            </h1>
          </motion.div>

          {/* Story Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="bg-white rounded-3xl shadow-lg p-8 mb-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-fredoka font-bold text-purple-600 mb-2">
                {currentStory.title}
              </h2>
              <div className="flex justify-center space-x-4 text-sm text-gray-600">
                <span className="bg-purple-100 px-3 py-1 rounded-full">
                  Level: {currentStory.level}
                </span>
                <span className="bg-blue-100 px-3 py-1 rounded-full">
                  Category: {currentStory.category}
                </span>
                <span className="bg-green-100 px-3 py-1 rounded-full">
                  {currentStory.wordCount} words
                </span>
              </div>
            </div>

            {/* Story Content */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <div className="text-lg leading-relaxed text-gray-800 whitespace-pre-line font-medium">
                {currentStory.content}
              </div>
            </div>

            {/* Reading Complete Button */}
            <div className="text-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startQuestions}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-2xl font-fredoka font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                ✅ I'm Done Reading - Start Questions!
              </motion.button>
            </div>
          </motion.div>

          {/* Back Button */}
          <div className="text-center">
            <button
              onClick={resetGame}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-600"
            >
              Choose Different Story
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

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
            🧠 Comprehension Questions! ❓
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
            <div className="text-2xl font-fredoka font-bold text-blue-600">{(currentQuestionIndex + 1) + '/' + currentQuestions.length}</div>
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
            <div className="text-center mb-8">
              <div className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
                {currentQuestion.type.replace('_', ' ')} • Question {currentQuestionIndex + 1}
              </div>
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
            {isCorrect !== null && (
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
                <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl">
                  💡 {currentQuestion.explanation}
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
              animate={{ width: ((currentQuestionIndex + 1) / currentQuestions.length) * 100 + '%' }}
              transition={{ duration: 0.5 }}
              className="bg-gradient-to-r from-purple-400 to-pink-500 h-4 rounded-full shadow-lg"
            ></motion.div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-600">
            Progress: {(currentQuestionIndex + 1) + '/' + currentQuestions.length} questions completed
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={resetGame}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-2xl font-fredoka font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-red-600"
          >
            Choose New Story
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

export default ReadingComprehension;
