import { useEffect } from 'react';
import { localDateKey } from '../utils/dates';
import { activeEvent } from './events';

/** Sets <html data-event="halloween"> while an event with a theme is running (see halloween.css). */
export function useEventTheme(): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const theme = activeEvent(localDateKey())?.themeClass;
      if (theme) root.dataset.event = theme;
      else delete root.dataset.event;
    };
    apply();
    // The iPad may stay open across midnight on the last day — re-check when she comes back.
    const onVisible = () => { if (!document.hidden) apply(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      delete root.dataset.event;
    };
  }, []);
}
