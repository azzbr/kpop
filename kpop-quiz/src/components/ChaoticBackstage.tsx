import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playWin, playPop, playCorrect } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

interface Blank {
  type: string;
  label: string;
  hint: string;
}

interface Story {
  title: string;
  emoji: string;
  blanks: Blank[];
  render: (vals: string[]) => string;
}

const STORIES: Story[] = [
  {
    title: 'The Concert Disaster',
    emoji: '🎤',
    blanks: [
      { type: 'person', label: 'Student A', hint: 'a classmate\'s name' },
      { type: 'action', label: 'Silly action', hint: 'something silly, e.g. sneezed, tripped' },
      { type: 'person', label: 'Student B', hint: 'another classmate\'s name' },
      { type: 'body_part', label: 'Body part', hint: 'e.g. left elbow, big toe' },
      { type: 'reaction', label: 'Crowd reaction', hint: 'what the crowd did, e.g. levitated' },
      { type: 'object', label: 'Random object', hint: 'something unexpected' },
    ],
    render: ([a, act, b, bp, react, obj]) =>
      `During the biggest HUNTR/X concert of the year, ${a} accidentally ${act} on ${b}'s ${bp}, causing the entire crowd to ${react}. Security tried to restore order using only a ${obj}. Historians still debate whether it was the best or worst concert ever.`,
  },
  {
    title: 'The Idol Audition',
    emoji: '⭐',
    blanks: [
      { type: 'person', label: 'Auditionee', hint: 'a classmate\'s name' },
      { type: 'talent', label: 'Talent', hint: 'e.g. yodelling, backwards walking' },
      { type: 'adj', label: 'Describing word', hint: 'e.g. magnificent, catastrophic' },
      { type: 'person', label: 'Judge', hint: 'another classmate\'s name' },
      { type: 'food', label: 'Food', hint: 'any food' },
      { type: 'number', label: 'A number', hint: 'any number' },
    ],
    render: ([aud, tal, adj, judge, food, num]) =>
      `${aud} walked onto the HUNTR/X audition stage and immediately began ${tal}. The performance was so ${adj} that judge ${judge} dropped their ${food} in shock. The crowd gave a standing ovation of exactly ${num} seconds. The talent scouts signed them immediately.`,
  },
  {
    title: 'The Secret Rehearsal',
    emoji: '🕺',
    blanks: [
      { type: 'person', label: 'Secret dancer', hint: 'a classmate\'s name' },
      { type: 'location', label: 'Location', hint: 'e.g. the library, the car park' },
      { type: 'dance_move', label: 'Dance move', hint: 'e.g. the worm, moonwalk' },
      { type: 'person', label: 'Witness', hint: 'who caught them' },
      { type: 'animal', label: 'Animal', hint: 'any animal' },
      { type: 'emotion', label: 'Emotion', hint: 'how they felt, e.g. horrified, delighted' },
    ],
    render: ([dancer, loc, move, witness, animal, emo]) =>
      `${dancer} was secretly rehearsing K-pop moves in ${loc} when they attempted the legendary ${move}. Suddenly, ${witness} walked in — along with a stray ${animal}. Everyone was ${emo}. The video somehow got 4 million views overnight.`,
  },
  {
    title: 'The Album Release Party',
    emoji: '💿',
    blanks: [
      { type: 'person', label: 'Party host', hint: 'a classmate\'s name' },
      { type: 'adjective', label: 'Album title word', hint: 'e.g. Glittery, Chaotic' },
      { type: 'person', label: 'Party crasher', hint: 'another classmate\'s name' },
      { type: 'item', label: 'Strange item brought', hint: 'something unexpected' },
      { type: 'adj2', label: 'How the party ended', hint: 'e.g. upside down, on fire' },
      { type: 'person', label: 'Person who fixed it', hint: 'the class hero' },
    ],
    render: ([host, adj, crasher, item, end, hero]) =>
      `${host} threw the biggest album release party for HUNTR/X's new album "${adj} Nights". Everything was perfect until ${crasher} arrived carrying a ${item}. By midnight the party was completely ${end}. Only ${hero} knew how to save the evening — and they did it perfectly.`,
  },
  {
    title: 'The Fan Meet Chaos',
    emoji: '🌟',
    blanks: [
      { type: 'person', label: 'Fan 1', hint: 'a classmate\'s name' },
      { type: 'idol', label: 'Idol name', hint: 'made-up idol name' },
      { type: 'gift', label: 'Gift given', hint: 'e.g. a sock, a drawing of a dog' },
      { type: 'person', label: 'Fan 2', hint: 'another classmate\'s name' },
      { type: 'quote', label: 'Dramatic quote', hint: 'something dramatic to say' },
      { type: 'escape', label: 'Escape method', hint: 'how they escaped, e.g. via helicopter' },
    ],
    render: ([fan1, idol, gift, fan2, quote, escape]) =>
      `At the HUNTR/X fan meet, ${fan1} handed idol ${idol} a ${gift}. The idol was so moved they whispered "${quote}". Pandemonium broke out. ${fan2} grabbed the microphone and announced something unrepeatable. Everyone escaped ${escape}. It was the fan meet of the century.`,
  },
];

