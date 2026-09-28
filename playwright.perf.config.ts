import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';

// Performance tests: `npm run test:perf`. Chromium only (Web Vitals APIs and CDP throttling),
// one worker so page loads don't compete for bandwidth and CPU.

// Start each run with a fresh results file for scripts/perf-summary.mjs.
fs.rmSync('perf-results', { recursive: true, force: true });

export default defineConfig({
  testDir: './tests/perf',
  fullyParallel: false,
  workers: 1,
  // One retry in CI: tp has had brief Cloudflare 520 outages. A real regression fails twice.
  retries: process.env.CI ? 1 : 0,
  timeout: 300_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-perf' }], ['github']]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-perf' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://tp.leeact.io',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'perf-chromium' }],
});
