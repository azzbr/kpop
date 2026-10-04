import { useEffect, useRef } from 'react';

export type SteerDir = 0 | 1 | 2 | 3; // up, right, down, left

/** Where the finger is, for drawing the joystick ring (CSS px inside the element). */
export interface SteerTouch { active: boolean; ox: number; oy: number; x: number; y: number }

const KEY_DIR: Record<string, SteerDir> = {
  ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3,
  w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3,
};

const DEAD_ZONE = 10; // px before a drag counts as steering
const MAX_REACH = 70; // the start point follows the finger beyond this, like a floating joystick

/**
 * Free-angle steering for Paper Clash: press anywhere and drag; the heading points from where the
 * finger went down towards the finger (a floating joystick that follows the finger if it goes far).
 * Arrow keys / WASD give the four directions. Taps on buttons are ignored.
 */
export function useSteerInput(
  ref: React.RefObject<HTMLElement | null>,
  onAngle: (angle: number) => void,
  onDir: (d: SteerDir) => void,
) {
  const touch = useRef<SteerTouch>({ active: false, ox: 0, oy: 0, x: 0, y: 0 });
  const angleCb = useRef(onAngle);
  const dirCb = useRef(onDir);
  angleCb.current = onAngle;
  dirCb.current = onDir;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pointer: number | null = null;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (pointer !== null) return;
      pointer = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      const [x, y] = local(e);
      touch.current = { active: true, ox: x, oy: y, x, y };
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const [x, y] = local(e);
      const t = touch.current;
      t.x = x; t.y = y;
      let dx = x - t.ox, dy = y - t.oy;
      const d = Math.hypot(dx, dy);
      if (d < DEAD_ZONE) return;
      if (d > MAX_REACH) {
        t.ox = x - (dx / d) * MAX_REACH;
        t.oy = y - (dy / d) * MAX_REACH;
        dx = x - t.ox; dy = y - t.oy;
      }
      angleCb.current(Math.atan2(dy, dx));
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      touch.current.active = false;
    };
    const key = (e: KeyboardEvent) => {
      const d = KEY_DIR[e.key];
      if (d === undefined) return;
      e.preventDefault();
      dirCb.current(d);
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
  }, [ref]);

  return touch;
}
