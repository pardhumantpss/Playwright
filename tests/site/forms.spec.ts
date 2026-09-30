import { type Page } from '@playwright/test';
import { test, expect } from './helpers/test';
import { AD_CONVERSION, ANALYTICS } from './helpers/site';

// Purpose: the contact, book-a-demo, sign-up and newsletter forms reject empty and invalid input.
// Every non-GET request is blocked (helpers/test.ts), so no form is ever sent; each test also checks
// that the form did not try to send anything.

const INVALID_EMAIL = 'not-an-email';
const sent = (blocked: string[]) => blocked.filter(b => !ANALYTICS.test(b));
const invalidFields = (page: Page) => page.$$eval('form input, form textarea', els =>
  (els as HTMLInputElement[]).filter(e => !e.checkValidity()).map(e => e.placeholder));

test.describe('Contact form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact/', { waitUntil: 'load' });
    await expect(page.getByPlaceholder('Enter full name')).toBeVisible();
  });

  test('TC-FORM-CONTACT-01 shows all fields', async ({ page }) => {
    for (const ph of ['Enter full name', 'Enter email address', 'Enter phone number', 'Enter website', 'Type your message please']) {
      await expect(page.getByPlaceholder(ph)).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /send message/i })).toBeVisible();
  });

  test('TC-FORM-CONTACT-02 empty submit shows an error for each required field and sends nothing', async ({ page, blocked }) => {
    await page.getByRole('button', { name: /send message/i }).click();
    for (const msg of ['Please enter your full name.', 'Please enter your email address.', 'Please enter your website.']) {
      await expect(page.getByText(msg)).toBeVisible();
    }
    await expect(page.getByText(/please type your message/i)).toBeVisible();
    expect(sent(blocked)).toEqual([]);
  });

  test('TC-FORM-CONTACT-03 an invalid email is rejected', async ({ page, blocked }) => {
    await page.getByPlaceholder('Enter full name').fill('Playwright Test');
    await page.getByPlaceholder('Enter email address').fill(INVALID_EMAIL);
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    expect(sent(blocked)).toEqual([]);
  });

  test('TC-FORM-CONTACT-04 Reset clears the fields', async ({ page }) => {
    await page.getByPlaceholder('Enter full name').fill('Playwright Test');
    await page.getByPlaceholder('Type your message please').fill('Hello');
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByPlaceholder('Enter full name')).toHaveValue('');
    await expect(page.getByPlaceholder('Type your message please')).toHaveValue('');
  });

  test('TC-FORM-CONTACT-05 known issue: message error text reads correctly', async ({ page }) => {
    test.fail(true, 'Known issue: the error says "Please type your message please." (the word "please" twice). Fix: "Please type your message."');
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText('Please type your message.', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('TC-FORM-CONTACT-07 known issue: a rejected submission records no Google Ads conversion', async ({ page, blocked }) => {
    test.fail(true, 'Known issue: clicking Send Message on an empty form fires Google Ads form_submit and conversion events although the form shows errors, so the ads account counts failed attempts as leads. Fix: in Google Tag Manager, tick "Check Validation" on the form-submission trigger, or fire the conversion only after the server accepts the message.');
    await page.waitForTimeout(3_000); // let the page-view tags finish
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText('Please enter your full name.')).toBeVisible();
    await page.waitForTimeout(5_000);
    expect(blocked.filter(b => AD_CONVERSION.test(b))).toEqual([]);
  });

  test('TC-FORM-CONTACT-06 contact page shows the company phone and email', async ({ page }) => {
    await expect(page.locator('a[href^="tel:"]').first()).toBeAttached();
    await expect(page.locator('a[href*="email-protection"], a[href^="mailto:"]').first()).toBeAttached();
  });
});

