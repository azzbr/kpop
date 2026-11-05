// ❄️ Falling snow over the menu screens while Winter Wonderland is on (styles in events/winter.css).
// A fixed box exactly the size of the screen, with overflow hidden, holds two sliding snow layers:
// nothing ever reaches past the screen edge, so the page never changes size (iPad Safari zoomed and
// re-laid-out the page when the old full-page snow layers slid past the bottom). Never shown in a game,
// and not at all when the device asks for reduced motion (still snow isn't worth a full-screen layer).
import { useEffect, useState } from 'react';
import { useGameStore } from '../../store';
import { activeEvent } from '../../events/events';
import { localDateKey } from '../../utils/dates';

const REDUCE = '(prefers-reduced-motion: reduce)';

/** Follows the device's reduce-motion setting, also when it changes while the app is open. */
function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(REDUCE).matches);
  useEffect(() => {
    const m = window.matchMedia?.(REDUCE);
    if (!m) return;
    const update = () => setReduce(m.matches);
    update();
    m.addEventListener?.('change', update);
    return () => m.removeEventListener?.('change', update);
  }, []);
  return reduce;
}

export default function WinterSnow() {
  const inGame = useGameStore(s => s.inGame);
  const reduce = usePrefersReducedMotion();
  if (inGame || reduce || activeEvent(localDateKey())?.themeClass !== 'winter') return null;
  return (
    <div className="winter-snow" aria-hidden data-testid="winter-snow">
      <div className="winter-snow-a" />
      <div className="winter-snow-b" />
    </div>
  );
}
