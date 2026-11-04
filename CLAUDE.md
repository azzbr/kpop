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
    │   ├── home/             # Grid parts: GameTile, TodayStrip, WeeklyCard, homeLogic (+ test)
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
3. Add a tile to `TILES` in `GameModeSelection.tsx` with a `category` (`arcade | puzzle | quiz | party | create | me | teacher`). Set `isNew: true` for a while. Each icon is used once. A solo game with a score also gets a `MASTERY` entry (`data/mastery.ts`, see Home screen) and a place in `WEEKLY_ROTATION` (`utils/weeklyGame.ts`); the tests check both.
4. Every screen needs a clear Back button → `setGameState('game_mode')`, marked `data-back` so Android's back gesture presses it in the installed app (ScreenFrame / GameShell do this for you)

### Store (`store.ts`)
Zustand with `persist` (save key `funquest-save`, `SAVE_VERSION` 6; v2 added `myQuizzes`, `equipped`, `dailyDoneDate`, `wordGuess`; v3 added `playLog`, `rounds`, `gameBadges`, `parent`, `pet`, `events`; v4 added `todCustom`, `pixelArt`, `agent`, `secretsFound`, `paperClash`, `equipped.skin`; v5 added `clubs`, `teacher`, `goldStars`; v6 added `favourites`, `recent`, `parent.vibration`). `teacherOn` (teacher mode for this visit) and `inGame` (a GameShell game is on screen) are never saved. `partializeSave` saves **progress only** (name, XP, coins, high scores, days played, badges, stats, theme, volume) — never the current screen or an in-progress game. Bump `SAVE_VERSION` and add a step to `migrateSave` when changing the saved shape; `src/storeMigration.test.ts` loads real v3, v4 and v5 saves (`src/__fixtures__/save-v3.json`, `save-v4.json`, `save-v5.json`) — capture a new fixture from the live build before each bump. `secretReturn` (where a hidden screen's Back goes; `openSecret` / `leaveSecret`) is never saved.

The old scattered localStorage keys (`kpop_xp`, `ninja_best`, …) are imported once by `readLegacy()` and deleted after hydration. Some per-game content keys still live in components (`zip_best`, `wordladder_solved`, `diary_list`, `style_*`, `cipher_*`, `jarvis_*`) — fine for content, but **scores go through the store**.

### Scoring & rewards — one rule
- `finishRound(gameId, score, xpScale)` — call once when a round ends. It saves the best score, marks today as played (daily streak), and gives XP = `clamp(round(score / xpScale), 5, 50)` (+25 for a new best), coins = `floor(XP / 5)`. It returns `{ isBest, best, xp, coins }`.
- `GameShell` calls it for you. Pick an `xpScale` so a good round lands near 40 XP.
- **Game of the week** (`utils/weeklyGame.ts`, Monday–Sunday, rotation over `WEEKLY_ROTATION`): that game's round XP ×2, so its coins ×2 too; the daily-challenge bonus is added on top, not doubled. **Mastery stars**: each new star pays `STAR_COINS` (5). `RoundResult` carries `weekly`, `starsBefore`, `starsAfter`. Keep the over card's "+N XP · +N 🪙" text as it is (e2e tests match it).
- **Daily challenge** (`utils/dailyChallenge.ts`): one game + target per local date. `finishRound` checks it (game id + score ≥ target) and adds +50 coins / +100 XP once a day. The ids and score units in `CHALLENGES` must match what each game passes to `finishRound` — change both together.
- **Coins** are spent in the **Locker** (`components/Locker.tsx`, catalogue in `data/lockerItems.ts`): avatars, colours, trails, titles, themes, stickers. `buyItem(id, price)` / `equip({...})`. Never rename an item id (it's saved in `inventory`). `equipped.avatar/color` are used by Paper Clash, Snake Arena and Friends Arena; `equipped.trail` by Paper Clash.
- `submitScore` saves the score without a reward. `addXP` is for small one-off rewards (puzzle solved) and also counts as a day played.
- Never give XP just for opening a screen or tapping a tile.

### Game engine (`src/games/engine/`)
- `useGameLoop({ tickHz, update, draw, running, onHidden })` — logic runs on a **fixed tick** (so 120 Hz iPads aren't double speed), drawing runs on requestAnimationFrame with an interpolation `alpha`, and it calls `onHidden` when she switches apps (pause there).
- `useCanvasSize(ref)` — keeps a canvas sharp at the device pixel ratio and resizes on rotation.
- `useSwipeInput(ref, onDir)` — Pointer-Events 4-way swipe steering (2048, Classic Paper Clash) plus arrow keys/WASD.
- `useSteerInput(ref, onAngle, onDir)` — free-angle floating-joystick steering (Paper Clash).
- `GameShell` — full-screen frame: Back, 🎵 (pauses, opens the music panel), Pause, ready / paused / game-over cards, best score, confetti, rewards, mastery stars on the over card (pop-in, chime per new star, progress bar to the next star, "So close!" at ≥ 85%). It also pauses a running round when the app is hidden, keeps the screen awake while a round runs (Wake Lock), sets `inGame`, and vibrates on Android for happy moments (`utils/haptics.ts` `buzz`: new best / new star / daily / badge = `great`, a party game's finale = `good`, never a loss; off with `parent.vibration`). A game with its own menu passes `onBack` (Back and the over card's leave button go there instead of the grid) plus `leaveLabel` / `againLabel` for the over card's buttons (Chess Academy does this), and `overExtra` for an extra over-card button (Robo Quest).
- `rng.ts` — seeded random (`createRng(seed)`), for tests and debug runs.

**Non-game screens** (tools, collections, toys) use `components/ui/ScreenFrame.tsx` (arcade backdrop, safe areas, 48px Back). Every game — old ones included — runs on `GameShell` and calls `finishRound` once per round; never `addXP` per tap or per answer (that was farmable). Game-name list for stats screens: `components/trophyRoomLogic.ts` `GAME_NAMES`.

**Pattern for a new real-time game:** put the rules in a pure `xxxLogic.ts` (no React, no canvas) with a vitest `xxxLogic.test.ts`; the component only handles input, drawing and the HUD. See `components/games/PaperClash.tsx` + `paperClashLogic.ts`.

**Paper Clash** (`paperClashLogic.ts`): a fine grid (250×250, round arena) for ownership and capture, with free-angle movement (position + heading, turn-rate limit, 20 Hz). Each tick's head segment is rasterised 4-connected (`supercover`), so crossing a trail always hits it and loops never leak in the flood fill. Steering: `steerAngle(p, rad)` (finger, via `useSteerInput`) and `steerDir(p, 0–3)` (keys, arrow pad). Land is drawn from `paperClashOutline.ts` (traced cell edges, smoothed, cached `Path2D` per player, rebuilt only for players whose land changed). Score is still peak % × 10, tuned with `scripts/paperClashSim.ts` (`npx tsx scripts/paperClashSim.ts`) so it means about what it did on the old grid — re-run it after changing speed, arena or bots. The old 4-way game is kept as "🟦 Classic squares" (`paperClashClassicLogic.ts`, `PaperClashClassic.tsx`, switch on the start card, saved as `paperClash.style`); remove it once the new one has been approved on her iPad.

**Debug hook:** with `?debug` in the URL, Paper Clash exposes `window.__game` (`start`, `hold`, `step`, `steerAngle`, `steerDir`, `world`, `percent`, `status`; Classic has `steer(0–3)` instead); `?seed=42` makes a run repeatable. Use this for Playwright tests instead of real-time play.

### Home screen (the grid, `GameModeSelection.tsx` + `components/home/`)
Top to bottom: level badge, `TodayStrip` (🔥 streak from `getStreak`, 🐾 pet line, ⭐ star total → Trophy Room), event/update banners, daily challenge + `WeeklyCard` (side by side from tablet width), 🎲 Surprise Me (`pickSurpriseGame`: games with 0–1★ not opened lately are 3× as likely), **▶ Jump back in** (`recent`, last 4; `noteOpened` in `open()` for game tiles, not 'me' tiles), **⭐ My favourites** (`favourites`, ☆ button on every tile, max 20), then the categories. Each `<section>` has an `aria-label` equal to its `<h2>` — a tile can appear in several sections, so e2e tests scope with `getByRole('region', { name })`. Rules in `home/homeLogic.ts` (+ test).
- `home/GameTile.tsx`: tile button + a sibling ☆/⭐ favourite button (bottom-right; NEW sits top-right), stars line `⭐⭐☆ · 🏅 Best: …`, "🌟 2× XP" chip on the weekly game, gold card + 🏆 at 3★ (`data-mastered`).
- **Mastery stars** (`data/mastery.ts` + test): 1★/2★/3★ score thresholds per solo game in its own finishRound units, computed from `highScores` (no saved stars, old bests count). 2★ ≈ the daily target, 3★ ≤ the game's max. Word Guess has none (score 0/1). Thresholds are first guesses — tune them after watching her play. MASTERY is keyed by `gameId`: when a tile holds several scored games, the entry names its `screen` (the tile's `scoreKey` is the one shown on the tile), and `weekly: false` keeps one out of `WEEKLY_ROTATION` (`chess_bot`).

### Logic puzzles (Nov 2026: Picture Puzzles, Bridges, Light Up, Untangle)
Original games built from ideas in open-source collections (Simon Tatham's puzzles) — own code, levels and pictures, nothing copied. Each has a pure `components/games/xxxLogic.ts` (+ test) and a GameShell component scored like Zip (`round(base × max(0.3, 1 − seconds/par))`, Easy/Small 300 · Medium 500 · Hard/Big 700; 1★ = any finished puzzle, 2★ 250, 3★ 400). Levels are seeded (`levelSeed(diff, n)`), so "Level 7" is the same everywhere; progress is a content key (`bridges_level`, `lightup_level`, `untangle_level`, `picture_solved`, …) and any valid answer counts, not just the generated one.
- **Picture Puzzles** (`pictureLogic.ts`, pictures in `data/picturePuzzles.ts`): every picture must be solvable by the line solver alone (`solveByLines`, checked in `data/picturePuzzles.test.ts`) so she never has to guess. Picture ids are saved — never rename them. Pictures are original and G-rated.
- **Bridges / Light Up / Untangle**: generators build a solution first, so every level is solvable; the tests run hundreds of seeds per level.
- `?debug` puts `window.__puzzle.solve()` on each puzzle for e2e tests (`e2e/puzzles.spec.ts`).
- **No copies of existing games.** Ideas and genres are fine; another game's code, art, levels, characters or name are not — even with an open licence (e.g. the Chrome Dino extracted on GitHub is never copied in — the Grown-ups corner only links to it; Rush Runner's Dino Valley is the original take).

### ♟️ Chess Academy (`chess_academy`, Nov 2026)
One tile (`scoreKey: 'chess_puzzles'`), a room menu (ScreenFrame) and four rooms, each its own GameShell whose Back returns to the menu (`components/games/ChessAcademy.tsx`):
- **🎓 Learn** (`gameId chess_learn`, score = stars × 100): original star-hunt levels for each piece plus check / checkmate / escape (`data/chessLessons.ts`, rules in `chessLessonLogic.ts` + test — BFS proves each level's move target). Progress in content key `chess_lessons` (`{ levelId: stars }`).
- **🧩 Puzzle Streak** (`chess_puzzles`, xpScale 22): 3 lives / 5 minutes; score = Σ round(rating / 10), the full hint halves it. One free retry, then the answer + the theme's tip (`data/chessThemes.ts`). Her puzzle level (Elo-style, starts 600) is `chess_puzzle_level`; seen ids `chess_puzzle_seen`. Lichess rule: any checkmating move solves.
- **🤖 Play a bot** (`chess_bot`, xpScale 9): 🐶 Biscuit / 🦊 Fox / 🦉 Professor Hoot (`chessBot.ts`, alpha-beta with our own evaluation, run in a Web Worker via `chessBotClient.ts` `askBot` — never rejects, falls back to the main thread). Win 100 / 250 / 450, draw 30 / 60 / 90, loss 0 (`celebrateEnd`, never the buzzer). Hint (`hintMove`) and take-back allowed. The search uses chess.js 1.4.0 private methods, so **chess.js is pinned to exactly 1.4.0** (`chessBot.test.ts` fails if they change).
- **👫 Two players** (`chess_duo`): pass-and-play, board turns round, undo.
- Rules: `chessLogic.ts` (+ test) wraps chess.js (moves, promotion, check/mate/draw, puzzle state machine, puzzle level). Board: `ChessBoard.tsx` (tap or drag, piece lifted above the finger, legal-move dots, promotion picker, `data-square` / `data-piece` / `data-mark` for tests) with our own piece art (`chessPieces.tsx`).
- **Puzzle data**: `data/chessPuzzles.ts` (1,163 puzzles, rating 400–1599, 9 kid-friendly themes) is generated by `node scripts/buildChessPuzzles.mjs [local.csv]` from the Lichess puzzle export (CC0; the script streams a GitHub copy when database.lichess.org is blocked). No game links are stored. `chessPuzzles.test.ts` replays every puzzle in chess.js and checks mates.
- **Credits**: Grown-ups corner → 📜 Credits and `public/licenses.txt` (chess.js BSD-2, Lichess puzzles CC0, matter-js MIT, Blockly Apache-2.0, fonts OFL). Add new open-source libraries or data there.
- `?debug` puts `window.__chess` on the open room (`move(uci)`, `solve()`, `load(fen)` for the bot, `peek()` for puzzles); `e2e/chess.spec.ts`.

### 🏗️ Stack Lab (`stack_lab`, Nov 2026)
Tap to drop pieces from a swinging crane onto a small table and build the tallest tower in 90 s (`components/games/StackLab.tsx`, rules in `stackLabLogic.ts` + test). Physics is **matter-js 0.20.0** (MIT, pinned), stepped on the fixed 60 Hz tick with 3 sub-steps.
- Pieces (`PIECES`: cube, plank, tower block, jelly, gem, hill) come from a seeded shuffled bag of 11 (`?seed=` repeats a round); the first piece is always an easy one. 🔄 Turn spins the hanging piece a quarter turn. Bodies have sharp corners on purpose (rounded ones make matter-js stacks jitter); the drawing rounds them and adds faces.
- Very slow movement of a landed piece is damped (`CREEP_SPEED`, `CREEP_DAMP`) so a stack doesn't creep, and still pieces sleep. A real topple is fast and isn't damped — the tests check that an overhanging cube still falls and a balanced plank stays.
- **Score = best still height in cm** (`UNITS_PER_CM` 6.4, a cube is 10 cm): it only counts when every piece has been still for `STILL_TICKS`. Pieces that fall off cost a heart, one per tumble (`TUMBLE_TICKS`); 3 tumbles or time's up end the round (after time's up the tower gets up to 4 s to settle).
- Stars 40 / 100 / 200 cm, xpScale 2, badges `sl_*`. Tuned with the pretend player in `stackLabSim.ts` (`npx tsx scripts/stackLabSim.ts`) — re-run it after changing pieces, friction, the crane or the round.
- `?debug` puts `window.__stack` on the screen (`hold`, `step`, `drop`, `turn`, `dropAt(x)`, `bestCm`, `world`); `e2e/stackLab.spec.ts`.

### 🤖 Robo Quest (`robo_quest`, Nov 2026)
Program a robot with snap-together **Blockly 13.4.0** blocks (Apache-2.0, pinned) to reach its dock 🔋 after picking up every ⚡. 30 original levels in 3 worlds (`data/roboLevels.ts`): 🌻 Garden (forward / turns), 🏭 Factory (+ 🔁 repeat 2–9), 🚀 Space (+ repeat until 🔋, ❓ if path ahead/left/right, if / else). Level ids are saved — never rename them.
- **Rules** in `components/games/roboLogic.ts` (+ test): `Program` AST, `runProgram` → a step trace (moves, turns, sensor checks for the board's pulse, bumps) and a kind result (`dock` / `bump` / `short` / `missing` / `loop` / `empty`; loops are capped and only ~20 steps are played back), `blockCount`, `starsFor` (⭐⭐⭐ ≤ target, ⭐⭐ ≤ target + 2), `levelScore` (world × 100 per star), `sanitizeProgram` for saves, and the search tools `shortestMoves` (BFS) / `searchShortest` (exhaustive programs).
- **Levels are proven** in `data/roboLevels.test.ts`: every reference solution docks with exactly `target` blocks; Garden targets equal the BFS minimum; nothing shorter exists (search up to 5 / 4 blocks in Factory / Space); Space sensor levels can't be done without sensors in ≤ target blocks. New levels: draw them from a move path (each path cell floor, walls around) and let the search set the target.
- **Blockly** (`roboBlocks.ts`): our own blocks on a slightly taller Zelos renderer (`'robo'`: 56 px blocks, ≥ 44 px at the phone scale 0.8); the repeat count is a dropdown (no iPad keyboard); `media: '/blockly-media/'` (files copied from the package, precached by the `serviceWorker()` plugin) and `sounds: false` — Blockly never loads anything from blockly.com. Only blocks under ▶ When Run count; others are greyed (`Events.disableOrphans`). **Tap-to-add**: a tap on a flyout block appends it after the selected block or at the end of the chain, filling an empty loop / if mouth first. `workspaceToProgram` / `programToWorkspace`; Blockly dropdowns sit at z-index 9999; the layout uses `isolate` so the flyout stays under GameShell's cards.
- **Screen** (`RoboQuest.tsx`): the start card is the level map (sequential unlocks); SVG board with a breadcrumb trail, sensor pulse and bump 💥 (kept until Reset / Run / an edit); ▶ Run, 👣 Step, 🔄 Reset, 🐢/🐇, 💡 hint; the over card offers "🔧 Try for ⭐⭐⭐" (GameShell `overExtra`) under 3 stars. Content keys `robo_stars` and `robo_code` (compact programs) travel with 🔁 Move progress.
- Rewards: `gameId robo_quest`, xpScale 15, stars 100 / 600 / 900, badges `rq_*`. `?debug` → `window.__robo` (`open(id)`, `load(program)`, `run()`, `solve()`, `blocks()`, `program()`); `e2e/roboQuest.spec.ts` (Blockly labels use non-breaking spaces — match with `\s`).

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
- **Seasonal events**: `events/events.ts` (`activeEvent(date)`; `?event=halloween` forces one on). `PumpkinHunt` (mounted in App) hides collectibles on menu screens only, max 3 per day; `EventBanner` on the grid (colours from the event's `palette`, a `themeNote` line, and `extras` = always-visible buttons to event screens); `useEventTheme` sets `<html data-event>` for `events/*.css`; limited Locker items via `eventLockerItems`, earn-only ones listed in `REWARD_ONLY` with a Locker hint from `rewardOnlyHint(id)`. Add a new event = a new entry in `SEASON_EVENTS` (+ optional CSS, quiz bank, Locker items). Event progress lives in `store.events[key]` as receipt ids (no save-version bump). Playwright's `page.clock` sets the date in e2e tests (`e2e/winter.spec.ts`).
- **❄️ Winter Wonderland** (`winter-2026`, 1 Dec – 6 Jan): 25-snowflake hunt (finale unlocks the "Snowflake Catcher" title), `winter.css` (deep-blue night on the default theme; slow falling snow on menu screens only — `.arcade-bg:not(.game-surface)` pseudo-elements, transform-only, off with reduced motion), Winter Quiz (`data/quiz/winter.ts`, fact-checked), Locker items `wi26_*` (`data/winterLocker.ts`, never rename).
  - **🎄 Advent calendar** (`advent_calendar`, from the banner): rules in `events/advent.ts` (+ test), doors in `data/adventDoors.ts` (24 doors, shuffled `DOOR_ORDER`; jokes, facts, gifts on 6/12/18/24, challenges). Door *d* opens on local date 2026-12-*d* (`localDateKey`, never UTC); missed doors open until 6 Jan, "Open all missed doors" opens them in one card. Every door pays 10 coins (door 24: 50) once — receipts `door-N` in `events['advent-2026']`; a screen-level lock ignores taps until the card is closed. Coins only, never XP.
  - **Challenges** (`{ gameId, screen, target }` in finishRound units, ≤ the game's 3★): live once the door is open; `finishRound` calls `checkAdventChallenges` and any qualifying round pays +20 coins once (`challenge-N`), shown on GameShell's over card as `RoundResult.adventBonus` (`data-testid="advent-bonus"`). ▶ Play now opens the game.
  - **Golden door 24**: `.advent-golden` shimmer + its own chime, the "Winter Star" title, and a snow day (`snowday-<date>` receipt → `useEventTheme` sets `<html data-snowday>` for that local day: heavier, sparkly snow on menus; game boards stay calm).
  - **❄️ Snow Catch** (`snow_catch`, only from the banner — no tile, no mastery stars or weekly slot): 30 s, drag anywhere / ← → to move the basket, ✨ golden flakes count 3. Rules in `components/games/snowCatchLogic.ts` (+ test), xpScale 1.25, badges `snow_*`. During the event +1 🪙 per flake, max 30 a day (content key `snow_catch_bonus`, shown via `overExtra`). `?debug` → `window.__snow` (`hold`, `step`, `moveTo`, `autoplay`, `caught`, `score`).
- **Parent corner** (`parent_corner`, "👪 Grown-ups" button under the grid, behind a times-table check): weekly play time from `playLog` (filled by `PlayTimeTracker` in App every 15 s), break reminder, sound-effect volume (`utils/sounds.setSfxVolume`), 📳 vibration on/off (`parent.vibration`), Friends Arena clubs (`grownups/ClubSetup.tsx`), Teacher setup (`grownups/TeacherSetup.tsx`), reset.

### Offline (service worker)
`sw/sw.js` is built into `dist/sw.js` by the `serviceWorker()` plugin in `vite.config.ts` (precache list + version injected). App files are precached; music is cached on first play and answered with 206 range responses (Safari needs them). Registered in `main.tsx` in production only (`?nosw` disables). Cross-origin requests (Supabase) are never cached, so **everything the app needs offline must be its own file**: the fonts are bundled (`src/assets/fonts/` woff2 + OFL licences, `@font-face` rules in `src/fonts.css`, imported first in `main.tsx`; `.woff2` files are precached) — never load fonts, images or scripts from another site (the old Google Fonts link made the installed app lose its fonts offline). Canvas text uses `Fredoka` — an alias of Fredoka One in `fonts.css`, loaded at start-up by `main.tsx`. `e2e/offline.spec.ts` checks fonts load with the internet off. When the app comes back to the front after 30+ min, `main.tsx` checks for a new version; if one takes over, the grid shows "✨ New things have arrived! Tap to update" (`markUpdateReady`).

### Installed app (Android, iPhone/iPad, computers)
- `utils/appInstall.ts` (`initAppInstall()` first thing in `main.tsx`): `useInstallState()` → `asApp` (opened from the Home Screen; `?app` fakes it for tests), `canPrompt` (Chrome's `beforeinstallprompt`, kept so no browser pop-up appears for kids), `platform` (`ios | android | desktop`; iPadOS says "Macintosh" + touch), `updateReady`. As the app it calls `navigator.storage.persist()`.
- **Grown-ups corner → 📲 Get the app** (`grownups/AppSetup.tsx`, first section until installed; the grid shows "📲 Get the app" next to 👪 Grown-ups when `offerInstall()`): the browser's install dialog, or picture steps for iPhone/iPad (Share → Add to Home Screen → Open as Web App) and Android menus.
- **iPhone/iPad Home Screen apps have their own storage, separate from Safari** — the app starts empty. **🔁 Move progress** (`utils/saveTransfer.ts` + test) makes a save code (every localStorage key, gzip + base64, prefix `FUNQUEST-SAVE:`) to copy/share and paste in the app or on a new device; it shows both saves and asks twice before replacing. Never uploaded. Doodle Pad pictures (IndexedDB) don't move. New per-game localStorage keys move automatically; keys starting with `__` are skipped.
- **Back gesture** (`utils/backGuard.ts`, installed app only): off the Welcome screen and grid there is one guard history entry; Android's back pops it → `funquest:back` (GameShell cancels it to pause a running round) → else the screen's `[data-back]` button is clicked → else grid / `leaveSecret()`. **Give every new screen's main Back button `data-back`** (ScreenFrame and GameShell already have it).
- `components/ui/ScreenErrorBoundary.tsx` wraps the screens: a screen file that fails to load (a deploy while the app was open) reloads once per 30 s, otherwise a friendly "Try again / Back to the games" card — never a blank page in an app without browser buttons.
- Manifest: `id`, `display_override`, maskable icons (`icons/icon-maskable.svg`, no text, inside the middle 80%) and `screenshots/` (Chrome's richer install sheet). Remake them with `npm run build && node scripts/makeAppImages.mjs` (`PW_CHROMIUM=/opt/pw-browsers/chromium` if Playwright's own browser is missing) and keep the sizes in the manifest in step.
- e2e: `e2e/installApp.spec.ts` (home screen: `e2e/home.spec.ts`).

### Online rooms (Friends Arena)
`src/online/useRoom.ts` joins a Supabase Realtime channel named after the room code. The host's device holds the authoritative game state and broadcasts it; other devices send inputs. Question/puzzle banks live in `src/online/*.ts`.
- **Host = whoever joined first** (`pickHost`, by `joinedAt`). Each tab saves its room + `joinedAt` in sessionStorage (`kpop_room`), so a refresh rejoins with the same seat (and a refreshing host stays host); App opens Friends Arena automatically. If the host vanishes, `hostAway` is true for `HOST_GRACE_MS` (20 s) before the next player takes over.
- Games in `LATE_JOIN_GAMES` (OnlineHub: Quiz Party, Imposter) sync late joiners and survive a host change; for any other game a new host sends everyone back to the lobby. Quiz Party's host state is also saved per tab (`qp_host_state`) so a refreshed host carries on mid-question.
- **`?localroom`** swaps Supabase for a `BroadcastChannel` between tabs of one browser (`online/localChannel.ts`) — use it for Playwright tests (several pages in one context) and offline play.
- **Lobby (OnlineHub):** names come from the store `userName` (typed with `TypeBox` = on-screen keyboard, checked by `online/names.ts` `safeName`); room codes are typed on the on-screen keyboard too. Host options live in `components/online/arenaOptions.ts` (`GAME_OPTIONS`, plus `BOARD` = big-screen mode, `config.board === '1'`). Emoji reactions (`online/useReactions.ts`, `Reactions.tsx`, ≤ 1/s per player) float on every screen in the lobby and in games; `BalloonPop` keeps waiting kids busy.
- **Live count:** `online/usePresenceCount.ts` — one presence channel `kpop_online` tracking only `{ r }` (1 = hosts a room) under the anonymous tab id; shown by `components/ui/OnlineCount.tsx` (lazy-loaded on Welcome and the grid so the realtime client stays out of the first download). Joined only while a screen shows it; left while the page is hidden.
- **Room powers (`useRoom`):** fresh codes are checked for collisions; the host keeps `RoomMeta` `{ locked, removed, allowed }` and broadcasts `room_meta`; joiners wait for it (`WELCOME_WAIT_MS`), disallowed ones get `room_refuse` (`admission()`); `removePlayer`, `setLocked`, `allowPlayer`, `passHost` (`room_host` → the new host re-tracks with the earliest `joinedAt`). `joinRoom` returns a `JoinResult`. Meta is kept per tab (`kpop_room_meta`) so a refreshing host stays locked. `online/channel.ts` opens any channel (Supabase or LocalChannel).
- **Clubs (`online/useClub.ts`, `clubLogic.ts`, `ClubPanel.tsx`, codes in `data/clubWords.ts`):** a grown-up or teacher makes a club in the Grown-ups corner (code like `FOX-RAINBOW-27`, name from the code, never typed); kids join with the code (store `clubs`, max 3). Channel `kpopclub:<CODE>`, presence = `ClubMember` (first name, emoji, status, room). Tap a hosting member to knock (`club_knock` → host's ✅ Let in calls `allowPlayer` + `club_admit` → the knocker joins), tap a free member to invite (`club_invite`, invitee is pre-allowed). Rate-limited 1 per 10 s per person both ways.
- **Teacher mode:** Grown-ups corner → Teacher setup (name via `safeName`, PIN stored as a SHA-256 hash, `utils/pin.ts` — a lock against kids, not security). The 🍎 Teacher button under the grid + PIN turns on `teacherOn` (splash `TeacherSplash`), showing the Classroom tiles. In Friends Arena the teacher joins with `role: 'teacher'` and is always host (`hostOrder`). `online/useClassroom.ts` + `Classroom.tsx`: `class_state` (Eyes on me, paused, Class Cup teams/points from `classLogic.ts`, playlist "next up", end-of-lesson screen), `gold_star` (store `receiveGoldStar`, 5 coins, max 3 per lesson = room + date). Pause/resume/skip are `ARENA_CTL` messages: `useHostGame` freezes its timers, shifts top-level `…At` timestamps on resume, and calls the game's `onSkip`; games with their own engine handle `ARENA_CTL` themselves. The old JARVIS name trick is gone (`jarvis_mode` is deleted on load); `jarvis_hq` is the generic Teacher's Lounge.
- **Rewards:** Arena games call `finishArenaGame(room, ranked)` (`online/arenaRewards.ts`) once per device at the end: placement score out of 100 into `finishRound('friends_arena', …)` (badges `arena_*`), and the host's `room.reportResult` feeds the lobby's "Tonight's leaderboard" (3/2/1 points).
- **Loading & refresh:** each Arena game is a lazy chunk (`GAME_SCREENS` in OnlineHub). After a refresh only `LATE_JOIN_GAMES` reopen; other games show "you'll join the next one", and a refreshed host ends the stale game (`to_lobby`). `online/supabaseClient.ts` is a bare `RealtimeClient` from `@supabase/realtime-js` (no supabase-js).
- **Engines & helpers:** type-the-answer games run on `GuessRace`, tap-the-answer on `TapRace`, "same puzzle, first to solve" on `PuzzleRace` (`online/puzzleRaceLogic.ts`), board/duel games use `online/boardSync.ts`, party games use `online/helloGate.ts`. Small new games use `online/useHostGame.ts` (host keeps the state, broadcasts a public **view** after each change — keep secrets such as unrevealed picks or the real answer out of the view; players send inputs) with `ArenaParts.tsx` / `arenaHelpers.ts` and RaceParts' `FinalCard`; see `RpsShowdown.tsx` + `rpsShowdownLogic.ts`. Every message type starts with the game's own unique prefix. Kids' typed text shown to others goes through `cleanText` + `online/rudeWords.ts`.
- **Party games added Oct 2026:** Bluff Buster (`online/bluffFacts.ts`, fact-checked), Crowd Pleaser, Star Grab, Category Blitz (`online/blitzCategories.ts`), Word Chain (`online/wordChainWords.ts`, unknown words go to a vote), RPS Showdown.
- **Party Night games (Oct 2026), all on `useHostGame` with board mode + `onSkip`:** Quip Clash (`online/quipPrompts.ts`), Emoji Charades (`online/charadePhrases.ts`, emoji picker `EMOJI_GROUPS`), Spy Station (`online/spyPlaces.ts`: answer chips must not fit other places — decoys are drawn from them), Heads Up Party (decks from `data/headsUpCards.ts`), Fake Artist (`online/fakeArtistWords.ts`), Doodle Decoy (`online/decoyPrompts.ts`), Monster Mash (`online/monsterParts.ts`). Shared bits: `partyParts.tsx` / `partyHooks.ts` (board frame, addressed messages, re-ask until answered), `arenaPictures.ts` (one JPEG per message, cached on every device, resent on request; saves to the Doodle Pad gallery).
- **Favourites 2.0:** Imposter (modes classic / undercover / doodle / emoji, 1–2 imposters, words + 150 undercover pairs in `online/imposter/words.ts`, cards sealed per device with `online/sealed.ts`, own engine `useImposter` that handles `ARENA_CTL`; it still calls `finishRound('imposter', …)` for the `im_*` badges). Doodle Dash (pick 1 of 3 words, hints, private "so close", `laps`). Picture Telephone (pages sent one by one, host turns the pages, votes, save the book). Riddle Rush (`online/riddleRushLogic.ts` + `riddles.ts`, 432 riddles with explanations, progressive hints). Secrets go in messages addressed `to` one device (or sealed), never in a broadcast view.
- **Arena drawing:** `components/online/DrawCanvas.tsx` (sizes, 12 colours, fill, eraser, undo; props `color`, `tools`, `maxStrokes`, `onOp`) with the op log in `drawOps.ts` (replayed identically on every device) and `useDrawStream.ts` (one shared drawing streamed through the host; late devices ask for the picture so far).
- **Quiz Party** (`online/quiz/`): rules are pure in `quizLogic.ts` (+ tests) — scoring with streaks, typed-answer matching, order questions, Gold Quest chests, Racing, Cash Climb upgrades, teams. `useQuizParty.ts` is the host-authoritative sync: the host broadcasts a full `qp_state` snapshot (never containing unrevealed answers), coalesced to ≤ ~7/s; players send `qp_ans` / `qp_chest` / `qp_target` / `qp_buy`; late joiners say `qp_hello`. Host can be a big screen or play too. Question sources (`sources.ts`): `data/quiz` banks, school questions, music, and the player's own quizzes (`myQuizzes`, made in Quiz Maker — they're only ever sent one question at a time, never stored online).

### Music
`MusicPlayer` is always mounted as a small floating button at the right edge that expands into controls; `hidden` keeps the audio playing without the controls (FM Radio). While `inGame` the floating button is hidden (it covered game boards on phones) and GameShell's 🎵 opens the panel under the header (`MUSIC_EVENT` in `utils/appEvents.ts`). Music pauses when the app is hidden and carries on when it's back. Tracks are listed in `TRACKS` in `store.ts`; `trackInfo(file)` gives the title/artist. To add one: drop an `.m4a` (AAC) with a plain slug name in `public/musickpop/` and add it to `TRACKS`.

---

## Game Screens

| Category | Games (`gameState`) |
|---|---|
| Arcade | `paper_clash`, `snake_arena`, `stack_lab` (Stack Lab, physics tower-stacking), `tower_defense` (quiz-powered), `kpop_rush` (Rush Runner: 🏙️ City or 🦖 Dino Valley world, saved as `rush_world`; one best score for both), `ninja_slice`, `rocket_launch`, `battle_arena` |
| Puzzles | `word_guess`, `game_2048`, `block_blast`, `mini_sudoku`, `zip_game`, `word_ladder`, `crossword_mini`, `word_scramble`, `pattern_memory`, `memory_speed`, `sparkle_match` (Gem Match), `picture_puzzle` (nonograms), `bridges`, `light_up`, `untangle`, `chess_academy` (Chess Academy: lessons, puzzles, bots, two players), `robo_quest` (Robo Quest, coding with Blockly) |
| Quiz | `quiz_arena` (solo, Classic/Lightning, any source), `quiz_maker`, `real_or_fake`, `emoji_guess`, `idol_personality_quiz` ("Which Arcade Hero Are You?") |
| Party | `online_hub` (Friends Arena — online rooms incl. Quiz Party and Imposter, ~30 games in `components/online/`), `heads_up` (tilt the iPad; needs DeviceOrientation permission from a tap), `would_you_rather`, `tug_of_war`, `truth_or_dare`, `trivia_battle` (Buzzer Battle, questions from every quiz bank), `reaction_duel`, `talent_show`, `team_maker`. One-iPad party games pass `celebrateEnd` to GameShell (win sound, never the 'wrong' one); names use `components/games/partyNames.tsx` |
| Create & Music | `beat_maker` (drums + a 10-note pentatonic melody grid; saved beats carry an optional `melody`, older saves load without one), `guess_intro`, `style_studio`, `idol_profile` (Player Card, saved in localStorage `funquest-player-card`), `idol_diary` (Adventure Diary: `data/adventureStories.ts`, 8 branching stories) |
| My Stuff | `pet_pal`, `quest_map`, `locker`, `achievement_showcase` (Trophy Room: every badge, best scores, streak calendar) |
| Grown-ups | `parent_corner` |
| Teacher (hidden) | `jarvis_hq` (Teacher's Lounge), `freeze_dance`, `chaotic_backstage` — the Classroom tiles show in teacher mode (Grown-ups corner → Teacher setup, then 🍎 Teacher + PIN under the grid; 🍎 End lesson turns it off). Texts use the teacher's name (`teacher.name`) |
| Hidden | `secret_menu` = the Secret Club (tap the **A** in "Arcade"): `doodle_pad`, `sticker_board` (also the **F**), `pixel_studio`, `agent_hq` (also "Secret HQ" under Start), `theme_lab`, `my_stats`; `huntrx_splash` (name **HUNTRX** / HUNTR/X) |
| Seasonal | `advent_calendar` (🎄 Advent calendar), `snow_catch` (❄️ Snow Catch) — opened from the Winter Wonderland banner, 1 Dec – 6 Jan |

---

## iPad rules

- Touch first. Buttons at least 44×44 px (48+ for primary actions). No hover-only UI.
- Wrap real-time game areas in `.game-surface` (no scrolling, zoom, text selection or long-press menu) and use Pointer Events.
- Avoid the iPad keyboard: prefer tap choices or `components/ui/OnScreenKeyboard.tsx` (in-game keys, optional letter colouring, space, digits). Editors like Quiz Maker may use real inputs. Never `autoFocus` inputs.
- Text kids type that others will see (quiz titles/questions) goes through `utils/cleanText.ts`.
- Use `.min-h-screen-d` (dvh) rather than 100vh, and respect `env(safe-area-inset-*)`.
- Audio only starts after a tap (MusicPlayer unlocks on the first tap). Safari ignores `<audio>` volume changes — pause other audio instead of fading it.
- Pause games when the page is hidden (`useGameLoop`'s `onHidden`).
- Saved progress: Safari can wipe site data after ~7 days without a visit, **except** for sites added to the Home Screen. Tell users to add it to the Home Screen — and to move their progress into it first (Grown-ups corner → 🔁 Move progress), because the Home Screen app has its own storage.
- Draw dragged pieces above the finger so the hand doesn't hide them.

---

## Design System

- `.arcade-bg` — dark purple/indigo backdrop for the welcome screen, grid and engine games
- `.btn-kid`, `.btn-kid-secondary`, `.card-kid`, `.text-kid-glow`, `.bg-kid-pattern` — older light-theme classes used by most existing screens
- Fonts: **Fredoka One** (headings), **Nunito** (body, variable 200–1000) — bundled in `src/fonts.css`, Latin + Latin-extended only
- Themes (`data-theme` on `<html>`) live in `index.css`; the Theme switcher is in the Secret Menu
- Framer Motion for UI transitions; keep them short (200–400 ms)

---

## Content rules (kids 8–12)

1. **No external links**, no embeds (YouTube etc.), no third-party sites. The one exception, at the family's request: the Grown-ups corner's **🦖 Open the Dino game** link (`DINO_URL` in `ParentCorner.tsx`, the GitHub Pages copy of Chrome's T-Rex runner from `wayou/t-rex-runner`), behind the times-table check — a grown-up opens it in the browser. Don't add others; `e2e/installApp.spec.ts` checks it stays the only one
2. **No personal data leaves the device** — progress is local (store + localStorage). The one exception is Friends Arena: `src/online/` uses Supabase Realtime *broadcast/presence* (publishable key in `supabaseClient.ts`) to send a player's first name, avatar and game moves to others in the same 4-letter room, and — only in a club the family/teacher joined by code — name, avatar and what they're playing to the other club members in Friends Arena. The live count sends nothing but an anonymous id. Nothing is written to a database. Keep it that way: no accounts, no stored chat, no public lists of names, first names only
3. **Positive tone** — wrong answers get encouragement, never shame
4. **Readable** — body text `text-base`/`text-lg`+, instructions `text-xl`+
5. **Emoji icons** — no icon libraries
6. **Short rounds** — a game round fits in about 5 minutes
7. **G-rated humour**; no scary, violent or adult themes ("knocked out", not "killed")
8. **Facts must be correct.** Any file with facts (quiz banks, "real or fake" facts, puzzle answers) needs a fact-check pass before shipping, and puzzles need a test proving they're solvable (see `data/*.test.ts`)
9. **Celebrate** finishes with confetti and sound

---

## Deployment

CI (`.github/workflows/e2e.yml`) runs unit tests, tsc and Playwright (WebKit + Chromium) on pushes to `claude/**` branches and `main`: push to the branch first and only fast-forward `main` once that run is green. The job runs on `ubuntu-24.04` (not `ubuntu-latest`): Playwright 1.56.1 can't install WebKit on Ubuntu 26.04, so upgrade the runner and `@playwright/test` together. A full run takes about 30 minutes (`timeout-minutes: 45`); raise the cap if the suite grows. Netlify builds `kpop-quiz/` on push to `main` (Node 22 — Vite 7 needs 20+). Security headers and SPA redirect are in `netlify.toml`; `/assets/*` is cached immutably. Serverless functions in `netlify/functions/` (`/api/health`, `/api/counter`, `/api/increment`) are optional.
