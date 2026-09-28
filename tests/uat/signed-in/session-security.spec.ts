import { test, expect } from './helpers/test';
import { openApp } from './helpers/app';

// Purpose: the signed-in session token is stored and scoped safely (read from the browser; nothing is changed).

/** Reads the JWT claims (never the signature) from the app's user-token in localStorage. */
async function tokenClaims(page: import('@playwright/test').Page) {
  const raw = await page.evaluate(() => localStorage.getItem('user-token'));
  expect(raw, 'user-token should be present after sign-in').toBeTruthy();
  let token = raw!;
  try { const j = JSON.parse(raw!); token = typeof j === 'string' ? j : (j.token || j.accessToken || raw); } catch { /* plain string */ }
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()) as Record<string, unknown>;
}

test.describe('Session token', () => {
  test.beforeEach(async ({ page }) => { await openApp(page, '/leeact/projects/all-projects'); });

  test('TC-SESS-01 session token is a JWT with issue and expiry times', async ({ page }) => {
    const c = await tokenClaims(page);
    expect(typeof c.iat).toBe('number');
    expect(typeof c.exp).toBe('number');
    expect(c.exp as number).toBeGreaterThan(Date.now() / 1000);
  });

  test('TC-SESS-02 known issue: session token expires within 30 days', async ({ page }) => {
    test.fail(true, 'The token is valid for 365 days (iat 2026-09-25, exp 2027-09-25), so a stolen token keeps working for a year. Fix: short-lived access tokens (minutes to hours) with refresh, and server-side revocation on logout.');
    const c = await tokenClaims(page);
    const days = ((c.exp as number) - (c.iat as number)) / 86400;
    expect(days, `token lifetime is ${days.toFixed(0)} days`).toBeLessThanOrEqual(30);
  });

  test('TC-SESS-03 session token is not placed in the page URL', async ({ page }) => {
    const raw = await page.evaluate(() => localStorage.getItem('user-token')) || '';
    const jwt = raw.replace(/^"|"$/g, '');
    expect(page.url()).not.toContain(jwt.slice(0, 20));
  });
});
