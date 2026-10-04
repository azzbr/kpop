import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import type { SavedQuiz } from '../store';
import type { QuizQuestion, QuestionType } from '../data/quiz/types';
import { blockedWord } from '../utils/cleanText';
import { playClick, playWin, playWrong } from '../utils/sounds';
import { setArenaSource } from './games/quizArenaSource';

const EMOJIS = ['🧠', '🌍', '🐾', '🚀', '⚽', '🎵', '🍕', '🦸', '🏰', '🎨', '🐉', '🌈'];
const MAX_Q = 30;
const TYPES: { id: QuestionType; label: string; emoji: string }[] = [
  { id: 'choice', label: 'Multiple choice', emoji: '🔤' },
  { id: 'truefalse', label: 'True or false', emoji: '✅' },
  { id: 'type', label: 'Type the answer', emoji: '⌨️' },
  { id: 'order', label: 'Put in order', emoji: '🔢' },
  { id: 'poll', label: 'Poll (no right answer)', emoji: '🗳️' },
];

const blank = (type: QuestionType): QuizQuestion => {
  switch (type) {
    case 'choice': return { type, text: '', options: ['', '', '', ''], correct: 0 };
    case 'truefalse': return { type, text: '', options: ['True', 'False'], correct: 0 };
    case 'type': return { type, text: '', answers: [''] };
    case 'order': return { type, text: '', options: ['', '', ''] };
    case 'poll': return { type, text: '', options: ['', ''] };
  }
};

/** Tidies a question and returns a problem to show, or null if it's good. */
function check(q: QuizQuestion): string | null {
  if (!q.text.trim()) return 'Write the question first.';
  const opts = (q.options ?? []).map(o => o.trim());
  if (q.type === 'choice') {
    const filled = opts.filter(Boolean);
    if (filled.length < 2) return 'Add at least 2 answers.';
    if (!opts[q.correct ?? 0]) return 'Tap ✅ next to the right answer.';
    if (new Set(filled.map(o => o.toLowerCase())).size !== filled.length) return 'Two answers are the same.';
  }
  if (q.type === 'type' && !(q.answers ?? []).some(a => a.trim())) return 'Add the right answer.';
  if (q.type === 'order' && opts.filter(Boolean).length < 3) return 'Add at least 3 things to put in order.';
  if (q.type === 'poll' && opts.filter(Boolean).length < 2) return 'Add at least 2 choices.';
  const all = [q.text, ...opts, ...(q.answers ?? [])].join(' ');
  const bad = blockedWord(all);
  if (bad) return `Let's keep it friendly — please change "${bad}".`;
  return null;
}

function tidy(q: QuizQuestion): QuizQuestion {
  if (q.type === 'choice') {
    // Drop empty options but keep the correct one pointed at the right text.
    const right = q.options![q.correct ?? 0];
    const options = q.options!.map(o => o.trim()).filter(Boolean);
    return { ...q, text: q.text.trim(), options, correct: Math.max(0, options.indexOf(right.trim())) };
  }
  if (q.type === 'order' || q.type === 'poll') return { ...q, text: q.text.trim(), options: q.options!.map(o => o.trim()).filter(Boolean) };
  if (q.type === 'type') return { ...q, text: q.text.trim(), answers: q.answers!.map(a => a.trim()).filter(Boolean) };
  return { ...q, text: q.text.trim() };
}

const input = 'w-full min-h-[48px] rounded-xl bg-white text-slate-900 px-3 font-nunito text-lg';

