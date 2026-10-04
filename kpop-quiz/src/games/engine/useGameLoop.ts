import { useEffect, useRef } from 'react';

export interface GameLoopOptions {
  /** Logic updates per second. Logic runs on this fixed tick so speed is the same at 60Hz and 120Hz. */
  tickHz: number;
  /** Called once per tick while running. */
  update: () => void;
  /** Called every animation frame. `alpha` (0–1) is how far we are between the last tick and the next. */
  draw: (alpha: number) => void;
  /** When false the loop keeps drawing but stops ticking (paused, game over, etc.). */
  running: boolean;
  /** Called when the page is hidden (she switches apps), so the game can show its pause screen. */
  onHidden?: () => void;
}

/**
 * Fixed-timestep game loop: logic ticks at `tickHz`, drawing happens on requestAnimationFrame.
 * Callbacks are read through refs, so they can change every render without restarting the loop.
 */
export function useGameLoop({ tickHz, update, draw, running, onHidden }: GameLoopOptions) {
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  const runningRef = useRef(running);
  const hiddenRef = useRef(onHidden);
  updateRef.current = update;
  drawRef.current = draw;
  runningRef.current = running;
  hiddenRef.current = onHidden;

  useEffect(() => {
    const stepMs = 1000 / tickHz;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      // Cap the catch-up after a long frame or a background tab so the game never "jumps".
      const dt = Math.min(now - last, 250);
      last = now;
      if (runningRef.current) {
        acc += dt;
        while (acc >= stepMs) {
          updateRef.current();
          acc -= stepMs;
          if (!runningRef.current) { acc = 0; break; }
        }
      } else {
        acc = 0;
      }
      drawRef.current(runningRef.current ? acc / stepMs : 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (document.hidden) hiddenRef.current?.();
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
    };
  }, [tickHz]);
}

/**
 * Keeps a canvas sized to its container at the device's pixel ratio (sharp on Retina iPads),
 * and re-sizes on rotation. Returns the CSS size via the ref so draw code can use it.
 */
export function useCanvasSize(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener('orientationchange', resize);
    return () => { ro.disconnect(); window.removeEventListener('orientationchange', resize); };
  }, [canvasRef]);
  return size;
}
