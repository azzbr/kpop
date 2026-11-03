// Installing Fun Quest as an app: "Install" on Android / Chrome / Edge, "Add to Home Screen" on
// iPhone and iPad. Also tells the rest of the app whether it is running as the installed app
// (full-screen, no browser buttons) and when a new version has arrived.
import { useSyncExternalStore } from 'react';

export type InstallPlatform = 'ios' | 'android' | 'desktop';

/** Chrome's install event (not in the TypeScript DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** Opened from the Home Screen / app list (or `?app`, for tests). */
  asApp: boolean;
  /** The browser's own install dialog can be shown (Android, desktop Chrome/Edge). */
  canPrompt: boolean;
  /** Installed during this visit (the browser tab is still a tab). */
  justInstalled: boolean;
  /** A new version took over while the app was open: a reload shows it. */
  updateReady: boolean;
  platform: InstallPlatform;
}

/** iPadOS Safari says "Macintosh", so touch points tell an iPad from a Mac. */
export function detectPlatform(ua: string, maxTouchPoints: number): InstallPlatform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function runningAsApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(location.search).has('app')) return true;
    if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
    return ['standalone', 'fullscreen', 'minimal-ui'].some(m => window.matchMedia?.(`(display-mode: ${m})`).matches);
  } catch {
    return false;
  }
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = {
  asApp: false,
  canPrompt: false,
  justInstalled: false,
  updateReady: false,
  platform: 'desktop',
};
const listeners = new Set<() => void>();

function update(patch: Partial<InstallState>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

let started = false;
/** Call once at startup (main.tsx), before the browser fires its install event. */
export function initAppInstall() {
  if (started || typeof window === 'undefined') return;
  started = true;
  state = { ...state, asApp: runningAsApp(), platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0) };
  window.addEventListener('beforeinstallprompt', (e) => {
    // No browser pop-up for the kids to tap by accident: the grown-up installs from the Grown-ups corner.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    update({ canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    update({ canPrompt: false, justInstalled: true });
  });
  // As an installed app, ask the browser to never clear the saved progress to free up space.
  // (No prompt in Chrome or Safari; skipped in a browser tab because Firefox would ask.)
  if (state.asApp) navigator.storage?.persist?.().catch(() => { /* optional */ });
}

/** Shows the browser's install dialog. Resolves 'unavailable' when there is none to show. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  update({ canPrompt: false });
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome;
}

/** The service worker installed a new version and took over this page. */
export function markUpdateReady() {
  if (!state.updateReady) update({ updateReady: true });
}

export function getInstallState(): InstallState {
  return state;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getInstallState, getInstallState);
}

/** Whether to offer "📲 Get the app": phones and tablets, or a desktop browser that can install. */
export function offerInstall(s: InstallState): boolean {
  return !s.asApp && (s.platform !== 'desktop' || s.canPrompt || s.justInstalled);
}
