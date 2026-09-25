import { test, expect } from '@playwright/test';
import { login } from '../helpers/uat';

// Purpose: signed-out visitors can't reach app screens and always land on the login page.

const protectedRoutes = [
  '/leeact/projects/all-projects',
  '/leeact/workspace/workspace-directory',
  '/leeact/project-details/overview',
  '/leeact/resources/directory',
  '/leeact/productivity/retrospective',
  '/leeact/finance/budgets',
  '/leeact/compliance/policies',
];

test.describe('Route protection when signed out', () => {
  test('TC-ROUTE-01 opening / sends signed-out visitors to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(login.email(page)).toBeVisible();
  });

  for (const route of protectedRoutes) {
    test(`TC-ROUTE-02 ${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(login.email(page)).toBeVisible();
    });
  }

  test('TC-ROUTE-03 an unknown URL does not show app content', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-pw');
    await expect(page).toHaveURL(/\/login|404|not-found/);
  });

  test('TC-ROUTE-04 known issue: an unknown URL returns HTTP 404', async ({ request }) => {
    test.fail(true, 'Unknown URLs return 200 (a "soft 404"). Fix: return 404 so monitoring and search engines see missing pages.');
    const res = await request.get('/this-page-does-not-exist-pw', { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });

  test('TC-ROUTE-05 no session data is stored before sign-in', async ({ page, context }) => {
    await page.goto('/login');
    await expect(login.email(page)).toBeVisible();
    const cookies = (await context.cookies()).map(c => c.name);
    expect(cookies.filter(n => /token|session|auth|jwt/i.test(n))).toEqual([]);
    const stored = await page.evaluate(() => Object.keys(localStorage).filter(k => /token|auth|jwt/i.test(k)));
    expect(stored).toEqual([]);
  });
});
