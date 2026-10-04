import { useGameStore } from '../../store';
import { playClick } from '../../utils/sounds';

/** The small switch on both start cards. */
export default function StyleSwitch() {
  const { paperClash, setPaperClash } = useGameStore();
  const classic = paperClash.style === 'classic';
  return (
    <button onClick={() => { playClick(); setPaperClash({ style: classic ? 'new' : 'classic' }); }}
      className="w-full min-h-[44px] rounded-xl bg-white/10 font-nunito text-base px-3 text-left">
      {classic ? '✨ Try the new smooth Paper Clash' : '🟦 Play Classic squares instead'}
    </button>
  );
}

