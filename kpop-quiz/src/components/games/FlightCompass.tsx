// ✈️ Flight Compass (flight_compass): the family's own great-circle geography game
// (azzbr/flight-compass), brought in almost unchanged. Its code lives in ./flightCompass/ as plain
// ES modules (rules, globe, dial, sounds, screens) with its own "chart room" stylesheet scoped
// under .fc-root. This file is the Fun Quest frame around it: GameShell (Back, 🎵, pause, wake
// lock), rewards when a run ends (finishRound once per run), and the Grown-ups sound settings.
import { useEffect, useRef, useState } from 'react';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { useGameStore } from '../../store';
import { playClick } from '../../utils/sounds';
import './flightCompass/flightCompass.css';
import App from './flightCompass/app.js';
import type { FlightSummary } from './flightCompass/app.js';
import MARKUP from './flightCompass/markup.js';

const DEBUG = new URLSearchParams(window.location.search).has('debug');

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export default function FlightCompass() {
  const setGameState = useGameStore(s => s.setGameState);
  const sfxVolume = useGameStore(s => s.parent.sfxVolume);
  // The game's home screen is part of the game, so the frame starts "playing" (no start card).
  const [status, setStatus] = useState<ShellStatus>('playing');
  const [round, setRound] = useState(0);
  const [summary, setSummary] = useState<FlightSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);

  useEffect(() => {
    const host = hostRef.current!;
    host.innerHTML = MARKUP;
    const parent = useGameStore.getState().parent;
    const app = new App(host, {
      sfxVolume: parent.sfxVolume,
      vibrate: parent.vibration !== false,
      onRunStart: () => { setSummary(null); setCopied(false); setStatus('playing'); },
      onSummary: info => { setSummary(info); setRound(r => r + 1); setStatus('over'); },
    });
    appRef.current = app;
    if (DEBUG) (window as unknown as { __flight: unknown }).__flight = app.debugApi();
    return () => {
      app.destroy();
      appRef.current = null;
      host.innerHTML = '';
      if (DEBUG) delete (window as unknown as { __flight?: unknown }).__flight;
    };
  }, []);

  useEffect(() => { appRef.current?.feedback.setVolume(sfxVolume); }, [sfxVolume]);

  /** Back: from a run (or its results) to the game's own home; from its home to the grid. */
  const back = () => {
    const app = appRef.current;
    if (app?.run) {
      if (!app.run.over) app.saveRun();
      app.showHome();
      setSummary(null);
      setStatus('playing');
    } else {
      setGameState('game_mode');
    }
  };

  return (
    <GameShell
      gameId="flight_compass"
      title="Flight Compass"
      icon="✈️"
      xpScale={30}
      status={status}
      score={summary?.score ?? 0}
      round={round}
      celebrateEnd
      onBack={back}
      leaveLabel="🧭 Flight Compass home"
      againLabel="✈️ New flight"
      overTitle={summary ? `${summary.hits} of ${summary.flown} cities on course` : undefined}
      overStats={summary ? [
        { label: 'Cities flown', value: String(summary.flown) },
        { label: 'Best streak', value: String(summary.bestStreak) },
      ] : undefined}
      overExtra={summary ? (
        <div className="mb-3">
          <p className="text-2xl tracking-wider mb-2" aria-label="Results by city">{summary.grid}</p>
          <button
            onClick={() => { playClick(); copyText(summary.shareText).then(setCopied); }}
            className="min-h-[48px] px-5 rounded-full bg-white/15 font-fredoka text-lg">
            {copied ? '✅ Copied!' : '📋 Copy result'}
          </button>
        </div>
      ) : undefined}
      onStart={() => { setSummary(null); setStatus('playing'); appRef.current?.newFlight(); }}
      onPause={() => setStatus('paused')}
      onResume={() => setStatus('playing')}
    >
      <div ref={hostRef} className="fc-root" data-testid="flight-compass" />
    </GameShell>
  );
}
