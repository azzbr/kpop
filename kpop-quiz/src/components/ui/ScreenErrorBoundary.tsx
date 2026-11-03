// Catches a screen that fails to load or crashes, so the installed app (no browser buttons, no
// reload) never shows a blank page. The usual cause: a new version was put online while the app
// was open, and the old version's screen files are gone — then one reload fetches the new version.
import { Component } from 'react';
import type { ReactNode } from 'react';

const RELOAD_KEY = 'funquest-chunk-reload';

export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as { message?: unknown } | null)?.message ?? err);
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|not a valid JavaScript MIME type|Loading chunk|ChunkLoadError/i.test(msg);
}

interface Props {
  /** The current screen: a new screen clears the error. */
  screen: string;
  onHome: () => void;
  children: ReactNode;
}

export default class ScreenErrorBoundary extends Component<Props, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;
    try {
      // Once per 30 s, so being offline can't cause a reload loop.
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      location.reload();
    } catch { /* storage blocked: the card's buttons still work */ }
  }

  componentDidUpdate(prev: Props) {
    if (prev.screen !== this.props.screen && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const update = isChunkLoadError(this.state.error);
    return (
      <div className="arcade-bg min-h-screen-d flex items-center justify-center p-6 text-white text-center">
        <div className="w-full max-w-md rounded-3xl bg-indigo-950/95 border-2 border-fuchsia-400/60 p-6 shadow-2xl">
          <div className="text-6xl mb-2">{update ? '✨' : '🛠️'}</div>
          <h1 className="font-fredoka text-3xl mb-2">{update ? 'Getting the newest version…' : 'Oops! This one tripped over.'}</h1>
          <p className="font-nunito text-lg text-violet-200 mb-5">
            {update ? 'If nothing happens, check the internet and tap Try again.' : 'Your progress is safe. Try again, or pick another game.'}
          </p>
          <button onClick={() => location.reload()} className="w-full min-h-[56px] rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 font-fredoka text-2xl mb-3">
            🔄 Try again
          </button>
          <button onClick={() => { this.props.onHome(); this.setState({ error: null }); }} className="w-full min-h-[48px] rounded-full bg-white/15 font-fredoka text-lg">
            🎮 Back to the games
          </button>
        </div>
      </div>
    );
  }
}
