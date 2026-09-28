import { test, expect } from '@playwright/test';
import { login, openLogin, openForgotPassword, FAKE_EMAIL } from '../helpers/uat';

// Purpose: visitors can request a password-reset code, with clear messages for bad input.

const sendOtp = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Send OTP' });
const emailField = (page: import('@playwright/test').Page) => page.getByPlaceholder('Email');

test.describe('Forgot password', () => {
  test('TC-FP-01 Forgot Password link on login opens the reset page', async ({ page }) => {
    await openLogin(page);
    await login.forgotLink(page).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    // Occasionally the URL changes but the old page stays on screen (seen on UAT 2026-09-25 and
    // 2026-09-28); this assertion catches that.
    await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible({ timeout: 30_000 });
  });

  test('TC-FP-02 shows instructions, email field, Send OTP and Back to Sign In', async ({ page }) => {
    await openForgotPassword(page);
    await expect(page.getByText('Enter your email address to receive an OTP')).toBeVisible();
    await expect(emailField(page)).toBeVisible();
    await expect(sendOtp(page)).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Back to Sign In' })).toHaveAttribute('href', '/login');
  });

  test('TC-FP-03 empty email shows "Please enter your email address"', async ({ page }) => {
    await openForgotPassword(page);
    await sendOtp(page).click();
    await expect(page.getByText('Please enter your email address')).toBeVisible();
  });

  test('TC-FP-04 unknown email gets the same generic success message', async ({ page }) => {
    await openForgotPassword(page);
    await emailField(page).fill(FAKE_EMAIL);
    await sendOtp(page).click();
    await expect(page.getByText('If your email is registered, you will receive a verification code')).toBeVisible();
  });

  test('TC-FP-05 known issue: badly formatted email gets a readable message', async ({ page }) => {
    test.fail(true, 'The page sends the request and shows the raw "Request failed with status code 400". Fix: validate the format first and show a plain message.');
    await openForgotPassword(page);
    await emailField(page).fill('not-an-email');
    await sendOtp(page).click();
    await expect(page.getByText(/valid email/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/status code/i)).toHaveCount(0);
  });

  test('TC-FP-06 Back to Sign In returns to the login page', async ({ page }) => {
    await openForgotPassword(page);
    await page.getByRole('link', { name: 'Back to Sign In' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(login.email(page)).toBeVisible({ timeout: 30_000 });
  });

  test('TC-FP-07 known issue: page title keeps naming the page', async ({ page }) => {
    test.fail(true, 'The server sends "Uat | Leecycle | Forgot Password", then a few seconds later the app overwrites it with "Leecycle Login". Fix: stop the client-side title override on this route.');
    await openForgotPassword(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    // The override lands a few seconds after load (later on slow machines): sample for 10 s.
    for (let i = 0; i < 20; i++) {
      expect(await page.title()).toMatch(/forgot|reset/i);
      await page.waitForTimeout(500);
    }
  });

});
