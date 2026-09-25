import { test, expect } from '@playwright/test';
import { login, openLogin, FAKE_EMAIL, FAKE_PASSWORD } from '../helpers/uat';

// Purpose: the login form can be completed with the keyboard alone.

test.describe('Keyboard navigation', () => {
  test.beforeEach(async ({ page }) => { await openLogin(page); });

  test('TC-KEY-01 Tab moves from email to password', async ({ page }) => {
    await login.email(page).focus();
    await page.keyboard.press('Tab');
    await expect(login.password(page)).toBeFocused();
  });

  test('TC-KEY-02 Sign in button is reachable with Tab from the password field', async ({ page }) => {
    await login.password(page).focus();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      if (await login.submit(page).evaluate(el => el === document.activeElement)) break;
    }
    await expect(login.submit(page)).toBeFocused();
  });

  test('TC-KEY-03 the form can be filled and submitted using only the keyboard', async ({ page }) => {
    await login.email(page).focus();
    await page.keyboard.type(FAKE_EMAIL);
    await page.keyboard.press('Tab');
    await page.keyboard.type(FAKE_PASSWORD);
    await page.keyboard.press('Enter');
    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });

  test('TC-KEY-04 known issue: the show-password button is reachable with Tab', async ({ page }) => {
    test.fail(true, 'The eye button has tabindex="-1", so keyboard users cannot reveal the password. Fix: remove tabindex="-1".');
    await expect(login.showPassword(page)).not.toHaveAttribute('tabindex', '-1');
  });

  test('TC-KEY-05 focused fields show a visible focus indicator', async ({ page }) => {
    await login.email(page).focus();
    const style = await login.email(page).evaluate(el => {
      const s = getComputedStyle(el);
      return { outline: s.outlineStyle !== 'none' && s.outlineWidth !== '0px', shadow: s.boxShadow !== 'none', border: s.borderColor };
    });
    await login.password(page).focus();
    const blurredBorder = await login.email(page).evaluate(el => getComputedStyle(el).borderColor);
    expect(style.outline || style.shadow || style.border !== blurredBorder, 'focus should change outline, shadow or border').toBe(true);
  });
});
