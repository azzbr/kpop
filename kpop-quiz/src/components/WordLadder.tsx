import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { playClick, playCorrect, playWrong, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';

// Valid 3-letter words (subset for validation)
const VALID_WORDS = new Set([
  'cat','bat','hat','mat','rat','sat','fat','pat','tap','top','tip','tin','tan','ran',
  'run','sun','gun','fun','bun','bud','bad','bag','ban','bay','bee','bed','big','bit',
  'box','boy','bug','bus','but','cab','can','cap','car','cob','cod','cog','cop','cot',
  'cow','cry','cub','cup','cut','dab','dam','dip','dog','dot','dry','dug','dye','ear',
  'eat','egg','elf','elk','elm','end','era','eve','ewe','eye','fad','fan','far','fig',
  'fit','fix','fly','fog','for','fox','fry','gap','gas','get','gin','gob','god','got',
  'gum','gut','guy','ham','has','hay','hen','her','hid','him','hip','his','hit','hob',
  'hog','hop','hot','how','hub','hug','hum','hut','ice','ill','imp','ink','inn','ion',
  'ivy','jab','jag','jam','jar','jaw','jay','jet','jig','job','jog','jot','joy','jug',
  'jut','keg','key','kid','kin','kit','lab','lad','lag','lap','law','lay','led','leg',
  'let','lid','lip','lit','log','lot','low','lug','map','may','men','met','mid','mix',
  'mob','mod','mom','mop','mud','mug','nab','nag','nap','net','nip','nit','nob','nod',
  'nor','not','now','nun','nut','oak','oar','oat','odd','off','oil','old','one','opt',
  'orb','ore','our','out','own','pad','pal','pan','paw','pay','peg','pen','pet','pie',
  'pig','pin','pit','pod','pop','pot','pow','pro','pub','pun','pup','pus','put','rag',
  'ram','rap','raw','ray','red','ref','rep','rib','rid','rig','rim','rip','rob','rod',
  'rot','row','rub','rug','rum','rut','rye','sag','sap','saw','say','sea','set','sew',
  'shy','sip','sir','sit','six','ski','sky','sly','sob','sod','son','sop','sot','sow',
  'soy','spa','spy','sub','sue','sum','sup','tab','tag','tar','tax','tea','ten','the',
  'tie','tom','too','tot','tow','toy','try','tub','tug','two','urn','use','van','vat',
  'via','vim','vow','wag','war','was','way','web','wed','wet','who','why','wig','win',
  'wit','woe','wok','won','woo','wow','yak','yam','yap','yaw','yes','yet','yew','yip',
  'you','yow','zag','zap','zen','zig','zip','zoo',
  // 4-letter words
  'star','kpop','idol','song','band','beat','love','dare','pink','blue','gold','bold',
  'cool','fire','jump','kick','wild','glow','sing','spin','show','fame','wave','fans',
  'care','dare','fare','hare','mare','pare','rare','bare','ware','barn','born','burn',
  'corn','earn','fern','firm','form','fork','harm','horn','lore','more','norm','port',
  'sort','torn','wore','yarn','cake','fake','lake','make','rake','sake','take','wake',
  'bake','bike','dike','hike','like','mike','pike','time','lime','mime','dime','grime',
  'game','came','dame','fame','lame','name','same','tame','bone','cone','done','gone',
  'lone','none','tone','zone','hone','tune','June','dune','rune','cute','mute','lute',
  'blue','clue','due','glue','hue','sue','true',
]);

const PUZZLES = [
  { start: 'cat', end: 'dog', hint: 'cat → ? → ? → dog', steps: 3 },
  { start: 'hot', end: 'fog', hint: 'hot → ? → ? → fog', steps: 3 },
  { start: 'fan', end: 'sun', hint: 'fan → ? → sun', steps: 2 },
  { start: 'hat', end: 'bug', hint: 'hat → ? → ? → bug', steps: 3 },
  { start: 'pin', end: 'log', hint: 'pin → ? → ? → log', steps: 3 },
  { start: 'cake', end: 'bike', hint: 'cake → ? → bike', steps: 2 },
  { start: 'star', end: 'scar', hint: 'star → ? → scar', steps: 2 },
  { start: 'love', end: 'live', hint: 'love → live', steps: 1 },
];

function differsBy1(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
    if (diffs > 1) return false;
  }
  return diffs === 1;
}

