import { test, expect } from '@playwright/test';

// Smoke tests for the public (signed-out) pages of tp.leeact.io.
// They only read pages; nothing is submitted.

test.describe('login page', () => {
  test('responds with 200', async ({ request }) => {
    const res = await request.get('/login');
    expect(res.status()).toBe(200);
  });

  test('shows the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Leecycle Login/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('signed-out visitors opening / land on /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('forgot password link opens the reset page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot Password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
