# K-Pop Fun Quest — CLAUDE.md

A K-pop themed educational web platform for kids aged 5–12. It combines music, mini-games, creative tools, and learning activities around a K-pop idol group called HUNTR/X.

---

## Quick Start

```bash
cd kpop-quiz
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
npm run lint       # ESLint check
```

**Deployed on Netlify.** `netlify.toml` lives at the repo root; build base is `kpop-quiz/`.

---

## Repo Layout

```
kpop/
├── CLAUDE.md
├── netlify.toml                  # Netlify deployment + headers + SPA redirect
└── kpop-quiz/                    # Entire application lives here
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── src/
    │   ├── main.tsx              # React root mount
    │   ├── App.tsx               # Top-level screen router (switch on gameState)
    │   ├── store.ts              # Zustand global store — ALL state lives here
    │   ├── index.css             # Tailwind directives + kid-specific utility classes
    │   ├── quizData.ts           # K-pop quiz questions (Easy→Demon, 5 difficulties)
    │   ├── friendsQuestionsData.ts
    │   └── components/           # One file per screen/feature (31 components)
    ├── public/
    │   ├── musickpop/            # 8 FLAC audio tracks
    │   └── images/               # K-pop group photos (WebP/JPEG)
    ├── netlify/functions/        # Serverless: counter, increment, health
    └── backend/                  # Optional Express server (local dev only)
```

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| UI | React | 19.1 |
| Types | TypeScript | 5.8 |
| Build | Vite | 7.1 |
| Styling | Tailwind CSS | 3.4 |
| Animation | Framer Motion | 12 |
| State | Zustand | 5 |
| Canvas | tldraw | 4.2 |

---

## Architecture

### Screen Router (`App.tsx`)

Every top-level screen is a `gameState` string. The router is a `switch` in `renderCurrentScreen()`. To add a new screen:
1. Add the state key to the `GameState` union type in `store.ts`
2. Import and add the component to the switch in `App.tsx`
3. Add a button/navigation path that calls `setGameState('your_key')`

### Global Store (`store.ts`)

Built with Zustand. All game state (scores, badges, streaks, music, mini-game progress) is in one flat store. Import with:

```ts
import { useGameStore } from '../store';
const { playerName, score, setGameState } = useGameStore();
```

Key state sections:
- **Game flow:** `gameState`, `difficulty`, `currentQuestions`
- **Player:** `playerName`, `score`, `earnedBadges`, `dailyStreak`
- **Music:** `currentTrack`, `isPlaying`, `volume`, `playlist`
- **Achievements:** `badgesEarned`, `songsListened`, `correctAnswers`
- **Mini-games:** memory cards, rhythm notes, trivia cards, teams, friends trivia
- **Secret menu:** inventory, stats, unlocked hidden badges

### Navigation

To go to a screen: `setGameState('screen_name')`
To go back to game selection: `setGameState('game_mode')`
To go to welcome: `setGameState('welcome')`

---

## All Game Screens

| `gameState` | Component | Description |
|---|---|---|
| `welcome` | `WelcomeScreen` | Landing screen, name entry, easter egg trigger |
| `game_mode` | `GameModeSelection` | 12-mode selection grid |
| `difficulty` | `DifficultyScreen` | Easy/Normal/Hard/Lyrics/Demon picker |
| `quiz` | `QuizView` | K-pop quiz gameplay |
| `result` | `ResultScreen` | Score summary + badge awards |
| `memory_game` | `MemoryGame` | Card matching (4×4 or 6×6) |
| `rhythm_game` | `RhythmGame` | Tap-to-beat with K-pop tracks |
| `trivia_cards` | `TriviaCards` | Collectible idol cards + market |
| `instruments_tutorial` | `InstrumentsTutorial` | Piano and recorder learning |
| `team_maker` | `TeamMaker` | Random team generator + tag game |
| `friends_trivia` | `FriendsTrivia` | Friend-specific trivia questions |
| `math_challenge` | `MathChallenge` | Timed math (4 operations + word problems) |
| `spelling_bee` | `SpellingBee` | Letter-by-letter spelling practice |
| `reading_comprehension` | `ReadingComprehension` | Story + comprehension questions |
| `science_quiz` | `ScienceQuiz` | Animals, planets, weather facts |
| `secret_menu` | `SecretMenu` | Hidden menu (12+ bonus activities) |
| `living_mural` | `LivingMural` | tldraw collaborative drawing canvas |
| `agent_hq` | `AgentHQ` | Secret agent mission control |
| `shop` | `Shop` | Cosmetic shop with in-game currency |
| `kpop_rush` | `KPopRushGame` | Chrome-dino-style runner game |

