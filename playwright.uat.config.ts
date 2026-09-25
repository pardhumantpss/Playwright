import { defineConfig, devices } from '@playwright/test';

// Functional test suite for the UAT environment: `npm run test:uat`.
//
// Projects:
//   uat-chromium        every signed-out test
//   uat-firefox/webkit  cross-browser display and navigation tests (no failed-login attempts,
//                       to stay clear of login rate limits)
//   uat-setup           prepares the signed-in session (.auth/uat-state.json)
//   uat-signed-in       tests after sign-in; skipped when no session is available
//   uat-all-pages       opens every page in the menu catalog (~500 pages, ~20 min)
//   uat-logout          runs last, because signing out ends the saved session
//
// npm scripts pick the projects: `npm run test:uat` (everything except uat-all-pages),
// `npm run test:uat:all-pages` (the full page check).

const UAT_URL = process.env.UAT_URL || 'https://uat.leecycle.dev';
const STATE = '.auth/uat-state.json';
const CROSS_BROWSER = /(login-page-ui|login-password-visibility|responsive-layout|route-protection|page-health)\.spec\.ts/;

export default defineConfig({
  testDir: './tests/uat',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // UAT runs on a single on-premises server; more than 2 parallel browsers slows it enough to time tests out.
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-uat' }], ['github']]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-uat' }]],
  use: {
    baseURL: UAT_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'uat-chromium', testDir: './tests/uat/public', use: { ...devices['Desktop Chrome'] } },
    { name: 'uat-firefox', testDir: './tests/uat/public', testMatch: CROSS_BROWSER, use: { ...devices['Desktop Firefox'] } },
    { name: 'uat-webkit', testDir: './tests/uat/public', testMatch: CROSS_BROWSER, use: { ...devices['Desktop Safari'] } },
    { name: 'uat-setup', testDir: './tests/uat/signed-in', testMatch: /auth\.setup\.ts/ },
    {
      name: 'uat-signed-in',
      testDir: './tests/uat/signed-in',
      testIgnore: /(logout|all-pages-load)\.spec\.ts/,
      dependencies: ['uat-setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'uat-all-pages',
      testDir: './tests/uat/signed-in',
      testMatch: /all-pages-load\.spec\.ts/,
      dependencies: ['uat-setup'],
      timeout: 120_000,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'uat-logout',
      testDir: './tests/uat/signed-in',
      testMatch: /logout\.spec\.ts/,
      // Not dependent on uat-all-pages: depending on it would make `npm run test:uat` run the full page check too.
      dependencies: ['uat-signed-in'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
