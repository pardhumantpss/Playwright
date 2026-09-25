import { test, expect } from '@playwright/test';
import { login, openLogin } from '../helpers/uat';

// Purpose: the eye icon shows and hides the typed password without changing it.

test.describe('Password visibility toggle', () => {
  test.beforeEach(async ({ page }) => { await openLogin(page); });

  test('TC-LOGIN-PWD-01 clicking the eye icon shows the password', async ({ page }) => {
    await login.password(page).fill('Secret123');
    await login.showPassword(page).click();
    await expect(login.password(page)).toHaveAttribute('type', 'text');
  });

  test('TC-LOGIN-PWD-02 clicking it again hides the password', async ({ page }) => {
    await login.password(page).fill('Secret123');
    await login.showPassword(page).click();
    await login.showPassword(page).click();
    await expect(login.password(page)).toHaveAttribute('type', 'password');
  });

  test('TC-LOGIN-PWD-03 toggling keeps the typed value', async ({ page }) => {
    await login.password(page).fill('Secret123');
    await login.showPassword(page).click();
    await expect(login.password(page)).toHaveValue('Secret123');
  });

  test('TC-LOGIN-PWD-04 known issue: the eye button has an accessible name', async ({ page }) => {
    test.fail(true, 'The button has no aria-label or text, so screen readers announce just "button". Fix: aria-label="Show password".');
    const name = await login.showPassword(page).evaluate(el => el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent?.trim() || '');
    expect(name).not.toBe('');
  });
});