export default function QuizMaker() {
  const { myQuizzes, saveQuiz, deleteQuiz, setGameState } = useGameStore();
  const [editing, setEditing] = useState<SavedQuiz | null>(null);
  const [qIdx, setQIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuizQuestion | null>(null);
  const [error, setError] = useState('');

  const newQuiz = () => {
    playClick();
    setEditing({ id: Math.random().toString(36).slice(2, 10), title: '', emoji: '🧠', questions: [], updatedAt: Date.now() });
  };

  const saveAll = () => {
    if (!editing) return;
    if (!editing.title.trim()) { setError('Give your quiz a name.'); playWrong(); return; }
    const bad = blockedWord(editing.title);
    if (bad) { setError(`Let's keep it friendly — please change "${bad}".`); playWrong(); return; }
    if (editing.questions.length < 3) { setError('Add at least 3 questions.'); playWrong(); return; }
    saveQuiz({ ...editing, title: editing.title.trim() });
    playWin();
    setEditing(null);
    setError('');
  };

  const openQuestion = (i: number | null, type: QuestionType = 'choice') => {
    playClick();
    setQIdx(i);
    setDraft(i === null ? blank(type) : structuredClone(editing!.questions[i]));
    setError('');
  };

  const saveQuestion = () => {
    if (!draft || !editing) return;
    const problem = check(draft);
    if (problem) { setError(problem); playWrong(); return; }
    const q = tidy(draft);
    const questions = [...editing.questions];
    if (qIdx === null) questions.push(q); else questions[qIdx] = q;
    setEditing({ ...editing, questions });
    setDraft(null);
    setError('');
    playClick();
  };

  // ---------------------------------------------------------------- question editor
  if (editing && draft) {
    const setOpt = (i: number, v: string) => setDraft({ ...draft, options: draft.options!.map((o, j) => (j === i ? v : o)) });
    return (
      <Screen title={qIdx === null ? 'New question' : `Question ${qIdx + 1}`} onBack={() => { setDraft(null); setError(''); }}>
        <div className="flex flex-wrap gap-2 mb-4">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setDraft({ ...blank(t.id), text: draft.text })}
              className={`min-h-[44px] px-3 rounded-xl font-fredoka ${draft.type === t.id ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <label className="block font-fredoka text-lg mb-1">Question</label>
        <textarea value={draft.text} maxLength={110} rows={2} onChange={e => setDraft({ ...draft, text: e.target.value })}
          className={`${input} py-2`} placeholder="e.g. What is my cat called?" />
        <label className="block font-fredoka text-lg mt-3 mb-1">Picture emoji <span className="font-nunito text-sm text-violet-300">(optional)</span></label>
        <input value={draft.emoji ?? ''} maxLength={8} onChange={e => setDraft({ ...draft, emoji: e.target.value || undefined })} className={`${input} w-32`} placeholder="🐱" />

        {draft.type === 'choice' && (
          <div className="mt-4 space-y-2">
            <p className="font-fredoka text-lg">Answers — tap ✅ for the right one</p>
            {draft.options!.map((o, i) => (
              <div key={i} className="flex gap-2 items-center">
                <button onClick={() => setDraft({ ...draft, correct: i })} aria-label={`Mark answer ${i + 1} correct`}
                  className={`w-12 h-12 rounded-xl text-2xl shrink-0 ${draft.correct === i ? 'bg-green-500' : 'bg-white/10'}`}>{draft.correct === i ? '✅' : '⬜'}</button>
                <input value={o} maxLength={28} onChange={e => setOpt(i, e.target.value)} className={input} placeholder={`Answer ${i + 1}${i >= 2 ? ' (optional)' : ''}`} />
              </div>
            ))}
          </div>
        )}
        {draft.type === 'truefalse' && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {['True', 'False'].map((l, i) => (
              <button key={l} onClick={() => setDraft({ ...draft, correct: i })}
                className={`min-h-[60px] rounded-2xl font-fredoka text-2xl ${draft.correct === i ? (i === 0 ? 'bg-green-500' : 'bg-red-500') : 'bg-white/10'}`}>
                {i === 0 ? '✔' : '✖'} {l} is right
              </button>
            ))}
          </div>
        )}
        {draft.type === 'type' && (
          <div className="mt-4 space-y-2">
            <p className="font-fredoka text-lg">Right answer <span className="font-nunito text-sm text-violet-300">(add other spellings too — small typos are OK anyway)</span></p>
            {draft.answers!.map((a, i) => (
              <input key={i} value={a} maxLength={28} className={input} placeholder={i === 0 ? 'Answer' : 'Another way to write it'}
                onChange={e => setDraft({ ...draft, answers: draft.answers!.map((x, j) => (j === i ? e.target.value : x)) })} />
            ))}
            {draft.answers!.length < 3 && <button onClick={() => setDraft({ ...draft, answers: [...draft.answers!, ''] })} className="min-h-[44px] px-4 rounded-xl bg-white/10 font-fredoka">+ Another spelling</button>}
          </div>
        )}
        {(draft.type === 'order' || draft.type === 'poll') && (
          <div className="mt-4 space-y-2">
            <p className="font-fredoka text-lg">{draft.type === 'order' ? 'Write them in the RIGHT order (they get shuffled)' : 'Choices'}</p>
            {draft.options!.map((o, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="w-8 font-fredoka text-xl text-center">{i + 1}</span>
                <input value={o} maxLength={28} onChange={e => setOpt(i, e.target.value)} className={input} />
              </div>
            ))}
            {draft.options!.length < (draft.type === 'order' ? 5 : 4) && (
              <button onClick={() => setDraft({ ...draft, options: [...draft.options!, ''] })} className="min-h-[44px] px-4 rounded-xl bg-white/10 font-fredoka">+ Add one</button>
            )}
          </div>
        )}
        <label className="block font-fredoka text-lg mt-4 mb-1">Fun fact after the answer <span className="font-nunito text-sm text-violet-300">(optional)</span></label>
        <input value={draft.fact ?? ''} maxLength={90} onChange={e => setDraft({ ...draft, fact: e.target.value || undefined })} className={input} />

        <ErrorLine error={error} />
        <button onClick={saveQuestion} className="mt-4 w-full min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl">Save question ✔</button>
      </Screen>
    );
  }

  // ---------------------------------------------------------------- quiz editor
  if (editing) {
    return (
      <Screen title={editing.title || 'New quiz'} onBack={() => { setEditing(null); setError(''); }}>
        <label className="block font-fredoka text-lg mb-1">Quiz name</label>
        <input value={editing.title} maxLength={30} onChange={e => setEditing({ ...editing, title: e.target.value })} className={input} placeholder="e.g. How well do you know me?" />
        <div className="flex flex-wrap gap-2 mt-3">
          {EMOJIS.map(e => (
            <button key={e} onClick={() => setEditing({ ...editing, emoji: e })}
              className={`w-12 h-12 rounded-xl text-2xl ${editing.emoji === e ? 'bg-fuchsia-500 ring-2 ring-white' : 'bg-white/10'}`}>{e}</button>
          ))}
        </div>

        <h2 className="font-fredoka text-2xl mt-5 mb-2">Questions ({editing.questions.length}/{MAX_Q})</h2>
        <div className="space-y-2">
          {editing.questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 rounded-2xl bg-white/10 p-2">
              <button onClick={() => openQuestion(i)} className="flex-1 text-left min-h-[48px] px-2 font-nunito text-lg">
                <span className="font-fredoka">{i + 1}.</span> {TYPES.find(t => t.id === q.type)?.emoji} {q.text}
              </button>
              <button disabled={i === 0} aria-label="Move up" onClick={() => {
                const qs = [...editing.questions]; [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; setEditing({ ...editing, questions: qs });
              }} className="w-11 h-11 rounded-xl bg-white/10 disabled:opacity-30">⬆️</button>
              <button aria-label="Delete question" onClick={() => setEditing({ ...editing, questions: editing.questions.filter((_, j) => j !== i) })}
                className="w-11 h-11 rounded-xl bg-white/10">🗑️</button>
            </div>
          ))}
        </div>
        {editing.questions.length < MAX_Q && (
          <div className="flex flex-wrap gap-2 mt-3">
            {TYPES.map(t => (
              <button key={t.id} onClick={() => openQuestion(null, t.id)} className="min-h-[48px] px-3 rounded-xl bg-white/15 font-fredoka">+ {t.emoji} {t.label}</button>
            ))}
          </div>
        )}
        <ErrorLine error={error} />
        <button onClick={saveAll} className="mt-5 w-full min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl">💾 Save quiz</button>
      </Screen>
    );
  }

  // ---------------------------------------------------------------- list
  return (
    <Screen title="🛠️ Quiz Maker" onBack={() => setGameState('game_mode')}>
      <p className="font-nunito text-lg text-violet-100 mb-4">
        Make your own quiz, then play it here or host it for friends in <b>Friends Arena → Quiz Party</b> (pick it under “My quizzes”). Your quizzes stay on this iPad.
      </p>
      <button onClick={newQuiz} className="w-full min-h-[64px] rounded-2xl bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl mb-4">+ New quiz</button>
      <AnimatePresence>
        {myQuizzes.map(q => (
          <motion.div key={q.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-white/10 p-3 mb-2 flex items-center gap-3">
            <span className="text-4xl">{q.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-fredoka text-xl truncate">{q.title}</div>
              <div className="font-nunito text-sm text-violet-300">{q.questions.length} questions</div>
            </div>
            <button onClick={() => { playClick(); setArenaSource(`mine:${q.id}`); setGameState('quiz_arena'); }} className="min-h-[48px] px-4 rounded-xl bg-green-600 font-fredoka">▶ Play</button>
            <button onClick={() => { playClick(); setEditing(structuredClone(q)); }} className="min-h-[48px] px-4 rounded-xl bg-white/15 font-fredoka">✏️ Edit</button>
            <button onClick={() => { if (window.confirm(`Delete "${q.title}"?`)) deleteQuiz(q.id); }} aria-label="Delete quiz" className="w-12 h-12 rounded-xl bg-white/15">🗑️</button>
          </motion.div>
        ))}
      </AnimatePresence>
      {myQuizzes.length === 0 && <p className="text-center font-nunito text-violet-300 mt-6">No quizzes yet — make your first one! ✨</p>}
    </Screen>
  );
}

function Screen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="arcade-bg min-h-screen-d text-white px-4 py-5">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => { playClick(); onBack(); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
          <h1 className="font-fredoka text-3xl truncate">{title}</h1>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

function ErrorLine({ error }: { error: string }) {
  return error ? <p className="mt-3 font-nunito text-lg text-amber-300">⚠️ {error}</p> : null;
}