type Phase = 'setup' | 'filling' | 'reveal';

export default function ChaoticBackstage() {
  const { setGameState } = useGameStore();
  const [roster, setRoster] = useState<string[]>([]);
  const [story, setStory] = useState<Story>(STORIES[0]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [values, setValues] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('setup');
  const [fillIdx, setFillIdx] = useState(0);
  const [input, setInput] = useState('');
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('jarvis_students');
      if (raw) {
        const list: { name: string }[] = JSON.parse(raw);
        setRoster(list.map(s => s.name).filter(Boolean));
      }
    } catch { /* ignore */ }
  }, []);

  const pickStory = (s: Story) => {
    setStory(s);
    playClick();
  };

  const startFilling = () => {
    // assign roster names to person-type blanks
    const shuffled = [...roster].sort(() => Math.random() - 0.5);
    const assign: Record<number, string> = {};
    let ri = 0;
    story.blanks.forEach((b, i) => {
      if (b.type === 'person' && shuffled[ri]) {
        assign[i] = shuffled[ri++];
      }
    });
    setAssignments(assign);
    setValues(Array(story.blanks.length).fill(''));
    setFillIdx(0);
    setInput(assign[0] ?? '');
    setPhase('filling');
    playPop();
  };

  const submitBlank = () => {
    const val = input.trim() || '???';
    const next = [...values];
    next[fillIdx] = val;
    setValues(next);
    playCorrect();

    const nextIdx = fillIdx + 1;
    if (nextIdx >= story.blanks.length) {
      setPhase('reveal');
      setConfetti(true);
      playWin();
      setTimeout(() => setConfetti(false), 4000);
    } else {
      setFillIdx(nextIdx);
      setInput(assignments[nextIdx] ?? '');
    }
  };

  const reset = () => {
    setPhase('setup');
    setValues([]);
    setFillIdx(0);
    setInput('');
    setAssignments({});
  };

  const currentBlank = story.blanks[fillIdx];
  const assignedName = assignments[fillIdx];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {confetti && <ConfettiBurst count={100} durationMs={4000} />}

      <div className="w-full max-w-xl">
        <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary mb-4 font-fredoka">
          ← Back
        </button>

        <div className="card-kid bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white text-center mb-4">
          <h1 className="font-fredoka text-4xl mb-1">🎭 Chaotic Backstage</h1>
          <p className="font-nunito text-rose-100 text-sm">
            Each student fills one blank — then Mr. Jarvis reads the whole story aloud!
          </p>
        </div>

        {/* Setup */}
        {phase === 'setup' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {roster.length > 0 && (
              <div className="card-kid bg-white">
                <h3 className="font-fredoka text-purple-700 mb-2">👥 Roster from Mr. Jarvis ({roster.length} students)</h3>
                <div className="flex flex-wrap gap-2">
                  {roster.map(n => (
                    <span key={n} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-nunito text-sm">{n}</span>
                  ))}
                </div>
                <p className="font-nunito text-xs text-gray-400 mt-2">
                  Students with "person" blanks will be auto-assigned their names. Other blanks = everyone contributes!
                </p>
              </div>
            )}

            {roster.length === 0 && (
              <div className="card-kid bg-amber-50 border-amber-300">
                <p className="font-nunito text-amber-800 text-sm">
                  💡 Add students in <strong>Mr. Jarvis's Lounge → Roll Call</strong> to auto-assign names to blanks. You can still play without them!
                </p>
              </div>
            )}

            <div className="card-kid bg-white">
              <h3 className="font-fredoka text-purple-700 text-xl mb-3">📖 Choose a story</h3>
              <div className="space-y-2">
                {STORIES.map(s => (
                  <motion.button
                    key={s.title}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => pickStory(s)}
                    className={`w-full p-3 rounded-2xl border-2 text-left flex items-center gap-3 transition-colors ${
                      story.title === s.title
                        ? 'border-fuchsia-400 bg-fuchsia-50'
                        : 'border-gray-200 bg-white hover:border-fuchsia-300'
                    }`}
                  >
                    <span className="text-2xl">{s.emoji}</span>
                    <div>
                      <div className="font-fredoka text-gray-800">{s.title}</div>
                      <div className="font-nunito text-xs text-gray-500">{s.blanks.length} blanks</div>
                    </div>
                    {story.title === s.title && <span className="ml-auto text-fuchsia-500">✓</span>}
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={startFilling}
              className="w-full btn-kid font-fredoka text-xl py-5"
            >
              🎭 Start Filling Blanks!
            </motion.button>
          </motion.div>
        )}

        {/* Filling blanks */}
        {phase === 'filling' && (
          <motion.div
            key={fillIdx}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="card-kid bg-white text-center">
              <div className="font-nunito text-gray-500 text-sm mb-1">
                Blank {fillIdx + 1} of {story.blanks.length}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <motion.div
                  animate={{ width: `${((fillIdx + 1) / story.blanks.length) * 100}%` }}
                  className="bg-fuchsia-500 h-2 rounded-full"
                />
              </div>
              <div className="text-5xl mb-3">{story.emoji}</div>
              <div className="font-fredoka text-2xl text-gray-800 mb-1">{currentBlank.label}</div>
              <div className="font-nunito text-gray-500 text-sm">e.g. {currentBlank.hint}</div>
            </div>

            <div className="card-kid bg-fuchsia-50 border-fuchsia-300">
              {assignedName ? (
                <>
                  <div className="font-fredoka text-fuchsia-700 text-lg mb-2">
                    📋 {assignedName}'s turn!
                  </div>
                  <p className="font-nunito text-fuchsia-600 text-sm mb-3">
                    Mr. Jarvis, call out <strong>{assignedName}</strong> — they fill this blank.
                  </p>
                </>
              ) : (
                <p className="font-nunito text-fuchsia-700 text-sm mb-3">
                  💡 Anyone in the class can shout their answer!
                </p>
              )}
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && input.trim() && submitBlank()}
                placeholder={`Type the ${currentBlank.label.toLowerCase()}...`}
                autoFocus
                className="w-full px-4 py-3 rounded-2xl border-2 border-fuchsia-300 focus:border-fuchsia-500 focus:outline-none font-nunito text-lg bg-white"
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={submitBlank}
                disabled={!input.trim()}
                className="w-full mt-3 btn-kid font-fredoka disabled:opacity-50"
              >
                {fillIdx < story.blanks.length - 1 ? 'Next blank →' : '🎭 Reveal the story!'}
              </motion.button>
            </div>

            <div className="card-kid bg-white">
              <h4 className="font-fredoka text-gray-600 mb-2">Filled so far:</h4>
              <div className="space-y-1">
                {story.blanks.slice(0, fillIdx).map((b, i) => (
                  <div key={i} className="flex gap-2 font-nunito text-sm">
                    <span className="text-gray-400">{b.label}:</span>
                    <span className="text-fuchsia-700 font-bold">{values[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Reveal */}
        {phase === 'reveal' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="card-kid bg-gradient-to-br from-yellow-300 to-orange-400 text-center">
              <div className="text-5xl mb-2">🎭</div>
              <h2 className="font-fredoka text-2xl text-orange-900 mb-1">{story.title}</h2>
              <p className="font-nunito text-orange-800 text-sm">Mr. Jarvis, read this aloud to the class! 👇</p>
            </div>

            <div className="card-kid bg-white border-4 border-fuchsia-300">
              <p className="font-nunito text-gray-800 text-lg leading-relaxed">
                {/* render with highlighted fills */}
                {story.render(values).split(/(\[.*?\])/g).map((part, i) => {
                  const filled = values.find(v => part.includes(v));
                  if (filled && values.includes(part)) {
                    return <mark key={i} className="bg-yellow-200 text-rose-700 font-bold px-1 rounded">{part}</mark>;
                  }
                  // highlight filled words
                  let result = part;
                  const segments: React.ReactNode[] = [];
                  let remaining = part;
                  values.forEach(v => {
                    if (!v || !remaining.includes(v)) return;
                    const idx = remaining.indexOf(v);
                    if (idx > 0) segments.push(<span key={`pre-${v}`}>{remaining.slice(0, idx)}</span>);
                    segments.push(<mark key={v} className="bg-yellow-200 text-rose-700 font-bold px-0.5 rounded">{v}</mark>);
                    remaining = remaining.slice(idx + v.length);
                  });
                  if (remaining) segments.push(<span key="tail">{remaining}</span>);
                  return segments.length > 1 ? <span key={i}>{segments}</span> : <span key={i}>{result}</span>;
                })}
              </p>
            </div>

            <div className="card-kid bg-white">
              <h4 className="font-fredoka text-gray-600 mb-2">The blanks were:</h4>
              <div className="grid grid-cols-2 gap-2">
                {story.blanks.map((b, i) => (
                  <div key={i} className="bg-fuchsia-50 rounded-xl p-2">
                    <div className="font-nunito text-xs text-gray-500">{b.label}</div>
                    <div className="font-fredoka text-fuchsia-700">{values[i]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button onClick={reset} className="btn-kid font-fredoka flex-1">New Story 🔁</button>
              <button onClick={() => setGameState('game_mode')} className="btn-kid-secondary font-fredoka flex-1">Done</button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
