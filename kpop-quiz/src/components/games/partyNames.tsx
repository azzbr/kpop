// Name entry for the pass-the-iPad party games (Trivia Battle, Reaction Duel, Tug-of-War, Talent Show).
// Quick-name chips + the in-game keyboard, so the iPad keyboard never pops up.
import { useCallback, useState } from 'react';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import { playClick, playPop } from '../../utils/sounds';
import { cleanName, MAX_NAME } from './wouldYouRatherLogic';
import { AVATARS, QUICK_NAMES, slotName } from './partyNamesLogic';
import type { Slot } from './partyNamesLogic';

/**
 * Two (or more) fixed seats, e.g. Left / Right. Names are optional — an empty seat uses its colour name.
 * Tap a seat to pick it, then tap a quick name or type one.
 */
export function NameSlots({ names, slots, onChange }: { names: string[]; slots: Slot[]; onChange: (names: string[]) => void }) {
  const [active, setActive] = useState(0);

  const setName = useCallback((i: number, v: string) => {
    const next = slots.map((_, j) => (j === i ? v : names[j] ?? ''));
    onChange(next);
  }, [names, slots, onChange]);

  const quick = (nm: string) => {
    playPop();
    setName(active, nm);
    setActive(a => (a + 1) % slots.length);
  };

  const onKey = useCallback((l: string) => {
    const cur = names[active] ?? '';
    if (cur.length < MAX_NAME) setName(active, cleanName(cur + l) || l);
  }, [names, active, setName]);
  const onBackspace = useCallback(() => setName(active, (names[active] ?? '').slice(0, -1)), [names, active, setName]);
  const onEnter = useCallback(() => { playClick(); setActive(a => (a + 1) % slots.length); }, [slots.length]);

  return (
    <div className="flex flex-col gap-3">
      <div className={`grid gap-3 ${slots.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {slots.map((s, i) => (
          <button key={i} type="button" onClick={() => { playClick(); setActive(i); }}
            className={`min-h-[72px] rounded-2xl px-3 py-2 font-fredoka text-2xl flex items-center justify-center gap-2 ${s.tone}
              ${active === i ? 'ring-4 ring-yellow-300 scale-[1.02]' : 'opacity-80'} transition-transform`}
            aria-label={`Seat ${i + 1}: ${slotName(names, slots, i)}`}>
            <span>{s.emoji}</span>
            <span className="truncate">{slotName(names, slots, i)}</span>
            {active === i && <span className="text-base">✏️</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {QUICK_NAMES.filter(nm => !names.includes(nm)).map(nm => (
          <button key={nm} type="button" onClick={() => quick(nm)} className="min-h-[44px] px-4 rounded-full bg-indigo-500/60 font-fredoka text-base">+ {nm}</button>
        ))}
        {names[active] && (
          <button type="button" onClick={() => { playClick(); setName(active, ''); }} className="min-h-[44px] px-4 rounded-full bg-white/15 font-fredoka text-base">
            ✕ Clear
          </button>
        )}
      </div>
      <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} enterLabel="Next" />
    </div>
  );
}

/** A growing list of players (Talent Show): chips you tap to remove, quick names, and the keyboard. */
export function PlayerChips({ players, onChange, min, max }: { players: string[]; onChange: (p: string[]) => void; min: number; max: number }) {
  const [typed, setTyped] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const add = useCallback((raw: string) => {
    const name = cleanName(raw);
    if (!name) { setMsg('Type a name first ✏️'); return; }
    if (players.length >= max) { setMsg(`${max} players max!`); return; }
    if (players.some(p => p.toLowerCase() === name.toLowerCase())) { setMsg(`${name} is already in!`); return; }
    playPop();
    onChange([...players, name]);
    setTyped('');
    setMsg(null);
  }, [players, max, onChange]);

  const onKey = useCallback((l: string) => setTyped(t => (t.length < MAX_NAME ? t + l : t)), []);
  const onBackspace = useCallback(() => setTyped(t => t.slice(0, -1)), []);
  const onEnter = useCallback(() => add(typed), [add, typed]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 justify-center min-h-[52px]">
        {players.length === 0 && <p className="font-nunito text-lg text-violet-200 self-center">Add {min} to {max} players</p>}
        {players.map((p, i) => (
          <button key={p} type="button" onClick={() => { playClick(); onChange(players.filter(x => x !== p)); }}
            className="min-h-[48px] rounded-full bg-white/15 pl-3 pr-2 font-fredoka text-lg flex items-center gap-2" aria-label={`Remove ${p}`}>
            {AVATARS[i % AVATARS.length]} {p} <span className="rounded-full bg-white/20 w-8 h-8 flex items-center justify-center">✕</span>
          </button>
        ))}
      </div>
      {players.length < max && (
        <>
          <div className="flex flex-wrap gap-2 justify-center">
            {QUICK_NAMES.filter(nm => !players.includes(nm)).map(nm => (
              <button key={nm} type="button" onClick={() => add(nm)} className="min-h-[44px] px-4 rounded-full bg-indigo-500/60 font-fredoka text-base">+ {nm}</button>
            ))}
          </div>
          <div className="min-h-[56px] rounded-2xl bg-white/10 border-2 border-white/30 px-4 flex items-center justify-center font-fredoka text-2xl">
            {typed || <span className="text-white/40 font-nunito text-lg">…or type a name</span>}
          </div>
          <div className="min-h-[24px] text-center font-nunito text-base text-yellow-200">{msg}</div>
          <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} enterLabel="Add" />
        </>
      )}
    </div>
  );
}
