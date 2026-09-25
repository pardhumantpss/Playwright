import { test, expect } from './helpers/test';
import { openApp } from './helpers/app';

// Purpose: each panel on the right-hand strip opens with its content and closes again.
// Panels are only opened and closed: nothing is submitted, marked as read or changed.

const closeX = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Close drawer' });
// The feedback box is a rich-text editor (an editable div), not a textarea.
const feedbackBox = (page: import('@playwright/test').Page) => page.locator('[contenteditable="true"]:visible').first();

test.describe('Right-hand panels', () => {
  test.beforeEach(async ({ page }) => { await openApp(page, '/leeact/projects/all-projects'); });

  test('TC-RAIL-01 profile opens User Preference with name, email, role and Logout', async ({ page, rail }) => {
    await rail.open('profile');
    await expect(page.getByText('User Preference')).toBeVisible();
    await expect(page.getByText(/@.+\(.+\)/)).toBeVisible(); // "email (Role)"
    await expect(page.getByText('Logout')).toBeVisible();
    await expect(page.getByText('UAT', { exact: true })).toBeVisible();
  });

  test('TC-RAIL-02 User Preference shows theme settings', async ({ page, rail }) => {
    await rail.open('profile');
    for (const t of ['Preferences Settings', 'Presets Brand Color', 'Custom Brand Color', 'Font Size']) await expect(page.getByText(t)).toBeVisible();
  });

  test('TC-RAIL-03 User Preference closes with ✕', async ({ page, rail }) => {
    await rail.open('profile');
    await expect(page.getByText('User Preference')).toBeVisible();
    // The profile button's "Settings" tooltip stays open over the ✕ until the pointer moves away.
    await page.mouse.move(700, 450);
    await expect(page.getByRole('tooltip', { name: 'Settings', exact: true })).toBeHidden();
    await closeX(page).click();
    await expect(page.getByText('User Preference')).toBeHidden();
  });

  test('TC-RAIL-04 notifications panel opens with its controls', async ({ page, rail }) => {
    await rail.open('notifications');
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible();
    await expect(page.getByText('Unread').first()).toBeVisible();
    await expect(page.getByText('Mark all as read')).toBeVisible();
  });

  test('TC-RAIL-05 LeeAI Assistant opens with its action groups', async ({ page, rail }) => {
    await rail.open('leeai');
    await expect(page.getByText('What would you like to do?')).toBeVisible();
    for (const g of ['CREATE & MODIFY', 'VIEW & SEARCH', 'DESTRUCTIVE ACTIONS']) await expect(page.getByText(g)).toBeVisible();
  });

  test('TC-RAIL-06 Share Feedback opens with a 500-character box and attachments', async ({ page, rail }) => {
    await rail.open('feedback');
    await expect(page.getByText('Share Your Feedback')).toBeVisible();
    await expect(page.getByText('Write your feedback here...')).toBeVisible();
    await expect(feedbackBox(page)).toBeVisible();
    await expect(page.getByText('0 / 500')).toBeVisible();
    await expect(page.getByText('Upload Files').first()).toBeVisible();
  });

  test('TC-RAIL-07 feedback character counter updates while typing', async ({ page, rail }) => {
    await rail.open('feedback');
    await feedbackBox(page).click();
    await page.keyboard.type('Playwright test - not sent');
    await expect(page.getByText('26 / 500')).toBeVisible();
    await closeX(page).click();
  });

  test('TC-RAIL-08 typing in the feedback box stops at 500 characters', async ({ page, rail }) => {
    await rail.open('feedback');
    await feedbackBox(page).click();
    await page.keyboard.type('x'.repeat(505));
    await expect(page.getByText('500 / 500')).toBeVisible();
    expect((await feedbackBox(page).innerText()).trim().length).toBe(500);
    await closeX(page).click();
  });

  test('TC-RAIL-08b known issue: pasted feedback is counted and limited to 500 characters', async ({ page, rail }) => {
    test.fail(true, 'Pasting 520 characters is accepted, the counter stays at "0 / 500", and Submit Feedback stays disabled, so pasted feedback cannot be sent. Fix: update the counter and apply the limit on paste/input events.');
    await rail.open('feedback');
    await feedbackBox(page).click();
    await page.keyboard.insertText('x'.repeat(520)); // same path as a paste
    await expect(page.getByText('500 / 500')).toBeVisible({ timeout: 5000 });
    expect((await feedbackBox(page).innerText()).trim().length).toBeLessThanOrEqual(500);
  });

  test('TC-RAIL-09 announcements panel opens', async ({ page, rail }) => {
    await rail.open('announcements');
    await expect(page.getByText('Announcements', { exact: true }).last()).toBeVisible();
  });

  test('TC-RAIL-10 theme button switches to dark mode and back', async ({ page, rail }) => {
    const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark');
    const start = await isDark();
    await rail.open('theme');
    await expect.poll(isDark).toBe(!start);
    await rail.open('theme');
    await expect.poll(isDark).toBe(start);
  });

  test('TC-RAIL-11 Apps panel says the feature is coming soon', async ({ page, rail }) => {
    await rail.open('apps');
    await expect(page.getByText('Apps functionality coming soon!')).toBeVisible();
  });

  test('TC-RAIL-12 known issue: right-hand icon buttons have accessible names', async ({ page, rail }) => {
    test.fail(true, 'Profile, notifications, feedback, announcements, theme and apps buttons have no aria-label, so screen readers announce "button". Fix: add aria-label to each.');
    await rail.button('apps'); // waits for the strip to render
    const unlabeled = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.left > window.innerWidth - 45; })
      .filter(b => !(b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText.trim())).length);
    expect(unlabeled).toBe(0);
  });
});
