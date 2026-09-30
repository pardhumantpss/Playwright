import { defineConfig, devices } from '@playwright/test';

// Tests for the public marketing site https://leeact.io: `npm run test:site`.
//
// Projects:
//   site-chromium        every test
//   site-firefox/webkit  navigation and form tests on the other engines
//   site-mobile          responsive layout and the mobile menu (Pixel 5)
//
// Every test blocks non-GET requests before they leave the browser (tests/site/helpers/test.ts),
// so no form is ever submitted and no analytics event is recorded.

const SITE_URL = process.env.SITE_URL || 'https://leeact.io';
const CROSS_BROWSER = /(navigation|forms)\.spec\.ts/;

export default defineConfig({
  testDir: './tests/site',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Request blocking turns off the HTTP cache, so each page load downloads its images again (up to 13 MB).
  // More than 2 browsers at once saturates the connection and times tests out.
  workers: 2,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-site' }], ['github']]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-site' }]],
  use: {
    baseURL: SITE_URL,
    trace: 'retain-on-failure',
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'site-chromium', testIgnore: /responsive\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'site-firefox', testMatch: CROSS_BROWSER, use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
    { name: 'site-webkit', testMatch: CROSS_BROWSER, use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
    { name: 'site-mobile', testMatch: /responsive\.spec\.ts/, use: { ...devices['Pixel 5'] } },
  ],
});