### Secret Menu Easter Egg

Click the **second "P"** in "K-Pop Fun Quest" on the welcome screen. Contains 4 tabs:
- **Creative Corner:** Drawing canvas, sticker gallery, pattern maker
- **Game Paradise:** K-Pop Rush, bubble popper, face generator, treasure hunt
- **Fun Zone:** Living mural, sound board, confetti cannon
- **Behind Scenes:** App stats dashboard, developer cameos, badge gallery

---

## Design System

### Kid-Friendly CSS Classes (`index.css`)

```css
.btn-kid            /* Primary pink/purple gradient button */
.btn-kid-secondary  /* Outlined secondary button */
.card-kid           /* Rounded white card with soft shadow */
.text-kid-glow      /* Glowing text for headings */
.bg-kid-pattern     /* Pastel polka-dot background */
```

### Fonts

- **Fredoka One** — headings, titles (rounded, playful)
- **Nunito** — body text (clean, readable for young readers)
- **Comfortaa** — accent text

### Colors

Stick to the Tailwind palette already defined in `tailwind.config.js`. Key hues: pink, purple, blue (primary); yellow, green, orange, cyan (accents). Use pastel shades for backgrounds, saturated shades for interactive elements.

### Animation Principles

Use Framer Motion for all transitions. Preferred patterns:
```tsx
// Screen entrance
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

// Hover feedback (buttons)
whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}

// Staggered list reveal
variants={{ container: { staggerChildren: 0.1 } }}
```

Keep animations short (200–400ms). Kids love bounce/spring, not slow fades.

---

## Adding a New Game Mode

1. **Create the component** in `src/components/MyNewGame.tsx`
2. **Add state key** to `GameState` type in `store.ts`
3. **Register in router** — import and add `case 'my_new_game': return <MyNewGame key="my_new_game" />;` in `App.tsx`
4. **Add to game mode grid** in `GameModeSelection.tsx` (each card needs icon, title, description, color, and `onClick` calling `setGameState`)
5. **Back button** — every screen must include a back button calling `setGameState('game_mode')`
6. **Score/badge** — if the game awards points, dispatch to the store's `addScore()` and check `checkBadgeUnlock()`

---

## Adding Quiz Questions (`quizData.ts`)

Questions are plain objects:
```ts
{
  question: "What is Rumi's special power?",
  options: ["Telekinesis", "Time freeze", "Invisibility", "Fire control"],
  correct: 0,   // index into options[]
  explanation: "Rumi can move objects with her mind!"
}
```

Five arrays by difficulty: `easyQuestions`, `normalQuestions`, `hardQuestions`, `lyricsQuestions`, `demonQuestions`.

---

## Badge System

Badges are defined in `store.ts`. Each badge has:
- `id`, `name`, `emoji`, `description`
- `unlockCondition` — a function checked after each game action

To add a new badge, append to the `badges` array and add unlock logic to `checkBadgeUnlock()`.

---

## Music Player

Eight FLAC tracks in `public/musickpop/`. The `MusicPlayer` component is always rendered (fixed bottom bar). Track list is defined in `store.ts` under `playlist`. To add a track:
1. Drop the file in `public/musickpop/`
2. Add an entry to the `playlist` array in `store.ts`

---

## Kids-First Content Rules

These rules keep the site age-appropriate and fun:

