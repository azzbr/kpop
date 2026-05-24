import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playPop, playWin, playUnlock } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

const WORD_LISTS: Record<string, string[]> = {
  ADJECTIVE:  ['sparkly', 'fluffy', 'magical', 'silly', 'huge', 'tiny', 'golden', 'fierce', 'spicy', 'rainbow'],
  COLOR:      ['pink', 'purple', 'blue', 'gold', 'silver', 'neon green', 'sunset orange', 'rainbow'],
  NUMBER:     ['7', '100', '5000', 'a million', 'three', 'eleven', 'forty-two'],
  NAME:       ['Rumi', 'Mira', 'Zoey', 'Romance', 'Mystery', 'Star', 'Luna', 'Kai'],
  FOOD:       ['kimbap', 'ramen', 'ice cream', 'kimchi', 'mochi', 'bingsu', 'tteokbokki', 'cotton candy'],
  ANIMAL:     ['bear', 'cat', 'dragon', 'dolphin', 'panda', 'fox', 'unicorn', 'penguin'],
  OBJECT:     ['microphone', 'crown', 'plushie', 'sticker album', 'sparkly wand', 'photo card', 'phone'],
  BODYPART:   ['feet', 'hands', 'knees', 'head', 'pinky finger', 'elbow', 'cheeks'],
  VEHICLE:    ['hot air balloon', 'rocket', 'scooter', 'pink limousine', 'flying carpet', 'submarine'],
  PLACE:      ['Seoul', 'Tokyo', 'the Moon', 'Disneyland', 'a giant cupcake', 'the school cafeteria'],
  BUILDING:   ['castle', 'glittery tower', 'museum', 'café shaped like a strawberry', 'underwater dome'],
  CLOTHING:   ['hoodie', 'sparkly dress', 'sneakers', 'pajamas', 'rainbow jacket', 'glitter cape'],
  VERB:       ['twirl', 'sing', 'sparkle', 'giggle', 'wiggle', 'dance', 'fly', 'bounce'],
  DRINK:      ['bubble tea', 'strawberry milk', 'smoothie', 'lemonade', 'unicorn juice', 'hot chocolate'],
};

interface StoryTemplate {
  id: string; title: string; emoji: string;
  blanks: { label: string; type: keyof typeof WORD_LISTS | string }[];
  // segments alternated with blank indices: "Today was..." [0] "..." [1] ...
  render: (w: string[]) => string;
}

const STORIES: StoryTemplate[] = [
  {
    id: 'academy', title: 'First Day at K-Pop Academy', emoji: '🎓',
    blanks: [
      { label: 'A describing word', type: 'ADJECTIVE' },
      { label: 'Something to wear', type: 'CLOTHING' },
      { label: 'A magical object', type: 'OBJECT' },
      { label: 'A name', type: 'NAME' },
      { label: 'An action word', type: 'VERB' },
      { label: 'Something big', type: 'OBJECT' },
      { label: 'A friend\'s name', type: 'NAME' },
      { label: 'A color', type: 'COLOR' },
      { label: 'A yummy food', type: 'FOOD' },
    ],
    render: w => `Today was my FIRST DAY at K-Pop Academy! 🎤 I wore my favorite ${w[0]} ${w[1]} and brought my lucky ${w[2]}. My new dance teacher, Ms. ${w[3]}, taught us how to ${w[4]} in front of a giant ${w[5]}. I made friends with ${w[6]}, who has ${w[7]} hair and loves ${w[8]}. BEST. DAY. EVER! ✨`,
  },
  {
    id: 'concert', title: 'Concert Day Adventure', emoji: '🎤',
    blanks: [
      { label: 'A place', type: 'PLACE' },
      { label: 'An action word', type: 'VERB' },
      { label: 'A describing word', type: 'ADJECTIVE' },
      { label: 'A number', type: 'NUMBER' },
      { label: 'An object', type: 'OBJECT' },
      { label: 'A body part', type: 'BODYPART' },
      { label: 'A food', type: 'FOOD' },
      { label: 'A drink', type: 'DRINK' },
    ],
    render: w => `It was finally concert day! 🎉 My group HUNTR/X was performing at ${w[0]}. Backstage, I ${w[1]} my ${w[2]} microphone. The crowd was holding ${w[3]} ${w[4]}s in the air! I danced so hard that my ${w[5]} hurt, but the fans LOVED it! After the show, we celebrated with ${w[6]} and ${w[7]}. 🌟`,
  },
  {
    id: 'lost', title: 'Lost in Seoul', emoji: '🗺️',
    blanks: [
      { label: 'A place', type: 'PLACE' },
      { label: 'A describing word', type: 'ADJECTIVE' },
      { label: 'An animal', type: 'ANIMAL' },
      { label: 'An action word', type: 'VERB' },
      { label: 'A color', type: 'COLOR' },
      { label: 'A food', type: 'FOOD' },
      { label: 'A vehicle', type: 'VEHICLE' },
      { label: 'An action word', type: 'VERB' },
      { label: 'A describing word', type: 'ADJECTIVE' },
      { label: 'A building', type: 'BUILDING' },
    ],
    render: w => `I got separated from my group in ${w[0]}! 😱 First I asked a ${w[1]} ${w[2]} for help, but it just ${w[3]}-ed at me. Then I met a kid who gave me a ${w[4]} ${w[5]}. We rode a giant ${w[6]} across the city. I finally found my friends ${w[7]}-ing in front of a ${w[8]} ${w[9]}! 🎊`,
  },
];

