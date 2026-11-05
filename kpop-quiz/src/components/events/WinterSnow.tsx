// ❄️ Falling snow over the menu screens while Winter Wonderland is on (styles in events/winter.css).
// A fixed box exactly the size of the screen, with overflow hidden, holds two sliding snow layers:
// nothing ever reaches past the screen edge, so the page never changes size (iPad Safari zoomed and
// re-laid-out the page when the old full-page snow layers slid past the bottom). Never shown in a game.
import { useGameStore } from '../../store';
import { activeEvent } from '../../events/events';
import { localDateKey } from '../../utils/dates';

export default function WinterSnow() {
  const inGame = useGameStore(s => s.inGame);
  if (inGame || activeEvent(localDateKey())?.themeClass !== 'winter') return null;
  return (
    <div className="winter-snow" aria-hidden data-testid="winter-snow">
      <div className="winter-snow-a" />
      <div className="winter-snow-b" />
    </div>
  );
}
