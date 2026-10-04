import { useEffect, useRef } from 'react';

export type SwipeDir = 0 | 1 | 2 | 3; // up, right, down, left

const KEYS: Record<string, SwipeDir> = {
  ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3,
};

/**
 * Swipe-to-steer for grid games, using Pointer Events (one code path for finger and mouse).
 * The direction fires as soon as the finger has moved `threshold` px, and the start point resets,
 * so she can chain turns without lifting her finger — like Paper.io on a phone.
 * Arrow keys / WASD work too.
 */
export function useSwipeInput(
  target: React.RefObject<HTMLElement | null>,
  onDir: (d: SwipeDir) => void,
  threshold = 22,
) {
  const cb = useRef(onDir);
  cb.current = onDir;

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let start: { x: number; y: number; id: number } | null = null;

    const down = (e: PointerEvent) => {
      // Let on-screen buttons inside the play area (d-pad, boost, undo) get their own taps:
      // capturing the pointer here would retarget their click.
      if ((e.target as HTMLElement | null)?.closest('button')) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      cb.current(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    };
    const up = (e: PointerEvent) => { if (start && e.pointerId === start.id) start = null; };
    const key = (e: KeyboardEvent) => {
      const d = KEYS[e.code];
      if (d === undefined) return;
      e.preventDefault();
      cb.current(d);
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
    };
  }, [target, threshold]);
}
