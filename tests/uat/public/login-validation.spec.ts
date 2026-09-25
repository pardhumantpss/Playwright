import { test, expect } from '@playwright/test';
import { login, openLogin, FAKE_EMAIL, FAKE_PASSWORD, UAT_API } from '../helpers/uat';

// Purpose: the login form rejects incomplete or wrong input with a clear message.

const MISSING = 'Please enter email and password';
const INVALID = 'Invalid credentials';

test.describe('Login validation', () => {
  test.beforeEach(async ({ page }) => { await openLogin(page); });

  test('TC-LOGIN-VAL-01 empty form shows "Please enter email and password"', async ({ page }) => {
    await login.submit(page).click();
    await expect(page.getByText(MISSING)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-LOGIN-VAL-02 email without password is rejected', async ({ page }) => {
    await login.email(page).fill(FAKE_EMAIL);
    await login.submit(page).click();
    await expect(page.getByText(MISSING)).toBeVisible();
  });

  test('TC-LOGIN-VAL-03 password without email is rejected', async ({ page }) => {
    await login.password(page).fill(FAKE_PASSWORD);
    await login.submit(page).click();
    await expect(page.getByText(MISSING)).toBeVisible();
  });

  test('TC-LOGIN-VAL-04 whitespace-only email and password are rejected', async ({ page }) => {
    await login.email(page).fill('   ');
    await login.password(page).fill('   ');
    await login.submit(page).click();
    await expect(page.getByText(MISSING)).toBeVisible();
  });

  test('TC-LOGIN-VAL-05 badly formatted email is blocked before sending', async ({ page }) => {
    let loginCalled = false;
    page.on('request', r => { if (r.url().includes('/authentication/login')) loginCalled = true; });
    await login.email(page).fill('not-an-email');
    await login.password(page).fill(FAKE_PASSWORD);
    await login.submit(page).click();
    const valid = await login.email(page).evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid, 'browser should flag the email as invalid').toBe(false);
    await page.waitForTimeout(1500);
    expect(loginCalled, 'no login request should be sent').toBe(false);
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-LOGIN-VAL-06 wrong credentials show "Invalid credentials" and stay on login', async ({ page }) => {
    const res = page.waitForResponse(r => r.url().startsWith(UAT_API) && r.url().includes('/authentication/login'));
    await login.email(page).fill(FAKE_EMAIL);
    await login.password(page).fill(FAKE_PASSWORD);
    await login.submit(page).click();
    expect((await res).status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByText(INVALID)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-LOGIN-VAL-07 pressing Enter in the password field submits the form', async ({ page }) => {
    await login.email(page).fill(FAKE_EMAIL);
    await login.password(page).fill(FAKE_PASSWORD);
    await login.password(page).press('Enter');
    await expect(page.getByText(INVALID)).toBeVisible();
  });

  test('TC-LOGIN-VAL-08 entered email is kept after a failed sign-in', async ({ page }) => {
    await login.email(page).fill(FAKE_EMAIL);
    await login.password(page).fill(FAKE_PASSWORD);
    await login.submit(page).click();
    await expect(page.getByText(INVALID)).toBeVisible();
    await expect(login.email(page)).toHaveValue(FAKE_EMAIL);
  });

  test('TC-LOGIN-VAL-09 error does not reveal whether the email exists', async ({ page }) => {
    await login.email(page).fill(FAKE_EMAIL);
    await login.password(page).fill(FAKE_PASSWORD);
    await login.submit(page).click();
    await expect(page.getByText(INVALID)).toBeVisible();
    await expect(page.getByText(/not found|no account|does not exist|not registered/i)).toHaveCount(0);
  });

  test('TC-LOGIN-VAL-10 password is sent in the request body, never in the URL', async ({ page }) => {
    const req = page.waitForRequest(r => r.url().includes('/authentication/login'));
    await login.email(page).fill(FAKE_EMAIL);
    await login.password(page).fill(FAKE_PASSWORD);
    await login.submit(page).click();
    const r = await req;
    expect(r.method()).toBe('POST');
    expect(r.url()).not.toContain(encodeURIComponent(FAKE_PASSWORD));
    expect(r.url().startsWith('https://')).toBe(true);
  });
});