const WordLadder: React.FC = () => {
  const { setGameState, addXP } = useGameStore();
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [chain, setChain] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [won, setWon] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [solved, setSolved] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('wordladder_solved') || '[]')); } catch { return new Set(); }
  });

  const puzzle = PUZZLES[puzzleIdx];

  const resetPuzzle = (idx: number) => {
    setPuzzleIdx(idx);
    setChain([PUZZLES[idx].start]);
    setInput('');
    setError('');
    setWon(false);
  };

  useMemo(() => { setChain([puzzle.start]); }, [puzzleIdx]);

  const last = chain[chain.length - 1];

  const submitWord = () => {
    const word = input.toLowerCase().trim();
    if (!word) return;

    if (word.length !== puzzle.start.length) {
      setError(`Must be ${puzzle.start.length} letters!`);
      playWrong();
      return;
    }
    if (chain.includes(word)) {
      setError('Already used that word!');
      playWrong();
      return;
    }
    if (!differsBy1(last, word)) {
      setError('Change exactly 1 letter!');
      playWrong();
      return;
    }
    if (!VALID_WORDS.has(word)) {
      setError('Not a valid word!');
      playWrong();
      return;
    }

    setError('');
    playCorrect();
    const newChain = [...chain, word];
    setChain(newChain);
    setInput('');

    if (word === puzzle.end) {
      playWin();
      setWon(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      addXP(25 + Math.max(0, (puzzle.steps + 2 - newChain.length) * 5));
      const newSolved = new Set([...solved, puzzleIdx]);
      setSolved(newSolved);
      localStorage.setItem('wordladder_solved', JSON.stringify([...newSolved]));
    }
  };

  const handleUndo = () => {
    if (chain.length <= 1) return;
    playClick();
    setChain(c => c.slice(0, -1));
    setError('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      {showConfetti && <ConfettiBurst count={60} durationMs={2500} />}

      <div className="max-w-md w-full mx-auto">
        <button onClick={() => { playClick(); setGameState('game_mode'); }} className="btn-kid-secondary mb-4">← Back</button>

        <div className="text-center mb-4">
          <div className="text-5xl mb-1">🔤</div>
          <h1 className="text-4xl font-fredoka font-bold text-blue-600 text-kid-glow">Word Ladder</h1>
          <p className="font-nunito text-gray-500 text-sm">Change one letter at a time to reach the goal!</p>
        </div>

        {/* Puzzle selector */}
        <div className="flex gap-1.5 flex-wrap justify-center mb-4">
          {PUZZLES.map((p, i) => (
            <button
              key={i}
              onClick={() => { playClick(); resetPuzzle(i); }}
              className={`px-3 py-1.5 rounded-full font-fredoka text-sm border-2 transition-colors relative ${
                i === puzzleIdx
                  ? 'bg-blue-500 border-blue-600 text-white'
                  : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
              }`}
            >
              {p.start}→{p.end}
              {solved.has(i) && <span className="absolute -top-1 -right-1 text-xs">✅</span>}
            </button>
          ))}
        </div>

        {/* Goal display */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow border-2 border-blue-200 mb-4 flex items-center justify-between">
          <div className="text-center">
            <p className="font-nunito text-xs text-gray-400">Start</p>
            <p className="font-fredoka font-bold text-2xl text-blue-600 uppercase">{puzzle.start}</p>
          </div>
          <div className="text-2xl">→</div>
          <div className="text-center">
            <p className="font-nunito text-xs text-gray-400">Goal</p>
            <p className="font-fredoka font-bold text-2xl text-green-600 uppercase">{puzzle.end}</p>
          </div>
          <div className="text-center">
            <p className="font-nunito text-xs text-gray-400">Steps</p>
            <p className="font-fredoka font-bold text-xl text-gray-600">{chain.length - 1}</p>
          </div>
        </div>

        {/* Chain display */}
        <div className="bg-white rounded-3xl p-4 shadow-xl border-2 border-blue-200 mb-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {chain.map((word, i) => (
              <React.Fragment key={i}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`px-4 py-2 rounded-xl font-fredoka font-bold text-xl uppercase shadow ${
                    i === 0 ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' :
                    word === puzzle.end ? 'bg-green-100 text-green-700 border-2 border-green-400' :
                    'bg-purple-100 text-purple-700 border-2 border-purple-200'
                  }`}
                >
                  {word}
                </motion.div>
                {i < chain.length - 1 && <div className="self-center text-gray-300 font-bold">→</div>}
              </React.Fragment>
            ))}
            {!won && (
              <div className="self-center text-gray-300 font-bold">→</div>
            )}
            {!won && (
              <div className="px-4 py-2 rounded-xl font-fredoka font-bold text-xl uppercase bg-green-50 text-green-400 border-2 border-dashed border-green-200">
                {puzzle.end}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        {!won && (
          <div className="flex gap-2 mb-2">
            <input
              value={input}
              onChange={e => { setInput(e.target.value.toLowerCase().replace(/[^a-z]/g, '')); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && submitWord()}
              maxLength={puzzle.start.length}
              placeholder={`${puzzle.start.length}-letter word...`}
              className="flex-1 border-2 border-blue-200 rounded-xl px-4 py-3 font-fredoka text-lg uppercase focus:outline-none focus:border-blue-400 text-center tracking-widest"
            />
            <button onClick={submitWord} className="btn-kid px-4">Go!</button>
          </div>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center font-nunito text-red-500 text-sm mb-2"
          >
            {error}
          </motion.p>
        )}

        {chain.length > 1 && !won && (
          <button onClick={handleUndo} className="w-full py-2 font-fredoka text-gray-500 hover:text-red-500 transition-colors">
            ↩️ Undo last step
          </button>
        )}

        {/* Hint */}
        {!won && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-3 mt-3 text-center">
            <p className="font-nunito text-yellow-700 text-sm">💡 Hint: {puzzle.hint}</p>
          </div>
        )}

        {/* Win banner */}
        <AnimatePresence>
          {won && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-green-400 text-center"
            >
              <div className="text-6xl mb-2">🎉</div>
              <h2 className="text-3xl font-fredoka font-bold text-green-600 mb-1">You did it!</h2>
              <p className="font-nunito text-gray-600 mb-1">
                {chain.join(' → ')} in {chain.length - 1} steps!
              </p>
              <p className="font-nunito text-purple-600 mb-3">+XP earned!</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {puzzleIdx + 1 < PUZZLES.length && (
                  <button onClick={() => { playClick(); resetPuzzle(puzzleIdx + 1); }} className="btn-kid">➡️ Next</button>
                )}
                <button onClick={() => { playClick(); resetPuzzle(puzzleIdx); }} className="btn-kid-secondary">🔄 Again</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default WordLadder;
