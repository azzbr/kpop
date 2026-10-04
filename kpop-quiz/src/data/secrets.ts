// Hidden easter eggs. Found ids are saved in the store (`secretsFound`, via findSecret).
// The Secret Club lists them: found ones show what they are, the rest show a riddle hint.
// Never rename an id.

export interface SecretEgg { id: string; icon: string; title: string; hint: string }

export const SECRETS: SecretEgg[] = [
  { id: 'a_club', icon: '🔓', title: 'The Secret Club', hint: 'The last word on the welcome screen hides a door…' },
  { id: 'f_board', icon: '🖼️', title: 'The Sticker Board', hint: 'Having Fun? Tap where the fun begins.' },
  { id: 'q_fact', icon: '💡', title: 'Fun-fact bubble', hint: 'Every Quest starts with a question. Tap it!' },
  { id: 'dj_mode', icon: '🎧', title: 'DJ mode', hint: 'The joystick likes being tapped… lots.' },
  { id: 'agent_hq', icon: '🕵️', title: 'Agent HQ', hint: 'Agents have a headquarters. Look under the Start button.' },
  { id: 'huntrx', icon: '🎤', title: 'Superstar mode', hint: 'The band on the music player has a special name…' },
  { id: 'pixel_skin', icon: '👾', title: 'Pixel skin', hint: 'Make pixel art, then wear it into battle on the map.' },
];
