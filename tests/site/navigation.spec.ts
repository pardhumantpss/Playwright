import { test, expect } from './helpers/test';
import { SOLUTION_PAGES } from './helpers/site';

// Purpose: the header menu, the Solutions menu and the call-to-action buttons take visitors to the right pages.
// Runs on Chromium, Firefox and WebKit.

const header = (page: import('@playwright/test').Page) => page.locator('header').first();

test.describe('Header navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
  });

  test('TC-NAV-01 home page shows the main heading and call-to-action buttons', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(header(page).getByRole('link', { name: /get started/i })).toBeVisible();
    await expect(header(page).getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  for (const [name, path] of [['Features', '/features/'], ['How it works', '/how-it-works/'], ['Workflow', '/workflow/'], ['KPIs', '/kpis/'], ['Download', '/download/']]) {
    test(`TC-NAV-02 header link "${name}" opens ${path}`, async ({ page }) => {
      await header(page).getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('h1')).toBeVisible();
    });
  }

  test('TC-NAV-03 Get Started opens the contact page', async ({ page }) => {
    await header(page).getByRole('link', { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/contact\/$/);
    await expect(page.getByPlaceholder('Enter full name')).toBeVisible();
  });

  test('TC-NAV-04 Sign Up opens the sign-up form', async ({ page }) => {
    await header(page).getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/signup\/$/);
    await expect(page.getByPlaceholder('Company Name')).toBeVisible();
  });

  test('TC-NAV-05 the logo returns to the home page', async ({ page }) => {
    await page.goto('/pricing/', { waitUntil: 'load' });
    await header(page).locator('a[href="/"]').first().click();
    await expect(page).toHaveURL(/leeact\.io\/$/);
  });

  test('TC-NAV-06 the Solutions menu opens and lists all 11 solution pages', async ({ page }) => {
    const toggle = header(page).getByRole('button', { name: 'Solutions' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    for (const path of SOLUTION_PAGES) await expect(header(page).locator(`a[href="${path}"]`).first()).toBeVisible();
  });

  test('TC-NAV-07 a Solutions menu entry opens its page', async ({ page }) => {
    await header(page).getByRole('button', { name: 'Solutions' }).click();
    await header(page).locator(`a[href="${SOLUTION_PAGES[0]}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${SOLUTION_PAGES[0]}$`));
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Footer', () => {
  test('TC-NAV-10 footer links to the main pages and social accounts', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const footer = page.locator('footer').last();
    for (const path of ['/about-us/', '/contact/', '/blog/']) await expect(footer.locator(`a[href="${path}"]`).first()).toBeAttached();
    await expect(footer.locator('a[href*="linkedin.com/company/leeact"]').first()).toBeAttached();
  });
});
