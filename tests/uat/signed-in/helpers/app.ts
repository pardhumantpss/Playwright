import { expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const STATE = path.resolve('.auth/uat-state.json');
export const hasSession = () => fs.existsSync(STATE);
export const NO_SESSION = 'No UAT session. Run `node login-capture.js https://uat.leecycle.dev .auth/uat-state.json` and log in, or set UAT_EMAIL and UAT_PASSWORD.';

/** The project that the test account can see. Override with UAT_PROJECT_ID / UAT_PROJECT_NAME. */
export const PROJECT = {
  id: process.env.UAT_PROJECT_ID || '203',
  name: process.env.UAT_PROJECT_NAME || 'Leecycle',
};

/** Opens an app page and waits until the access check finishes and the page heading is shown. */
export async function openApp(page: Page, urlPath: string) {
  // Record API failures so a bounce to /login says why (in CI, fresh sessions sometimes bounce
  // on the first attempt; the error message becomes a public GitHub annotation).
  const apiErrors: string[] = [];
  const onResponse = (r: import('@playwright/test').Response) => {
    if (r.status() >= 400 && /orchestrator|\/api\//.test(r.url())) apiErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  };
  page.on('response', onResponse);
  await page.goto(urlPath, { waitUntil: 'load' });
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 5_000 }).catch(() => {});
  page.off('response', onResponse);
  if (new URL(page.url()).pathname.startsWith('/login')) {
    const token = await page.evaluate(() => localStorage.getItem('user-token')).catch(() => null);
    throw new Error(
      `Redirected to /login from ${urlPath}. user-token in storage: ${token ? `yes (${token.length} chars)` : 'no'}. ` +
      `API errors before redirect: ${[...new Set(apiErrors)].join(', ') || 'none'}. ` +
      'If this persists, the saved session has expired: run login-capture.js again.');
  }
  await waitForApp(page);
}

export async function waitForApp(page: Page) {
  await expect(page.getByText('Verifying access')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 30_000 });
}

export const shell = {
  tab: (page: Page, name: string) => page.getByRole('tab', { name, exact: true }),
  module: (page: Page, name: string) => page.locator('button.e-ribbon-control:visible', { hasText: name }).first(),
  sidebarLink: (page: Page, name: string) => page.locator('a[href]').filter({ hasText: new RegExp(`^\\s*${escape(name)}\\s*$`) }).first(),
  collapseSidebar: (page: Page) => page.getByRole('button', { name: 'Collapse sidebar' }),
  notFound: (page: Page) => page.getByRole('heading', { name: 'Page Not Found' }),
};

function escape(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Error text the app shows when a page crashes or the API fails. */
export const APP_ERROR = /something went wrong|unexpected error|internal server error|failed to fetch|request failed with status code 5\d\d/i;
