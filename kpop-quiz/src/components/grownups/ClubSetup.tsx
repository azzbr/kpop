import { useState } from 'react';
import { useGameStore, MAX_CLUBS } from '../../store';
import { makeClub } from '../../data/clubWords';
import { playClick, playUnlock } from '../../utils/sounds';

// Grown-ups corner → Clubs. A club lets friends see each other online in Friends Arena and join
// each other's rooms without a room code. Share the club code only with people you know.
export default function ClubSetup() {
  const clubs = useGameStore(s => s.clubs);
  const joinClub = useGameStore(s => s.joinClub);
  const leaveClub = useGameStore(s => s.leaveClub);
  const [shown, setShown] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const create = () => {
    playUnlock();
    const c = makeClub();
    joinClub(c);
    setShown(c.code);
  };

  return (
    <section className="rounded-3xl bg-white/10 p-5">
      <h2 className="font-fredoka text-2xl mb-1">🏕️ Friends Arena clubs</h2>
      <p className="font-nunito text-base text-violet-100 mb-3">
        A club is a private group (family, friends or a class). Club members see each other's first name and avatar when they're in Friends Arena, and can ask to join each other's rooms — the host always says yes or no. Share the code only with people you know. Up to {MAX_CLUBS} clubs per device.
      </p>
      {clubs.length > 0 && (
        <ul className="space-y-2 mb-3">
          {clubs.map(c => (
            <li key={c.code} className="rounded-2xl bg-black/20 p-3 flex flex-wrap items-center gap-3">
              <span className="text-3xl">{c.emoji}</span>
              <span className="flex-1 min-w-[10rem]">
                <span className="block font-fredoka text-xl">{c.name}</span>
                {shown === c.code
                  ? <span className="block font-fredoka text-3xl tracking-wider text-amber-300 select-all">{c.code}</span>
                  : <button type="button" onClick={() => { playClick(); setShown(c.code); }} className="font-nunito text-base underline text-violet-200">Show the code</button>}
              </span>
              <button type="button" onClick={() => {
                if (confirm === c.code) { leaveClub(c.code); setConfirm(null); return; }
                playClick(); setConfirm(c.code);
              }} className={`min-h-[48px] px-4 rounded-full font-fredoka text-base ${confirm === c.code ? 'bg-red-600' : 'bg-white/15'}`}>
                {confirm === c.code ? 'Tap again to leave' : 'Leave'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {clubs.length < MAX_CLUBS && (
        <button type="button" onClick={create} className="min-h-[52px] px-6 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 font-fredoka text-lg">➕ Create a new club</button>
      )}
      <p className="font-nunito text-sm text-violet-200 mt-3">Other devices join from Friends Arena → “I have a club code”. Nothing is stored online: the club only exists while members are in Friends Arena.</p>
    </section>
  );
}
