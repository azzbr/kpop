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
Every screen is a `gameState` string. `App.tsx` renders Welcome and the game grid directly and lazy-loads everything else (`SCREENS` map), so the iPad only downloads what she opens.

To add a screen:
1. Add the key to the `GameState` union in `store.ts`
2. Add `my_key: lazy(() => import('./components/...'))` to `SCREENS` in `App.tsx`
3. Add a tile to `TILES` in `GameModeSelection.tsx` with a `category` (`arcade | puzzle | quiz | party | create | me | teacher`). Set `isNew: true` for a while. Each icon is used once.
4. Every screen needs a clear Back button → `setGameState('game_mode')`

### Store (`store.ts`)
Zustand with `persist` (save key `funquest-save`, `SAVE_VERSION` 4; v2 added `myQuizzes`, `equipped`, `dailyDoneDate`, `wordGuess`; v3 added `playLog`, `rounds`, `gameBadges`, `parent`, `pet`, `events`; v4 added `todCustom`, `pixelArt`, `agent`, `secretsFound`, `paperClash`, `equipped.skin`). `partializeSave` saves **progress only** (name, XP, coins, high scores, days played, badges, stats, theme, volume) — never the current screen or an in-progress game. Bump `SAVE_VERSION` and add a step to `migrateSave` when changing the saved shape; `src/storeMigration.test.ts` loads a real v3 save (`src/__fixtures__/save-v3.json`) — capture a new fixture from the live build before each bump. `secretReturn` (where a hidden screen's Back goes; `openSecret` / `leaveSecret`) is never saved.

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
- `useSwipeInput(ref, onDir)` — Pointer-Events 4-way swipe steering (2048, Classic Paper Clash) plus arrow keys/WASD.
- `useSteerInput(ref, onAngle, onDir)` — free-angle floating-joystick steering (Paper Clash).
- `GameShell` — full-screen frame: Back, Pause, ready / paused / game-over cards, best score, confetti, rewards.
- `rng.ts` — seeded random (`createRng(seed)`), for tests and debug runs.

**Non-game screens** (tools, collections, toys) use `components/ui/ScreenFrame.tsx` (arcade backdrop, safe areas, 48px Back). Every game — old ones included — runs on `GameShell` and calls `finishRound` once per round; never `addXP` per tap or per answer (that was farmable). Game-name list for stats screens: `components/trophyRoomLogic.ts` `GAME_NAMES`.

**Pattern for a new real-time game:** put the rules in a pure `xxxLogic.ts` (no React, no canvas) with a vitest `xxxLogic.test.ts`; the component only handles input, drawing and the HUD. See `components/games/PaperClash.tsx` + `paperClashLogic.ts`.

**Paper Clash** (`paperClashLogic.ts`): a fine grid (250×250, round arena) for ownership and capture, with free-angle movement (position + heading, turn-rate limit, 20 Hz). Each tick's head segment is rasterised 4-connected (`supercover`), so crossing a trail always hits it and loops never leak in the flood fill. Steering: `steerAngle(p, rad)` (finger, via `useSteerInput`) and `steerDir(p, 0–3)` (keys, arrow pad). Land is drawn from `paperClashOutline.ts` (traced cell edges, smoothed, cached `Path2D` per player, rebuilt only for players whose land changed). Score is still peak % × 10, tuned with `scripts/paperClashSim.ts` (`npx tsx scripts/paperClashSim.ts`) so it means about what it did on the old grid — re-run it after changing speed, arena or bots. The old 4-way game is kept as "🟦 Classic squares" (`paperClashClassicLogic.ts`, `PaperClashClassic.tsx`, switch on the start card, saved as `paperClash.style`); remove it once the new one has been approved on her iPad.

**Debug hook:** with `?debug` in the URL, Paper Clash exposes `window.__game` (`start`, `hold`, `step`, `steerAngle`, `steerDir`, `world`, `percent`, `status`; Classic has `steer(0–3)` instead); `?seed=42` makes a run repeatable. Use this for Playwright tests instead of real-time play.

### Drawing (`components/draw/`)
`DoodleCanvas` is the only drawing surface: a fixed 1200×900 board (survives rotation), Pointer Events, pen/marker/rainbow/eraser/fill/stickers (+ owned Locker stickers), undo capped at 20 (older ops are flattened). Rules in `doodleLogic.ts` (+ test). `DoodlePad` screen (`doodle_pad`, gallery in IndexedDB via `doodleStore.ts`, max 30) and the sticker board (`sticker_board`, autosaves one picture). Truth or Dare's "Draw it" dares use `<DoodleCanvas compact>`. tldraw was removed (the old Living Mural needed a licence key on the live site).

### Truth or Dare (`truth_or_dare`)
Cards in `data/truthOrDare.ts` (8 packs × 64, levels 1–3; the level is a ceiling and chosen packs are pooled). Rules in `components/games/truthOrDareLogic.ts` (+ test): fair laps (everyone once per lap, never twice in a row), the wheel lands on the picked player (`wheelRotation`), no repeats until a deck runs out, kind judging only (✅ Did it / 🐔 Chicken, 3 skips each, optional 😂). "Our cards" are kids' own cards (`todCustom`, through `cleanText`). Every card needs a tone review before shipping (see content rules).

### Secrets (`data/secrets.ts`)
Seven easter eggs, found ids saved in `secretsFound` via `findSecret` (welcome-screen letters F/Q/A are real 48px buttons; 🕹️×5 = DJ mode; Secret HQ; HUNTRX; wearing Pixel Studio art in Paper Clash). The Secret Club lists them with riddle hints. Every Secret Club room is opened with `openSecret(screen, 'secret_menu')` and leaves with `leaveSecret()`. Theme Lab themes set CSS variables used by `.arcade-bg` (`index.css`); a picked theme wins over a seasonal event's background. Agent HQ rules: `components/secretAgentLogic.ts`; Pixel Studio rules: `components/secret/pixelLogic.ts` (`drawPixelArt` draws a skin).

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
- **Rewards:** Arena games call `finishArenaGame(room, ranked)` (`online/arenaRewards.ts`) once per device at the end: placement score out of 100 into `finishRound('friends_arena', …)` (badges `arena_*`), and the host's `room.reportResult` feeds the lobby's "Tonight's leaderboard" (3/2/1 points).
- **Loading & refresh:** each Arena game is a lazy chunk (`GAME_SCREENS` in OnlineHub). After a refresh only `LATE_JOIN_GAMES` reopen; other games show "you'll join the next one", and a refreshed host ends the stale game (`to_lobby`). `online/supabaseClient.ts` is a bare `RealtimeClient` from `@supabase/realtime-js` (no supabase-js).
- **Engines & helpers:** type-the-answer games run on `GuessRace`, tap-the-answer on `TapRace`, "same puzzle, first to solve" on `PuzzleRace` (`online/puzzleRaceLogic.ts`), board/duel games use `online/boardSync.ts`, party games use `online/helloGate.ts`. Small new games use `online/useHostGame.ts` (host keeps the state, broadcasts a public **view** after each change — keep secrets such as unrevealed picks or the real answer out of the view; players send inputs) with `ArenaParts.tsx` / `arenaHelpers.ts` and RaceParts' `FinalCard`; see `RpsShowdown.tsx` + `rpsShowdownLogic.ts`. Every message type starts with the game's own unique prefix. Kids' typed text shown to others goes through `cleanText` + `online/rudeWords.ts`.
- **Party games added Oct 2026:** Bluff Buster (`online/bluffFacts.ts`, fact-checked), Crowd Pleaser, Star Grab, Category Blitz (`online/blitzCategories.ts`), Word Chain (`online/wordChainWords.ts`, unknown words go to a vote), RPS Showdown.
- **Quiz Party** (`online/quiz/`): rules are pure in `quizLogic.ts` (+ tests) — scoring with streaks, typed-answer matching, order questions, Gold Quest chests, Racing, Cash Climb upgrades, teams. `useQuizParty.ts` is the host-authoritative sync: the host broadcasts a full `qp_state` snapshot (never containing unrevealed answers), coalesced to ≤ ~7/s; players send `qp_ans` / `qp_chest` / `qp_target` / `qp_buy`; late joiners say `qp_hello`. Host can be a big screen or play too. Question sources (`sources.ts`): `data/quiz` banks, school questions, music, and the player's own quizzes (`myQuizzes`, made in Quiz Maker — they're only ever sent one question at a time, never stored online).

