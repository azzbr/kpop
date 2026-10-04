import { useCallback, useEffect, useRef } from 'react';

/**
 * Like setTimeout, but every pending timeout is cleared when the component unmounts,
 * so nothing fires (setState, sounds, scores, screen changes) after leaving a screen.
 */
export function useSafeTimeout() {
  const pending = useRef<Set<number>>(new Set());

  useEffect(() => {
    const ids = pending.current;
    return () => {
      ids.forEach(id => clearTimeout(id));
      ids.clear();
    };
  }, []);

  return useCallback((fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => {
      pending.current.delete(id);
      fn();
    }, ms);
    pending.current.add(id);
    return id;
  }, []);
}
