import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWrong } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface KoreanWord {
  korean: string;
  romanized: string;
  english: string;
  emoji: string;
  example: string;
  exampleTranslation: string;
  category: string;
  funFact: string;
}

const WORDS: KoreanWord[] = [
  { korean: '안녕하세요', romanized: 'Annyeonghaseyo', english: 'Hello', emoji: '👋', category: 'Greetings', example: '안녕하세요! 저는 HUNTR/X예요.', exampleTranslation: 'Hello! I am HUNTR/X.', funFact: 'This is the polite form. Friends say 안녕 (annyeong) instead!' },
  { korean: '감사합니다', romanized: 'Gamsahamnida', english: 'Thank you', emoji: '🙏', category: 'Greetings', example: '감사합니다, 팬 여러분!', exampleTranslation: 'Thank you, dear fans!', funFact: 'K-pop idols say this constantly at concerts and award shows!' },
  { korean: '사랑해요', romanized: 'Saranghaeyo', english: 'I love you', emoji: '💖', category: 'Feelings', example: '팬 여러분, 사랑해요!', exampleTranslation: 'Fans, I love you!', funFact: 'You\'ll hear this at every K-pop concert!' },
  { korean: '귀여워', romanized: 'Gwiyeowo', english: 'Cute / Adorable', emoji: '🥰', category: 'Descriptions', example: '이 강아지 너무 귀여워!', exampleTranslation: 'This puppy is so cute!', funFact: 'Fans scream this when their favourite idol does something adorable!' },
  { korean: '대박', romanized: 'Daebak', english: 'Awesome / Jackpot', emoji: '💥', category: 'Expressions', example: '이 노래 대박이야!', exampleTranslation: 'This song is awesome!', funFact: 'Originally meant "big hit" in business — now it means anything amazing!' },
  { korean: '화이팅', romanized: 'Hwaiting', english: 'Fighting / You got this!', emoji: '✊', category: 'Expressions', example: '시험 화이팅!', exampleTranslation: 'You got this on the exam!', funFact: 'From the English word "fighting" — used as a cheer all across Korea!' },
  { korean: '아이돌', romanized: 'Aidol', english: 'Idol', emoji: '🌟', category: 'K-pop', example: '저는 아이돌이 되고 싶어요.', exampleTranslation: 'I want to become an idol.', funFact: 'K-pop idols train in singing, dancing, and languages before debuting!' },
  { korean: '팬덤', romanized: 'Paendom', english: 'Fandom', emoji: '🎉', category: 'K-pop', example: '우리 팬덤은 최고야!', exampleTranslation: 'Our fandom is the best!', funFact: 'K-pop fandoms have official names — BTS fans are ARMY!' },
  { korean: '노래', romanized: 'Norae', english: 'Song', emoji: '🎵', category: 'Music', example: '이 노래 너무 좋아!', exampleTranslation: 'I love this song so much!', funFact: 'Karaoke in Korean is 노래방 (noraebang) — meaning "song room"!' },
  { korean: '춤', romanized: 'Chum', english: 'Dance', emoji: '💃', category: 'Music', example: '이 춤 배우고 싶어!', exampleTranslation: 'I want to learn this dance!', funFact: 'K-pop dances are called "point choreography" — each song has one iconic move!' },
  { korean: '맛있어', romanized: 'Massisseo', english: 'Delicious', emoji: '😋', category: 'Food', example: '김치 너무 맛있어!', exampleTranslation: 'Kimchi is so delicious!', funFact: 'Korean food is famous worldwide — especially bibimbap and tteokbokki!' },
  { korean: '친구', romanized: 'Chingu', english: 'Friend', emoji: '🤝', category: 'People', example: '너는 내 최고의 친구야!', exampleTranslation: 'You are my best friend!', funFact: 'In Korea, you can only call someone 친구 if you\'re the same age!' },
  { korean: '학교', romanized: 'Hakgyo', english: 'School', emoji: '🏫', category: 'Places', example: '학교 재미있어요!', exampleTranslation: 'School is fun!', funFact: 'Korean schools often start at 8am and some students study until 10pm!' },
  { korean: '예쁘다', romanized: 'Yeppeuda', english: 'Pretty / Beautiful', emoji: '🌺', category: 'Descriptions', example: '오늘 너 정말 예쁘다!', exampleTranslation: 'You look really pretty today!', funFact: 'A huge compliment in K-pop culture — idols work hard on their stage presence!' },
  { korean: '음악', romanized: 'Eumak', english: 'Music', emoji: '🎶', category: 'Music', example: '음악은 마법이에요!', exampleTranslation: 'Music is magic!', funFact: 'Korea has one of the world\'s fastest-growing music industries!' },
];

