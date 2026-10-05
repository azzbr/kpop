// Shared bits for the party games' name entry (see partyNames.tsx).
export const QUICK_NAMES = ['Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Sam', 'Lily', 'Noah'];
export const AVATARS = ['🦊', '🐼', '🦄', '🐯', '🐸', '🐙', '🐧', '🦁'];

export interface Slot {
  /** Shown when no name is given, e.g. "Red". */
  fallback: string;
  emoji: string;
  /** Tailwind background for the slot, e.g. "bg-rose-500". */
  tone: string;
}

/** The name to show for a seat: the typed name, or its colour name. */
export const slotName = (names: string[], slots: Slot[], i: number) => names[i]?.trim() || slots[i].fallback;