### Music
`MusicPlayer` is always mounted as a small floating button at the right edge that expands into controls; `hidden` keeps the audio playing without the controls (FM Radio). Tracks are listed in `TRACKS` in `store.ts`; `trackInfo(file)` gives the title/artist. To add one: drop an `.m4a` (AAC) with a plain slug name in `public/musickpop/` and add it to `TRACKS`.

---

## Game Screens

| Category | Games (`gameState`) |
|---|---|
| Arcade | `paper_clash`, `snake_arena`, `tower_defense` (quiz-powered), `kpop_rush` (Rush Runner), `ninja_slice`, `rocket_launch`, `battle_arena` |
| Puzzles | `word_guess`, `game_2048`, `block_blast`, `mini_sudoku`, `zip_game`, `word_ladder`, `crossword_mini`, `word_scramble`, `pattern_memory`, `memory_speed`, `sparkle_match` (Gem Match) |
| Quiz | `quiz_arena` (solo, Classic/Lightning, any source), `quiz_maker`, `real_or_fake`, `emoji_guess`, `idol_personality_quiz` ("Which Arcade Hero Are You?") |
| Party | `online_hub` (Friends Arena — online rooms incl. Quiz Party and Imposter, ~30 games in `components/online/`), `heads_up` (tilt the iPad; needs DeviceOrientation permission from a tap), `would_you_rather`, `tug_of_war`, `truth_or_dare`, `trivia_battle` (Buzzer Battle, questions from every quiz bank), `reaction_duel`, `talent_show`, `team_maker`. One-iPad party games pass `celebrateEnd` to GameShell (win sound, never the 'wrong' one); names use `components/games/partyNames.tsx` |
| Create & Music | `beat_maker`, `guess_intro`, `style_studio`, `idol_profile` (Player Card, saved in localStorage `funquest-player-card`), `idol_diary` (Adventure Diary: `data/adventureStories.ts`, 8 branching stories) |
| My Stuff | `pet_pal`, `quest_map`, `locker`, `achievement_showcase` (Trophy Room: every badge, best scores, streak calendar) |
| Grown-ups | `parent_corner` |
| Teacher (hidden) | `jarvis_hq`, `freeze_dance`, `chaotic_backstage` — tiles appear after submitting **JARVIS** (or Mr Jarvis…) as the player name; submitting any other name turns teacher mode off |
| Hidden | `secret_menu` = the Secret Club (tap the **A** in "Arcade"): `doodle_pad`, `sticker_board` (also the **F**), `pixel_studio`, `agent_hq` (also "Secret HQ" under Start), `theme_lab`, `my_stats`; `huntrx_splash` (name **HUNTRX** / HUNTR/X) |

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

CI (`.github/workflows/e2e.yml`) runs unit tests, tsc and Playwright (WebKit + Chromium) on pushes to `claude/**` branches and `main`: push to the branch first and only fast-forward `main` once that run is green. Netlify builds `kpop-quiz/` on push to `main` (Node 22 — Vite 7 needs 20+). Security headers and SPA redirect are in `netlify.toml`; `/assets/*` is cached immutably. Serverless functions in `netlify/functions/` (`/api/health`, `/api/counter`, `/api/increment`) are optional.
