// Android's back gesture closes an installed web app that has no history of its own — even in the
// middle of a game. While Fun Quest runs as the installed app, every screen except the Welcome
// screen and the game grid keeps one extra history entry (the "guard"). Back pops it, and then:
//  1. a cancelable `funquest:back` event goes out — GameShell cancels it to pause a running round;
//  2. otherwise the screen's own Back button (`data-back`) is pressed, so back does exactly what
//     Back does (leave a room, "tap again" confirms, secret rooms…);
//  3. otherwise the fallback runs (to the grid, or back to the Secret Club).
// On the grid there is no guard, so back closes the app as usual.
// Only used in the installed app: in a Safari tab an accidental edge swipe would otherwise leave a
// drawing screen, and iOS Home Screen apps have no back gesture at all.

export const BACK_EVENT = 'funquest:back';

const isGuard = () => (history.state as { fqGuard?: boolean } | null)?.fqGuard === true;

export interface BackGuard {
  /** Call after every screen change. */
  sync: () => void;
  dispose: () => void;
}

export function installBackGuard(opts: { isHome: () => boolean; fallback: () => void }): BackGuard {
  let ignorePops = 0;
  // Reloaded while on the guard entry: treat it as the page's own entry.
  if (isGuard()) history.replaceState(null, '');

  const sync = () => {
    const home = opts.isHome();
    if (!home && !isGuard()) history.pushState({ fqGuard: true }, '');
    else if (home && isGuard()) { ignorePops++; history.back(); }
  };

  const onPop = () => {
    if (ignorePops > 0) { ignorePops--; sync(); return; }
    if (opts.isHome()) return;
    const ev = new Event(BACK_EVENT, { cancelable: true });
    window.dispatchEvent(ev);
    if (!ev.defaultPrevented) {
      const button = document.querySelector<HTMLElement>('[data-back]');
      if (button) button.click(); else opts.fallback();
    }
    // Still away from the grid (paused, "tap again", a sub-page)? Put the guard back.
    window.setTimeout(sync, 0);
  };

  window.addEventListener('popstate', onPop);
  return { sync, dispose: () => window.removeEventListener('popstate', onPop) };
}
