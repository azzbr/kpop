import { defineConfig, devices } from '@playwright/test';

// End-to-end tests. They run against the production build (`vite preview`), at iPad size.
// WebKit (Safari's engine) runs in CI — see .github/workflows/e2e.yml and e2e/README.md.
const isCI = !!process.env.CI;
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'ipad-webkit', use: { ...devices['iPad Pro 11'], browserName: 'webkit' } },
    { name: 'ipad-chromium', use: { ...devices['iPad Pro 11'], browserName: 'chromium' } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
