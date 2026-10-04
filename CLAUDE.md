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
npm run test:e2e   # Playwright end-to-end (see e2e/README.md; WebKit/iPad runs in GitHub Actions)
```

**Deployed on Netlify.** `netlify.toml` lives at the repo root; build base is `kpop-quiz/`, Node 22. `package.json` is `"type": "module"`, so the serverless functions in `netlify/functions/` must use ESM (`export const handler`) — CommonJS makes the deploy fail at "Functions bundling".

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
    ├── quizData.ts           # Music questions (used as the "Music" quiz source)
    ├── utils/                # sounds.ts, dates.ts, dailyChallenge.ts, cleanText.ts, useSafeTimeout.ts
    ├── games/engine/         # Shared game engine (see below)
    ├── components/           # One file per screen
    │   ├── games/            # New-style games built on the engine (+ *Logic.ts, *.test.ts)
    │   ├── quiz/AnswerPad.tsx # Shared answer UI for every question type
    │   ├── ui/OnScreenKeyboard.tsx
    │   └── online/           # Friends Arena games (online/quiz/QuizParty.tsx = Kahoot-style)
    ├── online/               # Room transport (useRoom, localChannel), quiz engine (online/quiz/), banks
    └── data/                 # Content with tests: quiz/ banks, words, would-you-rather, real-or-fake, locker items
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
Zustand with `persist` (save key `funquest-save`, `version: 3`; v2 added `myQuizzes`, `equipped`, `dailyDoneDate`, `wordGuess`; v3 added `playLog`, `rounds`, `gameBadges`, `parent`, `pet`, `events`). `partialize` saves **progress only** (name, XP, coins, high scores, days played, badges, stats, theme, volume) — never the current screen or an in-progress game. Bump `version` and add a `migrate` step when changing the saved shape.

The old scattered localStorage keys (`kpop_xp`, `ninja_best`, …) are imported once by `readLegacy()` and deleted after hydration. Some per-game content keys still live in components (`zip_best`, `wordladder_solved`, `diary_list`, `style_*`, `cipher_*`, `jarvis_*`) — fine for content, but **scores go through the store**.

### Scoring & rewards — one rule
- `finishRound(gameId, score, xpScale)` — call once when a round ends. It saves the best score, marks today as played (daily streak), and gives XP = `clamp(round(score / xpScale), 5, 50)` (+25 for a new best), coins = `floor(XP / 5)`. It returns `{ isBest, best, xp, coins }`.
- `GameShell` calls it for you. Pick an `xpScale` so a good round lands near 40 XP.
- **Daily challenge** (`utils/dailyChallenge.ts`): one game + target per local date. `finishRound` checks it (game id + score ≥ target) and adds +50 coins / +100 XP once a day. The ids and score units in `CHALLENGES` must match what each game passes to `finishRound` — change both together.
- **Coins** are spent in the **Locker** (`components/Locker.tsx`, catalogue in `data/lockerItems.ts`): avatars, colours, trails, titles, themes, stickers. `buyItem(id, price)` / `equip({...})`. Never rename an item id (it's saved in `inventory`). `equipped.avatar/color` are used by Paper Clash, Snake Arena and Friends Arena; `equipped.trail` by Paper Clash.
- `submitScore` saves the score without a reward. `addXP` is for small one-off rewards (puzzle solved) and also counts as a day played.
- Never give XP just for opening a screen or tapping a tile.

### Game engine (`src/games/engine/`)
- `useGameLoop({ tickHz, update, draw, running, onHidden })` — logic runs on a **fixed tick** (so 120 Hz iPads aren't double speed), drawing runs on requestAnimationFrame with an interpolation `alpha`, and it calls `onHidden` when she switches apps (pause there).
- `useCanvasSize(ref)` — keeps a canvas sharp at the device pixel ratio and resizes on rotation.
- `useSwipeInput(ref, onDir)` — Pointer-Events swipe steering (turns can be chained without lifting the finger) plus arrow keys/WASD.
- `GameShell` — full-screen frame: Back, Pause, ready / paused / game-over cards, best score, confetti, rewards.
- `rng.ts` — seeded random (`createRng(seed)`), for tests and debug runs.

**Pattern for a new real-time game:** put the rules in a pure `xxxLogic.ts` (no React, no canvas) with a vitest `xxxLogic.test.ts`; the component only handles input, drawing and the HUD. See `components/games/PaperClash.tsx` + `paperClashLogic.ts`.

**Debug hook:** with `?debug` in the URL, Paper Clash exposes `window.__game` (`start`, `hold`, `step`, `steer`, `world`, `percent`); `?seed=42` makes a run repeatable. Use this for Playwright tests instead of real-time play.

### Badges, quests, pet, events, parents
- **Per-game badges**: `data/gameBadges.ts` — `finishRound` tests every badge after each round (+10 coins each); `BadgeToast` (mounted in App) announces them. Never rename a badge id.
- **Quest Map** (`quest_map`): `data/quests.ts`, claimed ids in localStorage `funquest-quests-claimed`.
- **Pet Pal** (`pet_pal`): rules in `utils/petLogic.ts` (grows once per day she plays, never dies), decor in `data/petItems.ts`.
- **Seasonal events**: `events/events.ts` (`activeEvent(date)`; `?event=halloween` forces one on). `PumpkinHunt` (mounted in App) hides collectibles on menu screens only, max 3 per day; `EventBanner` on the grid; `useEventTheme` sets `<html data-event>` for `events/*.css`; limited Locker items via `eventLockerItems`. Add a new event = a new entry in `SEASON_EVENTS` (+ optional CSS, quiz bank, Locker items).
- **Parent corner** (`parent_corner`, "👪 Grown-ups" button under the grid, behind a times-table check): weekly play time from `playLog` (filled by `PlayTimeTracker` in App every 15 s), break reminder, sound-effect volume (`utils/sounds.setSfxVolume`), reset.

### Offline (service worker)
`sw/sw.js` is built into `dist/sw.js` by the `serviceWorker()` plugin in `vite.config.ts` (precache list + version injected). App files are precached; music is cached on first play and answered with 206 range responses (Safari needs them). Registered in `main.tsx` in production only (`?nosw` disables). Cross-origin requests (Supabase, fonts) are not cached.

### Online rooms (Friends Arena)
`src/online/useRoom.ts` joins a Supabase Realtime channel named after the room code. The host's device holds the authoritative game state and broadcasts it; other devices send inputs. Question/puzzle banks live in `src/online/*.ts`.
- **Host = whoever joined first** (`pickHost`, by `joinedAt`). Each tab saves its room + `joinedAt` in sessionStorage (`kpop_room`), so a refresh rejoins with the same seat (and a refreshing host stays host); App opens Friends Arena automatically. If the host vanishes, `hostAway` is true for `HOST_GRACE_MS` (20 s) before the next player takes over.
- Games in `LATE_JOIN_GAMES` (OnlineHub: Quiz Party, Imposter) sync late joiners and survive a host change; for any other game a new host sends everyone back to the lobby. Quiz Party's host state is also saved per tab (`qp_host_state`) so a refreshed host carries on mid-question.
- **`?localroom`** swaps Supabase for a `BroadcastChannel` between tabs of one browser (`online/localChannel.ts`) — use it for Playwright tests (several pages in one context) and offline play.
- `room.reportResult(rankedIds)` (host) feeds the lobby's session leaderboard ("Tonight's leaderboard": 3/2/1 points). Quiz Party, `GuessRace` and `TapRace` call it; add one line to other games when touching them.
- **Quiz Party** (`online/quiz/`): rules are pure in `quizLogic.ts` (+ tests) — scoring with streaks, typed-answer matching, order questions, Gold Quest chests, Racing, Cash Climb upgrades, teams. `useQuizParty.ts` is the host-authoritative sync: the host broadcasts a full `qp_state` snapshot (never containing unrevealed answers), coalesced to ≤ ~7/s; players send `qp_ans` / `qp_chest` / `qp_target` / `qp_buy`; late joiners say `qp_hello`. Host can be a big screen or play too. Question sources (`sources.ts`): `data/quiz` banks, school questions, music, and the player's own quizzes (`myQuizzes`, made in Quiz Maker — they're only ever sent one question at a time, never stored online).

### Music
`MusicPlayer` is always mounted as a small floating button at the right edge that expands into controls; `hidden` keeps the audio playing without the controls (FM Radio, Living Mural). Tracks are listed in `TRACKS` in `store.ts`; `trackInfo(file)` gives the title/artist. To add one: drop an `.m4a` (AAC) with a plain slug name in `public/musickpop/` and add it to `TRACKS`.

---

## Game Screens

| Category | Games (`gameState`) |
|---|---|
| Arcade | `paper_clash`, `snake_arena`, `tower_defense` (quiz-powered), `kpop_rush` (Rush Runner), `ninja_slice`, `rocket_launch`, `battle_arena` |
| Puzzles | `word_guess`, `game_2048`, `block_blast`, `mini_sudoku`, `zip_game`, `word_ladder`, `crossword_mini`, `word_scramble`, `pattern_memory`, `memory_speed`, `sparkle_match` (Gem Match) |
| Quiz | `quiz_arena` (solo, Classic/Lightning, any source), `quiz_maker`, `real_or_fake`, `emoji_guess`, `idol_personality_quiz` |
| Party | `online_hub` (Friends Arena — online rooms incl. Quiz Party and Imposter, ~30 games in `components/online/`), `heads_up` (tilt the iPad; needs DeviceOrientation permission from a tap), `would_you_rather`, `tug_of_war`, `truth_or_dare`, `trivia_battle` (Buzzer Battle), `reaction_duel`, `talent_show`, `team_maker` |
| Create & Music | `beat_maker`, `guess_intro`, `fm_radio`, `dance_battle`, `style_studio`, `idol_profile` (Superstar Card), `idol_diary` (Secret Diary) |
| My Stuff | `pet_pal`, `quest_map`, `locker`, `streak_calendar`, `achievement_showcase` (Trophy Room) |
| Grown-ups | `parent_corner` |
| Teacher (hidden) | `jarvis_hq`, `freeze_dance`, `chaotic_backstage` — tiles appear after typing **JARVIS** as the player name |
| Hidden | `secret_menu` (tap the **A** in "Arcade" on the welcome screen), `living_mural` (tap the **F**), `agent_hq`, `huntrx_splash` (name **HUNTRX**) |

---

## iPad rules

- Touch first. Buttons at least 44×44 px (48+ for primary actions). No hover-only UI.
- Wrap real-time game areas in `.game-surface` (no scrolling, zoom, text selection or long-press menu) and use Pointer Events.
- Avoid the iPad keyboard: prefer tap choices or `components/ui/OnScreenKeyboard.tsx` (in-game keys, optional letter colouring, space, digits). Editors like Quiz Maker may use real inputs. Never `autoFocus` inputs.
- Text kids type that others will see (quiz titles/questions) goes through `utils/cleanText.ts`.
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
2. **No personal data leaves the device** — progress is local (store + localStorage). The one exception is Friends Arena: `src/online/` uses Supabase Realtime *broadcast* (publishable key in `supabaseClient.ts`) to send a player's display name and game moves to others in the same 4-letter room. Nothing is written to a database. Keep it that way: no accounts, no stored chat, first names only
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
