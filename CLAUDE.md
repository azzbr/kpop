# Fun Quest Arcade — CLAUDE.md

A games site for kids aged about 8–12: arcade games, brain puzzles, party games (2+ players on one device), and creative/music toys. The main player is a 10-year-old on an **iPad**, so touch is the primary input. The background music is the HUNTR/X soundtrack, but the site is no longer K-Pop themed.

---

## Quick Start

```bash
cd kpop-quiz
npm install
npm run dev        # http://localhost:5173
npm run build      # production build (tsc -b && vite build)
npm run lint       # ESLint
npm test           # vitest — pure game logic and content checks
```

**Deployed on Netlify.** `netlify.toml` lives at the repo root; build base is `kpop-quiz/`, Node 22.

---

## Repo Layout

```
kpop-quiz/
├── index.html                # iPad meta tags (viewport-fit, apple-mobile-web-app-*), manifest link
├── public/
│   ├── manifest.webmanifest  # Home Screen install, full-screen
│   ├── icons/                # app icons (svg + 180/192/512 png)
│   └── musickpop/            # 8 AAC .m4a tracks (plain slug names — no spaces/apostrophes)
└── src/
    ├── App.tsx               # Screen router: lazy-loaded screens keyed by gameState
    ├── store.ts              # Zustand store (persisted) — all shared state
    ├── index.css             # Tailwind + utility classes (see Design System)
    ├── quizData.ts           # Music/K-Pop quiz questions (5 difficulties)
    ├── utils/                # sounds.ts (Web Audio effects), dates.ts (local dates, streaks)
    ├── games/engine/         # Shared game engine (see below)
    ├── components/           # One file per screen
    │   └── games/            # New-style games built on the engine (+ *Logic.ts, *.test.ts)
    └── data/                 # Puzzle/content data with tests
```

---

## Architecture

### Screens
Every screen is a `gameState` string. `App.tsx` renders Welcome and the game grid directly and lazy-loads everything else (`SCREENS` map), so the iPad only downloads what she opens. The tldraw-based Living Mural is ~1.6 MB on its own — keep it lazy.

To add a screen:
1. Add the key to the `GameState` union in `store.ts`
2. Add `my_key: lazy(() => import('./components/...'))` to `SCREENS` in `App.tsx`
3. Add a tile to `TILES` in `GameModeSelection.tsx` with a `category` (`arcade | puzzle | quiz | party | create | me | teacher`). Set `isNew: true` for a while. Each icon is used once.
4. Every screen needs a clear Back button → `setGameState('game_mode')`

### Store (`store.ts`)
Zustand with `persist` (save key `funquest-save`, `version: 1`). `partialize` saves **progress only** (name, XP, coins, high scores, days played, badges, stats, theme, volume) — never the current screen or an in-progress game. Bump `version` and add a `migrate` step when changing the saved shape.

The old scattered localStorage keys (`kpop_xp`, `ninja_best`, …) are imported once by `readLegacy()` and deleted after hydration. Some per-game content keys still live in components (`zip_best`, `wordladder_solved`, `diary_list`, `style_*`, `cipher_*`, `jarvis_*`) — fine for content, but **scores go through the store**.

### Scoring & rewards — one rule
- `finishRound(gameId, score, xpScale)` — call once when a round ends. It saves the best score, marks today as played (daily streak), and gives XP = `clamp(round(score / xpScale), 5, 50)` (+25 for a new best), coins = `floor(XP / 5)`. It returns `{ isBest, best, xp, coins }`.
- `GameShell` calls it for you. Pick an `xpScale` so a good round lands near 40 XP.
- `submitScore` saves the score without a reward. `addXP` is for small one-off rewards (puzzle solved) and also counts as a day played.
- Never give XP just for opening a screen or tapping a tile.

