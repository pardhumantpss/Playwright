import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { STATE } from './helpers/app';

// Purpose: prepares the signed-in session that every signed-in test uses (setup step, not a test case).
// Prepares the signed-in session for the uat-signed-in project.
//  1. A saved session in .auth/uat-state.json (from login-capture.js) is reused if still valid.
//  2. Otherwise, if UAT_EMAIL and UAT_PASSWORD are set (e.g. GitHub secrets), it signs in through the UI.
//  3. Otherwise signed-in tests skip.

setup('prepare UAT session', async ({ browser }) => {
  if (fs.existsSync(STATE)) {
    const ctx = await browser.newContext({ storageState: STATE });
    const page = await ctx.newPage();
    await page.goto('/leeact/projects/all-projects');
    // An expired session is sent to /login; a valid one shows the ribbon tabs.
    await Promise.race([
      page.waitForURL(/\/login/, { timeout: 60_000 }),
      page.getByRole('tab', { name: 'Home', exact: true }).waitFor({ timeout: 60_000 }),
    ]).catch(() => {});
    const valid = !new URL(page.url()).pathname.startsWith('/login');
    await ctx.close();
    if (valid) return;
    console.warn('Saved UAT session has expired.');
    fs.rmSync(STATE);
  }

  const email = process.env.UAT_EMAIL, password = process.env.UAT_PASSWORD;
  if (!email || !password) {
    console.warn('No UAT session and no UAT_EMAIL/UAT_PASSWORD: signed-in tests will skip.');
    return;
  }
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return !!btn && Object.keys(btn).some(k => k.startsWith('__reactProps'));
  }, undefined, { timeout: 30_000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  // Save only once the app has fully started: the token lands in localStorage ('user-token')
  // after the redirect, and saving earlier produced sessions that bounced back to /login.
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => !!localStorage.getItem('user-token')), { timeout: 30_000 }).toBe(true);
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  await ctx.storageState({ path: STATE });
  await ctx.close();
  // Known CI flake (2026-09-28): the first signed-in tests after this fresh login sometimes load
  // signed in, then the app itself goes to /login ~5 s later with no failed API call; retries pass.
  // Waiting for the session in a second browser did not help. sessionWatch in helpers/test.ts
  // records a timeline when it happens.
});
