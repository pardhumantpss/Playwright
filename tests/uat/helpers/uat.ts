import { expect, type Page } from '@playwright/test';

export const UAT_URL = process.env.UAT_URL || 'https://uat.leecycle.dev';
export const UAT_API = process.env.UAT_API || 'https://uat-orchestrator.leecycle.dev';

// Made-up addresses on example.com (reserved, never delivers mail), so tests
// can't reach a real account or send a real email.
export const FAKE_EMAIL = 'playwright.nonexistent@example.com';
export const FAKE_PASSWORD = 'WrongPassword!1';

export const login = {
  email: (page: Page) => page.locator('input[name="email"]'),
  password: (page: Page) => page.locator('input[name="password"]'),
  submit: (page: Page) => page.getByRole('button', { name: 'Sign in' }),
  /** The eye icon button inside the password field. */
  showPassword: (page: Page) => page.locator('input[name="password"]').locator('xpath=following::button[1]'),
  forgotLink: (page: Page) => page.getByRole('link', { name: 'Forgot Password?' }),
};

/**
 * Waits until React has attached its event handlers to the form's submit button.
 * The server-rendered form is visible before that, and clicks on it are silently ignored.
 */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return !!btn && Object.keys(btn).some(k => k.startsWith('__reactProps'));
  }, undefined, { timeout: 30_000 });
}

export async function openLogin(page: Page) {
  await page.goto('/login');
  await expect(login.email(page)).toBeVisible();
  await waitForHydration(page);
}

export async function openForgotPassword(page: Page) {
  await page.goto('/forgot-password');
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await waitForHydration(page);
}

/** Pages every signed-out visitor can reach. */
export const publicPages = [
  { name: 'login', path: '/login', ready: 'input[name="email"]' },
  { name: 'forgot password', path: '/forgot-password', ready: 'input[placeholder="Email"]' },
];
