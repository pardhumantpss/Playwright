import { test, expect } from '@playwright/test';
import { login, openLogin } from '../helpers/uat';

// Purpose: the login page shows everything a visitor needs to sign in.

test.describe('Login page UI', () => {
  test.beforeEach(async ({ page }) => { await openLogin(page); });

  test('TC-LOGIN-UI-01 page title is "Leecycle Login"', async ({ page }) => {
    await expect(page).toHaveTitle('Leecycle Login');
  });

  test('TC-LOGIN-UI-02 shows the welcome heading and Sign In title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Effortless workflow begins here.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in to continue.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('TC-LOGIN-UI-03 email field is an empty email input with a placeholder', async ({ page }) => {
    await expect(login.email(page)).toHaveAttribute('type', 'email');
    await expect(login.email(page)).toHaveAttribute('placeholder', 'Email');
    await expect(login.email(page)).toHaveValue('');
    await expect(login.email(page)).toBeEditable();
  });

  test('TC-LOGIN-UI-04 password field is masked and has a placeholder', async ({ page }) => {
    await expect(login.password(page)).toHaveAttribute('type', 'password');
    await expect(login.password(page)).toHaveAttribute('placeholder', 'Password');
    await expect(login.password(page)).toHaveValue('');
  });

  test('TC-LOGIN-UI-05 Sign in button is visible and enabled', async ({ page }) => {
    await expect(login.submit(page)).toBeVisible();
    await expect(login.submit(page)).toBeEnabled();
    await expect(login.submit(page)).toHaveAttribute('type', 'submit');
  });

  test('TC-LOGIN-UI-06 shows the Forgot Password link to /forgot-password', async ({ page }) => {
    await expect(login.forgotLink(page)).toBeVisible();
    await expect(login.forgotLink(page)).toHaveAttribute('href', '/forgot-password');
  });

  test('TC-LOGIN-UI-07 shows the terms consent text with Terms and Privacy links', async ({ page }) => {
    await expect(page.getByText('By clicking "Sign In" I agree to')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
  });

  test('TC-LOGIN-UI-08 known issue: Terms and Privacy links go to a real page', async ({ page }) => {
    test.fail(true, 'Both links have href="#" and go nowhere. Fix: link to the published terms and privacy pages.');
    for (const name of ['Terms of Service', 'Privacy Policy']) {
      await expect(page.getByRole('link', { name })).not.toHaveAttribute('href', '#');
    }
  });

  test('TC-LOGIN-UI-09 shows the LEEACT footer and Help Desk', async ({ page }) => {
    await expect(page.getByText('LEEACT', { exact: true })).toBeVisible();
    await expect(page.getByText('Help Desk')).toBeVisible();
  });

  test('TC-LOGIN-UI-10 known issue: Help Desk opens help', async ({ page, context }) => {
    test.fail(true, 'Help Desk is a plain heading with no link or click action. Fix: link it to the help desk.');
    const popup = context.waitForEvent('page', { timeout: 3000 }).catch(() => null);
    await page.getByText('Help Desk').click();
    const opened = (await popup) !== null || !page.url().endsWith('/login');
    expect(opened, 'clicking Help Desk should open help').toBe(true);
  });

  test('TC-LOGIN-UI-11 language selector defaults to English', async ({ page }) => {
    // A hidden <select> holds the value; a styled <span> shows it.
    await expect(page.locator('select[aria-label="dropdownlist"]')).toHaveValue('en');
    await expect(page.locator('span[aria-label="dropdownlist"]')).toHaveText('English');
  });

  test('TC-LOGIN-UI-12 shows the brand illustration and logo images', async ({ page }) => {
    const images = page.locator('img');
    expect(await images.count()).toBeGreaterThan(0);
    for (const img of await images.all()) {
      if (!(await img.isVisible())) continue;
      // Images use loading="lazy", so give each one time to download.
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
        { message: `image ${await img.getAttribute('src')} failed to load`, timeout: 10_000 }).toBe(true);
    }
  });
});