function getTodayWord(): KoreanWord {
  const dayIndex = Math.floor(Date.now() / 86400000) % WORDS.length;
  return WORDS[dayIndex];
}

const KoreanWordOfDay: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const word = getTodayWord();
  const [quizPhase, setQuizPhase] = useState<'learning' | 'quiz' | 'done'>('learning');
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showKorean, setShowKorean] = useState(false);
  const [browseIdx, setBrowseIdx] = useState<number | null>(null);

  const displayWord = browseIdx !== null ? WORDS[browseIdx] : word;

  useEffect(() => {
    // Build quiz options: correct + 3 random wrong
    const wrong = WORDS.filter(w => w.english !== word.english)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(w => w.english);
    setQuizOptions([word.english, ...wrong].sort(() => Math.random() - 0.5));
  }, []);

  const handleQuizAnswer = (answer: string) => {
    if (picked) return;
    setPicked(answer);
    if (answer === word.english) {
      playCorrect();
      addXP(20);
      setShowConfetti(true);
      setTimeout(() => { setShowConfetti(false); setQuizPhase('done'); }, 1800);
    } else {
      playWrong();
      setTimeout(() => setQuizPhase('done'), 1500);
    }
  };

  const categories = [...new Set(WORDS.map(w => w.category))];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={50} durationMs={1800} />}

      <div className="max-w-xl w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">
          ← Back
        </button>

        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🇰🇷</div>
          <h1 className="text-4xl font-fredoka font-bold text-purple-600 text-kid-glow mb-1">Korean Word of the Day</h1>
          <p className="font-nunito text-gray-500 text-sm">Learn one Korean word every day! +20 XP for the mini quiz</p>
        </div>

        {/* Today's Word Card */}
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 180 }}
          className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-purple-200 mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="bg-purple-100 text-purple-700 font-fredoka font-bold px-3 py-1 rounded-full text-sm">
              📅 Today's Word
            </span>
            <span className="bg-pink-100 text-pink-600 font-fredoka text-sm px-3 py-1 rounded-full">
              {displayWord.category}
            </span>
          </div>

          <div className="text-center my-4">
            <div className="text-6xl mb-3">{displayWord.emoji}</div>
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-5xl font-bold mb-2"
              style={{ fontFamily: 'serif', color: '#7c3aed' }}
            >
              {displayWord.korean}
            </motion.div>
            <p className="text-xl font-nunito text-gray-500 mb-1 italic">{displayWord.romanized}</p>
            <p className="text-3xl font-fredoka font-bold text-gray-800">{displayWord.english}</p>
          </div>

          <div className="bg-purple-50 rounded-2xl p-4 mb-4">
            <p className="font-nunito text-gray-700 text-lg mb-1">
              <span className="font-bold text-purple-600">Example: </span>{displayWord.example}
            </p>
            <p className="font-nunito text-gray-500 text-sm italic">"{displayWord.exampleTranslation}"</p>
          </div>

          <div className="bg-yellow-50 rounded-2xl p-3 border-l-4 border-yellow-400">
            <p className="font-nunito text-gray-700 text-sm">
              <span className="font-bold">💡 Fun Fact: </span>{displayWord.funFact}
            </p>
          </div>
        </motion.div>

        {/* Pronunciation tip */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { playClick(); setShowKorean(v => !v); }}
          className="w-full bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-6 text-left"
        >
          <p className="font-fredoka font-bold text-blue-700 text-lg">🔊 How to say it:</p>
          <AnimatePresence>
            {showKorean && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <p className="font-nunito text-blue-600 text-lg font-bold">{displayWord.romanized}</p>
                <p className="font-nunito text-blue-500 text-sm mt-1">
                  Say each syllable slowly: {displayWord.romanized.split(/(?=[A-Z])/).join(' · ')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!showKorean && <p className="text-sm font-nunito text-blue-400 mt-1">Tap to reveal pronunciation guide →</p>}
        </motion.button>

        {/* Mini Quiz */}
        <AnimatePresence mode="wait">
          {quizPhase === 'learning' && (
            <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { playClick(); setQuizPhase('quiz'); }}
                className="btn-kid font-fredoka text-xl px-10 py-4"
              >
                🧠 Take the Mini Quiz! (+20 XP)
              </motion.button>
            </motion.div>
          )}

          {quizPhase === 'quiz' && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-xl border-2 border-pink-200 mb-6"
            >
              <h2 className="text-2xl font-fredoka font-bold text-pink-600 mb-2 text-center">Quick Quiz!</h2>
              <p className="font-nunito text-gray-600 text-center mb-4">
                What does <strong className="text-purple-600 text-xl">{word.korean}</strong> mean?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {quizOptions.map(option => (
                  <motion.button
                    key={option}
                    whileHover={!picked ? { scale: 1.03 } : {}}
                    whileTap={!picked ? { scale: 0.97 } : {}}
                    onClick={() => handleQuizAnswer(option)}
                    disabled={!!picked}
                    className={`p-4 rounded-2xl border-2 font-fredoka font-bold text-lg transition-all duration-300 ${
                      picked === option
                        ? option === word.english
                          ? 'bg-green-400 border-green-600 text-white scale-105'
                          : 'bg-red-400 border-red-600 text-white'
                        : picked && option === word.english
                        ? 'bg-green-300 border-green-500 text-white'
                        : picked
                        ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-50'
                        : 'bg-purple-50 border-purple-200 text-gray-700 hover:bg-purple-100'
                    }`}
                  >
                    {option}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {quizPhase === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 shadow-xl border-2 border-green-200 text-center mb-6"
            >
              <div className="text-5xl mb-2">{picked === word.english ? '🎉' : '💪'}</div>
              <h2 className="text-2xl font-fredoka font-bold mb-1" style={{ color: picked === word.english ? '#16a34a' : '#dc2626' }}>
                {picked === word.english ? 'Perfect! +20 XP!' : 'Almost! Keep Practising!'}
              </h2>
              <p className="font-nunito text-gray-600">
                {picked === word.english
                  ? `Yes! ${word.korean} means "${word.english}"!`
                  : `${word.korean} means "${word.english}" — you'll get it next time!`}
              </p>
              <button onClick={() => { playClick(); setQuizPhase('learning'); setPicked(null); }} className="btn-kid-secondary font-fredoka mt-4">
                🔄 Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Browse other words */}
        <div className="bg-white rounded-3xl p-5 shadow-lg border-2 border-gray-200">
          <h3 className="font-fredoka font-bold text-gray-700 text-xl mb-3 text-center">📚 Explore More Words</h3>
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { playClick(); setBrowseIdx(browseIdx !== null ? null : WORDS.findIndex(w => w.category === cat)); }}
                className="px-3 py-1 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-full text-sm font-fredoka text-purple-700 transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {WORDS.map((w, i) => (
              <motion.button
                key={w.korean}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { playClick(); setBrowseIdx(i); }}
                className={`p-2 rounded-xl border text-left transition-all ${
                  browseIdx === i ? 'bg-purple-100 border-purple-400' : 'bg-gray-50 border-gray-200 hover:bg-purple-50'
                }`}
              >
                <p className="font-bold text-purple-700" style={{ fontFamily: 'serif' }}>{w.korean}</p>
                <p className="text-xs font-nunito text-gray-500">{w.english} {w.emoji}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default KoreanWordOfDay;