interface DiaryEntry { id: number; storyId: string; words: string[]; date: string; title: string; }

const IdolDiary: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [tab, setTab] = useState<'new' | 'shelf'>('new');
  const [storyIdx, setStoryIdx] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('diary_list') || '[]'); } catch { return []; }
  });
  const [viewEntry, setViewEntry] = useState<DiaryEntry | null>(null);

  const story = storyIdx !== null ? STORIES[storyIdx] : null;

  const pickStory = (i: number) => {
    playClick();
    setStoryIdx(i);
    setStep(0);
    setWords([]);
    setShowResult(false);
  };

  const pickWord = (word: string) => {
    if (!story) return;
    playPop();
    const newWords = [...words, word];
    setWords(newWords);
    if (newWords.length === story.blanks.length) {
      setShowResult(true);
      playWin();
      setConfetti(true);
      addXP(15);
      setTimeout(() => setConfetti(false), 2500);
    } else {
      setStep(s => s + 1);
    }
  };

  const saveEntry = () => {
    if (!story) return;
    playUnlock();
    const newEntry: DiaryEntry = {
      id: Date.now(),
      storyId: story.id,
      words,
      date: new Date().toLocaleDateString(),
      title: story.title,
    };
    const next = [newEntry, ...entries].slice(0, 30);
    setEntries(next);
    localStorage.setItem('diary_list', JSON.stringify(next));
    localStorage.setItem('diary_entries', String(next.length));
    addXP(10);
    setStoryIdx(null);
    setWords([]);
    setShowResult(false);
    setTab('shelf');
  };

  const newStory = () => { setStoryIdx(null); setWords([]); setShowResult(false); setStep(0); };

  const deleteEntry = (id: number) => {
    playClick();
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    localStorage.setItem('diary_list', JSON.stringify(next));
    localStorage.setItem('diary_entries', String(next.length));
    setViewEntry(null);
  };

  const wordOptions = (type: string): string[] => WORD_LISTS[type] || [];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col items-center p-4"
      style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #fce7f3 100%)' }}
    >
      {confetti && <ConfettiBurst count={70} durationMs={2500} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('girls_zone'); }}
          className="mb-3 px-4 py-2 bg-white/70 hover:bg-white text-rose-700 rounded-full font-fredoka text-sm border-2 border-rose-200">
          ← Girls Zone
        </button>

        <div className="text-center mb-3">
          <h1 className="text-3xl font-fredoka font-bold text-rose-700">📔 Idol Diary</h1>
          <p className="font-nunito text-rose-500 text-sm">Fill in the blanks · Save funny stories!</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-white/70 rounded-2xl p-1 border-2 border-rose-200">
          <button onClick={() => { playClick(); setTab('new'); newStory(); }}
            className={`flex-1 py-2 rounded-xl font-fredoka text-sm ${tab === 'new' ? 'bg-rose-500 text-white' : 'text-rose-600'}`}>
            ✍️ Write
          </button>
          <button onClick={() => { playClick(); setTab('shelf'); }}
            className={`flex-1 py-2 rounded-xl font-fredoka text-sm ${tab === 'shelf' ? 'bg-rose-500 text-white' : 'text-rose-600'}`}>
            📚 Shelf ({entries.length})
          </button>
        </div>

        {/* WRITE tab */}
        {tab === 'new' && storyIdx === null && (
          <div className="space-y-3">
            <p className="font-nunito text-rose-700 text-center text-sm">Pick a story to start:</p>
            {STORIES.map((s, i) => (
              <motion.button
                key={s.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => pickStory(i)}
                className="w-full bg-white/85 border-2 border-rose-200 rounded-2xl p-4 text-left hover:bg-white hover:shadow transition-all flex items-center gap-3"
              >
                <div className="text-3xl">{s.emoji}</div>
                <div className="flex-1">
                  <h3 className="font-fredoka font-bold text-rose-700">{s.title}</h3>
                  <p className="font-nunito text-rose-500 text-xs">{s.blanks.length} blanks to fill</p>
                </div>
                <div className="text-rose-400">▶</div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Word picking phase */}
        {tab === 'new' && story && !showResult && (
          <div>
            <div className="bg-white/85 border-2 border-rose-200 rounded-2xl p-4 mb-3">
              <p className="font-fredoka text-rose-700 text-sm mb-1">
                Word {step + 1} of {story.blanks.length}
              </p>
              <div className="bg-rose-100 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-2 bg-gradient-to-r from-pink-400 to-rose-400"
                  animate={{ width: `${((step) / story.blanks.length) * 100}%` }}
                />
              </div>
              <p className="font-fredoka font-bold text-rose-900 text-lg mt-3">
                {story.blanks[step].label}
              </p>
              <p className="font-nunito text-rose-500 text-xs">({story.blanks[step].type.toLowerCase()})</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {wordOptions(story.blanks[step].type).map(w => (
                <motion.button
                  key={w}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => pickWord(w)}
                  className="bg-gradient-to-br from-pink-100 to-rose-100 border-2 border-pink-200 hover:border-pink-400 rounded-xl py-3 px-2 font-fredoka text-rose-700 hover:bg-pink-100 transition-colors text-sm"
                >
                  {w}
                </motion.button>
              ))}
            </div>

            <button onClick={newStory} className="w-full mt-3 py-2 bg-rose-100 text-rose-500 rounded-full font-fredoka text-sm">
              ← Pick different story
            </button>
          </div>
        )}

        {/* Story result */}
        {tab === 'new' && story && showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white to-rose-50 border-4 border-rose-300 rounded-3xl p-5 shadow-xl"
          >
            <div className="text-center mb-3">
              <div className="text-5xl">{story.emoji}</div>
              <h2 className="font-fredoka font-bold text-rose-700 text-xl">{story.title}</h2>
            </div>
            <p className="font-nunito text-gray-800 leading-relaxed text-base mb-4">
              {story.render(words).split(new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`)).map((part, i) => {
                if (words.includes(part)) {
                  return <span key={i} className="bg-yellow-200 font-bold text-rose-700 px-1 rounded">{part}</span>;
                }
                return <span key={i}>{part}</span>;
              })}
            </p>
            <p className="text-center font-nunito text-rose-600 text-sm mb-3">+15 XP for finishing the story!</p>
            <div className="flex gap-2">
              <button onClick={saveEntry} className="flex-1 btn-kid">💾 Save to Diary</button>
              <button onClick={newStory} className="flex-1 btn-kid-secondary">✏️ New Story</button>
            </div>
          </motion.div>
        )}

        {/* SHELF tab */}
        {tab === 'shelf' && (
          <div>
            {entries.length === 0 ? (
              <div className="bg-white/85 border-2 border-rose-200 rounded-2xl p-8 text-center">
                <div className="text-4xl mb-2">📚</div>
                <p className="font-fredoka text-rose-700">Your diary is empty!</p>
                <p className="font-nunito text-rose-500 text-sm">Write a story to add your first page ✨</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map(e => {
                  const tmpl = STORIES.find(s => s.id === e.storyId);
                  return (
                    <motion.button
                      key={e.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setViewEntry(e); playPop(); }}
                      className="w-full bg-white/85 border-2 border-rose-200 rounded-2xl p-3 text-left flex items-center gap-3 hover:bg-white"
                    >
                      <div className="text-2xl">{tmpl?.emoji || '📔'}</div>
                      <div className="flex-1">
                        <p className="font-fredoka font-bold text-rose-700 text-sm">{e.title}</p>
                        <p className="font-nunito text-rose-400 text-xs">{e.date} · {e.words.length} words</p>
                      </div>
                      <div className="text-rose-400">▶</div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* View saved entry */}
        <AnimatePresence>
          {viewEntry && (() => {
            const tmpl = STORIES.find(s => s.id === viewEntry.storyId);
            if (!tmpl) return null;
            return (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
                onClick={() => setViewEntry(null)}
              >
                <motion.div
                  initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-gradient-to-br from-white to-rose-50 rounded-3xl p-5 max-w-md w-full border-4 border-rose-300"
                >
                  <div className="text-center mb-3">
                    <div className="text-5xl">{tmpl.emoji}</div>
                    <h2 className="font-fredoka font-bold text-rose-700 text-xl">{viewEntry.title}</h2>
                    <p className="font-nunito text-rose-400 text-xs">{viewEntry.date}</p>
                  </div>
                  <p className="font-nunito text-gray-800 leading-relaxed mb-4">
                    {tmpl.render(viewEntry.words)}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setViewEntry(null)} className="flex-1 btn-kid-secondary">Close</button>
                    <button onClick={() => deleteEntry(viewEntry.id)} className="flex-1 bg-red-100 text-red-600 rounded-full font-fredoka py-2 hover:bg-red-200">🗑️ Delete</button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default IdolDiary;