test.describe('Book a demo form', () => {
  const submit = (page: Page) => page.getByRole('button', { name: /^submit$/i });

  test.beforeEach(async ({ page }) => {
    await page.goto('/book-a-demo/', { waitUntil: 'load' });
    await expect(page.getByPlaceholder('Enter your full name')).toBeVisible();
  });

  test('TC-FORM-DEMO-01 empty submit shows name and email errors and sends nothing', async ({ page, blocked }) => {
    await submit(page).click();
    await expect(page.getByText('Please enter your full name.')).toBeVisible();
    await expect(page.getByText('Please enter your work email.')).toBeVisible();
    expect(sent(blocked)).toEqual([]);
  });

  test('TC-FORM-DEMO-02 an invalid email is rejected', async ({ page, blocked }) => {
    await page.getByPlaceholder('Enter your full name').fill('Playwright Test');
    await page.getByPlaceholder('Enter your email address').fill(INVALID_EMAIL);
    await submit(page).click();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    expect(sent(blocked)).toEqual([]);
  });

  test('TC-FORM-DEMO-04 known issue: a rejected submission records no Google Ads conversion', async ({ page, blocked }) => {
    test.fail(true, 'Known issue: same as TC-FORM-CONTACT-07: an empty Submit fires Google Ads conversion events. Fix: "Check Validation" on the GTM form trigger.');
    await page.waitForTimeout(3_000);
    await submit(page).click();
    await expect(page.getByText('Please enter your full name.')).toBeVisible();
    await page.waitForTimeout(5_000);
    expect(blocked.filter(b => AD_CONVERSION.test(b))).toEqual([]);
  });

  test('TC-FORM-DEMO-03 the phone field accepts only a phone number type', async ({ page }) => {
    await expect(page.getByPlaceholder('Enter your phone number')).toHaveAttribute('type', 'tel');
  });
});

test.describe('Sign-up form', () => {
  const submit = (page: Page) => page.getByRole('button', { name: /^sign up$/i });

  test.beforeEach(async ({ page }) => {
    await page.goto('/signup/', { waitUntil: 'load' });
    await expect(page.getByPlaceholder('Company Name')).toBeVisible();
  });

  test('TC-FORM-SIGNUP-01 shows all fields, with the password hidden', async ({ page }) => {
    for (const ph of ['Company Name', 'Subdomain', 'Email', 'Mobile Number', 'Password']) await expect(page.getByPlaceholder(ph, { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Password', { exact: true })).toHaveAttribute('type', 'password');
  });

  test('TC-FORM-SIGNUP-02 empty submit shows an error for each required field and sends nothing', async ({ page, blocked }) => {
    await submit(page).click();
    for (const msg of ['Company name is required', 'Subdomain is required', 'Email is required', 'Phone number is required', 'Password is required']) {
      await expect(page.getByText(msg)).toBeVisible();
    }
    expect(sent(blocked)).toEqual([]);
  });

  test('TC-FORM-SIGNUP-03 an invalid email is rejected', async ({ page }) => {
    await page.getByPlaceholder('Email', { exact: true }).fill(INVALID_EMAIL);
    await submit(page).click();
    expect(await invalidFields(page)).toContain('Email');
  });

  test('TC-FORM-SIGNUP-04 known issue: Terms of Service and Privacy Policy links open real pages', async ({ page }) => {
    test.fail(true, 'Known issue: both links are href="#", and /terms/ and /privacy-policy/ return 404. Visitors are asked to agree to terms they cannot read. Fix: publish the pages and link them.');
    for (const name of ['Terms of Service', 'Privacy Policy']) {
      await expect(page.getByRole('link', { name })).not.toHaveAttribute('href', '#', { timeout: 3_000 });
    }
  });
});

test.describe('Newsletter form (footer)', () => {
  const email = (page: Page) => page.getByPlaceholder('Email address', { exact: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await email(page).scrollIntoViewIfNeeded();
  });

  test('TC-FORM-NEWS-01 an empty email is not submitted', async ({ page, blocked }) => {
    await page.getByRole('button', { name: 'Subscribe' }).click();
    expect(await email(page).evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
    expect(sent(blocked)).toEqual([]);
  });

  test('TC-FORM-NEWS-02 an invalid email is not submitted', async ({ page, blocked }) => {
    await email(page).fill(INVALID_EMAIL);
    await page.getByRole('button', { name: 'Subscribe' }).click();
    expect(await email(page).evaluate((e: HTMLInputElement) => e.validity.typeMismatch)).toBe(true);
    expect(sent(blocked)).toEqual([]);
  });
});