1. **No external links** — never link out to social media, YouTube, or third-party sites
2. **No personal data collection** — all state is client-side (Zustand); nothing is sent to a server
3. **Positive reinforcement only** — wrong answers get encouragement ("Almost! Try again!"), never shame
4. **Large touch targets** — all buttons must be at least 44×44px; test on mobile
5. **Readable text** — minimum `text-lg` (18px) for body; `text-xl`+ for instructions
6. **Emoji-first icons** — use emoji rather than icon libraries; they render everywhere and kids love them
7. **Short sessions** — each game mode should be completable in under 5 minutes
8. **Clear back navigation** — every screen must have a clearly labeled back or home button
9. **Safe language** — no scary, violent, or adult themes; keep humor G-rated
10. **Celebration moments** — use confetti, sound effects, and big congratulations on completions

---

## Ideas for Making the Site Even More Fun

### High-Impact Additions

- **🎤 Sing-Along Mode** — display lyrics with a bouncing ball synced to the music player
- **🎨 Avatar Creator** — kids design a custom K-pop idol avatar saved in localStorage
- **🌟 Star Chart** — visual constellation of achievements replacing the badge list
- **📖 Story Mode** — comic-style HUNTR/X adventure story with branching choices
- **🎲 Random Fun Button** — one button on the home screen that launches a random mini-game
- **🏆 Weekly Leaderboard** — cached top scores with fun player nicknames
- **🎵 Karaoke Game** — type the next lyric before the timer runs out
- **💃 Dance Tutorial** — step-by-step dance move instructions with animated stick figures
- **🌈 Theme Switcher** — let kids pick a color theme (pastel pink, neon, ocean blue, forest green)
- **🎁 Daily Gift Box** — open a surprise reward each day to boost streak motivation
- **🔤 Korean Word of the Day** — teach one simple Korean word or phrase with pronunciation
- **🤝 Pass-and-Play Multiplayer** — two players take turns on one device for trivia/quiz

### Quick Wins (Small Effort, Big Smile)

- Add sound effects on every button click (a short pop or chime)
- Animate the score counter incrementing (not just snapping to new value)
- Show a random fun fact about K-pop between quiz questions
- Add a "Lucky Star" power-up that removes one wrong answer option
- Easter egg: entering the player name as "HUNTRX" unlocks a special welcome animation
- Shake animation on wrong answers instead of just turning red
- Firework burst effect on achieving a new personal best

---

## Deployment

Deployed to Netlify. Push to `main` triggers a build automatically.

**Environment variables** (set in Netlify dashboard):
- `KPOP_QUIZ_TOTAL_TESTS` — counter for serverless test endpoint (optional)

**Serverless functions** (in `netlify/functions/`):
- `GET /api/health` — health check
- `GET /api/counter` — read test counter
- `POST /api/increment` — increment counter

**Security headers** are configured in `netlify.toml`:
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `X-Content-Type-Options: nosniff`

Static assets under `/assets/` are cached immutably for 1 year.

---

## Common Patterns

### Screen wrapper (use this structure for every new screen)
```tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../store';

export default function MyScreen() {
  const { setGameState } = useGameStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen bg-kid-pattern flex flex-col items-center p-4"
    >
      <button
        onClick={() => setGameState('game_mode')}
        className="btn-kid-secondary self-start mb-4"
      >
        ← Back
      </button>

      <h1 className="text-kid-glow text-4xl font-bold mb-6">My Screen 🎉</h1>

      {/* content here */}
    </motion.div>
  );
}
```

### Celebration effect
```tsx
import { useState } from 'react';

const [showConfetti, setShowConfetti] = useState(false);

const handleWin = () => {
  setShowConfetti(true);
  setTimeout(() => setShowConfetti(false), 3000);
};
```

### Adding to the store
```ts
// In store.ts, add to the interface:
myNewValue: number;
setMyNewValue: (v: number) => void;

// And in the create() call:
myNewValue: 0,
setMyNewValue: (v) => set({ myNewValue: v }),
```
