import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { localDateKey } from '../utils/dates';
import { useSafeTimeout } from '../utils/useSafeTimeout';
import { playClick, playPop, playUnlock, playWin } from '../utils/sounds';
import ConfettiBurst from './ConfettiBurst';
import ScreenFrame from './ui/ScreenFrame';
import { ADVENTURE_STORIES, endingsOf, isValidPath, pathText, storyById, type AdventureStory } from '../data/adventureStories';

// "Adventure Diary" — screen id idol_diary. Choose-your-path stories; finished adventures can be
// saved to the diary shelf ('diary_list', shared with the old fill-in-the-blanks pages).
// Reward: finishRound once per story per local day (score = total different endings found).

const GAME_ID = 'idol_diary';
const LIST_KEY = 'diary_list';
const ENDINGS_KEY = 'funquest-idol_diary-endings';
const DAY_KEY = 'funquest-idol_diary-day';

interface AdventureEntry { id: number; kind: 'adventure'; storyId: string; path: string[]; date: string; title: string }
/** Pages saved by the old fill-in-the-blanks diary. */
interface LegacyEntry { id: number; storyId: string; words: string[]; date: string; title: string }
type DiaryEntry = AdventureEntry | LegacyEntry;
const isAdventure = (e: DiaryEntry): e is AdventureEntry => (e as AdventureEntry).kind === 'adventure';

