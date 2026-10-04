# End-to-end tests (Playwright)

These tests drive the real production build (`npm run build` + `vite preview` on port 4173) in a
browser at iPad size. Playwright starts the server for you.

## Run locally

```bash
cd kpop-quiz
npx playwright install webkit chromium   # once (skip in sandboxes that already ship browsers)
npm run test:e2e                          # all projects
npm run test:e2e:chromium                 # iPad + desktop Chromium only
npx playwright test e2e/quizParty.spec.ts --project=ipad-chromium   # one file
npx playwright show-report                # open the last HTML report
```

## Projects

| Project | Browser | Device |
|---|---|---|
| `ipad-webkit` | WebKit (Safari's engine) | iPad Pro 11, touch |
| `ipad-chromium` | Chromium | iPad Pro 11, touch |
| `desktop-chromium` | Chromium | Desktop Chrome |

**WebKit runs in CI.** Some dev sandboxes can't download WebKit, so `.github/workflows/e2e.yml`
runs every project (including `ipad-webkit`) on each pull request and push to `main`, and uploads
the HTML report when something fails.

## The specs

- `smoke.spec.ts` — opens every tile on the grid (teacher tiles too), checks for errors and
  sideways overflow, and that Back returns to the grid.
- `progress.spec.ts` — save migration from version 1, and the one-time import of old localStorage keys.
- `paperClash.spec.ts` — uses the `?debug&seed=42` hook (`window.__game`) to play a loop and a crash.
- `wordGuess.spec.ts` — a daily guess is restored after a reload.
- `quizParty.spec.ts` — Friends Arena with `?localroom` (BroadcastChannel between pages of one
  browser context): a host and two players play Classic and Gold Quest.

Each test starts with empty localStorage (`openApp` in `helpers.ts`). Prefer waiting on
locators/`expect.poll` over fixed sleeps.
