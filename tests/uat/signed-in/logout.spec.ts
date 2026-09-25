import { test, expect } from './helpers/test';
import { openApp } from './helpers/app';

// Purpose: Logout ends the session and protected pages are closed again afterwards.
// Runs last (uat-logout project): it uses its own copy of the session, but the server may
// revoke the shared token, so other signed-in tests must finish first.

test.describe('Logout', () => {
  // Signing out may revoke a manually saved session, forcing a new manual login. Run it only when
  // the session comes from UAT_EMAIL/UAT_PASSWORD (CI logs in fresh) or when asked to.
  test.skip(!process.env.UAT_EMAIL && process.env.UAT_RUN_LOGOUT !== '1', 'Set UAT_RUN_LOGOUT=1 to run (it may end your saved session).');

  test('TC-LOGOUT-01 Logout returns to the login page and blocks protected pages', async ({ page, rail }) => {
    await openApp(page, '/leeact/projects/all-projects');
    await rail.open('profile');
    await page.getByText('Logout', { exact: true }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();

    await page.goto('/leeact/projects/all-projects');
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });
});