### Game engine (`src/games/engine/`)
- `useGameLoop({ tickHz, update, draw, running, onHidden })` — logic runs on a **fixed tick** (so 120 Hz iPads aren't double speed), drawing runs on requestAnimationFrame with an interpolation `alpha`, and it calls `onHidden` when she switches apps (pause there).
- `useCanvasSize(ref)` — keeps a canvas sharp at the device pixel ratio and resizes on rotation.
- `useSwipeInput(ref, onDir)` — Pointer-Events swipe steering (turns can be chained without lifting the finger) plus arrow keys/WASD.
- `GameShell` — full-screen frame: Back, Pause, ready / paused / game-over cards, best score, confetti, rewards. Leaves room at the bottom for the music bar.
- `rng.ts` — seeded random (`createRng(seed)`), for tests and debug runs.

**Pattern for a new real-time game:** put the rules in a pure `xxxLogic.ts` (no React, no canvas) with a vitest `xxxLogic.test.ts`; the component only handles input, drawing and the HUD. See `components/games/PaperClash.tsx` + `paperClashLogic.ts`.

**Debug hook:** with `?debug` in the URL, Paper Clash exposes `window.__game` (`start`, `hold`, `step`, `steer`, `world`, `percent`); `?seed=42` makes a run repeatable. Use this for Playwright tests instead of real-time play.

### Music
`MusicPlayer` is always mounted (fixed bar at the bottom); `hidden` keeps the audio playing without the bar (FM Radio, Living Mural). Tracks are listed in `TRACKS` in `store.ts`; `trackInfo(file)` gives the title/artist. To add one: drop an `.m4a` (AAC) with a plain slug name in `public/musickpop/` and add it to `TRACKS`.

---

## Game Screens

| Category | Games (`gameState`) |
|---|---|
| Arcade | `paper_clash`, `kpop_rush` (Rush Runner), `ninja_slice`, `rocket_launch`, `battle_arena` |
| Puzzles | `mini_sudoku`, `zip_game`, `word_ladder`, `crossword_mini`, `word_scramble`, `pattern_memory`, `memory_speed`, `sparkle_match` (Gem Match) |
| Quiz | `difficulty` → `quiz` → `result` (Music Quiz), `lightning_quiz`, `idol_personality_quiz` |
| Party | `truth_or_dare`, `trivia_battle` (Buzzer Battle), `reaction_duel`, `talent_show`, `team_maker` |
| Create & Music | `beat_maker`, `guess_intro`, `fm_radio`, `dance_battle`, `style_studio`, `idol_profile` (Superstar Card), `idol_diary` (Secret Diary) |
| My Stuff | `streak_calendar`, `achievement_showcase` (Trophy Room) |
| Teacher (hidden) | `jarvis_hq`, `freeze_dance`, `chaotic_backstage` — tiles appear after typing **JARVIS** as the player name |
| Hidden | `secret_menu` (tap the **A** in "Arcade" on the welcome screen), `living_mural` (tap the **F**), `agent_hq`, `shop`, `huntrx_splash` (name **HUNTRX**) |

---

## iPad rules

- Touch first. Buttons at least 44×44 px (48+ for primary actions). No hover-only UI.
- Wrap real-time game areas in `.game-surface` (no scrolling, zoom, text selection or long-press menu) and use Pointer Events.
- Avoid the on-screen keyboard: prefer tap choices or an in-game keyboard. Never `autoFocus` inputs.
- Use `.min-h-screen-d` (dvh) rather than 100vh, and respect `env(safe-area-inset-*)`.
- Audio only starts after a tap (MusicPlayer unlocks on the first tap). Safari ignores `<audio>` volume changes — pause other audio instead of fading it.
- Pause games when the page is hidden (`useGameLoop`'s `onHidden`).
- Saved progress: Safari can wipe site data after ~7 days without a visit, **except** for sites added to the Home Screen. Tell users to add it to the Home Screen.
- Draw dragged pieces above the finger so the hand doesn't hide them.

---

## Design System

- `.arcade-bg` — dark purple/indigo backdrop for the welcome screen, grid and engine games
- `.btn-kid`, `.btn-kid-secondary`, `.card-kid`, `.text-kid-glow`, `.bg-kid-pattern` — older light-theme classes used by most existing screens
- Fonts: **Fredoka One** (headings), **Nunito** (body)
- Themes (`data-theme` on `<html>`) live in `index.css`; the Theme switcher is in the Secret Menu
- Framer Motion for UI transitions; keep them short (200–400 ms)

---

## Content rules (kids 8–12)

1. **No external links**, no embeds (YouTube etc.), no third-party sites
2. **No personal data leaves the device** — everything is local (store + localStorage)
3. **Positive tone** — wrong answers get encouragement, never shame
4. **Readable** — body text `text-base`/`text-lg`+, instructions `text-xl`+
5. **Emoji icons** — no icon libraries
6. **Short rounds** — a game round fits in about 5 minutes
7. **G-rated humour**; no scary, violent or adult themes ("knocked out", not "killed")
8. **Facts must be correct.** Any file with facts (quiz banks, "real or fake" facts, puzzle answers) needs a fact-check pass before shipping, and puzzles need a test proving they're solvable (see `data/*.test.ts`)
9. **Celebrate** finishes with confetti and sound

---

## Deployment

Netlify builds `kpop-quiz/` on push to `main` (Node 22 — Vite 7 needs 20+). Security headers and SPA redirect are in `netlify.toml`; `/assets/*` is cached immutably. Serverless functions in `netlify/functions/` (`/api/health`, `/api/counter`, `/api/increment`) are optional.
