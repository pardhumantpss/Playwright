import { test, expect } from './helpers/test';
import { ALL_PAGES, maxOverflow, openAndScroll } from './helpers/site';
import { KNOWN } from './helpers/known-issues';

// Purpose: on a phone (Pixel 5), every page fits the screen and the menu opens and closes.
// Runs in the site-mobile project only.

test.describe('Mobile menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
  });

  test('TC-MOBILE-01 the menu button opens the menu with the main links', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Toggle navigation' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const name of ['Features', 'How it works', 'Workflow', 'KPIs', 'Download']) {
      await expect(page.locator('header').getByRole('link', { name, exact: true })).toBeVisible();
    }
  });

  test('TC-MOBILE-02 the close button hides the menu again', async ({ page }) => {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('button', { name: 'Close navigation' }).click();
    await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'false');
    // The menu slides off-screen rather than being removed.
    await expect(page.locator('header').getByRole('link', { name: 'Features', exact: true })).not.toBeInViewport();
  });

  test('TC-MOBILE-03 a menu link opens its page', async ({ page }) => {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.locator('header').getByRole('link', { name: 'Features', exact: true }).click();
    await expect(page).toHaveURL(/\/features\/$/);
  });
});

for (const path of ALL_PAGES) {
  test(`TC-MOBILE-10 ${path}: fits the phone screen without sideways scrolling`, async ({ page }) => {
    test.fail(KNOWN.mobileOverflow.includes(path), 'Known issue: the page is 410 px wide on a 393 px phone because the team slider sticks out. Fix: overflow-x: clip on the team section.');
    await openAndScroll(page, path);
    await expect(page.locator('h1:visible, h2:visible').first()).toBeVisible();
    expect(await maxOverflow(page)).toBeLessThanOrEqual(0);
  });
}
