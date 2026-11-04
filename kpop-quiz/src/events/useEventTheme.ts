import { useEffect } from 'react';
import { localDateKey } from '../utils/dates';
import { useGameStore } from '../store';
import { activeEvent } from './events';
import { ADVENT_KEY, isSnowDay } from './advent';

/**
 * Sets <html data-event="halloween"> while an event with a theme is running (see halloween.css,
 * winter.css), and <html data-snowday> on the local day the golden Advent door 24 was opened.
 */
export function useEventTheme(): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const today = localDateKey();
      const theme = activeEvent(today)?.themeClass;
      if (theme) root.dataset.event = theme;
      else delete root.dataset.event;
      if (theme === 'winter' && isSnowDay(today, useGameStore.getState().events[ADVENT_KEY] ?? [])) root.dataset.snowday = '';
      else delete root.dataset.snowday;
    };
    apply();
    // The iPad may stay open across midnight on the last day — re-check when she comes back.
    const onVisible = () => { if (!document.hidden) apply(); };
    document.addEventListener('visibilitychange', onVisible);
    // Opening door 24 starts the snow day straight away.
    const unsub = useGameStore.subscribe((s, prev) => { if (s.events !== prev.events) apply(); });
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      unsub();
      delete root.dataset.event;
      delete root.dataset.snowday;
    };
  }, []);
}
