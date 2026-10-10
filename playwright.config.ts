import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build served under /unitscope/,
// mirroring GitHub Pages. `npm run test:e2e` builds first.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/unitscope/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-subpath.mjs 4173',
    url: 'http://localhost:4173/unitscope/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true }, testMatch: /mobile\.spec\.ts/ },
  ],
});