function readJson<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch { return fallback; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

function loadEntries(): DiaryEntry[] {
  const raw = readJson<unknown>(LIST_KEY, []);
  return Array.isArray(raw) ? raw.filter((e): e is DiaryEntry => !!e && typeof e === 'object' && typeof (e as DiaryEntry).id === 'number') : [];
}

export default function IdolDiary() {
  const later = useSafeTimeout();
  const [tab, setTab] = useState<'play' | 'shelf'>('play');
  const [story, setStory] = useState<AdventureStory | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [entries, setEntries] = useState<DiaryEntry[]>(loadEntries);
  const [found, setFound] = useState<Record<string, string[]>>(() => readJson(ENDINGS_KEY, {}));
  const [view, setView] = useState<DiaryEntry | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [reward, setReward] = useState<string>('');
  const [savedThis, setSavedThis] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const nodeId = path[path.length - 1];
  const node = story && nodeId ? story.nodes[nodeId] : null;

  useEffect(() => {
    if (path.length > 1) bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [path.length]);

  const start = (s: AdventureStory) => {
    playClick();
    setStory(s);
    setPath([s.start]);
    setReward('');
    setSavedThis(false);
  };

  const choose = (to: string) => {
    if (!story || !story.nodes[to]) return;
    playPop();
    const next = [...path, to];
    setPath(next);
    const target = story.nodes[to];
    if (!target.end) return;

    // Ending reached.
    playWin();
    setConfetti(true);
    later(() => setConfetti(false), 2500);
    const mine = found[story.id] ?? [];
    const isNewEnding = !mine.includes(to);
    const nextFound = isNewEnding ? { ...found, [story.id]: [...mine, to] } : found;
    if (isNewEnding) { setFound(nextFound); writeJson(ENDINGS_KEY, nextFound); }

    const today = localDateKey();
    const day = readJson<{ date: string; stories: string[] }>(DAY_KEY, { date: today, stories: [] });
    const doneToday = day.date === today && Array.isArray(day.stories) ? day.stories : [];
    if (!doneToday.includes(story.id)) {
      const totalFound = Object.values(nextFound).reduce((n, ids) => n + ids.length, 0);
      const r = useGameStore.getState().finishRound(GAME_ID, totalFound, 1);
      writeJson(DAY_KEY, { date: today, stories: [...doneToday, story.id] });
      setReward(`+${r.xp} XP · +${r.coins} 🪙`);
    } else {
      setReward('');
    }
  };

  const saveToDiary = () => {
    if (!story || !node?.end || savedThis) return;
    playUnlock();
    const entry: AdventureEntry = {
      id: Date.now(), kind: 'adventure', storyId: story.id, path,
      date: new Date().toLocaleDateString(), title: `${story.title}: ${node.end.title}`,
    };
    const next = [entry, ...entries].slice(0, 30);
    setEntries(next);
    writeJson(LIST_KEY, next);
    setSavedThis(true);
  };

  const remove = (id: number) => {
    playClick();
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    writeJson(LIST_KEY, next);
    setView(null);
  };

  const backToList = () => { playClick(); setStory(null); setPath([]); };
  const totalEndings = ADVENTURE_STORIES.reduce((n, s) => n + endingsOf(s).length, 0);
  const totalFound = ADVENTURE_STORIES.reduce((n, s) => n + (found[s.id]?.filter(id => s.nodes[id]?.end).length ?? 0), 0);

  return (
    <ScreenFrame title="Adventure Diary" icon="📖" width="max-w-3xl"
      onBack={story ? backToList : undefined}
      right={<span className="font-fredoka text-lg bg-white/15 rounded-full px-3 py-2 shrink-0">🏁 {totalFound}/{totalEndings}</span>}>
      {confetti && <ConfettiBurst count={70} durationMs={2500} />}

      {!story && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(['play', 'shelf'] as const).map(t => (
            <button key={t} onClick={() => { playClick(); setTab(t); }}
              className={`min-h-[52px] rounded-full font-fredoka text-xl ${tab === t ? 'bg-fuchsia-500' : 'bg-white/10 active:bg-white/20'}`}>
              {t === 'play' ? '🧭 Adventures' : `📚 My Diary (${entries.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Story list */}
      {!story && tab === 'play' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {ADVENTURE_STORIES.map(s => {
            const ends = endingsOf(s);
            const got = ends.filter(([id]) => found[s.id]?.includes(id)).length;
            return (
              <button key={s.id} onClick={() => start(s)}
                className="min-h-[96px] rounded-3xl bg-white/10 border border-white/15 active:bg-white/20 p-4 text-left flex items-center gap-4">
                <span className="text-5xl" aria-hidden>{s.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-fredoka text-xl">{s.title}</span>
                  <span className="block font-nunito text-base text-violet-100">{s.blurb}</span>
                  <span className="block font-nunito text-base text-yellow-200 mt-1">🏁 Endings found: {got}/{ends.length}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Playing a story */}
      {story && node && (
        <div>
          <h2 className="font-fredoka text-2xl mb-3 text-center">{story.emoji} {story.title}</h2>
          <div className="space-y-3">
            {pathText(story, path).slice(0, -1).map((p, i) => (
              <div key={i} className="rounded-2xl bg-white/5 p-3 opacity-80">
                <p className="font-nunito text-lg">{p.text}</p>
                {p.choice && <p className="font-fredoka text-lg text-yellow-200 mt-1">➜ {p.choice}</p>}
              </div>
            ))}
            <AnimatePresence mode="wait">
              <motion.div key={nodeId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className={`rounded-3xl p-5 border ${node.end ? 'bg-gradient-to-br from-amber-400/40 to-fuchsia-600/40 border-yellow-200/60' : 'bg-white/10 border-white/15'}`}>
                {node.end && (
                  <div className="text-center mb-2">
                    <div className="text-6xl" aria-hidden>{node.end.emoji}</div>
                    <p className="font-fredoka text-base text-yellow-100">{node.end.kind === 'funny' ? '😂 Funny ending' : '🌟 Happy ending'}</p>
                    <h3 className="font-fredoka text-3xl">{node.end.title}</h3>
                  </div>
                )}
                <p className="font-nunito text-xl leading-relaxed">{node.text}</p>
                {node.choices && (
                  <div className="grid gap-3 mt-4">
                    <p className="font-fredoka text-lg text-violet-100">What do you do?</p>
                    {node.choices.map(ch => (
                      <button key={ch.to + ch.label} onClick={() => choose(ch.to)}
                        className="min-h-[60px] rounded-2xl bg-white/15 active:bg-white/25 px-5 text-left font-fredoka text-xl">
                        {ch.emoji} {ch.label}
                      </button>
                    ))}
                  </div>
                )}
                {node.end && (
                  <div className="mt-4 text-center">
                    {reward
                      ? <p className="font-fredoka text-xl text-yellow-200 mb-3">{reward}</p>
                      : <p className="font-nunito text-base text-violet-100 mb-3">You already got today’s reward for this story. Try another story for more!</p>}
                    <div className="grid sm:grid-cols-3 gap-2">
                      <button onClick={saveToDiary} disabled={savedThis}
                        className="min-h-[52px] rounded-full bg-gradient-to-r from-yellow-300 to-amber-400 text-stone-900 font-fredoka text-lg disabled:opacity-60">
                        {savedThis ? '✅ Saved' : '💾 Save to diary'}
                      </button>
                      <button onClick={() => start(story)} className="min-h-[52px] rounded-full bg-white/15 active:bg-white/25 font-fredoka text-lg">🔄 Try another path</button>
                      <button onClick={backToList} className="min-h-[52px] rounded-full bg-white/15 active:bg-white/25 font-fredoka text-lg">🧭 More stories</button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Diary shelf */}
      {!story && tab === 'shelf' && (
        entries.length === 0 ? (
          <div className="rounded-3xl bg-white/10 p-8 text-center">
            <div className="text-5xl mb-2" aria-hidden>📚</div>
            <p className="font-fredoka text-2xl">Your diary is empty!</p>
            <p className="font-nunito text-lg text-violet-100">Finish an adventure and save it here.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {entries.map(e => {
              const s = isAdventure(e) ? storyById(e.storyId) : undefined;
              return (
                <button key={e.id} onClick={() => { playPop(); setView(e); }}
                  className="min-h-[64px] rounded-2xl bg-white/10 active:bg-white/20 p-3 text-left flex items-center gap-3">
                  <span className="text-3xl" aria-hidden>{s?.emoji ?? '📔'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-fredoka text-lg truncate">{isAdventure(e) ? e.title : 'Old fill-in story'}</span>
                    <span className="block font-nunito text-base text-violet-100">{e.date}</span>
                  </span>
                  <span aria-hidden>▶</span>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* View a saved page */}
      <AnimatePresence>
        {view && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setView(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={ev => ev.stopPropagation()}
              className="arcade-bg rounded-3xl border-2 border-white/30 p-5 max-w-lg w-full max-h-[85dvh] overflow-y-auto text-white">
              {isAdventure(view) && storyById(view.storyId) && isValidPath(storyById(view.storyId)!, view.path) ? (
                <>
                  <h2 className="font-fredoka text-2xl mb-1">{storyById(view.storyId)!.emoji} {view.title}</h2>
                  <p className="font-nunito text-base text-violet-100 mb-3">{view.date}</p>
                  {pathText(storyById(view.storyId)!, view.path).map((p, i) => (
                    <div key={i} className="mb-2">
                      <p className="font-nunito text-lg">{p.text}</p>
                      {p.choice && <p className="font-fredoka text-lg text-yellow-200">➜ {p.choice}</p>}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <h2 className="font-fredoka text-2xl mb-1">📔 Old fill-in story</h2>
                  <p className="font-nunito text-base text-violet-100 mb-3">{view.date}</p>
                  <div className="flex flex-wrap gap-2">
                    {('words' in view && Array.isArray(view.words) ? view.words : []).map((w, i) => (
                      <span key={i} className="rounded-full bg-white/15 px-3 py-1 font-nunito text-lg">{String(w)}</span>
                    ))}
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button onClick={() => { playClick(); setView(null); }} className="min-h-[52px] rounded-full bg-white/15 active:bg-white/25 font-fredoka text-lg">Close</button>
                <button onClick={() => remove(view.id)} className="min-h-[52px] rounded-full bg-rose-500/80 active:bg-rose-500 font-fredoka text-lg">🗑️ Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ScreenFrame>
  );
}
